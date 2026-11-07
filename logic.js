/* Reine Planung, ohne DOM. Auch von tests/logic.test.js geladen. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TagesplanerLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MIN_DUR = 5;
  const DAY = 24 * 60;
  const TYPES = ['deep', 'focused', 'reactive', 'meeting', 'pause', 'buffer', 'quick', 'flexible'];
  const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

  const pad = (n) => String(n).padStart(2, '0');

  function clamp(v, a, b) {
    if (!Number.isFinite(v)) return a;
    return Math.min(b, Math.max(a, v));
  }

  function fmt(min) {
    const m = Math.max(0, Math.round(Number(min) || 0));
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }

  function fmtEnd(min) {
    if (min >= DAY) return '24:00';
    return fmt(min);
  }

  function durText(d) {
    d = Math.round(Number(d) || 0);
    if (d < 60) return d + ' Min';
    const h = Math.floor(d / 60);
    const m = d % 60;
    if (!m) return h === 1 ? '1 Std' : h + ' Std';
    return h + ' Std ' + m + ' Min';
  }

  function dayKeyFromDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function keyToDate(k) {
    const p = String(k || '').split('-').map(Number);
    return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1);
  }

  function addDays(k, n) {
    const d = keyToDate(k);
    d.setDate(d.getDate() + n);
    return dayKeyFromDate(d);
  }

  function isSafeId(id) {
    return typeof id === 'string' && ID_RE.test(id);
  }

  function makeId() {
    const raw = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
    const id = raw.replace(/[^a-z0-9]/gi, '').slice(0, 20);
    return id || ('id' + Math.floor(Math.random() * 1e9));
  }

  function takeId(used, preferred) {
    if (isSafeId(preferred) && !used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    let id = makeId();
    let guard = 0;
    while ((!isSafeId(id) || used.has(id)) && guard < 20) {
      id = makeId();
      guard += 1;
    }
    used.add(id);
    return id;
  }

  function clampTime(start, dur) {
    let d = Math.round(Number(dur));
    if (!Number.isFinite(d)) d = 30;
    d = clamp(d, MIN_DUR, DAY);
    let s = Math.round(Number(start));
    if (!Number.isFinite(s)) s = 0;
    s = clamp(s, 0, DAY - d);
    return { start: s, dur: d };
  }

  function rangeLabel(start, dur) {
    const t = clampTime(start, dur);
    return fmt(t.start) + '–' + fmtEnd(t.start + t.dur);
  }

  function defaultTitle(type) {
    if (type === 'pause') return 'Pause';
    if (type === 'meeting') return 'Termin';
    return 'Aufgabe';
  }

  function defaults() {
    return {
      version: 2,
      role: null,
      palette: 'auto',
      theme: 'auto',
      contrast: false,
      snap: 15,
      dayStart: 8 * 60,
      dayEnd: 18 * 60,
      newDay: 'empty',
      custom: null,
      recurring: [],
      inbox: [],
      days: {},
      reminders: { sound: false, vibrate: false, notify: false, inApp: false },
      tipsSeen: false,
      onboarded: false
    };
  }

  function normReminders(r) {
    const src = r && typeof r === 'object' ? r : {};
    return {
      sound: !!src.sound,
      vibrate: !!src.vibrate,
      notify: !!src.notify,
      inApp: src.inApp === true
    };
  }

  function normBlock(b, used) {
    const src = b && typeof b === 'object' ? b : {};
    const type = TYPES.includes(src.type) ? src.type : 'focused';
    const time = clampTime(src.start, src.dur);
    const title = String(src.title == null ? '' : src.title).trim().slice(0, 80) || defaultTitle(type);
    const subtasks = [];
    if (Array.isArray(src.subtasks)) {
      src.subtasks.forEach((s) => {
        if (!s || !String(s.text || '').trim()) return;
        subtasks.push({
          id: takeId(used, s.id),
          text: String(s.text).trim().slice(0, 80),
          done: !!s.done
        });
      });
    }
    const block = {
      id: takeId(used, src.id),
      title,
      type,
      icon: typeof src.icon === 'string' && isSafeId(src.icon) ? src.icon : null,
      start: time.start,
      dur: time.dur,
      subtasks,
      done: !!src.done
    };
    return block;
  }

  function hourBound(value, fallback, min, max) {
    const n = Math.round(Number(value) / 60) * 60;
    if (!Number.isFinite(n)) return fallback;
    return clamp(n, min, max);
  }

  function unwrap(input) {
    let src = input;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
    if (src.data && typeof src.data === 'object' && !Array.isArray(src.data) && src.days == null) src = src.data;
    if (src.version === 1) {
      return {
        version: 2,
        role: src.role,
        palette: src.palette,
        snap: src.snap,
        days: src.days || {},
        inbox: src.inbox || [],
        recurring: src.recurring || []
      };
    }
    return src;
  }

  function sanitize(input) {
    const fresh = defaults();
    try {
      const src = unwrap(input);
      const st = defaults();
      if (typeof src.role === 'string' && src.role) st.role = src.role.slice(0, 40);
      if (['auto', 'cool', 'warm'].includes(src.palette)) st.palette = src.palette;
      if (['auto', 'light', 'dark'].includes(src.theme)) st.theme = src.theme;
      st.contrast = !!src.contrast;
      st.snap = src.snap === 5 || src.snap === 15 ? src.snap : fresh.snap;
      st.dayStart = hourBound(src.dayStart, fresh.dayStart, 0, 22 * 60);
      st.dayEnd = hourBound(src.dayEnd, Math.max(fresh.dayEnd, st.dayStart + 120), st.dayStart + 120, DAY);
      if (['role', 'custom', 'empty'].includes(src.newDay)) st.newDay = src.newDay;
      st.reminders = normReminders(src.reminders);
      st.tipsSeen = !!src.tipsSeen;
      st.onboarded = !!src.onboarded;

      const used = new Set();
      const recurMap = new Map();
      if (Array.isArray(src.recurring)) {
        src.recurring.forEach((r) => {
          if (!r || typeof r !== 'object') return;
          if (!['daily', 'weekdays', 'weekly'].includes(r.rule)) return;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.from || ''))) return;
          const oldId = r.id;
          const nb = normBlock(r, used);
          recurMap.set(String(oldId), nb.id);
          nb.rule = r.rule;
          nb.weekday = clamp(Math.round(Number(r.weekday) || 0), 0, 6);
          nb.from = String(r.from);
          nb.until = /^\d{4}-\d{2}-\d{2}$/.test(String(r.until || '')) ? String(r.until) : null;
          nb.done = false;
          st.recurring.push(nb);
        });
      }

      function link(block, raw) {
        if (!raw || raw.recurId == null || raw.recurId === '') return;
        const mapped = recurMap.get(String(raw.recurId));
        if (mapped) block.recurId = mapped;
      }

      if (Array.isArray(src.inbox)) {
        src.inbox.forEach((b) => {
          try {
            const nb = normBlock(b, used);
            link(nb, b);
            st.inbox.push(nb);
          } catch (e) { /* ein kaputter Eintrag */ }
        });
      }

      if (Array.isArray(src.custom)) {
        const custom = [];
        src.custom.forEach((b) => {
          try { custom.push(normBlock(b, used)); } catch (e) { /* überspringen */ }
        });
        st.custom = custom;
      }

      if (src.days && typeof src.days === 'object') {
        Object.keys(src.days).forEach((k) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
          const d = src.days[k] || {};
          const blocks = [];
          if (Array.isArray(d.blocks)) {
            d.blocks.forEach((b) => {
              if (!b || typeof b !== 'object') return;
              try {
                const nb = normBlock(b, used);
                link(nb, b);
                blocks.push(nb);
              } catch (e) { /* ein kaputter Block */ }
            });
          }
          st.days[k] = {
            blocks,
            energy: [1, 2, 3, 4, 5].includes(d.energy) ? d.energy : null
          };
        });
      }
      return { state: st, persist: true, corrupt: false };
    } catch (e) {
      return { state: fresh, persist: false, corrupt: true };
    }
  }

  function readStorage(raw) {
    if (raw == null || raw === '') return { state: defaults(), persist: true, corrupt: false };
    try {
      return sanitize(JSON.parse(raw));
    } catch (e) {
      return { state: defaults(), persist: false, corrupt: true };
    }
  }

  function alreadyUsing(st) {
    if (!st) return false;
    if (st.onboarded || st.role) return true;
    if (st.inbox && st.inbox.length) return true;
    if (st.recurring && st.recurring.length) return true;
    const days = st.days || {};
    return Object.keys(days).some((k) => days[k] && days[k].blocks && days[k].blocks.length);
  }

  function blocksForNewDay() {
    return [];
  }

  function overlaps(blocks, start, dur, ignoreId) {
    return (blocks || []).some((b) => b && b.id !== ignoreId && start < b.start + b.dur && b.start < start + dur);
  }

  function freeStart(blocks, dur, pref, dayStart, dayEnd) {
    const d = clampTime(0, dur).dur;
    const from = Number.isFinite(dayStart) ? dayStart : 8 * 60;
    const to = Number.isFinite(dayEnd) ? dayEnd : 18 * 60;
    if (pref != null && Number.isFinite(pref) && pref >= 0 && pref + d <= DAY && !overlaps(blocks, pref, d)) return pref;
    for (let s = from; s + d <= to; s += 15) if (!overlaps(blocks, s, d)) return s;
    let s = Math.ceil((blocks || []).reduce((m, b) => Math.max(m, b.start + b.dur), from) / 15) * 15;
    if (s + d > DAY) s = DAY - d;
    let guard = 0;
    while (overlaps(blocks, s, d) && s + 15 + d <= DAY && guard < 200) {
      s += 15;
      guard += 1;
    }
    return clampTime(s, d).start;
  }

  function suggestStart(blocks, dur, opts) {
    const o = opts || {};
    const d = clampTime(0, dur).dur;
    const dayStart = Number.isFinite(o.dayStart) ? o.dayStart : 8 * 60;
    const dayEnd = Number.isFinite(o.dayEnd) ? o.dayEnd : 18 * 60;
    const isToday = o.isToday !== false;
    const from = isToday && Number.isFinite(o.nowMin)
      ? Math.max(dayStart, Math.ceil(o.nowMin / 15) * 15)
      : dayStart;
    const limit = Math.min(DAY, Math.max(dayEnd, from + d));
    for (let s = from; s + d <= limit; s += 15) if (!overlaps(blocks, s, d, o.ignoreId)) return s;
    for (let s = dayStart; s + d <= dayEnd; s += 15) if (!overlaps(blocks, s, d, o.ignoreId)) return s;
    return freeStart(blocks, d, from, dayStart, dayEnd);
  }

  function isOpenTask(b) {
    return !!(b && !b.done && b.type !== 'pause' && b.type !== 'buffer');
  }

  function openTasks(blocks) {
    return (blocks || []).filter(isOpenTask);
  }

  function planTomorrow(open, tomorrowBlocks, opts) {
    const o = opts || {};
    const dest = (tomorrowBlocks || []).map((b) => ({ id: b.id, start: b.start, dur: b.dur }));
    const placed = [];
    const removeIds = [];
    (open || []).forEach((b) => {
      if (!isOpenTask(b)) return;
      const start = freeStart(dest, b.dur, b.start, o.dayStart, o.dayEnd);
      const copy = {
        title: b.title,
        type: b.type,
        icon: b.icon || null,
        start,
        dur: b.dur,
        subtasks: (b.subtasks || []).map((s) => ({ text: s.text, done: !!s.done })),
        done: false
      };
      placed.push(copy);
      dest.push({ id: 'new', start, dur: b.dur });
      removeIds.push(b.id);
    });
    return { placed, removeIds };
  }

  function dayEndMin(blocks) {
    return (blocks || []).reduce((m, b) => Math.max(m, b.start + b.dur), 0);
  }

  function shouldOfferWrap(blocks, nowMin) {
    if (!blocks || !blocks.length) return false;
    if (!(nowMin >= dayEndMin(blocks))) return false;
    return openTasks(blocks).length > 0;
  }

  function nowInfo(blocks, nowMin) {
    const list = (blocks || []).slice().sort((a, b) => a.start - b.start || a.dur - b.dur);
    let cur = null;
    let next = null;
    list.forEach((b) => {
      const end = b.start + b.dur;
      if (b.start <= nowMin && nowMin < end && (!cur || b.start >= cur.start)) cur = b;
      if (b.start > nowMin && !next) next = b;
    });
    return { cur, next, list };
  }

  function greeting(min) {
    if (min < 5 * 60 || min >= 22 * 60) return 'Gute Nacht';
    if (min < 11 * 60) return 'Guten Morgen';
    if (min < 14 * 60) return 'Hallo';
    if (min < 18 * 60) return 'Schönen Nachmittag';
    return 'Guten Abend';
  }

  function demoMinutes(search) {
    const q = new URLSearchParams(String(search || '').replace(/^\?/, '?')).get('zeit');
    if (!q) return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(q);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  function saveToast(saved, corrupt, label) {
    if (!saved && corrupt) return { kind: 'error', text: 'Die alten Daten sind beschädigt und bleiben unverändert.' };
    if (!saved) return { kind: 'error', text: 'Speichern hat nicht geklappt.' };
    if (label) return { kind: 'ok', text: label };
    return null;
  }

  return {
    MIN_DUR,
    DAY,
    TYPES,
    defaults,
    isSafeId,
    clampTime,
    rangeLabel,
    fmt,
    fmtEnd,
    durText,
    dayKeyFromDate,
    keyToDate,
    addDays,
    normBlock,
    sanitize,
    readStorage,
    alreadyUsing,
    blocksForNewDay,
    overlaps,
    freeStart,
    suggestStart,
    isOpenTask,
    openTasks,
    planTomorrow,
    dayEndMin,
    shouldOfferWrap,
    nowInfo,
    greeting,
    demoMinutes,
    saveToast
  };
});
