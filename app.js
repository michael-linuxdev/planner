/* Tagesplaner v2 – visueller Tagesplan, komplett lokal (localStorage), offline (Service Worker).
 * Vanilla JS, kein Build-Schritt, keine externen Anfragen. */
'use strict';

(function () {
  // ==================================================================
  // Konstanten
  // ==================================================================
  const PPM = 3;                 // Pixel pro Minute (15 Min = 45 px)
  const TRANSITION_MIN = 10;     // sanfter Übergang / Erinnerung vor dem nächsten Block
  const LONG_PRESS_MS = 300;
  const KEY = 'tagesplaner.v2';
  const OLD_KEY = 'tagesplaner.v1';
  const KEEP_PAST_DAYS = 90;
  const BUBBLE = 56;             // Breite der Symbolspalte (Bubble + Abstand)

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ==================================================================
  // Icons (Inline-SVG, einheitliche Strich-Icons)
  // ==================================================================
  const ICONS = {
    // Block-Arten
    deep: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="2.5" y="14" width="5" height="7" rx="2"/><rect x="16.5" y="14" width="5" height="7" rx="2"/>',
    focused: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    reactive: '<path d="M21 12a8.5 8.5 0 0 1-12.3 7.6L3.5 21l1.4-4.8A8.5 8.5 0 1 1 21 12z"/><path d="M12.5 8l-2 4h3l-2 4"/>',
    meeting: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.1A5 5 0 0 1 21.5 19"/>',
    pause: '<path d="M4 9h13v4.5a6.5 6.5 0 0 1-6.5 6.5A6.5 6.5 0 0 1 4 13.5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H16.6"/><path d="M8 3.5v2.5M12.5 3.5v2.5"/>',
    buffer: '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 4.5 5 6 5 9s-5 4.5-5 9"/><path d="M17 3c0 4.5-5 6-5 9s5 4.5 5 9"/>',
    quick: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>',
    flexible: '<path d="M2.5 12c2.4-5 5.1-5 7.5 0s5.1 5 7.5 0c1-2.1 2.4-3.2 4-3.2"/>',
    // Auswählbare Symbole
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    laptop: '<rect x="4.5" y="5" width="15" height="10.5" rx="1.5"/><path d="M2.5 19h19"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    phone: '<path d="M5 3.5h3.2l1.6 4.2-2 1.3a11 11 0 0 0 7.2 7.2l1.3-2 4.2 1.6V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5z"/>',
    book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>',
    pen: '<path d="M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M14 7l3 3"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    food: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10"/><path d="M17 21V3c-2.2 1.2-3.5 3.6-3.5 7v3H17"/>',
    walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M9.5 21l2.2-6.2 2.8 2.7V21M8 11.5l3.5-3.7 3 2.7 2.8.9M11.7 14.8l-.6-5"/>',
    sport: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    car: '<path d="M5 16.5V12l2-5h10l2 5v4.5"/><path d="M3.5 12h17v4.5h-17z"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="16.5" cy="18.5" r="1.5"/>',
    cart: '<path d="M3 4h2.5l2 11h10.5l2-8H7"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    sprout: '<path d="M12 21v-8"/><path d="M12 13c0-4.2 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5z"/><path d="M12 15.5c0-3.3-2.6-5.5-6.5-5.5 0 3.3 2.6 5.5 6.5 5.5z"/>',
    pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>',
    bed: '<path d="M3 18V6M3 13h18v5M21 13v-1.5A2.5 2.5 0 0 0 18.5 9H11v4"/><circle cx="7" cy="10.5" r="1.8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" stroke-width="2"/>',
    child: '<circle cx="12" cy="5.5" r="2.5"/><path d="M12 9v6M7.5 11l4.5-2 4.5 2M9.5 21l2.5-6 2.5 6"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    // Rollen
    roleDev: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    roleSocial: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 15s-3.2-1.9-3.2-4a1.7 1.7 0 0 1 3.2-.8 1.7 1.7 0 0 1 3.2.8c0 2.1-3.2 4-3.2 4z"/>',
    roleCare: '<path d="M12 21v-8"/><path d="M12 13c0-4.2 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5z"/><path d="M12 15.5c0-3.3-2.6-5.5-6.5-5.5 0 3.3 2.6 5.5 6.5 5.5z"/>',
    // Oberfläche
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20.5V16h-4.5"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12.5A1.6 1.6 0 0 0 8.6 21h6.8a1.6 1.6 0 0 0 1.6-1.5L18 7"/><path d="M9.5 7V4.5h5V7"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevronL: '<path d="M15 6l-6 6 6 6"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
    inbox: '<path d="M3.5 13.5l2.5-8h12l2.5 8V19h-17z"/><path d="M3.5 13.5H9l1 2h4l1-2h5.5"/>',
    focus: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plan: '<path d="M6 4v16"/><circle cx="6" cy="7" r="2" fill="currentColor"/><circle cx="6" cy="16" r="2" fill="currentColor"/><path d="M11 7h9M11 16h6"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    offline: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a4.8 4.8 0 0 1 6.4 0"/><circle cx="12" cy="19.3" r="1" fill="currentColor"/>',
    grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>'
  };
  const PICKABLE = ['deep', 'focused', 'reactive', 'meeting', 'pause', 'buffer', 'quick', 'flexible',
    'code', 'laptop', 'mail', 'phone', 'book', 'pen', 'chart', 'camera', 'calendar', 'food', 'walk', 'sport',
    'heart', 'home', 'car', 'cart', 'music', 'sprout', 'pill', 'bed', 'sun', 'moon', 'star', 'smile', 'child', 'bell'];

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || ICONS.flexible) + '</svg>';
  }
  function batteryIcon(level) {
    let bars = '';
    for (let i = 0; i < level; i++) bars += '<rect x="' + (4.5 + i * 3) + '" y="9" width="2" height="6" rx=".6" fill="currentColor" stroke="none"/>';
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M21.5 10.5v3"/>' + bars + '</svg>';
  }

  // ==================================================================
  // Block-Arten (Farben in styles.css unter .t-<art>)
  // ==================================================================
  const TYPES = {
    deep:     { label: 'Deep Work',     hint: 'Tiefe Konzentration, keine Unterbrechungen' },
    focused:  { label: 'Focused',       hint: 'Konzentriert, aber leichter' },
    reactive: { label: 'Reactive',      hint: 'Auf Anfragen und Nachrichten reagieren' },
    meeting:  { label: 'Meeting',       hint: 'Termin mit anderen' },
    pause:    { label: 'Pause',         hint: 'Erholen, essen, bewegen' },
    buffer:   { label: 'Buffer',        hint: 'Luft für Übergänge und Unerwartetes' },
    quick:    { label: 'Quick / Admin', hint: 'Kleine, schnelle Aufgaben' },
    flexible: { label: 'Flexible',      hint: 'Frei einteilbar' }
  };
  const TYPE_ORDER = Object.keys(TYPES);
  const FOCUS_TYPES = ['deep', 'focused'];

  // ==================================================================
  // Rollen + Vorlagen  [Start, Dauer, Art, Titel, Unteraufgaben, Symbol]
  // palette: 'cool' = erste Farbe der Vorgabe, 'warm' = zweite Farbe
  // ==================================================================
  const ROLES = {
    dev: {
      name: 'Entwickler', icon: 'roleDev', palette: 'cool',
      desc: 'Lange Fokuszeiten für Code, feste Meeting-Inseln, Puffer gegen Kontextwechsel.',
      template: [
        ['08:00', 15, 'quick', 'Ankommen & Tagesüberblick', ['Kalender ansehen', 'Top 3 für heute festlegen'], 'sun'],
        ['08:15', 15, 'reactive', 'Chat & Mails sichten', ['Nur sichten, nicht alles beantworten'], 'mail'],
        ['08:30', 15, 'meeting', 'Daily Stand-up', []],
        ['08:45', 15, 'buffer', 'Puffer', []],
        ['09:00', 120, 'deep', 'Feature entwickeln', ['Ticket & Akzeptanzkriterien lesen', 'Tests schreiben', 'Implementieren', 'Self-Review & Commit'], 'code'],
        ['11:00', 15, 'pause', 'Bewegungspause', ['Aufstehen, Wasser trinken'], 'walk'],
        ['11:15', 45, 'focused', 'Code Reviews', ['Offene Pull Requests prüfen', 'Feedback geben']],
        ['12:00', 45, 'pause', 'Mittagspause', [], 'food'],
        ['12:45', 15, 'buffer', 'Wieder ankommen', []],
        ['13:00', 45, 'reactive', 'Bugs & Support-Anfragen', ['Tickets priorisieren', 'Kurz antworten']],
        ['13:45', 45, 'meeting', 'Refinement / Planung', []],
        ['14:30', 15, 'pause', 'Kurze Pause', []],
        ['14:45', 90, 'deep', 'Deep Work II: Refactoring', ['Bereich auswählen', 'Schrittweise umbauen', 'Tests grün?'], 'code'],
        ['16:15', 15, 'buffer', 'Puffer', []],
        ['16:30', 45, 'flexible', 'Lernen / Dokumentation', ['README ergänzen'], 'book'],
        ['17:15', 30, 'quick', 'Admin: Zeiterfassung & Tickets', ['Zeiten buchen', 'Ticketstatus aktualisieren']],
        ['17:45', 15, 'quick', 'Tagesabschluss', ['Notizen für morgen', 'Rechner zuklappen'], 'moon']
      ]
    },
    social: {
      name: 'Social Media Managerin', icon: 'roleSocial', palette: 'warm',
      desc: 'Kreativzeit für Content, feste Community-Fenster statt ständigem Checken.',
      template: [
        ['08:00', 30, 'reactive', 'Community-Check: Kommentare & DMs', ['Dringendes beantworten', 'Rest markieren']],
        ['08:30', 15, 'quick', 'Analytics-Snapshot', ['Reichweite von gestern notieren'], 'chart'],
        ['08:45', 15, 'meeting', 'Team-Check-in', []],
        ['09:00', 90, 'deep', 'Content erstellen', ['Reel-Skript schreiben', 'Grafiken gestalten', 'Captions & Hashtags'], 'camera'],
        ['10:30', 15, 'pause', 'Pause', ['Bildschirm weg, kurz raus']],
        ['10:45', 45, 'focused', 'Redaktionsplan pflegen', ['Nächste Woche füllen', 'Themen abstimmen'], 'calendar'],
        ['11:30', 30, 'reactive', 'Community Management', []],
        ['12:00', 45, 'pause', 'Mittagspause', [], 'food'],
        ['12:45', 15, 'buffer', 'Puffer', []],
        ['13:00', 45, 'meeting', 'Abstimmung Kunde / Marketing', ['Freigaben einholen'], 'phone'],
        ['13:45', 15, 'buffer', 'Notizen sortieren', []],
        ['14:00', 60, 'focused', 'Posts einplanen', ['Instagram', 'LinkedIn', 'TikTok']],
        ['15:00', 30, 'reactive', 'Kommentare & Trends', []],
        ['15:30', 15, 'pause', 'Kurze Pause', []],
        ['15:45', 60, 'flexible', 'Trend-Recherche & Ideen', ['Ideen-Board ergänzen'], 'star'],
        ['16:45', 45, 'quick', 'Reporting & Admin', ['Wochenzahlen eintragen', 'Mails'], 'chart'],
        ['17:30', 30, 'reactive', 'Letzter Check & Abschluss', ['Morgen vorbereiten']]
      ]
    },
    care: {
      name: 'Erzieherin / Sozial', icon: 'roleCare', palette: 'cool',
      desc: 'Struktur für Gruppenalltag, Übergänge und Dokumentation – mit echten Pausen.',
      template: [
        ['08:00', 15, 'buffer', 'Ankommen & Raum vorbereiten', []],
        ['08:15', 45, 'reactive', 'Bringzeit: Kinder begrüßen', ['Kurze Übergaben mit Eltern', 'Besonderheiten notieren'], 'child'],
        ['09:00', 15, 'meeting', 'Morgenkreis', [], 'smile'],
        ['09:15', 75, 'focused', 'Angebot / Projektarbeit', ['Material bereitlegen', 'Kleingruppe A', 'Kleingruppe B'], 'pen'],
        ['10:30', 30, 'flexible', 'Freispiel begleiten', []],
        ['11:00', 45, 'focused', 'Draußen & Bewegung', ['Wetterkleidung prüfen'], 'sun'],
        ['11:45', 45, 'reactive', 'Mittagessen begleiten', [], 'food'],
        ['12:30', 30, 'pause', 'Eigene Pause', ['Wirklich raus aus der Gruppe']],
        ['13:00', 60, 'deep', 'Dokumentation & Beobachtungen', ['Beobachtungsbögen', 'Portfolio-Einträge', 'Entwicklungsbericht'], 'pen'],
        ['14:00', 15, 'buffer', 'Puffer', []],
        ['14:15', 45, 'reactive', 'Abholzeit & Elternkontakt', [], 'child'],
        ['15:00', 15, 'pause', 'Kurze Pause', []],
        ['15:15', 60, 'meeting', 'Teamsitzung / Fallbesprechung', ['Fälle vorbereiten']],
        ['16:15', 30, 'quick', 'Admin: Listen, Mails, Bestellungen', [], 'mail'],
        ['16:45', 45, 'flexible', 'Elterngespräch vorbereiten', ['Notizen sammeln', 'Termin bestätigen'], 'phone'],
        ['17:30', 30, 'quick', 'Tagesabschluss & Übergabe', ['Übergabebuch', 'Raum aufräumen'], 'moon']
      ]
    }
  };

  const ENERGY = [
    { v: 1, label: 'Sehr niedrig', tip: 'Sanfter Tag: Nimm dir nur das Wichtigste vor. Mehr Puffer und Pausen sind heute genau richtig.' },
    { v: 2, label: 'Niedrig', tip: 'Plane heute etwas mehr Luft ein. Deep-Work-Blöcke dürfen kürzer sein.' },
    { v: 3, label: 'Mittel', tip: 'Ein normaler Tag. Pausen trotzdem ernst nehmen.' },
    { v: 4, label: 'Gut', tip: 'Gute Energie – nutze sie für deine Fokus-Blöcke.' },
    { v: 5, label: 'Voll', tip: 'Viel Energie! Achte darauf, dich nicht zu überplanen.' }
  ];

  // ==================================================================
  // Helfer
  // ==================================================================
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (m) => { m = Math.max(0, Math.floor(m)); return pad(Math.floor(m / 60) % 25) + ':' + pad(m % 60); };
  const parseTime = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const durText = (d) => {
    d = Math.round(d);
    if (d < 60) return d + ' Min';
    const h = Math.floor(d / 60), m = d % 60;
    return m ? h + ' Std ' + m + ' Min' : h + ' Std';
  };
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = () => matchMedia('(min-width: 1000px)').matches;

  // Demo-Zeit: ?zeit=10:25 fixiert die Uhrzeit
  const demoMin = parseTime(new URLSearchParams(location.search).get('zeit'));
  function now() {
    const d = new Date();
    if (demoMin !== null) d.setHours(Math.floor(demoMin / 60), demoMin % 60, 0, 0);
    return d;
  }
  const nowMin = () => { const d = now(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
  const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayKey = () => dayKey(now());
  const keyToDate = (k) => { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); };
  const weekday = (k) => keyToDate(k).getDay(); // 0 = So
  const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const dateLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateShort = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });

  // ==================================================================
  // Zustand
  // ==================================================================
  function defaults() {
    return {
      version: 2, role: null, palette: 'auto', theme: 'auto', contrast: false, snap: 5,
      dayStart: 8 * 60, dayEnd: 18 * 60, newDay: 'role', custom: null,
      recurring: [], inbox: [], days: {},
      reminders: { sound: false, vibrate: true, notify: false },
      tipsSeen: false
    };
  }

  function normBlock(b) {
    const o = {
      id: typeof b.id === 'string' ? b.id : uid(),
      title: String(b.title || '').slice(0, 80),
      type: TYPES[b.type] ? b.type : 'flexible',
      icon: ICONS[b.icon] && PICKABLE.includes(b.icon) ? b.icon : null,
      start: Math.round(Number(b.start) || 0),
      dur: clamp(Math.round(Number(b.dur) || 30), 5, 24 * 60),
      subtasks: Array.isArray(b.subtasks) ? b.subtasks.filter((s) => s && s.text).map((s) => ({ id: s.id || uid(), text: String(s.text).slice(0, 80), done: !!s.done })) : [],
      done: !!b.done
    };
    o.start = clamp(o.start, 0, 24 * 60 - o.dur);
    if (!o.title) o.title = TYPES[o.type].label;
    if (b.recurId) o.recurId = String(b.recurId);
    return o;
  }

  function sanitize(s) {
    const st = Object.assign(defaults(), s);
    if (st.role && !ROLES[st.role]) st.role = null;
    if (![5, 15].includes(st.snap)) st.snap = 5;
    if (!['auto', 'cool', 'warm'].includes(st.palette)) st.palette = 'auto';
    if (!['auto', 'light', 'dark'].includes(st.theme)) st.theme = 'auto';
    if (!['role', 'custom', 'empty'].includes(st.newDay)) st.newDay = 'role';
    st.dayStart = clamp(Math.round(st.dayStart / 60) * 60, 0, 22 * 60);
    st.dayEnd = clamp(Math.round(st.dayEnd / 60) * 60, st.dayStart + 120, 24 * 60);
    st.reminders = Object.assign(defaults().reminders, st.reminders || {});
    st.inbox = Array.isArray(st.inbox) ? st.inbox.map(normBlock) : [];
    st.custom = Array.isArray(st.custom) ? st.custom.map(normBlock) : null;
    st.recurring = Array.isArray(st.recurring) ? st.recurring.filter((r) => r && r.id && ['daily', 'weekdays', 'weekly'].includes(r.rule)).map((r) => Object.assign(normBlock(r), { id: r.id, rule: r.rule, weekday: Number(r.weekday) || 0, from: String(r.from), until: r.until ? String(r.until) : null })) : [];
    const days = {};
    Object.keys(st.days || {}).forEach((k) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      const d = st.days[k] || {};
      days[k] = { blocks: Array.isArray(d.blocks) ? d.blocks.map(normBlock) : [], energy: [1, 2, 3, 4, 5].includes(d.energy) ? d.energy : null };
    });
    st.days = days;
    st.version = 2;
    return st;
  }

  function fromV1(old) {
    return { role: old.role, palette: old.palette, snap: old.snap, days: old.days || {} };
  }

  function load() {
    try {
      let s = JSON.parse(localStorage.getItem(KEY));
      if (!s) {
        const old = JSON.parse(localStorage.getItem(OLD_KEY));
        if (old && old.version === 1) s = fromV1(old);
      }
      if (s) return sanitize(s);
    } catch (e) { /* kaputte Daten -> neu starten */ }
    return defaults();
  }

  let state = load();
  let viewKey = todayKey();
  const drafts = {};          // erzeugte, noch nicht gespeicherte Tage (Zukunft)
  const openIds = new Set();  // aufgeklappte Unteraufgaben (nur Ansicht)
  let tab = 'plan';

  function save() {
    const cutoff = addDays(todayKey(), -KEEP_PAST_DAYS);
    Object.keys(state.days).forEach((k) => { if (k < cutoff) delete state.days[k]; });
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      toast('Speichern nicht möglich – der Browser-Speicher ist voll oder gesperrt.');
    }
  }

  // ---------- Vorlagen & Wiederholungen ----------
  function fromTemplate(roleId) {
    return ROLES[roleId].template.map(([t, dur, type, title, subs, ic]) => normBlock({
      title, type, start: parseTime(t), dur, icon: ic || null,
      subtasks: (subs || []).map((text) => ({ text }))
    }));
  }
  function freshCopy(b) {
    const c = clone(b);
    c.id = uid(); c.done = false;
    c.subtasks = c.subtasks.map((s) => ({ id: uid(), text: s.text, done: false }));
    return c;
  }
  function baseBlocks(source) {
    if (source === 'empty') return [];
    if (source === 'custom' && state.custom && state.custom.length) return state.custom.map(freshCopy);
    return state.role ? fromTemplate(state.role) : [];
  }
  function ruleMatches(r, k) {
    if (k < r.from) return false;
    if (r.until && k > r.until) return false;
    const wd = weekday(k);
    if (r.rule === 'daily') return true;
    if (r.rule === 'weekdays') return wd >= 1 && wd <= 5;
    return wd === r.weekday;
  }
  function recurringFor(k) {
    return state.recurring.filter((r) => ruleMatches(r, k)).map((r) => {
      const b = freshCopy(r);
      delete b.rule; delete b.weekday; delete b.from; delete b.until;
      b.recurId = r.id;
      return normBlock(b);
    });
  }
  function generateDay(k, source) {
    if (k < todayKey()) return { blocks: [], energy: null };
    return { blocks: baseBlocks(source || state.newDay).concat(recurringFor(k)), energy: null };
  }
  function getDay(k) {
    if (state.days[k]) return state.days[k];
    if (!drafts[k]) drafts[k] = generateDay(k);
    return drafts[k];
  }
  function materialize(k) {
    if (!state.days[k]) { state.days[k] = getDay(k); delete drafts[k]; }
    return state.days[k];
  }
  function clearDrafts() { Object.keys(drafts).forEach((k) => delete drafts[k]); }
  const viewDay = () => getDay(viewKey);
  const findBlock = (id, k = viewKey) => getDay(k).blocks.find((b) => b.id === id);
  const isToday = () => viewKey === todayKey();
  const isPastDay = () => viewKey < todayKey();

  function activePalette() {
    if (state.palette === 'cool' || state.palette === 'warm') return state.palette;
    return state.role ? ROLES[state.role].palette : 'cool';
  }
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const root = document.documentElement;
    const theme = state.theme === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : state.theme;
    root.dataset.theme = theme;
    root.dataset.palette = activePalette();
    if (state.contrast) root.dataset.contrast = 'high'; else delete root.dataset.contrast;
    $('#meta-theme').setAttribute('content', theme === 'dark' ? '#15171b' : '#f5f4f0');
  }
  darkMQ.addEventListener && darkMQ.addEventListener('change', applyTheme);

  // ---------- Änderungen mit Rückgängig ----------
  const undoStack = [];
  function mutate(label, fn, opts) {
    opts = opts || {};
    const snap = JSON.stringify(state);
    const result = fn();
    if (result === false) return false;
    undoStack.push(snap);
    if (undoStack.length > 40) undoStack.shift();
    save();
    render();
    if (label) toast(label, opts.noUndo ? null : { label: 'Rückgängig', fn: undo });
    return result;
  }
  function undo() {
    const s = undoStack.pop();
    if (!s) { toast('Nichts zum Rückgängigmachen.'); return; }
    state = sanitize(JSON.parse(s));
    clearDrafts();
    save();
    render();
    toast('Rückgängig gemacht.');
  }

  // ==================================================================
  // DOM
  // ==================================================================
  const el = {
    onboarding: $('#onboarding'), app: $('#app'), roleList: $('#role-list'), onbCancel: $('#onb-cancel'),
    dayName: $('#day-name'), dayDate: $('#day-date'), dayToday: $('#day-today'), week: $('#week'),
    planTop: $('#plan-top'), timeline: $('#timeline'), grid: $('#grid'), gaps: $('#gaps'), items: $('#items'),
    nowLine: $('#now-line'), nowLabel: $('#now-label'), dropPreview: $('#drop-preview'), planEmpty: $('#plan-empty'),
    sideNow: $('#side-now'), inbox: $('#inbox'), inboxList: $('#inbox-list'), inboxCount: $('#inbox-count'),
    tabInboxCount: $('#tab-inbox-count'), focus: $('#focus'), focusBody: $('#focus-body'), focusClock: $('#focus-clock'),
    editor: $('#editor'), more: $('#more'), choice: $('#choice'), toast: $('#toast'), live: $('#sr-live')
  };
  const TOP_PAD = 18;

  $$('[data-icon]').forEach((b) => b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon)));

  function announce(msg) { el.live.textContent = ''; setTimeout(() => { el.live.textContent = msg; }, 30); }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg, action) {
    el.toast.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<button type="button" class="btn small">' + esc(action.label) + '</button>' : '');
    if (action) el.toast.querySelector('button').addEventListener('click', () => { hideToast(); action.fn(); });
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 6000 : 2600);
  }
  function hideToast() { el.toast.classList.remove('show'); }

  // ---------- Auswahl-Dialog (auch als Bestätigung) ----------
  function choose(opts) {
    return new Promise((resolve) => {
      $('#choice-title').textContent = opts.title;
      $('#choice-text').textContent = opts.text || '';
      $('#choice-text').hidden = !opts.text;
      $('#choice-options').innerHTML = opts.options.map((o, i) =>
        '<button value="' + esc(o.value) + '" class="choice-btn' + (o.danger ? ' danger' : '') + (i === 0 && !o.danger ? ' primary' : '') + '">' +
        (o.icon ? icon(o.icon) : '') + '<span><b>' + esc(o.label) + '</b>' + (o.desc ? '<small>' + esc(o.desc) + '</small>' : '') + '</span></button>').join('');
      el.choice.returnValue = '';
      el.choice.addEventListener('close', () => resolve(el.choice.returnValue || null), { once: true });
      el.choice.showModal();
    });
  }
  const confirmDo = (title, text, okLabel, danger) =>
    choose({ title, text, options: [{ value: 'ok', label: okLabel || 'OK', danger }] }).then((v) => v === 'ok');

  [el.editor, el.more, el.choice].forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  });

  // ==================================================================
  // Rendern
  // ==================================================================
  function render() {
    applyTheme();
    if (!state.role) { showOnboarding(false); return; }
    el.onboarding.hidden = true;
    el.app.hidden = false;
    document.body.dataset.tab = tab;
    $$('.tab[data-tab]').forEach((t) => t.setAttribute('aria-current', String(t.dataset.tab === tab)));
    renderHeader();
    renderPlanTop();
    renderTimeline();
    renderInbox();
    updateLive();
  }

  // ---------- Onboarding ----------
  function showOnboarding(isChange) {
    el.roleList.innerHTML = Object.keys(ROLES).map((id, i) => {
      const r = ROLES[id];
      const current = isChange && state.role === id;
      const preview = fromTemplate(id).slice(0, 7);
      return '<button type="button" class="role-card' + (current ? ' is-current' : '') + '" data-role="' + id + '">' +
        '<span class="role-icon">' + icon(r.icon) + '</span>' +
        '<span class="role-text">' +
          '<span class="role-name">' + esc(r.name) + (current ? ' <em>· aktuell</em>' : '') + '</span>' +
          '<span class="role-desc">' + esc(r.desc) + '</span>' +
          '<span class="role-strip" aria-hidden="true">' + preview.map((b) => '<i class="t-' + b.type + ' pal-' + r.palette + '" style="flex:' + b.dur + '"></i>').join('') + '</span>' +
        '</span>' + icon('chevron', 'role-chev') +
      '</button>';
    }).join('');
    el.onbCancel.hidden = !isChange;
    el.app.hidden = true;
    el.onboarding.hidden = false;
    window.scrollTo(0, 0);
  }

  el.roleList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-role]');
    if (!btn) return;
    const id = btn.dataset.role;
    const first = !state.role;
    if (!first) {
      const ok = await confirmDo('„' + ROLES[id].name + '“ übernehmen?', 'Der Plan von heute wird durch die Vorlage dieser Rolle ersetzt. Später, Wiederholungen und eigene Vorlage bleiben erhalten.', 'Übernehmen');
      if (!ok) return;
    }
    viewKey = todayKey();
    tab = 'plan';
    mutate(first ? null : 'Rolle gewechselt.', () => {
      state.role = id;
      clearDrafts();
      state.days[viewKey] = { blocks: baseBlocks('role').concat(recurringFor(viewKey)), energy: (state.days[viewKey] || {}).energy || null };
      dismissPast(viewKey);
    });
    scrollToNow();
    if (first) announce('Plan für ' + ROLES[id].name + ' geladen.');
  });
  el.onbCancel.addEventListener('click', () => render());

  // ---------- Kopf & Woche ----------
  function relName(k) {
    const t = todayKey();
    if (k === t) return 'Heute';
    if (k === addDays(t, 1)) return 'Morgen';
    if (k === addDays(t, -1)) return 'Gestern';
    return WD_LONG[weekday(k)];
  }
  function dayProgress(k) {
    const d = state.days[k] || (k >= todayKey() ? getDay(k) : null);
    if (!d) return null;
    const list = d.blocks.filter((b) => b.type !== 'buffer');
    if (!list.length) return null;
    return { done: list.filter((b) => b.done).length, total: list.length };
  }
  function renderHeader() {
    el.dayName.textContent = relName(viewKey);
    const d = keyToDate(viewKey);
    el.dayDate.textContent = (viewKey === todayKey() || Math.abs(d - keyToDate(todayKey())) <= 864e5 ? dateLong.format(d) : dateShort.format(d)) +
      (demoMin !== null && isToday() ? ' · Demo ' + fmt(demoMin) : '');
    el.dayToday.hidden = isToday();
    // Woche (Mo–So)
    const wd = (weekday(viewKey) + 6) % 7;
    const monday = addDays(viewKey, -wd);
    let html = '';
    for (let i = 0; i < 7; i++) {
      const k = addDays(monday, i);
      const p = dayProgress(k);
      const pct = p ? Math.round((p.done / p.total) * 100) : 0;
      html += '<button type="button" class="wday' + (k === viewKey ? ' sel' : '') + (k === todayKey() ? ' today' : '') + (k < todayKey() ? ' past' : '') + '" data-day="' + k + '"' +
        ' aria-label="' + esc(dateLong.format(keyToDate(k))) + (p ? ', ' + p.done + ' von ' + p.total + ' erledigt' : '') + '"' + (k === viewKey ? ' aria-current="date"' : '') + '>' +
        '<span class="wd">' + WD_SHORT[weekday(k)] + '</span><span class="dn">' + keyToDate(k).getDate() + '</span>' +
        '<span class="wbar"><i style="width:' + pct + '%"></i></span></button>';
    }
    el.week.innerHTML = html;
  }
  function goDay(k, scroll) {
    viewKey = k;
    openIds.clear();
    if (tab === 'focus') tab = 'plan';
    render();
    if (scroll !== false) { if (isToday()) scrollToNow(); else window.scrollTo(0, 0); }
  }
  $('#day-prev').addEventListener('click', () => goDay(addDays(viewKey, -1)));
  $('#day-next').addEventListener('click', () => goDay(addDays(viewKey, 1)));
  el.dayToday.addEventListener('click', () => goDay(todayKey()));
  el.week.addEventListener('click', (e) => { const b = e.target.closest('[data-day]'); if (b) goDay(b.dataset.day); });

  // ---------- Karten über der Zeitleiste ----------
  // Ausgeblendete „liegen geblieben“-Hinweise überleben ein Neuladen (nur für heute gespeichert)
  const MISSED_KEY = 'tagesplaner.missedSeen';
  const dismissedMissed = (() => {
    let ids = [];
    try { const o = JSON.parse(localStorage.getItem(MISSED_KEY) || 'null'); if (o && o.day === todayKey() && Array.isArray(o.ids)) ids = o.ids; } catch (_) { /* egal */ }
    const set = new Set(ids);
    const add = set.add.bind(set);
    set.add = (id) => { add(id); try { localStorage.setItem(MISSED_KEY, JSON.stringify({ day: todayKey(), ids: Array.from(set) })); } catch (_) { /* egal */ } return set; };
    return set;
  })();
  // Nach Rollenwahl / Neu planen nicht sofort „liegen geblieben“ melden
  function dismissPast(k) {
    if (k !== todayKey()) return;
    const n = nowMin();
    getDay(k).blocks.forEach((b) => { if (b.start + b.dur <= n) dismissedMissed.add(b.id); });
  }
  function renderPlanTop() {
    const day = viewDay();
    const blocks = day.blocks;
    let html = '';

    if (!state.tipsSeen) {
      html += '<section class="card-note tips"><h2>So funktioniert’s</h2><ul>' +
        '<li>' + icon('check') + '<span><b>Kreis antippen</b> – Block abhaken</span></li>' +
        '<li>' + icon('grip') + '<span><b>Symbol ziehen</b> oder Karte lange drücken – verschieben</span></li>' +
        '<li>' + icon('minus') + '<span><b>Unteren Rand ziehen</b> – Dauer ändern</span></li>' +
        '<li>' + icon('pen') + '<span><b>Karte antippen</b> – bearbeiten, Symbol wählen, wiederholen</span></li>' +
        '</ul><button type="button" class="btn small primary" data-act="tips-ok">Verstanden</button></section>';
    }

    const prog = dayProgress(viewKey);
    const focusMin = blocks.filter((b) => FOCUS_TYPES.includes(b.type)).reduce((a, b) => a + b.dur, 0);
    const pauseMin = blocks.filter((b) => b.type === 'pause').reduce((a, b) => a + b.dur, 0);
    if (blocks.length) {
      const pct = prog ? Math.round((prog.done / prog.total) * 100) : 0;
      html += '<section class="daycard">' +
        '<div class="dc-ring" style="--p:' + pct + '"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" class="trk"/><circle cx="18" cy="18" r="15.5" class="val" pathLength="100" style="stroke-dasharray:' + pct + ' 100"/></svg><span>' + pct + '%</span></div>' +
        '<div class="dc-text"><b>' + (prog ? prog.done + ' von ' + prog.total + ' erledigt' : 'Noch nichts abzuhaken') + '</b>' +
        '<span>' + (focusMin ? 'Fokus ' + durText(focusMin) : 'Kein Fokus-Block') + ' · ' + (pauseMin ? 'Pausen ' + durText(pauseMin) : 'keine Pause geplant') + '</span></div>' +
        '</section>';
    }

    if (isToday()) {
      const en = day.energy;
      if (!en) {
        html += '<section class="card-note energy"><h2>Wie ist deine Energie heute?</h2><div class="energy-row" role="group" aria-label="Energie">' +
          ENERGY.map((e) => '<button type="button" class="en-btn en-' + e.v + '" data-energy="' + e.v + '">' + batteryIcon(e.v) + '<span>' + e.label + '</span></button>').join('') +
          '</div><p class="muted small">Optional · bleibt nur auf diesem Gerät</p></section>';
      } else {
        const e = ENERGY[en - 1];
        html += '<section class="energy-mini en-' + en + '"><span class="en-ic">' + batteryIcon(en) + '</span><span><b>Energie: ' + e.label + '</b><small>' + esc(e.tip) + '</small></span>' +
          '<button type="button" class="btn small ghost" data-act="energy-reset">Ändern</button></section>';
      }
      const n = nowMin();
      const missed = blocks.filter((b) => !b.done && b.start + b.dur <= n && b.type !== 'buffer' && b.type !== 'pause' && !dismissedMissed.has(b.id));
      if (missed.length) {
        html += '<section class="card-note missed"><p><b>' + (missed.length === 1 ? '1 Block ist' : missed.length + ' Blöcke sind') + ' liegen geblieben.</b> Kein Problem – das passiert.</p>' +
          '<div class="row-btns"><button type="button" class="btn small" data-act="missed-later" data-icon-inline>' + icon('inbox') + '<span>Ins Später verschieben</span></button>' +
          '<button type="button" class="btn small ghost" data-act="missed-hide">Ausblenden</button></div></section>';
      }
    }

    if (!blocks.length) {
      html += '<section class="empty-card">' +
        '<svg class="empty-art" viewBox="0 0 120 80" aria-hidden="true"><rect x="30" y="8" width="70" height="14" rx="7" class="e1"/><rect x="30" y="30" width="48" height="14" rx="7" class="e2"/><rect x="30" y="52" width="60" height="14" rx="7" class="e3"/><circle cx="16" cy="15" r="6" class="e1"/><circle cx="16" cy="37" r="6" class="e2"/><circle cx="16" cy="59" r="6" class="e3"/></svg>' +
        '<h2>' + (isPastDay() ? 'Für diesen Tag gibt es keinen Plan.' : 'Noch nichts geplant.') + '</h2>' +
        '<p>' + (isPastDay() ? 'Vergangene Tage bleiben leer, wenn nichts geplant war.' : 'Tippe auf eine freie Zeit, hol dir Aufgaben aus „Später“ oder lade eine Vorlage.') + '</p>' +
        '<div class="row-btns"><button type="button" class="btn primary small" data-act="add">' + icon('plus') + '<span>Block hinzufügen</span></button>' +
        '<button type="button" class="btn small" data-act="replan">' + icon('refresh') + '<span>Vorlage laden</span></button></div></section>';
    }
    el.planTop.innerHTML = html;
  }

  el.planTop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act],[data-energy]');
    if (!b) return;
    if (b.dataset.energy) {
      const v = Number(b.dataset.energy);
      mutate('Energie gespeichert.', () => { materialize(viewKey).energy = v; });
      return;
    }
    const act = b.dataset.act;
    if (act === 'tips-ok') { state.tipsSeen = true; save(); render(); }
    else if (act === 'energy-reset') mutate(null, () => { materialize(viewKey).energy = null; });
    else if (act === 'missed-hide') {
      const n = nowMin();
      viewDay().blocks.forEach((x) => { if (x.start + x.dur <= n) dismissedMissed.add(x.id); });
      render();
    } else if (act === 'missed-later') {
      const n = nowMin();
      mutate('In „Später“ verschoben.', () => {
        const day = materialize(viewKey);
        const moving = day.blocks.filter((x) => !x.done && x.start + x.dur <= n && x.type !== 'buffer' && x.type !== 'pause');
        moving.forEach((x) => state.inbox.unshift(toInboxItem(x)));
        day.blocks = day.blocks.filter((x) => !moving.includes(x));
      });
    } else if (act === 'add') openEditor({ kind: 'block' });
    else if (act === 'replan') replan();
  });

  // ---------- Zeitleiste ----------
  let G = { start: 480, end: 1080, extras: [] };
  const subPanelHeight = (b) => 16 + b.subtasks.length * 46 + 54;
  function buildGeometry(blocks) {
    let s = state.dayStart, e = state.dayEnd;
    blocks.forEach((b) => { s = Math.min(s, Math.floor(b.start / 60) * 60); e = Math.max(e, Math.ceil((b.start + b.dur) / 60) * 60); });
    const extras = [];
    if (!drag) blocks.forEach((b) => { if (openIds.has(b.id) && b.subtasks.length) extras.push({ at: b.start + b.dur, h: subPanelHeight(b), id: b.id }); });
    extras.sort((a, b) => a.at - b.at);
    return { start: s, end: Math.min(e, 24 * 60), extras };
  }
  function yA(t) { let y = (t - G.start) * PPM; for (const x of G.extras) if (x.at <= t) y += x.h; return y; }
  function yB(t) { let y = (t - G.start) * PPM; for (const x of G.extras) if (x.at < t) y += x.h; return y; }

  function layoutLanes(list) {
    const sorted = list.slice().sort((a, b) => a.start - b.start || b.dur - a.dur);
    const out = new Map();
    let cluster = [], lanesEnd = [], clusterEnd = -Infinity;
    const flush = () => { cluster.forEach(({ b, lane }) => out.set(b.id, { lane, lanes: lanesEnd.length })); cluster = []; lanesEnd = []; };
    for (const b of sorted) {
      if (cluster.length && b.start >= clusterEnd) flush();
      let lane = lanesEnd.findIndex((end) => end <= b.start);
      if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(0); }
      lanesEnd[lane] = b.start + b.dur;
      cluster.push({ b, lane });
      clusterEnd = Math.max(cluster.length === 1 ? -Infinity : clusterEnd, b.start + b.dur);
    }
    flush();
    return out;
  }
  function laneBox(pos) {
    const n = pos.lanes, i = pos.lane, gap = n > 1 ? 4 : 0;
    if (i === 0) return { left: '0px', width: 'calc(' + BUBBLE + 'px + (100% - ' + BUBBLE + 'px) / ' + n + ' - ' + gap + 'px)', cardLeft: BUBBLE + 'px' };
    const left = 'calc(' + BUBBLE + 'px + ' + i + ' * (100% - ' + BUBBLE + 'px) / ' + n + ')';
    return { left, width: 'calc((100% - ' + BUBBLE + 'px) / ' + n + ' - ' + gap + 'px)', cardLeft: left };
  }

  function itemHtml(b, pos) {
    const t = TYPES[b.type];
    const top = yA(b.start);
    const h = Math.max(yB(b.start + b.dur) - top, 15);
    const compact = h < 60, tiny = h < 42;
    const ic = b.icon || b.type;
    const box = laneBox(pos);
    const open = openIds.has(b.id) && b.subtasks.length > 0;
    const doneSubs = b.subtasks.filter((s) => s.done).length;
    const sub = b.subtasks.length
      ? '<button type="button" class="sub-toggle no-drag" aria-expanded="' + open + '" aria-label="Unteraufgaben ' + (open ? 'zuklappen' : 'aufklappen') + ', ' + doneSubs + ' von ' + b.subtasks.length + ' erledigt">' + icon('chevron') + '<span>' + doneSubs + '/' + b.subtasks.length + '</span></button>'
      : '';
    const label = t.label + ': ' + b.title + ', ' + fmt(b.start) + ' bis ' + fmt(b.start + b.dur) + (b.done ? ', erledigt' : '');
    let html = '<div class="item t-' + b.type + (compact ? ' compact' : '') + (tiny ? ' tiny' : '') + (b.done ? ' done' : '') +
      (pos.lane > 0 ? ' nobubble' : '') + (pos.lanes > 1 ? ' laned' : '') + (open ? ' open' : '') + '" data-id="' + b.id + '"' +
      ' style="top:' + top + 'px;height:' + h + 'px;left:' + box.left + ';width:' + box.width + '">' +
      (pos.lane === 0 ? '<div class="bubble" data-grip title="Ziehen zum Verschieben"><span class="bubble-fill"></span>' + icon(b.done ? 'check' : ic) + '</div>' : '') +
      '<div class="card" tabindex="0" aria-roledescription="Zeitblock" aria-label="' + esc(label) + '. Enter bearbeiten, Leertaste abhaken, Pfeiltasten verschieben, Umschalt+Pfeile Dauer.">' +
        (pos.lane > 0 ? '<span class="card-icon">' + icon(ic) + '</span>' : '') +
        '<span class="card-text">' +
          '<span class="card-title">' + esc(b.title) + '</span>' +
          '<span class="card-meta"><span class="card-time">' + fmt(b.start) + '–' + fmt(b.start + b.dur) + '</span><span class="card-dur"> · ' + durText(b.dur) + '</span>' +
          (b.recurId ? '<span class="rep" title="Wiederholt sich">' + icon('repeat') + '</span>' : '') + '</span>' +
        '</span>' +
        '<span class="badge"></span>' + sub +
        '<button type="button" class="check no-drag" aria-pressed="' + b.done + '" aria-label="' + (b.done ? 'Wieder öffnen' : 'Abhaken') + ': ' + esc(b.title) + '">' + icon('check') + '</button>' +
      '</div>' +
      '<div class="resize" title="Ziehen, um die Dauer zu ändern" aria-hidden="true"><span></span></div>' +
    '</div>';
    if (open) {
      let extraBefore = 0;
      for (const x of G.extras) { if (x.id === b.id) break; if (x.at === b.start + b.dur) extraBefore += x.h; }
      html += '<div class="subpanel t-' + b.type + '" data-for="' + b.id + '" style="top:' + (yB(b.start + b.dur) + extraBefore) + 'px;height:' + (subPanelHeight(b) - 6) + 'px;left:' + box.cardLeft + ';width:calc(' + box.width + ' - ' + (pos.lane === 0 ? BUBBLE : 0) + 'px)">' +
        '<ul>' + b.subtasks.map((s) => '<li><label class="check-row"><input type="checkbox" data-sub="' + s.id + '"' + (s.done ? ' checked' : '') + '><span>' + esc(s.text) + '</span></label></li>').join('') + '</ul>' +
        '<form class="sub-add"><input type="text" name="text" maxlength="80" placeholder="Unteraufgabe hinzufügen …" aria-label="Neue Unteraufgabe" enterkeyhint="done" autocomplete="off">' +
        '<button type="submit" class="icon-btn" aria-label="Hinzufügen">' + icon('plus') + '</button></form></div>';
    }
    return html;
  }

  function freeGaps(blocks) {
    const iv = blocks.map((b) => [b.start, b.start + b.dur]).sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let cur = G.start;
    for (const [s, e] of iv) { if (s > cur) gaps.push([cur, s]); cur = Math.max(cur, e); }
    if (G.end > cur) gaps.push([cur, G.end]);
    const n = isToday() ? nowMin() : -1;
    return gaps.map(([s, e]) => [Math.max(s, n > s ? Math.ceil(n / 5) * 5 : s), e]).filter(([s, e]) => e - s >= 20);
  }

  function renderTimeline() {
    const blocks = viewDay().blocks;
    G = buildGeometry(blocks);
    const H = yA(G.end);
    el.timeline.style.height = (H + TOP_PAD * 2) + 'px';
    let g = '';
    for (let m = G.start; m <= G.end; m += 60) {
      g += '<div class="gridline" style="top:' + yA(m) + 'px"><span class="gridlabel">' + fmt(m) + '</span></div>';
      if (m + 30 < G.end) g += '<div class="gridline half" style="top:' + yA(m + 30) + 'px"></div>';
    }
    el.grid.innerHTML = g;
    const lanes = layoutLanes(blocks);
    el.items.innerHTML = blocks.slice().sort((a, b) => a.start - b.start).map((b) => itemHtml(b, lanes.get(b.id))).join('');
    el.gaps.innerHTML = isPastDay() ? '' : freeGaps(blocks).map(([s, e]) => {
      const top = yA(s), h = yB(e) - top;
      return '<button type="button" class="gap" data-start="' + s + '" data-len="' + (e - s) + '" style="top:' + (top + h / 2 - 18) + 'px">' + icon('plus') +
        '<span>' + durText(e - s) + ' frei</span></button>';
    }).join('');
  }

  function itemNode(id) { return el.items.querySelector('.item[data-id="' + id + '"]'); }

  function scrollToNow() {
    requestAnimationFrame(() => {
      if (!isToday()) return;
      const m = clamp(nowMin(), G.start, G.end);
      const y = el.timeline.getBoundingClientRect().top + window.scrollY + TOP_PAD + yA(m) - window.innerHeight * 0.35;
      window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
    });
  }
  function scrollToItem(id) {
    requestAnimationFrame(() => {
      const n = itemNode(id);
      if (!n) return;
      n.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      n.classList.add('flash');
      setTimeout(() => n.classList.remove('flash'), 1400);
    });
  }

  // ==================================================================
  // Live: Jetzt-Linie, Übergänge, Fokus, Erinnerungen
  // ==================================================================
  function nowInfo() {
    const k = todayKey();
    const list = getDay(k).blocks.slice().sort((a, b) => a.start - b.start);
    const n = nowMin();
    let cur = null, next = null, prevEnd = null;
    for (const b of list) {
      const end = b.start + b.dur;
      if (b.start <= n && n < end && (!cur || b.start >= cur.start)) cur = b;
      if (b.start > n && !next) next = b;
      if (end <= n) prevEnd = Math.max(prevEnd || 0, end);
    }
    return { k, n, list, cur, next, prevEnd };
  }

  let lastToday = todayKey();
  function updateLive() {
    if (el.app.hidden) return;
    const tk = todayKey();
    if (tk !== lastToday) { const wasToday = viewKey === lastToday; lastToday = tk; clearDrafts(); if (wasToday) { goDay(tk); return; } }
    const n = nowMin();
    const today = isToday();
    const show = today && n >= G.start && n <= G.end;
    el.nowLine.hidden = !show;
    if (show) { el.nowLine.style.top = (TOP_PAD + yA(n)) + 'px'; el.nowLabel.textContent = fmt(n); }

    for (const b of viewDay().blocks) {
      const node = itemNode(b.id);
      if (!node || (drag && drag.id === b.id && drag.active)) continue;
      const end = b.start + b.dur;
      const isPast = today ? end <= n : isPastDay();
      const isCur = today && b.start <= n && n < end;
      const until = today ? b.start - n : -1;
      const isUp = until > 0 && until <= TRANSITION_MIN && !b.done;
      node.classList.toggle('past', isPast);
      node.classList.toggle('current', isCur);
      node.classList.toggle('upcoming', isUp);
      node.style.setProperty('--p', isCur ? ((n - b.start) / b.dur).toFixed(4) : (isPast ? '1' : '0'));
      const badge = node.querySelector('.badge');
      badge.textContent = b.done ? '' : isUp ? 'in ' + Math.ceil(until) + ' Min' : (isCur ? 'noch ' + durText(Math.ceil(end - n)) : '');
    }
    renderSideNow();
    renderFocus();
    checkReminders();
  }

  function ringSvg(frac, cls) {
    const off = (100 - clamp(frac, 0, 1) * 100).toFixed(2);
    return '<svg class="ring ' + (cls || '') + '" viewBox="0 0 240 240" aria-hidden="true"><circle class="ring-trk" cx="120" cy="120" r="104"/>' +
      '<circle class="ring-val" cx="120" cy="120" r="104" pathLength="100" style="stroke-dashoffset:' + off + '"/></svg>';
  }
  function clockText(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s);
  }

  function renderSideNow() {
    if (!isDesktop() || !state.role) return;
    const { n, cur, next } = nowInfo();
    let html = '';
    if (cur && !cur.done) {
      const left = cur.start + cur.dur - n;
      html = '<div class="sn-row t-' + cur.type + '"><span class="sn-ring">' + ringSvg(left / cur.dur) + '<span class="sn-ic">' + icon(cur.icon || cur.type) + '</span></span>' +
        '<span class="sn-text"><span class="kicker">Jetzt</span><b>' + esc(cur.title) + '</b><span>noch ' + durText(Math.ceil(left)) + ' · bis ' + fmt(cur.start + cur.dur) + '</span></span></div>';
    } else {
      html = '<div class="sn-row"><span class="sn-text"><span class="kicker">Jetzt</span><b>' + (next ? 'Freie Zeit' : 'Nichts mehr geplant') + '</b>' +
        (next ? '<span>bis ' + fmt(next.start) + '</span>' : '<span>Genieß den Rest des Tages.</span>') + '</span></div>';
    }
    if (next) {
      const until = Math.ceil(next.start - n);
      html += '<div class="sn-next t-' + next.type + (until <= TRANSITION_MIN ? ' soon' : '') + '"><span class="mini-bubble">' + icon(next.icon || next.type) + '</span><span>' +
        (until <= TRANSITION_MIN ? 'In ' + until + ' Min' : 'Um ' + fmt(next.start)) + ': <b>' + esc(next.title) + '</b></span></div>';
    }
    html += '<button type="button" class="btn wide" data-act="open-focus">' + icon('focus') + '<span>Fokus-Ansicht öffnen</span></button>';
    if (html !== el.sideNow._last) { el.sideNow.innerHTML = html; el.sideNow._last = html; }
  }
  el.sideNow.addEventListener('click', (e) => { if (e.target.closest('[data-act="open-focus"]')) setTab('focus'); });

  // ---------- Fokus-Ansicht ----------
  let focusSig = '';
  function renderFocus() {
    if (tab !== 'focus' || el.app.hidden) return;
    const info = nowInfo();
    const { n, cur, next, list } = info;
    el.focusClock.textContent = fmt(n);
    const active = cur && !cur.done ? cur : null;
    const sig = JSON.stringify([list.length, active && [active.id, active.title, active.dur, active.start, active.subtasks], cur && cur.done && cur.id, next && [next.id, next.title, next.start], state.theme]);
    if (sig !== focusSig) {
      focusSig = sig;
      let html = '';
      if (!list.length) {
        html = '<div class="focus-empty"><h2>Heute ist noch nichts geplant.</h2><p>Leg einen Block an oder lade eine Vorlage.</p>' +
          '<button type="button" class="btn primary" data-fact="add">' + icon('plus') + '<span>Block hinzufügen</span></button></div>';
      } else if (active) {
        const subs = active.subtasks;
        html = '<div class="focus-hero t-' + active.type + '">' +
          '<div class="ring-wrap">' + ringSvg(1, 'big') + '<div class="ring-center"><span class="ring-ic">' + icon(active.icon || active.type) + '</span>' +
            '<span class="ring-time" data-cd></span><span class="ring-sub">verbleibend</span></div></div>' +
          '<span class="focus-type">' + esc(TYPES[active.type].label) + '</span>' +
          '<h2 class="focus-title">' + esc(active.title) + '</h2>' +
          '<p class="focus-range">' + fmt(active.start) + '–' + fmt(active.start + active.dur) + ' · ' + durText(active.dur) + '</p>' +
          '<div class="focus-actions"><button type="button" class="btn primary big" data-fact="done">' + icon('check') + '<span>Erledigt</span></button>' +
          '<button type="button" class="btn big" data-fact="plus5">' + icon('plus') + '<span>5 Min</span></button>' +
          '<button type="button" class="btn big icon-only" data-fact="edit" aria-label="Bearbeiten">' + icon('pen') + '</button></div>' +
          (subs.length ? '<ul class="focus-subs">' + subs.map((s) => '<li><label class="check-row big"><input type="checkbox" data-fsub="' + s.id + '"' + (s.done ? ' checked' : '') + '><span>' + esc(s.text) + '</span></label></li>').join('') + '</ul>' : '') +
          '</div>';
      } else {
        const doneCur = cur && cur.done ? cur : null;
        html = '<div class="focus-hero free">' +
          (next ? '<div class="ring-wrap">' + ringSvg(1, 'big') + '<div class="ring-center"><span class="ring-ic">' + icon('sun') + '</span><span class="ring-time" data-cd></span><span class="ring-sub">bis zum nächsten Block</span></div></div>' : '<div class="celebrate">' + icon('star') + '</div>') +
          '<h2 class="focus-title">' + (doneCur ? 'Geschafft: ' + esc(doneCur.title) : next ? 'Freie Zeit' : 'Tag geschafft!') + '</h2>' +
          '<p class="focus-range">' + (next ? 'Durchatmen. Du musst gerade nichts.' : 'Für heute ist nichts mehr geplant. Gut gemacht.') + '</p></div>';
      }
      if (next) {
        html += '<div class="focus-next t-' + next.type + '" data-next><span class="mini-bubble">' + icon(next.icon || next.type) + '</span>' +
          '<span class="fn-text"><span class="kicker" data-next-in></span><b>' + esc(next.title) + '</b><span>' + fmt(next.start) + '–' + fmt(next.start + next.dur) + '</span></span></div>';
      }
      el.focusBody.innerHTML = html;
    }
    // sekündliche Aktualisierung
    const cd = el.focusBody.querySelector('[data-cd]');
    const ringVal = el.focusBody.querySelector('.ring.big .ring-val');
    if (active && cd) {
      const leftSec = (active.start + active.dur - n) * 60;
      cd.textContent = clockText(leftSec);
      ringVal.style.strokeDashoffset = (100 - clamp(leftSec / (active.dur * 60), 0, 1) * 100).toFixed(2);
    } else if (cd && next) {
      const base = info.prevEnd != null ? info.prevEnd : Math.min(next.start - 60, n);
      const leftSec = (next.start - n) * 60;
      cd.textContent = clockText(leftSec);
      ringVal.style.strokeDashoffset = (100 - clamp(leftSec / Math.max(60, (next.start - base) * 60), 0, 1) * 100).toFixed(2);
    }
    const ni = el.focusBody.querySelector('[data-next-in]');
    if (ni && next) {
      const until = Math.ceil(next.start - n);
      ni.textContent = until <= TRANSITION_MIN ? 'In ' + until + ' Min · langsam abschließen' : 'Als Nächstes · in ' + durText(until);
      el.focusBody.querySelector('[data-next]').classList.toggle('soon', until <= TRANSITION_MIN);
    }
  }

  el.focusBody.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fact]');
    if (!b) return;
    const { cur, k } = nowInfo();
    const act = b.dataset.fact;
    if (act === 'add') openEditor({ kind: 'block', day: k });
    if (!cur) return;
    if (act === 'done') toggleDone(cur.id, k);
    else if (act === 'plus5') mutate('5 Minuten verlängert.', () => { const x = materialize(k).blocks.find((y) => y.id === cur.id); x.dur = Math.min(x.dur + 5, 24 * 60 - x.start); });
    else if (act === 'edit') { viewKey = k; openEditor({ kind: 'block', id: cur.id }); }
  });
  el.focusBody.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-fsub]');
    if (!cb) return;
    const { cur, k } = nowInfo();
    if (!cur) return;
    mutate(null, () => { const s = materialize(k).blocks.find((y) => y.id === cur.id).subtasks.find((x) => x.id === cb.dataset.fsub); if (s) s.done = cb.checked; });
    if (cb.checked) haptic();
  });
  $('#focus-close').addEventListener('click', () => setTab('plan'));

  function setTab(t) {
    tab = t;
    focusSig = '';
    if (t === 'focus') { viewKey = viewKey; }
    render();
    if (t === 'plan') { if (isToday()) scrollToNow(); } else window.scrollTo(0, 0);
    if (t === 'inbox' && !isDesktop()) setTimeout(() => $('#inbox-input').focus({ preventScroll: true }), 50);
  }
  $$('.tab[data-tab]').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
  $('#btn-focus-top').addEventListener('click', () => setTab(tab === 'focus' ? 'plan' : 'focus'));

  // ---------- Erinnerungen (lokal, opt-in) ----------
  let fired;
  try { fired = new Set(JSON.parse(sessionStorage.getItem('tp-fired') || '[]')); } catch (e) { fired = new Set(); }
  function checkReminders() {
    const r = state.reminders;
    if (!(r.sound || r.vibrate || r.notify)) return;
    const k = todayKey();
    const d = state.days[k] || drafts[k];
    if (!d) return;
    const n = nowMin();
    for (const b of d.blocks) {
      const lead = b.start - n;
      if (lead > 0 && lead <= TRANSITION_MIN && !b.done) {
        const key = k + '|' + b.id + '|' + b.start;
        if (fired.has(key)) continue;
        fired.add(key);
        try { sessionStorage.setItem('tp-fired', JSON.stringify(Array.from(fired).slice(-200))); } catch (e) { /* egal */ }
        fireReminder(b, Math.ceil(lead));
      }
    }
  }
  function fireReminder(b, lead, test) {
    const r = state.reminders;
    const title = 'In ' + lead + ' Min: ' + b.title;
    const body = fmt(b.start) + '–' + fmt(b.start + b.dur) + ' · ' + TYPES[b.type].label + '. Langsam zum Abschluss kommen.';
    if (r.sound) chime();
    if (r.vibrate && navigator.vibrate) { try { navigator.vibrate([60, 90, 60]); } catch (e) { /* egal */ } }
    if (r.notify && 'Notification' in window && Notification.permission === 'granted') {
      const opts = { body, tag: 'tp-' + b.id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', silent: !r.sound };
      const viaSw = navigator.serviceWorker && navigator.serviceWorker.controller
        ? navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts))
        : Promise.reject(new Error('kein SW'));
      viaSw.catch(() => { try { new Notification(title, opts); } catch (e) { /* egal */ } });
    }
    if (test || document.visibilityState === 'visible') toast(title);
  }
  let actx = null;
  function chime() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime;
      [[523.25, 0], [659.25, 0.22], [783.99, 0.44]].forEach(([f, dt]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.11, t + dt + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.4);
        o.connect(g); g.connect(actx.destination);
        o.start(t + dt); o.stop(t + dt + 1.5);
      });
    } catch (e) { /* kein Audio */ }
  }
  function haptic() { if (state.reminders.vibrate && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* egal */ } } }

  // ==================================================================
  // Später (Inbox)
  // ==================================================================
  function toInboxItem(b) {
    const c = normBlock(clone(b));
    c.id = uid(); c.done = false; delete c.recurId;
    c.subtasks.forEach((s) => { s.done = false; });
    return c;
  }
  function renderInbox() {
    const list = state.inbox;
    el.inboxCount.textContent = list.length ? String(list.length) : '';
    el.tabInboxCount.hidden = !list.length;
    el.tabInboxCount.textContent = list.length > 9 ? '9+' : String(list.length);
    if (!list.length) {
      el.inboxList.innerHTML = '<li class="inbox-empty">' + icon('inbox') + '<p><b>Dein Kopf ist frei.</b> Schreib hier alles auf, was du irgendwann erledigen willst – ganz ohne Uhrzeit.</p></li>';
      return;
    }
    el.inboxList.innerHTML = list.map((b) =>
      '<li class="ib t-' + b.type + '" data-id="' + b.id + '">' +
        '<span class="ib-bubble" data-ib-grip title="Auf die Zeitleiste ziehen">' + icon(b.icon || b.type) + '</span>' +
        '<button type="button" class="ib-main" data-ib="edit"><b>' + esc(b.title) + '</b><small>' + durText(b.dur) + ' · ' + esc(TYPES[b.type].label) + (b.subtasks.length ? ' · ' + b.subtasks.length + ' Unteraufg.' : '') + '</small></button>' +
        '<button type="button" class="btn small ib-plan" data-ib="plan" aria-label="' + esc(b.title) + ' einplanen">' + icon('calendar') + '<span>Einplanen</span></button>' +
        '<button type="button" class="check" data-ib="done" aria-label="Erledigt: ' + esc(b.title) + '">' + icon('check') + '</button>' +
      '</li>').join('');
  }

  $('#inbox-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#inbox-input');
    const title = inp.value.trim();
    if (!title) return;
    mutate('In „Später“ abgelegt.', () => { state.inbox.unshift(normBlock({ title, type: 'flexible', dur: 30 })); });
    inp.value = '';
    $('#inbox-input').focus({ preventScroll: true });
  });

  el.inboxList.addEventListener('click', (e) => {
    if (suppressClick) return;
    const b = e.target.closest('[data-ib]');
    if (!b) return;
    const id = b.closest('.ib').dataset.id;
    const act = b.dataset.ib;
    if (act === 'edit') openEditor({ kind: 'inbox', id });
    else if (act === 'plan') scheduleInbox(id);
    else if (act === 'done') {
      const li = b.closest('.ib');
      li.classList.add('just-done');
      haptic();
      setTimeout(() => mutate('Erledigt – stark!', () => { state.inbox = state.inbox.filter((x) => x.id !== id); }), reducedMotion() ? 0 : 380);
    }
  });

  function targetDayForScheduling() { return isPastDay() ? todayKey() : viewKey; }
  function suggestStart(dur, k, ignoreId) {
    const blocks = getDay(k).blocks.filter((b) => b.id !== ignoreId);
    const busy = (s) => blocks.some((b) => s < b.start + b.dur && b.start < s + dur);
    const n = nowMin();
    const from = k === todayKey() ? Math.max(state.dayStart, Math.ceil(n / 15) * 15) : state.dayStart;
    const limit = Math.max(state.dayEnd, from + dur);
    for (let s = from; s + dur <= Math.min(limit, 24 * 60); s += 15) if (!busy(s)) return s;
    for (let s = state.dayStart; s + dur <= state.dayEnd; s += 15) if (!busy(s)) return s;
    return clamp(from, 0, 24 * 60 - dur);
  }
  function scheduleInbox(id, start, day) {
    const item = state.inbox.find((x) => x.id === id);
    if (!item) return;
    const k = day || targetDayForScheduling();
    const s = start != null ? start : suggestStart(item.dur, k);
    let newId = null;
    mutate('Eingeplant: ' + relName(k) + ', ' + fmt(s) + '.', () => {
      const b = normBlock(Object.assign(clone(item), { start: s }));
      b.id = uid(); newId = b.id;
      materialize(k).blocks.push(b);
      state.inbox = state.inbox.filter((x) => x.id !== id);
      viewKey = k;
      if (!isDesktop()) tab = 'plan';
    });
    scrollToItem(newId);
  }

  // ==================================================================
  // Block-Aktionen
  // ==================================================================
  function toggleDone(id, k) {
    k = k || viewKey;
    const b = getDay(k).blocks.find((x) => x.id === id);
    if (!b) return;
    const willDone = !b.done;
    mutate(null, () => { materialize(k).blocks.find((x) => x.id === id).done = willDone; });
    if (willDone) {
      haptic();
      const node = itemNode(id);
      if (node && !reducedMotion()) {
        node.classList.add('pop');
        const burst = document.createElement('span');
        burst.className = 'burst';
        burst.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
        node.appendChild(burst);
        setTimeout(() => { node.classList.remove('pop'); burst.remove(); }, 900);
      }
      const p = dayProgress(k);
      if (p && p.done === p.total) toast('Alles erledigt. Richtig stark!');
      else announce('Abgehakt: ' + b.title);
    }
  }
  function duplicateBlock(id) {
    const b = findBlock(id);
    if (!b) return;
    let copyId = null;
    mutate('Dupliziert.', () => {
      const c = freshCopy(b);
      delete c.recurId;
      c.start = b.start + b.dur + b.dur <= 24 * 60 ? b.start + b.dur : b.start;
      copyId = c.id;
      materialize(viewKey).blocks.push(c);
    });
    scrollToItem(copyId);
  }
  function deleteBlock(id) {
    const b = findBlock(id);
    if (!b) return;
    mutate('„' + b.title + '“ gelöscht.', () => {
      const d = materialize(viewKey);
      d.blocks = d.blocks.filter((x) => x.id !== id);
      openIds.delete(id);
    });
  }
  function blockToLater(id) {
    const b = findBlock(id);
    if (!b) return;
    mutate('In „Später“ verschoben.', () => {
      const d = materialize(viewKey);
      d.blocks = d.blocks.filter((x) => x.id !== id);
      state.inbox.unshift(toInboxItem(b));
    });
  }

  // Klicks in der Zeitleiste
  el.items.addEventListener('click', (e) => {
    if (suppressClick) return;
    const chk = e.target.closest('.item .check');
    if (chk) { toggleDone(chk.closest('.item').dataset.id); return; }
    const tgl = e.target.closest('.sub-toggle');
    if (tgl) {
      const id = tgl.closest('.item').dataset.id;
      if (openIds.has(id)) openIds.delete(id); else openIds.add(id);
      render();
      const n = itemNode(id);
      n && n.querySelector('.sub-toggle').focus({ preventScroll: true });
    }
  });
  el.items.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-sub]');
    if (!cb) return;
    const id = cb.closest('.subpanel').dataset.for;
    mutate(null, () => { const s = materialize(viewKey).blocks.find((x) => x.id === id).subtasks.find((x) => x.id === cb.dataset.sub); if (s) s.done = cb.checked; });
    if (cb.checked) haptic();
    const again = el.items.querySelector('input[data-sub="' + cb.dataset.sub + '"]');
    again && again.focus({ preventScroll: true });
  });
  el.items.addEventListener('submit', (e) => {
    const f = e.target.closest('.sub-add');
    if (!f) return;
    e.preventDefault();
    const text = f.elements.text.value.trim();
    if (!text) return;
    const id = f.closest('.subpanel').dataset.for;
    mutate(null, () => { materialize(viewKey).blocks.find((x) => x.id === id).subtasks.push({ id: uid(), text, done: false }); });
    const inp = el.items.querySelector('.subpanel[data-for="' + id + '"] .sub-add input');
    inp && inp.focus({ preventScroll: true });
  });
  el.items.addEventListener('contextmenu', (e) => { if (e.target.closest('.item') && !e.target.closest('input')) e.preventDefault(); });
  el.gaps.addEventListener('click', (e) => {
    const g = e.target.closest('.gap');
    if (!g) return;
    openEditor({ kind: 'block', start: Number(g.dataset.start), dur: Math.min(30, Number(g.dataset.len)) });
  });

  // Tastatur auf Karten
  el.items.addEventListener('keydown', (e) => {
    const card = e.target.classList && e.target.classList.contains('card') ? e.target : null;
    if (!card) return;
    const id = card.closest('.item').dataset.id;
    const b = findBlock(id);
    if (!b) return;
    if (e.key === 'Enter') { e.preventDefault(); openEditor({ kind: 'block', id }); return; }
    if (e.key === ' ') { e.preventDefault(); toggleDone(id); refocus(id); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteBlock(id); return; }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const d = (e.key === 'ArrowUp' ? -1 : 1) * state.snap;
    mutate(null, () => {
      const x = materialize(viewKey).blocks.find((y) => y.id === id);
      if (e.shiftKey) x.dur = clamp(x.dur + d, minDur(), 24 * 60 - x.start);
      else x.start = clamp(x.start + d, 0, 24 * 60 - x.dur);
    });
    refocus(id);
    const x = findBlock(id);
    announce(fmt(x.start) + ' bis ' + fmt(x.start + x.dur));
  });
  function refocus(id) { const n = itemNode(id); n && n.querySelector('.card').focus({ preventScroll: true }); }
  const minDur = () => Math.max(10, state.snap);

  // ==================================================================
  // Ziehen: Blöcke verschieben / Dauer ändern / Aufgaben aus „Später“ einplanen
  //  Maus: ziehen ab 5 px · Touch: lange drücken oder sofort am Symbol (Bubble) ziehen
  // ==================================================================
  let drag = null;
  let suppressClick = false;

  el.items.addEventListener('pointerdown', (e) => {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('.no-drag, .subpanel')) return;
    const item = e.target.closest('.item');
    if (!item) return;
    const b = findBlock(item.dataset.id);
    if (!b) return;
    const onResize = !!e.target.closest('.resize');
    const onGrip = !!e.target.closest('[data-grip]');
    startPointer(e, { kind: 'block', id: b.id, node: item, mode: onResize ? 'resize' : 'move', orig: { start: b.start, dur: b.dur }, immediate: onResize || onGrip });
  });

  el.inboxList.addEventListener('pointerdown', (e) => {
    if (drag || !isDesktop() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const li = e.target.closest('.ib');
    if (!li) return;
    const onGrip = !!e.target.closest('[data-ib-grip]');
    if (!onGrip && (e.pointerType !== 'mouse' || e.target.closest('.check, .ib-plan'))) return;
    const item = state.inbox.find((x) => x.id === li.dataset.id);
    if (!item) return;
    startPointer(e, { kind: 'inbox', id: item.id, node: li, mode: 'inbox', dur: item.dur, immediate: onGrip });
  });

  function startPointer(e, d) {
    drag = Object.assign(d, { pid: e.pointerId, ptype: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, s0: window.scrollY, active: false, timer: null, raf: 0, cur: d.orig ? Object.assign({}, d.orig) : null });
    if (d.immediate) { e.preventDefault(); activateDrag(); }
    else if (e.pointerType === 'touch') {
      d.node.classList.add('pressing');
      d.timer = setTimeout(() => { if (drag === d && !d.active) { activateDrag(); haptic(); } }, LONG_PRESS_MS);
    }
    if (e.pointerType !== 'touch') { try { d.node.setPointerCapture(e.pointerId); } catch (_) { /* egal */ } }
  }

  function activateDrag() {
    const d = drag;
    clearTimeout(d.timer);
    d.active = true;
    d.node.classList.remove('pressing');
    if (openIds.size) { openIds.clear(); renderTimeline(); updateLive(); if (d.kind === 'block') d.node = itemNode(d.id); }
    if (d.kind === 'block') {
      d.node.classList.remove('upcoming');
      d.node.classList.add('dragging', d.mode === 'resize' ? 'is-resizing' : 'is-moving');
    } else {
      const r = d.node.getBoundingClientRect();
      d.ghost = d.node.cloneNode(true);
      d.ghost.classList.add('ib-ghost');
      d.ghost.style.width = r.width + 'px';
      d.offX = d.x0 - r.left; d.offY = d.y0 - r.top;
      document.body.appendChild(d.ghost);
      d.node.classList.add('lifting');
    }
    document.body.classList.add('is-dragging');
    applyDrag();
    d.raf = requestAnimationFrame(autoScroll);
  }

  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active) {
      const dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
      if (drag.ptype === 'touch') { if (dist > 8) { clearTimeout(drag.timer); drag.node.classList.remove('pressing'); drag = null; } }
      else if (dist > 5) activateDrag();
      return;
    }
    e.preventDefault();
    applyDrag();
  }, { passive: false });
  window.addEventListener('pointerup', (e) => endPointer(e, false));
  window.addEventListener('pointercancel', (e) => endPointer(e, true));
  document.addEventListener('touchmove', (e) => { if (drag && drag.active) e.preventDefault(); }, { passive: false });

  const inside = (node, x, y) => { const r = node.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };

  function applyDrag() {
    const d = drag;
    const step = state.snap;
    if (d.kind === 'block') {
      const dm = ((d.y - d.y0) + (window.scrollY - d.s0)) / PPM;
      if (d.mode === 'move') {
        d.cur.start = clamp(Math.round((d.orig.start + dm) / step) * step, G.start, G.end - d.orig.dur);
        d.node.style.top = yA(d.cur.start) + 'px';
        d.overInbox = isDesktop() && inside(el.inbox, d.x, d.y);
        d.node.classList.toggle('to-inbox', d.overInbox);
        el.inbox.classList.toggle('drop-target', d.overInbox);
      } else {
        const end = clamp(Math.round((d.orig.start + d.orig.dur + dm) / step) * step, d.orig.start + minDur(), G.end);
        d.cur.dur = end - d.orig.start;
        d.node.style.height = (d.cur.dur * PPM) + 'px';
      }
      const t = d.node.querySelector('.card-time');
      if (t) t.textContent = fmt(d.cur.start) + '–' + fmt(d.cur.start + d.cur.dur);
      const dd = d.node.querySelector('.card-dur');
      if (dd) dd.textContent = ' · ' + durText(d.cur.dur);
      const badge = d.node.querySelector('.badge');
      if (badge) badge.textContent = d.overInbox ? 'Später' : d.mode === 'resize' ? durText(d.cur.dur) : fmt(d.cur.start);
    } else {
      d.ghost.style.transform = 'translate(' + (d.x - d.offX) + 'px,' + (d.y - d.offY) + 'px) rotate(-1.5deg)';
      const r = el.timeline.getBoundingClientRect();
      if (d.x >= r.left && d.x <= r.right && d.y >= r.top && d.y <= r.bottom) {
        const t = G.start + (d.y - r.top - TOP_PAD) / PPM - Math.min(d.dur, 30) / 2;
        const s = clamp(Math.round(t / step) * step, G.start, G.end - d.dur);
        d.dropStart = s;
        el.dropPreview.hidden = false;
        el.dropPreview.style.top = (TOP_PAD + yA(s)) + 'px';
        el.dropPreview.style.height = (d.dur * PPM) + 'px';
        el.dropPreview.firstChild.textContent = fmt(s) + '–' + fmt(s + d.dur);
      } else {
        d.dropStart = null;
        el.dropPreview.hidden = true;
      }
    }
  }

  function autoScroll() {
    if (!drag || !drag.active) return;
    const edge = 80;
    const bar = $('.tabbar');
    const inset = getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0;
    const top = $('.topbar').offsetHeight + 10;
    const bottom = window.innerHeight - inset - edge;
    let v = 0;
    if (drag.y < top + edge) v = -Math.ceil((top + edge - drag.y) / 6);
    else if (drag.y > bottom) v = Math.ceil((drag.y - bottom) / 6);
    if (v) { window.scrollBy(0, v); applyDrag(); }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function endPointer(e, cancelled) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    clearTimeout(d.timer);
    cancelAnimationFrame(d.raf);
    document.body.classList.remove('is-dragging');
    el.inbox.classList.remove('drop-target');
    el.dropPreview.hidden = true;
    if (d.ghost) d.ghost.remove();
    d.node.classList.remove('pressing', 'dragging', 'is-moving', 'is-resizing', 'lifting', 'to-inbox');
    const moved = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
    if (d.active) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 80);
      if (cancelled) { render(); return; }
      if (d.kind === 'block') {
        if (d.overInbox) { blockToLater(d.id); return; }
        const b = findBlock(d.id);
        if (!b || (b.start === d.cur.start && b.dur === d.cur.dur)) {
          render();
          if (moved < 6 && d.mode === 'move') openEditor({ kind: 'block', id: d.id }); // Antippen der Bubble
          return;
        }
        mutate(d.mode === 'resize' ? 'Dauer: ' + durText(d.cur.dur) + '.' : 'Verschoben auf ' + fmt(d.cur.start) + '.', () => {
          const x = materialize(viewKey).blocks.find((y) => y.id === d.id);
          x.start = d.cur.start; x.dur = d.cur.dur;
        });
        announce(fmt(d.cur.start) + ' bis ' + fmt(d.cur.start + d.cur.dur));
      } else if (d.dropStart != null) {
        scheduleInbox(d.id, d.dropStart, viewKey);
      } else render();
    } else if (!cancelled && d.kind === 'block' && moved < 8) {
      openEditor({ kind: 'block', id: d.id }); // Tippen = bearbeiten
    }
  }

  // ==================================================================
  // Editor
  // ==================================================================
  let ed = null;
  const f = {
    name: $('#ed-name'), iconBtn: $('#ed-icon-btn'), icons: $('#ed-icons'), types: $('#ed-types'),
    h: $('#ed-h'), m: $('#ed-m'), dur: $('#ed-dur'), chips: $('#ed-chips'), end: $('#ed-end'),
    repeat: $('#ed-repeat'), subs: $('#ed-subs'),
    del: $('#ed-delete'), dup: $('#ed-dup'), later: $('#ed-later'), sched: $('#ed-schedule')
  };
  f.types.innerHTML = TYPE_ORDER.map((t) =>
    '<label class="type-opt t-' + t + '"><input type="radio" name="type" value="' + t + '"><span class="type-sw">' + icon(t) + '</span><span class="type-name">' + esc(TYPES[t].label) + '</span></label>').join('');
  f.icons.innerHTML = '<button type="button" class="ic-opt" data-ic="" role="radio" aria-label="Symbol der Art">' + '<span class="auto-lbl">Auto</span></button>' +
    PICKABLE.map((n) => '<button type="button" class="ic-opt" data-ic="' + n + '" role="radio" aria-label="Symbol ' + n + '">' + icon(n) + '</button>').join('');
  f.h.innerHTML = Array.from({ length: 24 }, (_, i) => '<option value="' + i + '">' + pad(i) + '</option>').join('');
  f.chips.innerHTML = [5, 15, 30, 45, 60, 90].map((m) => '<button type="button" class="chip" data-min="' + m + '">' + durText(m) + '</button>').join('');

  function openEditor(o) {
    const k = o.day || viewKey;
    let src = null;
    if (o.kind === 'block' && o.id) src = getDay(k).blocks.find((x) => x.id === o.id);
    if (o.kind === 'inbox' && o.id) src = state.inbox.find((x) => x.id === o.id);
    const dur = o.dur || 30;
    const draft = src ? clone(src) : normBlock({ type: o.kind === 'inbox' ? 'flexible' : 'focused', start: o.start != null ? o.start : suggestStart(dur, k), dur });
    if (!src) draft.title = '';
    ed = { kind: o.kind, id: src ? src.id : null, day: k, draft };
    const isBlock = o.kind === 'block';
    $('#ed-title').textContent = isBlock ? (src ? 'Block bearbeiten' : 'Neuer Block' + (k !== todayKey() ? ' · ' + relName(k) : '')) : (src ? 'Aufgabe für später' : 'Neue Aufgabe für später');
    f.name.value = draft.title;
    f.name.placeholder = isBlock ? 'Was hast du vor?' : 'Was willst du irgendwann erledigen?';
    f.types.querySelector('input[value="' + draft.type + '"]').checked = true;
    $('#ed-time-row').hidden = !isBlock;
    $('#ed-repeat-field').hidden = !isBlock;
    f.del.hidden = !src;
    f.dup.hidden = !(isBlock && src);
    f.later.hidden = !(isBlock && src);
    f.sched.hidden = !(!isBlock && src);
    f.icons.hidden = true;
    f.iconBtn.setAttribute('aria-expanded', 'false');
    const wd = WD_LONG[weekday(k)];
    f.repeat.innerHTML = '<option value="none">Nie</option><option value="daily">Täglich</option><option value="weekdays">Werktags (Mo–Fr)</option><option value="weekly">Wöchentlich am ' + wd + '</option>';
    const series = src && src.recurId ? state.recurring.find((r) => r.id === src.recurId) : null;
    f.repeat.value = series ? series.rule : 'none';
    renderTimePick();
    renderEdIcon();
    renderDur();
    renderEditSubs();
    el.editor.showModal();
    f.name.blur();
    if (!src) setTimeout(() => f.name.focus(), 60);
  }

  function renderEdIcon() {
    const d = ed.draft;
    f.iconBtn.className = 'ed-icon t-' + d.type;
    f.iconBtn.innerHTML = icon(d.icon || d.type);
    $$('.ic-opt', f.icons).forEach((b) => b.setAttribute('aria-checked', String((b.dataset.ic || null) === (d.icon || null))));
    f.icons.className = 'icon-grid t-' + d.type;
  }
  f.iconBtn.addEventListener('click', () => {
    f.icons.hidden = !f.icons.hidden;
    f.iconBtn.setAttribute('aria-expanded', String(!f.icons.hidden));
  });
  f.icons.addEventListener('click', (e) => {
    const b = e.target.closest('.ic-opt');
    if (!b) return;
    ed.draft.icon = b.dataset.ic || null;
    renderEdIcon();
    f.icons.hidden = true;
    f.iconBtn.setAttribute('aria-expanded', 'false');
    f.iconBtn.focus();
  });
  f.types.addEventListener('change', (e) => { ed.draft.type = e.target.value; renderEdIcon(); });

  function renderTimePick() {
    const s = ed.draft.start;
    const mins = new Set(Array.from({ length: 12 }, (_, i) => i * 5));
    mins.add(s % 60);
    f.m.innerHTML = Array.from(mins).sort((a, b) => a - b).map((m) => '<option value="' + m + '">' + pad(m) + '</option>').join('');
    f.h.value = String(Math.floor(s / 60));
    f.m.value = String(s % 60);
  }
  const readStart = () => Number(f.h.value) * 60 + Number(f.m.value);
  [f.h, f.m].forEach((s) => s.addEventListener('change', () => { ed.draft.start = readStart(); renderDur(); }));

  function renderDur() {
    const d = ed.draft;
    f.dur.textContent = durText(d.dur);
    const s = readStart();
    f.end.textContent = ed.kind === 'block' ? 'Ende: ' + fmt(Math.min(s + d.dur, 24 * 60)) + ' Uhr' : 'Geschätzte Dauer, wenn du die Aufgabe einplanst.';
    $$('.chip', f.chips).forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.min) === d.dur)));
  }
  $$('[data-dur]', el.editor).forEach((btn) => btn.addEventListener('click', () => {
    ed.draft.dur = clamp(ed.draft.dur + Number(btn.dataset.dur) * 5, 5, 12 * 60);
    renderDur();
  }));
  f.chips.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    ed.draft.dur = Number(c.dataset.min);
    renderDur();
  });

  function renderEditSubs() {
    f.subs.innerHTML = ed.draft.subtasks.map((s) =>
      '<li data-sid="' + s.id + '"><label class="cb-only"><input type="checkbox"' + (s.done ? ' checked' : '') + ' aria-label="Erledigt"></label>' +
      '<input type="text" class="sub-text" value="' + esc(s.text) + '" maxlength="80" aria-label="Unteraufgabe" placeholder="Unteraufgabe">' +
      '<button type="button" class="icon-btn" data-remove aria-label="Unteraufgabe entfernen">' + icon('close') + '</button></li>').join('');
  }
  f.subs.addEventListener('input', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const s = ed.draft.subtasks.find((x) => x.id === li.dataset.sid);
    if (e.target.classList.contains('sub-text')) s.text = e.target.value;
    else if (e.target.type === 'checkbox') s.done = e.target.checked;
  });
  f.subs.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    ed.draft.subtasks.find((x) => x.id === e.target.closest('li').dataset.sid).done = e.target.checked;
  });
  f.subs.addEventListener('click', (e) => {
    if (!e.target.closest('[data-remove]')) return;
    const id = e.target.closest('li').dataset.sid;
    ed.draft.subtasks = ed.draft.subtasks.filter((x) => x.id !== id);
    renderEditSubs();
  });
  f.subs.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('sub-text')) { e.preventDefault(); addEditSub(); }
  });
  function addEditSub() {
    ed.draft.subtasks.push({ id: uid(), text: '', done: false });
    renderEditSubs();
    const inputs = $$('.sub-text', f.subs);
    inputs[inputs.length - 1].focus();
  }
  $('#ed-sub-add').addEventListener('click', addEditSub);
  f.name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#ed-form').requestSubmit(); } });

  function readDraft() {
    const d = ed.draft;
    d.title = f.name.value.trim() || TYPES[d.type].label;
    d.subtasks = d.subtasks.map((s) => ({ id: s.id, text: s.text.trim(), done: !!s.done })).filter((s) => s.text);
    if (ed.kind === 'block') d.start = readStart();
    return normBlock(d);
  }

  // ---------- Wiederholungen ----------
  function createSeries(nb, rule, k) {
    const r = normBlock(clone(nb));
    r.subtasks.forEach((s) => { s.done = false; });
    Object.assign(r, { id: uid(), rule, weekday: weekday(k), from: k, until: null, done: false });
    delete r.recurId;
    state.recurring.push(r);
    nb.recurId = r.id;
    Object.keys(state.days).forEach((kk) => {
      if (kk > k && ruleMatches(r, kk) && !state.days[kk].blocks.some((b) => b.recurId === r.id)) state.days[kk].blocks.push(recurringInstance(r));
    });
  }
  function recurringInstance(r) {
    const b = freshCopy(r);
    ['rule', 'weekday', 'from', 'until'].forEach((x) => delete b[x]);
    b.recurId = r.id;
    return normBlock(b);
  }
  function updateSeries(r, nb, rule, k) {
    Object.assign(r, { title: nb.title, type: nb.type, icon: nb.icon, start: nb.start, dur: nb.dur, rule, subtasks: nb.subtasks.map((s) => ({ id: uid(), text: s.text, done: false })) });
    if (rule === 'weekly') r.weekday = weekday(k);
    Object.keys(state.days).forEach((kk) => {
      if (kk <= k) return;
      const day = state.days[kk];
      day.blocks = day.blocks.filter((b) => b.recurId !== r.id);
      if (ruleMatches(r, kk)) day.blocks.push(recurringInstance(r));
    });
  }
  function endSeries(r, k) {
    r.until = addDays(k, -1);
    if (r.until < r.from) state.recurring = state.recurring.filter((x) => x !== r);
    Object.keys(state.days).forEach((kk) => {
      if (kk > k) state.days[kk].blocks = state.days[kk].blocks.filter((b) => b.recurId !== r.id);
    });
  }

  $('#ed-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nb = readDraft();
    const k = ed.day;
    if (ed.kind === 'inbox') {
      const id = ed.id;
      el.editor.close();
      mutate(id ? 'Gespeichert.' : 'In „Später“ abgelegt.', () => {
        if (id) { const i = state.inbox.findIndex((x) => x.id === id); if (i >= 0) state.inbox[i] = nb; }
        else state.inbox.unshift(nb);
      });
      return;
    }
    const rule = f.repeat.value;
    const orig = ed.id ? getDay(k).blocks.find((x) => x.id === ed.id) : null;
    const series = orig && orig.recurId ? state.recurring.find((r) => r.id === orig.recurId) : null;
    let scope = 'this';
    if (series && rule !== 'none') {
      const changed = rule !== series.rule || ['title', 'type', 'icon', 'start', 'dur'].some((x) => nb[x] !== orig[x]) ||
        JSON.stringify(nb.subtasks.map((s) => s.text)) !== JSON.stringify(orig.subtasks.map((s) => s.text));
      if (changed) {
        const v = await choose({ title: 'Wiederholten Block ändern', options: [
          { value: 'future', label: 'Diesen und alle folgenden', desc: 'Ab ' + relName(k) + ', ' + dateShort.format(keyToDate(k)), icon: 'repeat' },
          { value: 'this', label: 'Nur diesen Tag', icon: 'calendar' }] });
        if (!v) return;
        scope = v;
      }
    }
    const isNew = !orig;
    el.editor.close();
    mutate(isNew ? 'Block hinzugefügt.' : 'Gespeichert.', () => {
      const day = materialize(k);
      if (orig) { const i = day.blocks.findIndex((x) => x.id === orig.id); day.blocks[i] = nb; } else day.blocks.push(nb);
      if (series) {
        if (rule === 'none') { endSeries(series, k); delete nb.recurId; }
        else if (scope === 'future') updateSeries(series, nb, rule, k);
      } else if (rule !== 'none') createSeries(nb, rule, k);
      clearDrafts();
      viewKey = k;
    });
    if (isNew) scrollToItem(nb.id);
  });

  f.dup.addEventListener('click', () => { const id = ed.id; el.editor.close(); duplicateBlock(id); });
  f.later.addEventListener('click', () => { const id = ed.id; el.editor.close(); blockToLater(id); });
  f.sched.addEventListener('click', () => {
    const nb = readDraft();
    const id = ed.id;
    el.editor.close();
    const i = state.inbox.findIndex((x) => x.id === id);
    if (i >= 0) state.inbox[i] = nb;
    scheduleInbox(id);
  });
  f.del.addEventListener('click', async () => {
    const id = ed.id, k = ed.day;
    if (ed.kind === 'inbox') {
      el.editor.close();
      const it = state.inbox.find((x) => x.id === id);
      mutate('„' + it.title + '“ gelöscht.', () => { state.inbox = state.inbox.filter((x) => x.id !== id); });
      return;
    }
    const b = getDay(k).blocks.find((x) => x.id === id);
    const series = b && b.recurId ? state.recurring.find((r) => r.id === b.recurId) : null;
    if (series) {
      const v = await choose({ title: 'Wiederholten Block löschen', options: [
        { value: 'this', label: 'Nur diesen Tag', icon: 'calendar' },
        { value: 'future', label: 'Diesen und alle folgenden', desc: 'Die Wiederholung endet', icon: 'repeat', danger: true }] });
      if (!v) return;
      el.editor.close();
      mutate('„' + b.title + '“ gelöscht.', () => {
        const d = materialize(k);
        d.blocks = d.blocks.filter((x) => x.id !== id);
        if (v === 'future') endSeries(series, k);
        clearDrafts();
      });
      return;
    }
    el.editor.close();
    deleteBlock(id);
  });

  // ==================================================================
  // Mehr / Einstellungen
  // ==================================================================
  $('#legend').innerHTML = TYPE_ORDER.map((t) =>
    '<li class="t-' + t + '"><span class="mini-bubble">' + icon(t) + '</span><span><b>' + esc(TYPES[t].label) + '</b><small>' + esc(TYPES[t].hint) + '</small></span></li>').join('');
  const s = {
    newDay: $('#s-newday'), contrast: $('#s-contrast'), start: $('#s-start'), end: $('#s-end'),
    sound: $('#s-sound'), vibrate: $('#s-vibrate'), notify: $('#s-notify')
  };
  function openMore() {
    s.newDay.innerHTML = '<option value="role">Rollen-Vorlage (' + esc(ROLES[state.role].name) + ')</option>' +
      '<option value="custom"' + (state.custom && state.custom.length ? '' : ' disabled') + '>Meine Vorlage' + (state.custom && state.custom.length ? '' : ' (noch keine)') + '</option>' +
      '<option value="empty">Leerer Tag</option>';
    s.newDay.value = state.newDay;
    $$('input[name="theme"]', el.more).forEach((r) => { r.checked = r.value === state.theme; });
    $$('input[name="palette"]', el.more).forEach((r) => { r.checked = r.value === state.palette; });
    $$('input[name="snap"]', el.more).forEach((r) => { r.checked = Number(r.value) === state.snap; });
    s.contrast.checked = state.contrast;
    s.start.innerHTML = Array.from({ length: 23 }, (_, i) => '<option value="' + i * 60 + '">' + pad(i) + ':00</option>').join('');
    s.start.value = String(state.dayStart);
    fillEnd();
    s.sound.checked = state.reminders.sound;
    s.vibrate.checked = state.reminders.vibrate;
    s.notify.checked = state.reminders.notify && 'Notification' in window && Notification.permission === 'granted';
    $('#s-notify-hint').textContent = !('Notification' in window) ? 'Dieser Browser unterstützt keine Benachrichtigungen.'
      : Notification.permission === 'denied' ? 'Im Browser blockiert – bitte in den Website-Einstellungen erlauben.'
      : 'Funktioniert, solange die App geöffnet ist (auch im Hintergrund).';
    $('#s-role').textContent = ROLES[state.role].name;
    el.more.showModal();
  }
  function fillEnd() {
    const st = Number(s.start.value);
    let html = '';
    for (let h = st / 60 + 2; h <= 24; h++) html += '<option value="' + h * 60 + '">' + pad(h) + ':00</option>';
    s.end.innerHTML = html;
    s.end.value = String(Math.max(state.dayEnd, st + 120));
  }
  $('#btn-more').addEventListener('click', openMore);
  $('#btn-more-top').addEventListener('click', openMore);

  el.more.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.name === 'theme') { state.theme = t.value; save(); applyTheme(); }
    else if (t.name === 'palette') { state.palette = t.value; save(); applyTheme(); }
    else if (t.name === 'snap') { state.snap = Number(t.value); save(); }
    else if (t === s.contrast) { state.contrast = t.checked; save(); applyTheme(); }
    else if (t === s.newDay) { state.newDay = t.value; clearDrafts(); save(); render(); }
    else if (t === s.start) { state.dayStart = Number(t.value); fillEnd(); state.dayEnd = Number(s.end.value); save(); render(); }
    else if (t === s.end) { state.dayEnd = Number(t.value); save(); render(); }
    else if (t === s.sound) { state.reminders.sound = t.checked; save(); if (t.checked) chime(); }
    else if (t === s.vibrate) { state.reminders.vibrate = t.checked; save(); haptic(); }
    else if (t === s.notify) {
      if (!t.checked) { state.reminders.notify = false; save(); return; }
      if (!('Notification' in window)) { t.checked = false; toast('Benachrichtigungen werden hier nicht unterstützt.'); return; }
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') { t.checked = false; toast('Benachrichtigungen wurden nicht erlaubt.'); return; }
      state.reminders.notify = true; save();
    }
  });
  $('#s-test').addEventListener('click', () => {
    const { next } = nowInfo();
    fireReminder(next || normBlock({ title: 'Beispiel-Block', type: 'pause', start: 600, dur: 15 }), 10, true);
  });
  $('#s-role-btn').addEventListener('click', () => { el.more.close(); showOnboarding(true); });
  $('#m-replan').addEventListener('click', () => { el.more.close(); replan(); });
  $('#m-save-tpl').addEventListener('click', () => { el.more.close(); saveTemplate(); });
  $('#btn-replan').addEventListener('click', replan);
  $('#btn-replan-side').addEventListener('click', replan);
  $('#btn-save-tpl').addEventListener('click', saveTemplate);

  async function replan() {
    const k = viewKey;
    const opts = [{ value: 'role', label: 'Rollen-Vorlage', desc: ROLES[state.role].name, icon: 'refresh' }];
    if (state.custom && state.custom.length) opts.push({ value: 'custom', label: 'Meine Vorlage', desc: state.custom.length + ' Blöcke', icon: 'star' });
    opts.push({ value: 'empty', label: 'Leerer Tag', desc: state.recurring.length ? 'Wiederholungen bleiben' : 'Mit freier Zeitleiste starten', icon: 'minus' });
    const v = await choose({ title: relName(k) + ' neu planen', text: 'Der Plan dieses Tages wird ersetzt – du kannst es rückgängig machen.', options: opts });
    if (!v) return;
    mutate('Tag neu geplant.', () => {
      const en = (state.days[k] || {}).energy || null;
      state.days[k] = { blocks: baseBlocks(v).concat(recurringFor(k)), energy: en };
      openIds.clear();
      dismissPast(k);
    });
    if (isToday()) scrollToNow();
  }

  async function saveTemplate() {
    const blocks = viewDay().blocks.filter((b) => !b.recurId);
    if (!blocks.length) { toast('Dieser Tag ist leer – plane zuerst ein paar Blöcke.'); return; }
    mutate('Als deine Vorlage gespeichert.', () => { state.custom = blocks.map(freshCopy); });
    if (state.newDay !== 'custom') {
      const v = await choose({ title: 'Vorlage gespeichert', text: 'Sollen neue Tage automatisch mit deiner Vorlage starten?', options: [
        { value: 'yes', label: 'Ja, neue Tage damit starten', icon: 'star' },
        { value: 'no', label: 'Nein, nur bei „Tag neu planen“', icon: 'refresh' }] });
      if (v === 'yes') mutate('Neue Tage starten mit deiner Vorlage.', () => { state.newDay = 'custom'; clearDrafts(); });
    }
  }

  // ---------- Sicherung ----------
  $('#s-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'tagesplaner', version: 2, exportedAt: new Date().toISOString(), data: state }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tagesplaner-sicherung-' + todayKey() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Sicherung heruntergeladen.');
  });
  $('#s-import').addEventListener('click', () => $('#s-import-file').click());
  $('#s-import-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try {
      const obj = JSON.parse(await file.text());
      data = obj && obj.data ? obj.data : obj;
      if (!data || typeof data !== 'object' || !data.days || ![1, 2].includes(data.version)) throw new Error('Format');
    } catch (err) { toast('Diese Datei ist keine gültige Tagesplaner-Sicherung.'); return; }
    el.more.close();
    const ok = await confirmDo('Sicherung importieren?', 'Alle aktuellen Daten auf diesem Gerät werden durch die Sicherung ersetzt.', 'Importieren');
    if (!ok) return;
    mutate('Sicherung importiert.', () => { state = sanitize(data.version === 1 ? fromV1(data) : data); clearDrafts(); viewKey = todayKey(); });
  });
  $('#s-reset').addEventListener('click', async () => {
    el.more.close();
    const ok = await confirmDo('Alle Daten löschen?', 'Pläne, Später-Liste, Vorlagen, Wiederholungen und Einstellungen werden von diesem Gerät entfernt.', 'Alles löschen', true);
    if (!ok) return;
    mutate('Alle Daten gelöscht.', () => { state = defaults(); clearDrafts(); tab = 'plan'; viewKey = todayKey(); });
  });
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; $('#s-install').hidden = false; });
  $('#s-install').addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    installEvent = null;
    $('#s-install').hidden = true;
  });

  // ==================================================================
  // Globale Aktionen
  // ==================================================================
  function addNew() { openEditor({ kind: tab === 'inbox' ? 'inbox' : 'block', day: tab === 'focus' ? todayKey() : viewKey }); }
  $('#fab').addEventListener('click', addNew);
  $('#btn-add-side').addEventListener('click', () => openEditor({ kind: 'block' }));

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || document.querySelector('dialog[open]');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !typing) { e.preventDefault(); undo(); }
    else if (e.key === 'Escape' && tab === 'focus' && !typing) setTab('plan');
  });

  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || drag || document.querySelector('dialog[open]')) return;
    state = load();
    clearDrafts();
    render();
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { el.sideNow._last = ''; render(); }, 150); });

  // ==================================================================
  // Start
  // ==================================================================
  render();
  if (state.role) scrollToNow();
  setInterval(() => { if (tab === 'focus' && !document.hidden && !drag) updateLive(); }, 1000);
  setInterval(() => { if (!drag) updateLive(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateLive(); });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service Worker nicht registriert:', err));
    });
  }

  // Für Tests / Fehlersuche
  window.__tagesplaner = { get state() { return state; }, get G() { return G; }, PPM, TOP_PAD, undo };
})();
