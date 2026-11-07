# Tagesplaner – visueller Tagesplan (PWA)

Ein ruhiger, visueller Tagesplaner für neurodivergente Menschen – die lokale Alternative zu Tiimo und Structured.
**Komplett lokal:** kein Backend, kein Konto, keine KI, keine Tracker, keine externen Schriften oder CDNs.
Alle Daten liegen nur im `localStorage` deines Browsers. Offline-fähig und als App installierbar.

Live: **<https://planner.micana.de>**

## Funktionen

- **Zeitleiste** mit farbigen Symbol-Bubbles an einer vertikalen Linie, Jetzt-Linie, Tagesfortschritt, Lücken zum Antippen („+ frei“).
- **Jetzt-Ansicht (Fokus):** großer Countdown-Ring, Unteraufgaben zum Abhaken, „Erledigt“, „+5 Min“, Vorschau auf den nächsten Block.
- **Übergänge:** 10 Minuten vor dem nächsten Block pulsiert dessen Symbol sanft; optional sanfter Ton, Vibration und Benachrichtigung.
- **Später (Inbox):** Gedanken ohne Uhrzeit sofort festhalten; per „Einplanen“ in die nächste freie Lücke oder (Desktop) per Drag auf die Zeitleiste. Blöcke lassen sich auch zurück in „Später“ legen.
- **Ziehen & Größe ändern:** Maus: direkt ziehen. Touch: kurz gedrückt halten **oder** sofort am Symbol ziehen; Wischen scrollt. Griff zum Verlängern (44 × 24 px) auch an 15-Minuten-Blöcken.
- **Unteraufgaben** klappen in der Zeitleiste auf und schieben die folgenden Blöcke nach unten (nichts wird verdeckt).
- **Wiederholungen** (täglich, werktags, wöchentlich) – beim Bearbeiten/Löschen: „Nur diesen Tag“ oder „Diesen und alle folgenden“.
- **Vorlagen:** 3 Rollen-Vorlagen (Entwickler, Social Media Managerin, Erzieherin/Sozial) und **eigene Vorlage** („Als meine Vorlage speichern“). Neue Tage starten wahlweise mit Rollen-Vorlage, eigener Vorlage oder leer.
- **Tag neu planen** – ohne Schuldgefühl, immer mit „Rückgängig“. Liegen gebliebene Blöcke können mit einem Tipp nach „Später“.
- **Tage & Woche:** Wochenleiste, vor/zurück, „Heute“. Vergangene Tage ohne Plan bleiben leer (es wird nichts erfunden).
- **Energie-Check-in** (optional, 5 Stufen) pro Tag.
- **Darstellung:** Hell/Dunkel/Automatisch, hoher Kontrast, Farbvariante Kühl/Warm, einstellbarer Tagesbereich (z. B. 06–20 Uhr), Raster 5/15 Min, 24-h-Zeitauswahl unabhängig von der Browsersprache.
- **Rückgängig überall** (Hinweis-Leiste oder Strg/⌘ + Z), JSON-Sicherung exportieren/importieren.
- **Barrierearm:** Tastaturbedienung, Screenreader-Ansagen, „Bewegung reduzieren“ wird respektiert.

## Bedienung (Kurzfassung)

| Aktion | So geht's |
|---|---|
| Block bearbeiten | Block antippen (Titel, Symbol, Art, Start, Dauer, Wiederholung, Unteraufgaben) |
| Neuer Block | „+“ (mobil) bzw. „Neuer Block“ – startet in der nächsten freien Lücke; oder eine Lücke antippen |
| Abhaken | Kreis rechts im Block, oder „Erledigt“ in der Jetzt-Ansicht |
| Tastatur | Block fokussieren: Enter = bearbeiten, Leertaste = erledigt, ↑/↓ = verschieben, Umschalt + ↑/↓ = Dauer, Entf = löschen, Strg/⌘ + Z = rückgängig, Esc = Jetzt-Ansicht schließen |

**Demo-Uhrzeit:** `?zeit=HH:MM` fixiert die Uhrzeit, z. B. `/?zeit=10:52`.

## Lokal starten

Service Worker brauchen `http://localhost` oder HTTPS:

```bash
cd tagesplaner
python3 -m http.server 8000
# → http://localhost:8000
```

## Deployment (GitHub Pages, planner.micana.de)

Das Repo ist bereits vorbereitet: `CNAME` (planner.micana.de), `.nojekyll`, `404.html`, nur relative Pfade, kein Build-Schritt.

1. Repo pushen (z. B. `michael-linuxdev/planner`, Branch `main`).
2. GitHub → Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.
3. DNS: `CNAME`-Eintrag `planner` → `michael-linuxdev.github.io`.
4. In den Pages-Einstellungen „Enforce HTTPS“ aktivieren (sobald das Zertifikat da ist).

**Updates:** Nach Code-Änderungen die Konstante `CACHE` in `sw.js` erhöhen. Der Service Worker liefert sofort aus dem Cache und lädt im Hintergrund nach; die neue Version ist beim nächsten Öffnen aktiv.

## Als App installieren

- **Android / Chrome / Edge:** Menü → „App installieren“ (oder in „Mehr“ → „Als App installieren“, falls angeboten).
- **iPhone / iPad (Safari):** Teilen → „Zum Home-Bildschirm“.

## Dateien

```
index.html            Oberfläche (Onboarding, Zeitleiste, Jetzt, Später, Dialoge)
styles.css            Design-Tokens, Hell/Dunkel/Kontrast, Layout mobil + Desktop
app.js                Logik: Vorlagen, Wiederholungen, Zeitleiste, Drag & Drop, Erinnerungen, Speicherung
sw.js                 Service Worker (Offline-Cache)
manifest.webmanifest  PWA-Manifest
icons/                App-Icons
CNAME, .nojekyll, 404.html   GitHub-Pages-Einrichtung
```

**Daten:** localStorage-Schlüssel `tagesplaner.v2` (Daten aus v1 werden automatisch übernommen). Pläne der letzten 90 Tage werden behalten.

## Bekannte Grenzen

- Erinnerungen/Benachrichtigungen funktionieren nur, solange die App geöffnet ist (auch im Hintergrund-Tab) – ohne Server gibt es keine Push-Nachrichten. iOS zeigt Benachrichtigungen nur bei installierter App.
- Kein Sync zwischen Geräten – zum Umziehen „Sicherung exportieren/importieren“ nutzen. Daten können verloren gehen, wenn der Browser-Speicher gelöscht wird.
- Änderungen an Wiederholungen wirken auf heute/künftige Tage, nicht rückwirkend auf bereits gespeicherte Tage.
- Aufgaben aus „Später“ per Drag einplanen geht nur am Desktop; mobil per „Einplanen“-Knopf.
- Keine Kalender-Anbindung (bewusst: keine externen Verbindungen).
