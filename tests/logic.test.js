'use strict';

const assert = require('assert');
const L = require('../logic.js');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  ' + name); }
  catch (e) { failed += 1; console.error('FAIL ' + name); console.error(e.stack || e); }
}

test('unsichere IDs werden ersetzt', () => {
  const used = new Set();
  const bad = L.takeId('"><img>', used);
  const kept = L.takeId('ok-id_1', used);
  const dup = L.takeId('ok-id_1', used);
  assert.ok(L.isSafeId(bad));
  assert.ok(!bad.includes('<'));
  assert.strictEqual(kept, 'ok-id_1');
  assert.notStrictEqual(dup, 'ok-id_1');
  assert.ok(L.isSafeId(dup));
});

test('Auf morgen nur wenn die Serie morgen wirklich gilt', () => {
  const weekly = { rule: 'weekly', weekday: 6, from: '2026-01-03', until: null };
  assert.strictEqual(L.ruleHits(weekly, '2026-11-07'), true);
  assert.strictEqual(L.ruleHits(weekly, '2026-11-08'), false);
  const daily = { rule: 'daily', weekday: 0, from: '2026-01-01', until: null };
  assert.strictEqual(L.ruleHits(daily, '2026-11-08'), true);
  assert.strictEqual(L.ruleHits({ rule: 'weekdays', from: '2026-01-01' }, '2026-11-07'), false);
  assert.strictEqual(L.ruleHits({ rule: 'weekdays', from: '2026-01-01' }, '2026-11-09'), true);
});

test('Arbeitsvorlage nicht am Wochenende', () => {
  assert.strictEqual(L.isWeekend('2026-11-07'), true);
  assert.strictEqual(L.isWeekend('2026-11-08'), true);
  assert.strictEqual(L.isWeekend('2026-11-09'), false);
});

test('Editor-Zeit ist die gespeicherte Zeit', () => {
  const t = L.fitTime(23 * 60, 150);
  assert.strictEqual(t.start, 21 * 60 + 30);
  assert.strictEqual(t.dur, 150);
  assert.strictEqual(t.start + t.dur, 24 * 60);
  assert.strictEqual(L.fitTime(10 * 60, 3).dur, 5);
});

test('ICS-UID bleibt bei anderer Uhrzeit gleich', () => {
  const block = { id: 'block1', recurId: 'serie1', title: 'Bericht', start: 9 * 60 };
  const uid = L.icsUid('2026-11-09', block);
  assert.strictEqual(uid, L.icsUid('2026-11-09', Object.assign({}, block, { start: 15 * 60, title: 'Anders' })));
  assert.notStrictEqual(uid, L.icsUid('2026-11-09', { id: 'block2', title: 'Bericht', start: 9 * 60 }));
  assert.ok(!uid.includes('<'));
});

test('Titel mit Uhrzeit spart das Eintippen der Zeit', () => {
  const hit = L.pullTime('14:30 Zahnarzt', 30);
  assert.strictEqual(hit.title, 'Zahnarzt');
  assert.strictEqual(hit.start, 14 * 60 + 30);
  assert.strictEqual(L.pullTime('Zahnarzt', 30), null);
  assert.strictEqual(L.pullTime('25:00 Nein', 30), null);
});

test('Alte Arten werden übernommen, der Block bleibt', () => {
  assert.strictEqual(L.canonicalType('deep'), 'deep');
  assert.strictEqual(L.canonicalType('focused'), 'deep');
  assert.strictEqual(L.canonicalType('reactive'), 'quick');
  assert.strictEqual(L.canonicalType('flexible'), 'quick');
  assert.strictEqual(L.canonicalType('meeting'), 'meeting');
  assert.strictEqual(L.canonicalType('pause'), 'pause');
  assert.strictEqual(L.canonicalType('buffer'), 'buffer');
  assert.strictEqual(L.canonicalType('quick'), 'quick');
  assert.strictEqual(L.canonicalType('unbekannt'), 'quick');
  assert.strictEqual(L.canonicalType(undefined), 'quick');
});

test('Erfolgstoast nur nach echtem Speichern', () => {
  assert.strictEqual(L.saveMessage(true, false, null), null);
  assert.strictEqual(L.saveMessage(true, false, 'Gespeichert.'), 'Gespeichert.');
  assert.ok(L.saveMessage(false, true, 'Gespeichert.').includes('nicht überschrieben'));
  assert.ok(!L.saveMessage(false, false, 'Gespeichert.').includes('Gespeichert'));
});

if (failed) {
  console.error(failed + ' fehlgeschlagen');
  process.exit(1);
}
console.log('alle tests ok');
