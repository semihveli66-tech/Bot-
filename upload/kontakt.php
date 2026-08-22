<?php
/* ============================================================
   PHONETASTIC – Kontaktformular
   ------------------------------------------------------------
   Nimmt die Anfrage von der Website entgegen und schickt sie
   per E-Mail an den Shop. Laeuft auf jedem Hosting mit PHP
   (z. B. All-Inkl) ohne zusaetzliche Bibliothek.

   >>> HIER EINSTELLEN: <<<
   ============================================================ */

// An welche Adresse sollen die Anfragen gehen?
// Bewusst direkt das Outlook-Postfach und nicht info@phonetastic.at:
// so entfaellt der Umweg ueber die Weiterleitung und die Mail kommt
// auf dem kuerzesten Weg an. Auf der Website steht trotzdem
// info@phonetastic.at - das ist die Adresse fuer die Kunden.
$EMPFAENGER = 'phonetastic1@outlook.com';

// Absenderadresse. WICHTIG: Muss eine Adresse der EIGENEN Domain
// sein, sonst landet die Mail im Spam oder wird abgelehnt.
// Dieses Postfach im KAS unter "E-Mail" anlegen.
$ABSENDER = 'noreply@phonetastic.at';

/* ===== ab hier nichts mehr aendern ===== */

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Ungültige Anfrage.']);
    exit;
}

/** Entfernt Zeilenumbrueche, damit niemand eigene Mail-Header einschleusen kann. */
function sauber($wert, $maxLaenge = 200) {
    $wert = is_string($wert) ? $wert : '';
    $wert = str_replace(["\r", "\n", "%0a", "%0d"], ' ', $wert);
    return mb_substr(trim($wert), 0, $maxLaenge);
}

$name    = sauber($_POST['name']   ?? '', 100);
$email   = sauber($_POST['email']  ?? '', 150);
$telefon = sauber($_POST['phone']  ?? '', 50);
$geraet  = sauber($_POST['device'] ?? '', 150);
$text    = trim($_POST['message']  ?? '');
$text    = mb_substr($text, 0, 3000);

// Spam-Falle: Dieses Feld ist im Formular unsichtbar. Fuellt es
// jemand aus, war es ein Bot. Wir antworten freundlich, senden aber nichts.
if (!empty($_POST['website'])) {
    echo json_encode(['ok' => true]);
    exit;
}

$fehler = [];
if ($name === '')  $fehler[] = 'Bitte gib deinen Namen an.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $fehler[] = 'Bitte gib eine gültige E-Mail-Adresse an.';
if ($text === '')  $fehler[] = 'Bitte schreib uns kurz, worum es geht.';

if ($fehler) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => implode(' ', $fehler)]);
    exit;
}

$betreff = 'Website-Anfrage von ' . $name;

$inhalt =
    "Neue Anfrage über phonetastic.at\n" .
    str_repeat('=', 40) . "\n\n" .
    "Name:          " . $name . "\n" .
    "E-Mail:        " . $email . "\n" .
    "Telefon:       " . ($telefon !== '' ? $telefon : '-') . "\n" .
    "Gerät/Problem: " . ($geraet !== '' ? $geraet : '-') . "\n\n" .
    "Nachricht:\n" . $text . "\n\n" .
    str_repeat('-', 40) . "\n" .
    "Eingegangen am " . date('d.m.Y \u\m H:i') . " Uhr\n";

$header = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'From: PHONETASTIC Website <' . $ABSENDER . '>',
    // Nur die reine Adresse, kein Anzeigename: der Name steht im Text und
    // koennte sonst Steuerzeichen in den Header tragen.
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion()
];

$betreffKodiert = '=?UTF-8?B?' . base64_encode($betreff) . '?=';

$gesendet = @mail(
    $EMPFAENGER,
    $betreffKodiert,
    $inhalt,
    implode("\r\n", $header),
    '-f' . $ABSENDER
);

if ($gesendet) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Die Nachricht konnte gerade nicht gesendet werden. Bitte ruf uns kurz an: 0660 651 12 62'
    ]);
}
