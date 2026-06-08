-- ============================================================================
--  Solar-Lead-System Österreich — Datenbankschema (PostgreSQL + PostGIS)
-- ============================================================================
--
--  Dieses Schema legst du EINMAL in deiner Supabase-Datenbank an.
--
--  So führst du es aus:
--    1. Supabase Dashboard öffnen -> dein Projekt
--    2. Linke Leiste -> "SQL Editor" -> "New query"
--    3. Den kompletten Inhalt dieser Datei reinkopieren
--    4. Auf "Run" klicken
--
--  Was passiert hier?
--    - PostGIS aktivieren (erlaubt Geo-Daten: Punkte, Flächen, Umkreissuche)
--    - Eine Tabelle "prospects" anlegen (= deine Hausbesitzer-Liste)
--    - Indizes anlegen (machen Abfragen schnell)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Erweiterungen aktivieren
-- ----------------------------------------------------------------------------
-- PostGIS = Geo-Funktionen für PostgreSQL (Koordinaten, Flächen, Distanzen).
create extension if not exists postgis;
-- gen_random_uuid() für zufällige eindeutige IDs.
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- 2) Pipeline-Status als Aufzählungstyp
-- ----------------------------------------------------------------------------
-- Jeder Interessent (prospect) durchläuft Stufen. Ein "enum" stellt sicher,
-- dass nur diese erlaubten Werte gespeichert werden können (keine Tippfehler).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'prospect_status') then
    create type prospect_status as enum (
      'sourced',        -- Adresse erfasst, noch nichts geprüft
      'enriched',       -- Solar-API + Satellitenbild geholt
      'qualified',      -- Dach ist geeignet (Süd, genug Fläche, keine Anlage)
      'disqualified',   -- Dach ungeeignet -> aussortiert
      'rendered',       -- KI-Bild mit Panels erstellt
      'site_live',      -- Microsite deployed
      'postcard_sent',  -- Postkarte verschickt
      'scanned',        -- QR-Code wurde gescannt (Microsite besucht)
      'booked',         -- Termin gebucht
      'sold',           -- Termin an Installateur verkauft
      'unsubscribed'    -- Hausbesitzer möchte keine Post mehr
    );
  end if;
end$$;


-- ----------------------------------------------------------------------------
-- 3) Haupttabelle: prospects
-- ----------------------------------------------------------------------------
create table if not exists prospects (
  -- --- Identität ---------------------------------------------------------
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique,            -- z.B. "mariahilferstrasse-12" für die Microsite-URL

  -- --- Adresse (Österreich) ---------------------------------------------
  address             text not null,          -- vollständige Adresse, wie eingegeben
  street              text,                   -- Straße
  house_number        text,                   -- Hausnummer
  zip                 text,                   -- PLZ, z.B. "1060"
  city                text default 'Wien',
  state               text,                   -- Bundesland, z.B. "Wien"
  country             text default 'AT',

  -- --- Geo-Daten (PostGIS) ----------------------------------------------
  -- "geography(Point, 4326)" speichert einen Punkt in WGS84 (GPS-Koordinaten).
  -- Damit kannst du später z.B. "alle Häuser im Umkreis von 2 km" abfragen.
  location            geography(Point, 4326),
  latitude            double precision,       -- Redundant gespeichert, weil's praktisch ist
  longitude           double precision,

  -- --- Status der Pipeline ----------------------------------------------
  status              prospect_status not null default 'sourced',

  -- --- Gebäude- & Dachdaten (aus Google Solar API) -----------------------
  building_type       text,                   -- z.B. "Einfamilienhaus"
  roof_area_m2        double precision,       -- gesamte nutzbare Dachfläche
  south_facing_area_m2 double precision,      -- Anteil der Fläche Richtung Süden
  best_roof_azimuth   double precision,       -- Ausrichtung bestes Segment (180 = exakt Süd)
  best_roof_pitch     double precision,       -- Dachneigung in Grad
  max_panel_count     integer,                -- wie viele Panels max. draufpassen
  max_array_area_m2   double precision,       -- maximale Modulfläche
  annual_sunshine_hours double precision,     -- Sonnenstunden/Jahr am besten Punkt
  yearly_energy_kwh   double precision,       -- erwartete Jahresproduktion (kWh)
  has_existing_solar  boolean default false,  -- ist schon eine Anlage drauf? (manuell/Vision)
  roof_suitable       boolean,                -- Endurteil: geeignet ja/nein
  suitability_score   integer,                -- 0–100, wie gut das Dach ist

  -- --- Wirtschaftlichkeit (ROI-Rechner-Werte) ---------------------------
  system_size_kwp     double precision,       -- empfohlene Anlagengröße in kWp
  install_cost_eur    numeric(10,2),          -- geschätzte Anlagenkosten in €
  annual_savings_eur  numeric(10,2),          -- Stromkostenersparnis pro Jahr in €
  payback_years       numeric(5,1),           -- Amortisationszeit in Jahren

  -- --- Bilder -----------------------------------------------------------
  satellite_image_url text,                   -- Google-Maps-Satellitenbild (R2-URL)
  rendered_image_url  text,                   -- KI-Bild mit Panels (R2-URL)

  -- --- Eigentümer (aus Grundbuch / Herold) ------------------------------
  owner_name          text,
  owner_source        text,                   -- "grundbuch", "herold", "confidential" ...

  -- --- Microsite & Postkarte --------------------------------------------
  microsite_url       text,
  postcard_provider   text,                   -- "post.at" o.Ä.
  postcard_sent_at    timestamptz,
  qr_scans            integer default 0,

  -- --- Rohdaten & Audit -------------------------------------------------
  -- Komplette Antwort der Solar-API als JSON aufheben — falls du später
  -- mehr Felder brauchst, musst du die API nicht erneut abfragen (spart Geld).
  solar_api_raw       jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- 4) Indizes (machen Abfragen schnell)
-- ----------------------------------------------------------------------------
-- Räumlicher Index: blitzschnelle Umkreis-/Geo-Abfragen auf "location".
create index if not exists prospects_location_gix on prospects using gist (location);
-- Häufige Filter:
create index if not exists prospects_status_idx     on prospects (status);
create index if not exists prospects_zip_idx        on prospects (zip);
create index if not exists prospects_suitable_idx   on prospects (roof_suitable);
-- Doppelte Adressen vermeiden (eine Adresse = ein prospect):
create unique index if not exists prospects_address_uniq on prospects (lower(address));


-- ----------------------------------------------------------------------------
-- 5) "updated_at" automatisch aktualisieren
-- ----------------------------------------------------------------------------
-- Kleiner Trigger, der bei jedem UPDATE das Feld updated_at auf "jetzt" setzt.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prospects_updated_at on prospects;
create trigger trg_prospects_updated_at
  before update on prospects
  for each row execute function set_updated_at();


-- ----------------------------------------------------------------------------
-- 6) Hilfsfunktion: location automatisch aus lat/lng befüllen
-- ----------------------------------------------------------------------------
-- Wenn dein Code latitude/longitude schreibt, baut dieser Trigger daraus
-- automatisch den PostGIS-Punkt "location". Du musst dich nicht drum kümmern.
create or replace function sync_location_from_latlng()
returns trigger as $$
begin
  if new.latitude is not null and new.longitude is not null then
    -- Achtung: PostGIS erwartet (Längengrad, Breitengrad) = (lng, lat)!
    new.location = ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prospects_sync_location on prospects;
create trigger trg_prospects_sync_location
  before insert or update on prospects
  for each row execute function sync_location_from_latlng();


-- ============================================================================
--  Beispiel-Abfragen (nur zur Veranschaulichung — nicht ausführen nötig)
-- ============================================================================
--
--  Alle qualifizierten Häuser in 1060 Wien:
--    select address, system_size_kwp, payback_years
--    from prospects
--    where status = 'qualified' and zip = '1060';
--
--  Alle Häuser im Umkreis von 2 km um einen Punkt (Längengrad, Breitengrad):
--    select address, ST_Distance(location, ST_MakePoint(16.36, 48.20)::geography) as meter
--    from prospects
--    where ST_DWithin(location, ST_MakePoint(16.36, 48.20)::geography, 2000)
--    order by meter;
-- ============================================================================
