/* Kleine reine Helfer für die v3.1-App. Kein DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TagesplanerLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  const DAY = 24 * 60;

  function pad(n) { return String(n).padStart(2, '0'); }
  function isSafeId(id) { return typeof id === 'string' && ID_RE.test(id); }

  function takeId(preferred, used) {
    if (isSafeId(preferred) && (!used || !used.has(preferred))) {
      if (used) used.add(preferred);
      return preferred;
    }
    let id = (Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)).replace(/[^a-z0-9]/gi, '');
    if (!id) id = 'id';
    while (used && used.has(id)) id += Math.floor(Math.random() * 10);
    if (used) used.add(id);
    return id.slice(0, 40);
  }

  function weekday(dayKey) {
    const p = String(dayKey || '').split('-').map(Number);
    return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1).getDay();
  }

  function isWeekend(dayKey) {
    const d = weekday(dayKey);
    return d === 0 || d === 6;
  }

  function fitTime(start, dur) {
    let d = Math.round(Number(dur));
    if (!Number.isFinite(d)) d = 30;
    d = Math.min(DAY, Math.max(5, d));
    let s = Math.round(Number(start));
    if (!Number.isFinite(s)) s = 0;
    s = Math.min(DAY - d, Math.max(0, s));
    return { start: s, dur: d };
  }

  function ruleHits(rule, dayKey) {
    if (!rule || !/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey || ''))) return false;
    if (rule.from && dayKey < rule.from) return false;
    if (rule.until && dayKey > rule.until) return false;
    const wd = weekday(dayKey);
    if (rule.rule === 'daily') return true;
    if (rule.rule === 'weekdays') return wd >= 1 && wd <= 5;
    if (rule.rule === 'weekly') return wd === Number(rule.weekday);
    return false;
  }

  function icsUid(dayKey, block) {
    const stable = String((block && (block.recurId || block.id)) || 'block').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'block';
    return String(dayKey || '').replace(/[^0-9]/g, '').slice(0, 8) + '-' + stable + '@planner.micana.de';
  }

  function saveMessage(saved, corrupt, label) {
    if (!saved && corrupt) return 'Gespeicherte Daten sind beschädigt und werden nicht überschrieben.';
    if (!saved) return 'Speichern nicht möglich – der Speicher ist voll oder gesperrt.';
    return label || null;
  }

  function fingerprint(b) {
    return JSON.stringify({
      t: b.title,
      y: b.type,
      s: b.start,
      d: b.dur,
      i: b.icon || null,
      u: (b.subtasks || []).map((s) => [s.text, !!s.done]),
      done: !!b.done
    });
  }

  function isPristineTemplate(blocks, templateBlocks) {
    const own = (blocks || []).filter((b) => !b.recurId);
    const expected = templateBlocks || [];
    if (own.length !== expected.length) return false;
    const A = own.map(fingerprint).sort();
    const B = expected.map(fingerprint).sort();
    for (let i = 0; i < A.length; i += 1) if (A[i] !== B[i]) return false;
    return (blocks || []).filter((b) => b.recurId).every((b) => !b.done && !(b.subtasks || []).some((s) => s.done));
  }

  function pickSuggestions(catalog, existing, nowMin) {
    const have = new Set((existing || []).map((b) => b.title));
    const hasPause = (existing || []).some((b) => b.type === 'pause');
    const out = [];
    if (!hasPause) {
      const pause = (catalog || []).find((c) => c.type === 'pause');
      out.push({
        title: pause ? pause.title : 'Kurze Pause',
        type: 'pause',
        dur: pause && pause.dur ? pause.dur : 15,
        icon: (pause && pause.icon) || 'pause'
      });
    }
    const ranked = (catalog || [])
      .filter((c) => c && c.type !== 'buffer' && !have.has(c.title))
      .map((c) => ({
        title: c.title,
        type: c.type,
        dur: c.dur,
        icon: c.icon || c.type,
        score: Math.abs((c.start == null ? nowMin : c.start) - nowMin)
      }))
      .sort((a, b) => a.score - b.score);
    ranked.forEach((c) => {
      if (out.length >= 4) return;
      if (out.some((s) => s.title === c.title)) return;
      out.push({ title: c.title, type: c.type, dur: c.dur, icon: c.icon });
    });
    return out.slice(0, 4);
  }

  function swipeDone(dx, dy) {
    return dx >= 48 && dx > Math.abs(dy) * 1.5;
  }

  function pullTime(title, dur) {
    const m = /^(\d{1,2})[:.](\d{2})\s+(.+)$/.exec(String(title || '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    const fit = fitTime(h * 60 + min, dur);
    return { title: m[3].slice(0, 80), start: fit.start, dur: fit.dur };
  }

  return { isSafeId, takeId, weekday, isWeekend, fitTime, ruleHits, icsUid, saveMessage, pullTime, isPristineTemplate, pickSuggestions, swipeDone, DAY };
});
