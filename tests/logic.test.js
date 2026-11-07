'use strict';

const assert = require('assert');
const L = require('../logic.js');

let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('ok  ' + name);
  } catch (e) {
    failed += 1;
    console.error('FAIL ' + name);
    console.error(e && e.stack ? e.stack : e);
  }
}

test('unsichere IDs werden ersetzt, sichere bleiben', () => {
  const raw = {
    version: 2,
    days: {
      '2026-11-09': {
        blocks: [
          {
            id: '"><img id="xss-probe">',
            title: 'Hi',
            type: 'quick',
            start: 600,
            dur: 15,
            subtasks: [{ id: 'y"><b id="xss-sub">', text: 'A', done: false }]
          },
          { id: 'ok-id_1', title: 'Bleibt', type: 'pause', start: 700, dur: 10, subtasks: [] }
        ]
      }
    }
  };
  const { state, persist, corrupt } = L.sanitize(raw);
  const blocks = state.days['2026-11-09'].blocks;
  assert.strictEqual(persist, true);
  assert.strictEqual(corrupt, false);
  assert.ok(L.isSafeId(blocks[0].id));
  assert.ok(L.isSafeId(blocks[0].subtasks[0].id));
  assert.strictEqual(blocks[1].id, 'ok-id_1');
  assert.ok(!JSON.stringify(state).includes('<'));
  assert.ok(!JSON.stringify(state).includes('xss-probe'));
});

test('doppelte IDs werden eindeutig', () => {
  const { state } = L.sanitize({
    version: 2,
    days: {
      '2026-11-09': {
        blocks: [
          { id: 'same', title: 'Eins', type: 'focused', start: 480, dur: 30 },
          { id: 'same', title: 'Zwei', type: 'focused', start: 540, dur: 30 }
        ]
      }
    }
  });
  const ids = state.days['2026-11-09'].blocks.map((b) => b.id);
  assert.strictEqual(ids[0], 'same');
  assert.notStrictEqual(ids[1], 'same');
  assert.ok(L.isSafeId(ids[1]));
});

test('ein kaputter Block wirft sanitize nicht um', () => {
  const { state } = L.sanitize({
    version: 2,
    days: {
      '2026-11-09': {
        blocks: [null, { title: 'Gut', start: 480, dur: 20 }, { title: 12, dur: 'x' }]
      }
    }
  });
  const blocks = state.days['2026-11-09'].blocks;
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0].title, 'Gut');
  assert.ok(blocks[1].dur >= L.MIN_DUR);
});

test('kaputtes JSON wird nicht überschrieben', () => {
  const bad = L.readStorage('{');
  assert.strictEqual(bad.persist, false);
  assert.strictEqual(bad.corrupt, true);
  assert.deepStrictEqual(bad.state.days, {});
  const empty = L.readStorage(null);
  assert.strictEqual(empty.persist, true);
  assert.strictEqual(empty.corrupt, false);
});

test('Export-Hülle und Erinnerungen standardmäßig aus', () => {
  const { state } = L.sanitize({
    app: 'tagesplaner',
    version: 2,
    data: {
      version: 2,
      role: 'dev',
      reminders: { sound: false, vibrate: true, notify: false },
      days: { '2026-11-09': { blocks: [{ title: 'Alt', type: 'deep', start: 540, dur: 30 }], energy: 4 } }
    }
  });
  assert.strictEqual(state.role, 'dev');
  assert.strictEqual(state.reminders.inApp, false);
  assert.strictEqual(state.reminders.vibrate, true);
  assert.strictEqual(state.days['2026-11-09'].blocks[0].title, 'Alt');
  assert.strictEqual(state.days['2026-11-09'].energy, 4);
});

test('Vorlagen und Serien füllen keine neuen Tage, bleiben aber gespeichert', () => {
  const { state } = L.sanitize({
    version: 2,
    role: 'dev',
    newDay: 'role',
    custom: [{ title: 'Stand-up', type: 'meeting', start: 9 * 60, dur: 15 }],
    recurring: [{ id: 'w', title: 'Wochenbericht', type: 'deep', start: 10 * 60, dur: 30, rule: 'weekly', weekday: 6, from: '2026-01-03', until: null }]
  });
  assert.strictEqual(L.blocksForNewDay('2026-11-07', state).length, 0);
  assert.strictEqual(L.blocksForNewDay('2026-11-09', state).length, 0);
  assert.strictEqual(state.role, 'dev');
  assert.strictEqual(state.custom[0].title, 'Stand-up');
  assert.strictEqual(state.recurring[0].rule, 'weekly');
  assert.ok(L.isSafeId(state.recurring[0].id));
});

test('Offenes wird mitgenommen, Pausen bleiben', () => {
  const open = [{
    id: 'occ', title: 'Wochenbericht', type: 'deep', start: 9 * 60, dur: 30, done: false, recurId: 's1',
    subtasks: [{ text: 'Entwurf', done: true }]
  }];
  const moved = L.planTomorrow(open, [], { dayStart: 8 * 60, dayEnd: 18 * 60 });
  assert.strictEqual(moved.placed.length, 1);
  assert.strictEqual(moved.placed[0].title, 'Wochenbericht');
  assert.strictEqual(moved.placed[0].subtasks[0].done, true);
  assert.deepStrictEqual(moved.removeIds, ['occ']);
  const pause = L.planTomorrow(
    [{ id: 'p', title: 'Mittag', type: 'pause', start: 12 * 60, dur: 45, done: false, subtasks: [] }],
    [],
    {}
  );
  assert.strictEqual(pause.placed.length, 0);
  assert.strictEqual(pause.removeIds.length, 0);
});

test('freie Lücke überlappt nicht', () => {
  const blocks = [{ id: 'a', start: 8 * 60, dur: 60 }];
  const start = L.suggestStart(blocks, 30, { nowMin: 8 * 60, isToday: true, dayStart: 8 * 60, dayEnd: 18 * 60 });
  assert.strictEqual(start, 9 * 60);
  assert.strictEqual(L.overlaps(blocks, start, 30), false);
  const busy = [{ id: 'b', start: 9 * 60, dur: 60 }];
  const plan = L.planTomorrow(
    [{ id: 'n', title: 'Neu', type: 'focused', start: 9 * 60, dur: 30, done: false, subtasks: [] }],
    busy,
    { dayStart: 8 * 60, dayEnd: 18 * 60 }
  );
  assert.notStrictEqual(plan.placed[0].start, 9 * 60);
  assert.strictEqual(L.overlaps(busy, plan.placed[0].start, 30), false);
});

test('Editor zeigt die Zeit, die gespeichert wird', () => {
  const t = L.clampTime(23 * 60, 150);
  assert.strictEqual(t.start, 21 * 60 + 30);
  assert.strictEqual(t.dur, 150);
  assert.strictEqual(L.rangeLabel(23 * 60, 150), '21:30–24:00');
  assert.strictEqual(L.clampTime(10 * 60, 3).dur, 5);
  assert.strictEqual(L.MIN_DUR, 5);
});

test('Demo-Zeit', () => {
  assert.strictEqual(L.demoMinutes('?zeit=10:30'), 10 * 60 + 30);
  assert.strictEqual(L.demoMinutes('?zeit=25:00'), null);
  assert.strictEqual(L.demoMinutes('?zeit=10:99'), null);
});

test('Erfolgstoast nur nach echtem Speichern', () => {
  assert.strictEqual(L.saveToast(true, false, null), null);
  assert.strictEqual(L.saveToast(true, false, 'Geschafft').kind, 'ok');
  assert.strictEqual(L.saveToast(false, true, 'Geschafft').kind, 'error');
  assert.ok(!L.saveToast(false, false, 'Geschafft').text.includes('Geschafft'));
});

if (failed) {
  console.error(failed + ' fehlgeschlagen');
  process.exit(1);
}
console.log('alle tests ok');
