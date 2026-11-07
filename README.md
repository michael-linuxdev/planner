# Tagesplaner – visueller Tagesplan (PWA)

Ein ruhiger, visueller Tagesplaner für neurodivergente Menschen – die lokale Alternative zu Tiimo und Structured.
**Komplett lokal:** kein Backend, kein Konto, keine KI, keine Tracker, keine externen Schriften oder CDNs.
Alle Daten liegen nur im `localStorage` deines Browsers. Offline-fähig und als App installierbar.

Live: **<https://planner.micana.de>**

## Drei Ansichten – mehr nicht

| Ansicht | Was du siehst |
|---|---|
| **Jetzt** (Start) | Der laufende Block mit Countdown-Ring, Unteraufgaben zum Abhaken, „Erledigt“, „+5 Min“ und was als Nächstes kommt. Außerhalb geplanter Zeit: ruhiger Hinweis („Gleich geht’s los“, „Freie Zeit“, „Feierabend“). |
| **Heute** | Tag, Woche oder Monat. Tag: Zeitleiste. Der Griff zum Verschieben sitzt rechts (rechter Daumen), das Symbol links hakt ab. Unter Mehr lässt sich das für Linkshänder spiegeln. Woche: die sieben Tage mit Blöcken. Monat: Kalender mit Punkten und Anzahl. |
| **Später** | Alles ohne Uhrzeit. „Einplanen“ → im Plan auf eine Uhrzeit tippen (oder „Nächste Lücke“). |

Alles andere steckt im Menü **Mehr**: Tag abschließen, Tag neu planen, In Kalender übernehmen (.ics), Energie-Check-in, Vorlagen, Rolle, Darstellung (Hell/Dunkel, Kontrast, Farben, Tagesbereich, Raster), Erinnerungen, Sicherung.

## Bedienung

| Aktion | So geht's |
|---|---|
| Neu anlegen | Der große **+**-Knopf. Titel, Art (Fokus · Termin · Pause · Kleinkram), Dauer (5/15/30/60 Min) – Start ist automatisch die nächste freie Lücke. Uhrzeit, eigene Dauer, Wiederholung und Unteraufgaben unter „Uhrzeit & mehr“; alle 8 Arten unter „Mehr Typen“. „Später (ohne Uhrzeit)“ legt die Aufgabe in die Später-Liste. |
| Bearbeiten | Block antippen |
| Verschieben | Maus: ziehen. Touch: Symbol (Bubble) sofort ziehen oder Karte lange drücken. Wischen scrollt. Der Block folgt dem Finger stufenlos, ein gestrichelter Umriss zeigt, wo er einrastet (5 oder 15 Min). |
| Dauer ändern | Griff an der Unterkante ziehen |
| Abhaken | Kreis rechts im Block oder „Erledigt“ in Jetzt |
| Aufgabe aus Später einplanen | „Einplanen“ → Uhrzeit im Plan antippen (auf 15 Min gerundet) oder „Nächste Lücke“ |
| Tagesabschluss | Nach dem letzten Block erscheint in Heute und Jetzt: „x von y geschafft – Rest auf morgen?“ → *Auf morgen* (gleiche Uhrzeit, wenn frei), *Nach „Später“* oder *So lassen*. Jederzeit auch über Mehr → „Tag abschließen“. |
| Kalender | Mehr → „In Kalender übernehmen“: .ics für heute oder die nächsten 7 Tage, jeder Termin mit Erinnerung 10 Min vorher (VALARM). Datei öffnen → in die Kalender-App übernehmen. |
| Rückgängig | Hinweis-Leiste „Rückgängig“ oder Strg/⌘ + Z |
| Tastatur | Block fokussieren: Enter = bearbeiten, Leertaste = erledigt, ↑/↓ = verschieben, Umschalt + ↑/↓ = Dauer, Entf = löschen, Esc = Einplanen abbrechen. In Fenstern: Esc schließt, Tab bleibt im Fenster, danach kehrt der Fokus zurück. |
| Fenster schließen | ✕, Esc, Tippen daneben oder (mobil) am Kopf nach unten wischen |

**Arten:** Fokus = Deep Work, Termin = Meeting, Pause, Kleinkram = Quick/Admin. Focused, Reactive, Buffer und Flexible bleiben unter „Mehr Typen“; die Rollen-Vorlagen nutzen alle 8 Arten mit ihren Farben.

**Demo-Uhrzeit:** `?zeit=HH:MM` fixiert die Uhrzeit, z. B. `/?zeit=10:52`.

## Lokal starten

Service Worker brauchen `http://localhost` oder HTTPS:

```bash
cd tagesplaner
python3 -m http.server 8000
# → http://localhost:8000
```

## Deployment (GitHub Pages, planner.micana.de)

Statisch, kein Build-Schritt: `CNAME` (planner.micana.de), `.nojekyll`, `404.html`, nur relative Pfade.

1. Push auf `main` von `michael-linuxdev/planner`.
2. GitHub → Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.
3. DNS: `CNAME`-Eintrag `planner` → `michael-linuxdev.github.io`, danach „Enforce HTTPS“.

**Updates:** Nach Code-Änderungen die Konstante `CACHE` in `sw.js` erhöhen (aktuell `tagesplaner-v3.1.0`). Der Service Worker liefert sofort aus dem Cache und lädt im Hintergrund nach; sobald die neue Version bereit ist, erscheint „Neue Version ist bereit · Neu laden“.

## Als App installieren

- **Android / Chrome / Edge:** Menü → „App installieren“ (oder Mehr → Daten & App → „Als App installieren“, falls angeboten).
- **iPhone / iPad (Safari):** Teilen → „Zum Home-Bildschirm“.

## Dateien

```
index.html            Oberfläche (Onboarding, Jetzt, Heute, Später, Editor, Mehr)
styles.css            Design-Tokens, Hell/Dunkel/Kontrast, mobil (Leiste unten) + Desktop (Seitenleiste)
app.js                Logik: Vorlagen, Wiederholungen, Zeitleiste, Ziehen, Einplanen, Tagesabschluss, ICS, Speicherung
sw.js                 Service Worker (Offline-Cache)
manifest.webmanifest  PWA-Manifest
icons/                App-Icons
CNAME, .nojekyll, 404.html   GitHub-Pages-Einrichtung
```

**Daten:** localStorage-Schlüssel `tagesplaner.v2` (Daten aus v1/v2 werden übernommen). Pläne der letzten 90 Tage werden behalten.

## Bekannte Grenzen

- Erinnerungen (Ton, Vibration, Hinweis) gibt es nur bei geöffneter App. Verlässlich wird es über die Kalender-Datei. Gleiche Blöcke behalten ihre UID, auch wenn du die Uhrzeit änderst.
- Kein Sync zwischen Geräten – „Sicherung exportieren/importieren“ nutzen. Browser-Daten löschen = Pläne weg.
- Änderungen an Wiederholungen wirken ab dem gewählten Tag, nicht rückwirkend.
- Neue Tage am Wochenende starten ohne Arbeitsvorlage. Ein gespeicherter Wochenendtag, der noch exakt die unberührte Rollen-Vorlage ist, wird einmal geleert. Bearbeitete oder eigene Blöcke bleiben. „Auf morgen“ lässt einen Block nur aus, wenn seine Serie morgen wirklich wiederkehrt.
- Erinnerungen sind aus, bis du sie einschaltest, und kommen nur bei geöffneter App. Im Titel `14:30 Zahnarzt` setzt die Uhrzeit beim Anlegen.
- Aufgaben aus „Später“ werden per Tippen eingeplant, nicht per Ziehen.
- Sehr kurze Blöcke (unter 15 Min) zeigen nur den Titel; lange Titel werden gekürzt – der volle Titel steht im Tooltip und im Editor.
- Vibration gibt es nur auf Geräten/Browsern mit `navigator.vibrate` (z. B. Android-Chrome, nicht iOS Safari).
