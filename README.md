# Tagesplaner

Eine ruhige Seite: was jetzt dran ist, und was danach kommt.
Alles bleibt im Browser (`localStorage`, Schlüssel `tagesplaner.v2`). Kein Konto, keine Cloud.

Live: **<https://planner.micana.de>**

## Bedienung

1. **Los**
2. Unten eine Zeile schreiben und Enter. Sie dauert 30 Minuten und landet in der nächsten freien Lücke.
3. **Fertig**, wenn sie durch ist.

Eine Zeile antippen ändert den Text oder löscht sie. Was gestern offen blieb, liegt am nächsten Tag wieder da.

Hell und Dunkel folgen dem Gerät. Unteraufgaben, die schon gespeichert sind, bleiben in den Daten, werden aber nicht mehr abgefragt.

## Lokal

```bash
cd planner
python3 -m http.server 8000
```

`node tests/logic.test.js`

Nach Änderungen an den Dateien `CACHE` in `sw.js` erhöhen.

## Daten

Alte Pläne, Serien, Vorlagen und die Später-Liste bleiben beim Laden erhalten und werden nicht gelöscht. Die Oberfläche legt daraus keine neuen Tage mehr an und bietet keine Rollen, kein Raster, keinen Kalender-Export und keine Erinnerungen. `?zeit=HH:MM` setzt nur die angezeigte Uhrzeit.
