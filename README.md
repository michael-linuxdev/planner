# Tagesplaner

Was jetzt dran ist, und der Tag als Bild.
Alles bleibt im Browser (`localStorage`, Schlüssel `tagesplaner.v2`). Kein Konto, keine Cloud.

Live: **<https://planner.micana.de>**

## Bedienung

1. **Los**
2. Oben den Tag wählen. Wischen oder die Pfeile wechseln die Woche.
3. Unten eine Zeile und Enter.
   - `einkaufen` landet frei in der nächsten Lücke.
   - `14:30 Zahnarzt` ist ein fester Termin.
   - `morgen 9:00 Arzt` oder `Montag Team` gilt für einen anderen Tag.
4. **Fertig**, wenn es durch ist.
5. Einen Block antippen: Titel, Uhrzeit, Dauer, löschen. Ziehen verschiebt ihn.

Feste Termine bleiben am Tag. Nur freie Aufgaben rutschen auf den nächsten Tag, wenn sie offen bleiben. Alte Pläne ohne dieses Kennzeichen bleiben, wo sie sind.

## Lokal

```bash
cd planner
python3 -m http.server 8000
```

`node tests/logic.test.js`

Nach Änderungen an den Dateien `CACHE` in `sw.js` erhöhen. `?zeit=HH:MM` setzt nur die angezeigte Uhrzeit.
