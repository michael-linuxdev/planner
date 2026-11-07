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

  function halfOf(block, lunchStart, lunchEnd) {
    if (!block) return 'am';
    if (block.lunch) return 'lunch';
    if (block.fixed === false && (block.half === 'am' || block.half === 'pm')) return block.half;
    return block.start < lunchStart ? 'am' : 'pm';
  }

  function placeFlex(blocks, opts) {
    const lunchStart = opts.lunchStart;
    const lunchEnd = opts.lunchEnd;
    const dayStart = Math.min(opts.dayStart, lunchStart);
    const dayEnd = Math.max(opts.dayEnd, lunchEnd);
    const list = (blocks || []).filter((b) => b && b.id != null).map((b) => ({
      id: b.id,
      start: b.start,
      dur: Math.max(5, b.dur || 30),
      fixed: !!(b.lunch || b.fixed !== false),
      half: b.half === 'am' || b.half === 'pm' ? b.half : null,
      rank: Number.isFinite(Number(b.rank)) ? Number(b.rank) : b.start,
      lunch: !!b.lunch
    }));
    function gaps(from, to, occupied) {
      const occ = occupied.map((b) => ({
        s: Math.max(b.start, from),
        e: Math.min(b.start + b.dur, to)
      })).filter((b) => b.e > b.s).sort((a, c) => a.s - c.s);
      const out = [];
      let cursor = from;
      occ.forEach((b) => {
        if (b.s > cursor) out.push([cursor, b.s]);
        cursor = Math.max(cursor, b.e);
      });
      if (cursor < to) out.push([cursor, to]);
      return out;
    }
    function pack(items, from, to, occupied) {
      const slots = gaps(from, to, occupied);
      const placed = [];
      items.forEach((item) => {
        let fit = null;
        for (let i = 0; i < slots.length; i++) {
          const room = slots[i][1] - slots[i][0];
          if (room >= item.dur) { fit = slots[i][0]; slots[i][0] += item.dur; break; }
        }
        if (fit == null) {
          const tail = slots.length ? slots[slots.length - 1][1] : to;
          fit = Math.min(Math.max(tail, from), Math.max(from, DAY - item.dur));
        }
        placed.push({ id: item.id, start: fit, dur: item.dur });
      });
      return placed;
    }
    const fixed = list.filter((b) => b.fixed && !b.lunch);
    const byRank = (a, b) => a.rank - b.rank || a.start - b.start;
    const am = list.filter((b) => !b.fixed && !b.lunch && halfOf(b, lunchStart, lunchEnd) === 'am').sort(byRank);
    const pm = list.filter((b) => !b.fixed && !b.lunch && halfOf(b, lunchStart, lunchEnd) === 'pm').sort(byRank);
    return pack(am, dayStart, lunchStart, fixed).concat(pack(pm, lunchEnd, Math.min(DAY, Math.max(dayEnd, lunchEnd)), fixed));
  }

  function overlapSlices(blocks) {
    const list = (blocks || []).filter((b) => b && b.id != null && Number.isFinite(b.start) && Number.isFinite(b.dur));
    return list.map((a) => {
      const slices = [];
      list.forEach((b) => {
        if (b.id === a.id) return;
        const start = Math.max(a.start, b.start);
        const end = Math.min(a.start + a.dur, b.start + b.dur);
        if (end > start) slices.push({ start, end });
      });
      slices.sort((x, y) => x.start - y.start);
      const merged = [];
      slices.forEach((s) => {
        const last = merged[merged.length - 1];
        if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
        else merged.push({ start: s.start, end: s.end });
      });
      return { id: a.id, slices: merged };
    }).filter((x) => x.slices.length);
  }

  function pushFollowing(blocks, id) {
    const list = (blocks || []).filter((b) => b && b.id != null).map((b) => ({ id: b.id, start: b.start, dur: b.dur }));
    list.sort((a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id)));
    const anchor = list.find((b) => b.id === id);
    if (!anchor) return list;
    let cursor = anchor.start + anchor.dur;
    list.forEach((b) => {
      if (b.id === id || b.start < anchor.start) return;
      if (b.start < cursor) {
        b.start = Math.min(Math.max(cursor, 0), Math.max(0, DAY - b.dur));
        cursor = b.start + b.dur;
      } else cursor = Math.max(cursor, b.start + b.dur);
    });
    return list;
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

  return { isSafeId, takeId, weekday, isWeekend, fitTime, ruleHits, icsUid, saveMessage, pullTime, isPristineTemplate, pickSuggestions, swipeDone, overlapSlices, pushFollowing, halfOf, placeFlex, DAY };
});
