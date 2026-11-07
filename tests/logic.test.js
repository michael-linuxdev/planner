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

test('Unberührte Wochenend-Vorlage ist erkennbar, bearbeitete nicht', () => {
  const template = [
    { title: 'Stand-up', type: 'meeting', start: 540, dur: 15, icon: null, subtasks: [], done: false }
  ];
  assert.strictEqual(L.isPristineTemplate(template, template), true);
  assert.strictEqual(L.isPristineTemplate([
    { title: 'Stand-up', type: 'meeting', start: 540, dur: 15, icon: null, subtasks: [{ text: 'A', done: true }], done: false }
  ], template), false);
  assert.strictEqual(L.isPristineTemplate(template.concat([
    { title: 'Extra', type: 'quick', start: 600, dur: 30, subtasks: [], done: false }
  ]), template), false);
  assert.strictEqual(L.isPristineTemplate([
    { title: 'Stand-up', type: 'meeting', start: 600, dur: 15, icon: null, subtasks: [], done: false }
  ], template), false);
  assert.strictEqual(L.isPristineTemplate([
    template[0],
    { title: 'Serie', type: 'deep', start: 700, dur: 30, recurId: 'r', subtasks: [], done: true }
  ], template), false);
});

test('Vorschläge kommen aus der Rolle und kennen die Lücken', () => {
  const catalog = [
    { title: 'Posts schreiben', type: 'deep', dur: 90, start: 9 * 60, icon: 'pen' },
    { title: 'Pause', type: 'pause', dur: 15, start: 11 * 60, icon: 'pause' },
    { title: 'Reporting', type: 'quick', dur: 30, start: 16 * 60, icon: 'chart' },
    { title: 'Kundenabstimmung', type: 'meeting', dur: 45, start: 13 * 60, icon: 'phone' },
    { title: 'Puffer', type: 'buffer', dur: 15, start: 12 * 60, icon: 'buffer' }
  ];
  const morning = L.pickSuggestions(catalog, [], 8 * 60 + 30);
  assert.strictEqual(morning[0].title, 'Pause');
  assert.strictEqual(morning[0].type, 'pause');
  assert.ok(morning.some((s) => s.title === 'Posts schreiben'));
  assert.ok(!morning.some((s) => s.type === 'buffer'));
  assert.ok(morning.length <= 4);
  const withPause = L.pickSuggestions(catalog, [{ title: 'Posts schreiben', type: 'deep' }], 8 * 60);
  assert.ok(!withPause.some((s) => s.title === 'Posts schreiben'));
  assert.strictEqual(withPause[0].type, 'pause');
  const full = L.pickSuggestions(catalog, [
    { title: 'Pause', type: 'pause' },
    { title: 'Reporting', type: 'quick' },
    { title: 'Kundenabstimmung', type: 'meeting' }
  ], 16 * 60);
  assert.ok(!full.some((s) => s.type === 'pause' && s.title === 'Pause'));
  assert.ok(!full.some((s) => s.title === 'Reporting'));
  assert.strictEqual(full[0].title, 'Posts schreiben');
});

test('Überlappung bleibt markiert, Nachfolgende rücken nach', () => {
  const blocks = [
    { id: 'a', start: 15 * 60 + 45, dur: 70 },
    { id: 'b', start: 16 * 60 + 45, dur: 45 },
    { id: 'c', start: 17 * 60 + 30, dur: 30 }
  ];
  const slices = L.overlapSlices(blocks);
  const a = slices.find((s) => s.id === 'a').slices;
  const b = slices.find((s) => s.id === 'b').slices;
  assert.deepStrictEqual(a, [{ start: 16 * 60 + 45, end: 16 * 60 + 55 }]);
  assert.deepStrictEqual(b, [{ start: 16 * 60 + 45, end: 16 * 60 + 55 }]);
  assert.strictEqual(L.overlapSlices([{ id: 'a', start: 9 * 60, dur: 30 }, { id: 'b', start: 10 * 60, dur: 30 }]).length, 0);
  const pushed = L.pushFollowing(blocks, 'a');
  assert.strictEqual(pushed.find((x) => x.id === 'a').start, 15 * 60 + 45);
  assert.strictEqual(pushed.find((x) => x.id === 'b').start, 16 * 60 + 55);
  assert.strictEqual(pushed.find((x) => x.id === 'c').start, 16 * 60 + 55 + 45);
  const earlier = L.pushFollowing([
    { id: 'early', start: 15 * 60, dur: 90 },
    { id: 'late', start: 16 * 60, dur: 30 }
  ], 'late');
  assert.strictEqual(earlier.find((x) => x.id === 'early').start, 15 * 60);
});

test('Wischen nach rechts hakelt ab, senkrecht bleibt Scrollen', () => {
  assert.strictEqual(L.swipeDone(48, 0), true);
  assert.strictEqual(L.swipeDone(80, 20), true);
  assert.strictEqual(L.swipeDone(40, 0), false);
  assert.strictEqual(L.swipeDone(48, 40), false);
  assert.strictEqual(L.swipeDone(-60, 0), false);
  assert.strictEqual(L.swipeDone(10, 4), false);
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
