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

  const TYPE_KEEP = { deep: 'deep', meeting: 'meeting', pause: 'pause', buffer: 'buffer', quick: 'quick' };
  const TYPE_MERGE = { focused: 'deep', reactive: 'quick', flexible: 'quick' };

  function canonicalType(type) {
    if (TYPE_KEEP[type]) return TYPE_KEEP[type];
    if (TYPE_MERGE[type]) return TYPE_MERGE[type];
    return 'quick';
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

  return { isSafeId, takeId, weekday, isWeekend, fitTime, ruleHits, icsUid, saveMessage, pullTime, canonicalType, DAY };
});
