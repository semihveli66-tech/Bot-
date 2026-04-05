"""
Polymarket BTC 5-Min UP/DOWN Auto-Bet Bot

Dieser Bot:
1. Überwacht den BTC-Preis in Echtzeit (Binance API)
2. Berechnet Support/Resistance Levels
3. Generiert UP/DOWN Signale basierend auf technischer Analyse
4. Platziert automatisch Bets auf Polymarket

WARNUNG: Dieses Script handelt mit echtem Geld. Benutze es auf eigene Gefahr.
"""

import os
import sys
import time
import json
import logging
import signal
from datetime import datetime, timezone
from dataclasses import dataclass, field

import requests
import numpy as np
from dotenv import load_dotenv

from py_clob_client.client import ClobClient
from py_clob_client.clob_types import MarketOrderArgs, OrderArgs

load_dotenv()

# ─── LOGGING ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("bot.log"),
    ],
)
log = logging.getLogger("polymarket-bot")

# ─── KONFIGURATION ────────────────────────────────────────────────────────────
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")
BET_SIZE = float(os.getenv("BET_SIZE", "5"))
MIN_SIGNAL_SCORE = float(os.getenv("MIN_SIGNAL_SCORE", "65"))
MARKET_CONDITION_ID = os.getenv("MARKET_CONDITION_ID", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

POLYMARKET_HOST = "https://clob.polymarket.com"
BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines"
CHAIN_ID = 137  # Polygon

# Technische Analyse Parameter
EMA_FAST = 9
EMA_SLOW = 21
RSI_PERIOD = 14
LOOKBACK_CANDLES = 50
PIVOT_STRENGTH = 2
ZONE_MERGE_PCT = 0.15
CANDLE_INTERVAL = "5m"
CHECK_INTERVAL_SECONDS = 60  # Alle 60 Sekunden prüfen


# ─── DATENSTRUKTUREN ──────────────────────────────────────────────────────────
@dataclass
class Candle:
    timestamp: float
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class Signal:
    direction: str  # "UP", "DOWN", "NEUTRAL"
    bull_score: float
    bear_score: float
    nearest_support: float
    nearest_resistance: float
    rsi: float
    ema_fast: float
    ema_slow: float
    price: float
    timestamp: datetime


@dataclass
class TradeRecord:
    timestamp: datetime
    direction: str
    price: float
    bet_size: float
    signal_score: float
    order_id: str = ""


# ─── BINANCE DATEN ────────────────────────────────────────────────────────────
def fetch_candles(symbol: str = "BTCUSDT", interval: str = CANDLE_INTERVAL,
                  limit: int = LOOKBACK_CANDLES) -> list[Candle]:
    """Holt Kerzendaten von der Binance API."""
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    resp = requests.get(BINANCE_KLINES_URL, params=params, timeout=10)
    resp.raise_for_status()
    candles = []
    for k in resp.json():
        candles.append(Candle(
            timestamp=float(k[0]),
            open=float(k[1]),
            high=float(k[2]),
            low=float(k[3]),
            close=float(k[4]),
            volume=float(k[5]),
        ))
    return candles


# ─── TECHNISCHE ANALYSE ───────────────────────────────────────────────────────
def calc_ema(data: list[float], period: int) -> list[float]:
    """Berechnet den Exponential Moving Average."""
    ema = [data[0]]
    multiplier = 2 / (period + 1)
    for price in data[1:]:
        ema.append(price * multiplier + ema[-1] * (1 - multiplier))
    return ema


def calc_rsi(data: list[float], period: int = RSI_PERIOD) -> float:
    """Berechnet den RSI."""
    if len(data) < period + 1:
        return 50.0
    deltas = np.diff(data[-(period + 1):])
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    avg_gain = np.mean(gains) if len(gains) > 0 else 0
    avg_loss = np.mean(losses) if len(losses) > 0 else 0
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def calc_macd(data: list[float]) -> tuple[float, float]:
    """Berechnet MACD und Signal Line. Gibt (macd_hist, prev_macd_hist) zurück."""
    if len(data) < 26:
        return 0.0, 0.0
    ema12 = calc_ema(data, 12)
    ema26 = calc_ema(data, 26)
    macd_line = [a - b for a, b in zip(ema12, ema26)]
    signal_line = calc_ema(macd_line, 9)
    hist = macd_line[-1] - signal_line[-1]
    prev_hist = macd_line[-2] - signal_line[-2] if len(macd_line) > 1 else 0
    return hist, prev_hist


def find_pivot_highs(candles: list[Candle], strength: int = PIVOT_STRENGTH) -> list[float]:
    """Findet Pivot Highs."""
    pivots = []
    for i in range(strength, len(candles) - strength):
        is_pivot = True
        for j in range(1, strength + 1):
            if candles[i].high <= candles[i - j].high or candles[i].high <= candles[i + j].high:
                is_pivot = False
                break
        if is_pivot:
            pivots.append(candles[i].high)
    return pivots


def find_pivot_lows(candles: list[Candle], strength: int = PIVOT_STRENGTH) -> list[float]:
    """Findet Pivot Lows."""
    pivots = []
    for i in range(strength, len(candles) - strength):
        is_pivot = True
        for j in range(1, strength + 1):
            if candles[i].low >= candles[i - j].low or candles[i].low >= candles[i + j].low:
                is_pivot = False
                break
        if is_pivot:
            pivots.append(candles[i].low)
    return pivots


def merge_levels(levels: list[float], threshold_pct: float = ZONE_MERGE_PCT) -> list[float]:
    """Zusammenführung naher Levels."""
    if not levels:
        return []
    sorted_levels = sorted(levels)
    merged = [sorted_levels[0]]
    for level in sorted_levels[1:]:
        if abs(level - merged[-1]) / merged[-1] * 100 < threshold_pct:
            merged[-1] = (merged[-1] + level) / 2
        else:
            merged.append(level)
    return merged


def find_nearest_support(levels: list[float], price: float) -> float:
    """Findet das nächste Support-Level unter dem aktuellen Preis."""
    below = [l for l in levels if l < price]
    return max(below) if below else 0.0


def find_nearest_resistance(levels: list[float], price: float) -> float:
    """Findet das nächste Resistance-Level über dem aktuellen Preis."""
    above = [l for l in levels if l > price]
    return min(above) if above else 0.0


# ─── SIGNAL-GENERATOR ─────────────────────────────────────────────────────────
def generate_signal(candles: list[Candle]) -> Signal:
    """Analysiert Kerzen und generiert ein UP/DOWN Signal."""
    closes = [c.close for c in candles]
    price = closes[-1]

    # EMAs
    ema_fast_vals = calc_ema(closes, EMA_FAST)
    ema_slow_vals = calc_ema(closes, EMA_SLOW)
    ema_f = ema_fast_vals[-1]
    ema_s = ema_slow_vals[-1]

    # RSI
    rsi = calc_rsi(closes)

    # MACD
    macd_hist, prev_macd_hist = calc_macd(closes)

    # Support/Resistance
    pivot_highs = find_pivot_highs(candles)
    pivot_lows = find_pivot_lows(candles)
    resistance_levels = merge_levels(pivot_highs)
    support_levels = merge_levels(pivot_lows)
    nearest_res = find_nearest_resistance(resistance_levels, price)
    nearest_sup = find_nearest_support(support_levels, price)

    # Distanzen
    dist_to_res = (nearest_res - price) / price * 100 if nearest_res > 0 else 999
    dist_to_sup = (price - nearest_sup) / price * 100 if nearest_sup > 0 else 999

    # Volumen
    volumes = [c.volume for c in candles]
    avg_vol = np.mean(volumes[-20:]) if len(volumes) >= 20 else np.mean(volumes)
    vol_ratio = volumes[-1] / avg_vol if avg_vol > 0 else 1.0
    high_volume = vol_ratio > 1.5

    # ─── BULL SCORE ────────────────────────────────────────────────────
    bull = 0.0
    bull += 15.0 if price > ema_f else 0.0
    bull += 15.0 if ema_f > ema_s else 0.0
    bull += 15.0 if 50 < rsi < 70 else 0.0
    bull += 10.0 if macd_hist > 0 else 0.0
    bull += 10.0 if macd_hist > prev_macd_hist else 0.0
    bull += 15.0 if dist_to_sup < 0.1 else 0.0  # Nahe Support = Bounce
    bull += 10.0 if dist_to_res > 0.3 else 0.0  # Weit von Resistance
    bull += 10.0 if high_volume and candles[-1].close > candles[-1].open else 0.0

    # ─── BEAR SCORE ────────────────────────────────────────────────────
    bear = 0.0
    bear += 15.0 if price < ema_f else 0.0
    bear += 15.0 if ema_f < ema_s else 0.0
    bear += 15.0 if 30 < rsi < 50 else 0.0
    bear += 10.0 if macd_hist < 0 else 0.0
    bear += 10.0 if macd_hist < prev_macd_hist else 0.0
    bear += 15.0 if dist_to_res < 0.1 else 0.0  # Nahe Resistance = Abprall
    bear += 10.0 if dist_to_sup > 0.3 else 0.0  # Weit von Support
    bear += 10.0 if high_volume and candles[-1].close < candles[-1].open else 0.0

    # Signal
    if bull >= MIN_SIGNAL_SCORE and bull > bear:
        direction = "UP"
    elif bear >= MIN_SIGNAL_SCORE and bear > bull:
        direction = "DOWN"
    else:
        direction = "NEUTRAL"

    return Signal(
        direction=direction,
        bull_score=bull,
        bear_score=bear,
        nearest_support=nearest_sup,
        nearest_resistance=nearest_res,
        rsi=rsi,
        ema_fast=ema_f,
        ema_slow=ema_s,
        price=price,
        timestamp=datetime.now(timezone.utc),
    )


# ─── POLYMARKET CLIENT ─────────────────────────────────────────────────────────
class PolymarketTrader:
    def __init__(self):
        self.client = None
        self.market_info = None
        self.yes_token_id = None
        self.no_token_id = None
        self.trade_history: list[TradeRecord] = []

    def connect(self):
        """Verbindet mit Polymarket."""
        if not PRIVATE_KEY:
            log.error("PRIVATE_KEY nicht gesetzt! Setze ihn in der .env Datei.")
            sys.exit(1)

        self.client = ClobClient(
            POLYMARKET_HOST,
            key=PRIVATE_KEY,
            chain_id=CHAIN_ID,
            signature_type=0,
        )
        creds = self.client.create_or_derive_api_creds()
        self.client.set_api_creds(creds)
        log.info("Polymarket verbunden.")

    def find_btc_market(self):
        """Sucht den BTC 5-min Up/Down Market."""
        if MARKET_CONDITION_ID:
            log.info(f"Verwende konfigurierte Market ID: {MARKET_CONDITION_ID}")
            market = self.client.get_market(MARKET_CONDITION_ID)
            self._parse_market(market)
            return

        log.info("Suche nach BTC Markets auf Polymarket...")
        markets = self.client.get_markets()
        btc_markets = []
        for m in markets:
            desc = (m.get("question", "") + m.get("description", "")).lower()
            if "bitcoin" in desc or "btc" in desc:
                btc_markets.append(m)
                log.info(f"  Gefunden: {m.get('question', 'N/A')} | ID: {m.get('condition_id', '')}")

        if not btc_markets:
            log.warning("Keine BTC Markets gefunden. Setze MARKET_CONDITION_ID manuell in .env")
            return

        # Versuche 5-min Market zu finden
        for m in btc_markets:
            desc = (m.get("question", "") + m.get("description", "")).lower()
            if "5" in desc and ("min" in desc or "minute" in desc):
                self._parse_market(m)
                log.info(f"5-Min Market gefunden: {m.get('question', '')}")
                return

        log.info("Kein spezifischer 5-min Market gefunden. Verfügbare BTC Markets oben gelistet.")
        log.info("Setze MARKET_CONDITION_ID in .env auf den gewünschten Market.")

    def _parse_market(self, market: dict):
        """Extrahiert Token IDs aus einem Market."""
        self.market_info = market
        tokens = market.get("tokens", [])
        for token in tokens:
            outcome = token.get("outcome", "").upper()
            if outcome == "YES":
                self.yes_token_id = token.get("token_id")
            elif outcome == "NO":
                self.no_token_id = token.get("token_id")
        log.info(f"YES Token: {self.yes_token_id}")
        log.info(f"NO Token: {self.no_token_id}")

    def place_bet(self, direction: str, signal: Signal) -> str | None:
        """Platziert einen Bet auf Polymarket."""
        if not self.client:
            log.error("Nicht mit Polymarket verbunden!")
            return None

        # UP = BUY YES, DOWN = BUY NO
        if direction == "UP":
            token_id = self.yes_token_id
            side_label = "YES (UP)"
        elif direction == "DOWN":
            token_id = self.no_token_id
            side_label = "NO (DOWN)"
        else:
            log.info("Signal ist NEUTRAL - kein Bet.")
            return None

        if not token_id:
            log.error(f"Token ID für {side_label} nicht gefunden!")
            return None

        try:
            log.info(f"Platziere {side_label} Bet: ${BET_SIZE} @ BTC {signal.price:.0f}")

            order = self.client.create_market_order(MarketOrderArgs(
                token_id=token_id,
                amount=BET_SIZE,
            ))

            order_id = order.get("orderID", order.get("id", "unknown"))
            log.info(f"Bet platziert! Order ID: {order_id}")

            trade = TradeRecord(
                timestamp=datetime.now(timezone.utc),
                direction=direction,
                price=signal.price,
                bet_size=BET_SIZE,
                signal_score=signal.bull_score if direction == "UP" else signal.bear_score,
                order_id=str(order_id),
            )
            self.trade_history.append(trade)
            self._save_trade_log(trade)
            self._send_telegram(
                f"{'🟢' if direction == 'UP' else '🔴'} BTC {direction} Bet\n"
                f"Preis: ${signal.price:,.0f}\n"
                f"Score: {trade.signal_score:.0f}/100\n"
                f"Bet: ${BET_SIZE}\n"
                f"RSI: {signal.rsi:.1f} | EMA: {'Bull' if signal.ema_fast > signal.ema_slow else 'Bear'}"
            )
            return str(order_id)

        except Exception as e:
            log.error(f"Fehler beim Bet: {e}")
            self._send_telegram(f"⚠️ Bet Fehler: {e}")
            return None

    def _save_trade_log(self, trade: TradeRecord):
        """Speichert Trade in JSON-Log."""
        log_file = "trades.json"
        trades = []
        if os.path.exists(log_file):
            with open(log_file) as f:
                trades = json.load(f)
        trades.append({
            "timestamp": trade.timestamp.isoformat(),
            "direction": trade.direction,
            "price": trade.price,
            "bet_size": trade.bet_size,
            "signal_score": trade.signal_score,
            "order_id": trade.order_id,
        })
        with open(log_file, "w") as f:
            json.dump(trades, f, indent=2)

    def _send_telegram(self, message: str):
        """Sendet Telegram-Benachrichtigung (optional)."""
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
            return
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            requests.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML",
            }, timeout=5)
        except Exception as e:
            log.warning(f"Telegram Fehler: {e}")


# ─── MAIN BOT LOOP ────────────────────────────────────────────────────────────
class Bot:
    def __init__(self):
        self.trader = PolymarketTrader()
        self.running = True
        self.last_signal_direction = "NEUTRAL"
        self.trades_today = 0
        self.max_trades_per_day = 50  # Sicherheitslimit

    def start(self):
        """Startet den Bot."""
        log.info("=" * 60)
        log.info("  Polymarket BTC 5-Min UP/DOWN Bot")
        log.info("=" * 60)
        log.info(f"  Bet-Größe:       ${BET_SIZE}")
        log.info(f"  Min Signal Score: {MIN_SIGNAL_SCORE}")
        log.info(f"  Check Intervall:  {CHECK_INTERVAL_SECONDS}s")
        log.info(f"  Max Trades/Tag:   {self.max_trades_per_day}")
        log.info("=" * 60)

        # Verbinde mit Polymarket
        self.trader.connect()
        self.trader.find_btc_market()

        if not self.trader.yes_token_id or not self.trader.no_token_id:
            log.error("Market Token IDs nicht gefunden. Setze MARKET_CONDITION_ID in .env")
            log.info("Bot läuft im Signal-Only Modus (keine Bets).")

        # Graceful Shutdown
        signal.signal(signal.SIGINT, self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

        log.info("Bot gestartet. Drücke Ctrl+C zum Stoppen.\n")
        self._run_loop()

    def _run_loop(self):
        """Hauptschleife."""
        while self.running:
            try:
                # 1. Daten holen
                candles = fetch_candles()
                if len(candles) < LOOKBACK_CANDLES:
                    log.warning(f"Nur {len(candles)} Kerzen erhalten, brauche {LOOKBACK_CANDLES}")
                    time.sleep(CHECK_INTERVAL_SECONDS)
                    continue

                # 2. Signal berechnen
                sig = generate_signal(candles)

                # 3. Log
                log.info(
                    f"BTC ${sig.price:,.0f} | "
                    f"Signal: {sig.direction} | "
                    f"Bull: {sig.bull_score:.0f} Bear: {sig.bear_score:.0f} | "
                    f"RSI: {sig.rsi:.1f} | "
                    f"S: ${sig.nearest_support:,.0f} R: ${sig.nearest_resistance:,.0f}"
                )

                # 4. Trade-Logik
                if sig.direction != "NEUTRAL" and sig.direction != self.last_signal_direction:
                    if self.trades_today >= self.max_trades_per_day:
                        log.warning("Tägliches Trade-Limit erreicht!")
                    elif self.trader.yes_token_id and self.trader.no_token_id:
                        self.trader.place_bet(sig.direction, sig)
                        self.trades_today += 1

                self.last_signal_direction = sig.direction

                # 5. Tägliches Reset um Mitternacht UTC
                now = datetime.now(timezone.utc)
                if now.hour == 0 and now.minute == 0:
                    self.trades_today = 0

            except requests.RequestException as e:
                log.error(f"Netzwerk-Fehler: {e}")
            except Exception as e:
                log.error(f"Unerwarteter Fehler: {e}", exc_info=True)

            time.sleep(CHECK_INTERVAL_SECONDS)

    def _shutdown(self, *_):
        """Graceful Shutdown."""
        log.info("\nBot wird gestoppt...")
        self.running = False


# ─── ENTRY POINT ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    bot = Bot()
    bot.start()
