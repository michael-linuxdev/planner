/* Tagesplaner – eine Ansicht, eine Aktion. Daten bleiben lokal. */
'use strict';

(function () {
  const L = window.TagesplanerLogic;
  const KEY = 'tagesplaner.v2';
  const KEEP_DAYS = 90;
  const ADD_MIN = 30;

  const $ = (s) => document.querySelector(s);

  function h(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v == null) return;
        if (k === 'class') n.className = v;
        else n.setAttribute(k, String(v));
      });
    }
    if (text != null) n.textContent = text;
    return n;
  }

  const loaded = L.readStorage((() => {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  })());
  let state = loaded.state;
  let persistAllowed = loaded.persist;
  const corrupt = loaded.corrupt;
  const drafts = {};
  const undoStack = [];
  let busy = false;
  let liveHeroId = null;
  let ed = null;

  const dateFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  function nowDate() {
    const d = new Date();
    const demo = L.demoMinutes(location.search);
    if (demo != null) d.setHours(Math.floor(demo / 60), demo % 60, 0, 0);
    return d;
  }
  function todayKey() { return L.dayKeyFromDate(nowDate()); }
  function nowMin() {
    const d = nowDate();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }
  let lastToday = todayKey();

  function collectUsed() {
    const used = new Set();
    const walk = (b) => {
      if (!b) return;
      if (b.id) used.add(b.id);
      (b.subtasks || []).forEach((s) => { if (s && s.id) used.add(s.id); });
    };
    (state.recurring || []).forEach(walk);
    (state.inbox || []).forEach(walk);
    (state.custom || []).forEach(walk);
    Object.keys(state.days || {}).forEach((k) => (state.days[k].blocks || []).forEach(walk));
    return used;
  }

  function clearDrafts() {
    Object.keys(drafts).forEach((k) => delete drafts[k]);
  }

  function getDay(k) {
    if (state.days[k]) return state.days[k];
    if (!drafts[k]) drafts[k] = { blocks: [], energy: null };
    return drafts[k];
  }

  function materialize(k) {
    if (!state.days[k]) {
      state.days[k] = getDay(k);
      delete drafts[k];
    }
    return state.days[k];
  }

  function save() {
    if (!persistAllowed) return false;
    try {
      const cutoff = L.addDays(todayKey(), -KEEP_DAYS);
      Object.keys(state.days).forEach((k) => { if (k < cutoff) delete state.days[k]; });
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  let toastTimer = null;
  function hideToast() {
    const t = $('#toast');
    t.hidden = true;
    t.replaceChildren();
  }
  function toast(msg, action) {
    const t = $('#toast');
    t.replaceChildren(h('span', null, msg));
    const act = typeof action === 'function' ? { label: 'Rückgängig', fn: action } : action;
    if (act && act.fn) {
      const b = h('button', { type: 'button' }, act.label || 'Rückgängig');
      b.addEventListener('click', () => { hideToast(); act.fn(); });
      t.append(b);
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, act && act.fn ? 5000 : 2200);
  }

  function undo() {
    const snap = undoStack.pop();
    if (!snap) return;
    state = JSON.parse(snap);
    clearDrafts();
    if (!save()) {
      toast(L.saveToast(false, !persistAllowed, null).text);
      return;
    }
    render();
  }

  function commit(label, fn) {
    if (busy) return false;
    busy = true;
    const snap = JSON.stringify(state);
    try {
      fn();
      if (!save()) {
        state = JSON.parse(snap);
        clearDrafts();
        render();
        toast(L.saveToast(false, !persistAllowed, label).text);
        return false;
      }
      undoStack.push(snap);
      if (undoStack.length > 30) undoStack.shift();
      clearDrafts();
      render();
      const note = L.saveToast(true, false, label);
      if (note) toast(note.text, undo);
      return true;
    } catch (e) {
      try { state = JSON.parse(snap); } catch (_) { /* bleibt */ }
      toast('Das hat nicht geklappt.');
      return false;
    } finally {
      busy = false;
    }
  }

  function carryForward(fromKey, toKey) {
    const src = state.days[fromKey];
    if (!src || !src.blocks) return;
    const open = L.openTasks(src.blocks);
    if (!open.length) return;
    const plan = L.planTomorrow(open, getDay(toKey).blocks, {
      dayStart: state.dayStart, dayEnd: state.dayEnd
    });
    if (!plan.placed.length) return;
    const snap = JSON.stringify(state);
    try {
      const dest = materialize(toKey);
      const used = collectUsed();
      plan.placed.forEach((copy) => dest.blocks.push(L.normBlock(copy, used)));
      const drop = new Set(plan.removeIds);
      src.blocks = src.blocks.filter((b) => !drop.has(b.id));
      if (!save()) {
        state = JSON.parse(snap);
        clearDrafts();
      }
    } catch (e) {
      try { state = JSON.parse(snap); } catch (_) { /* bleibt */ }
      clearDrafts();
    }
  }

  function applyTheme() {
    const root = document.documentElement;
    const dark = state.theme === 'dark' || (state.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    if (state.contrast) root.dataset.contrast = 'high';
    else delete root.dataset.contrast;
    const meta = $('#meta-theme');
    if (meta) meta.setAttribute('content', dark ? '#141311' : '#f3f0e8');
  }

  function safeBlocks(day) {
    return (day && day.blocks || []).filter((b) => b && L.isSafeId(b.id));
  }

  function focusOf(info, n) {
    const current = info.cur && !info.cur.done ? info.cur : null;
    if (current) return { block: current, overdue: false };
    const missed = info.list.filter((b) => L.isOpenTask(b) && b.start + b.dur <= n);
    if (missed.length) return { block: missed[missed.length - 1], overdue: true };
    return { block: null, overdue: false };
  }

  function section(node, build) {
    try { build(); }
    catch (e) {
      node.replaceChildren(h('p', { class: 'muted' }, 'Dieser Teil lässt sich gerade nicht anzeigen.'));
    }
  }

  function render() {
    applyTheme();
    if (!L.alreadyUsing(state)) {
      $('#start').hidden = false;
      $('#app').hidden = true;
      return;
    }
    $('#start').hidden = true;
    $('#app').hidden = false;
    const banner = $('#banner');
    if (corrupt || !persistAllowed) {
      banner.hidden = false;
      banner.textContent = 'Die gespeicherten Daten sind beschädigt und werden nicht überschrieben.';
    } else banner.hidden = true;

    const k = todayKey();
    const n = nowMin();
    const blocks = safeBlocks(getDay(k));
    const info = L.nowInfo(blocks, n);
    const focus = focusOf(info, n);
    liveHeroId = focus.block ? focus.block.id : null;
    $('#greet').textContent = L.greeting(n);
    $('#when').textContent = dateFmt.format(nowDate()) + ' · ' + L.fmt(Math.floor(n));
    section($('#hero'), () => renderHero(focus, info, n));
    section($('#next'), () => renderNext(info.next, focus.block));
    section($('#rest'), () => renderRest(info, focus.block, n));
    section($('#inbox-sec'), () => renderInbox());
  }

  function renderHero(focus, info, n) {
    const host = $('#hero');
    host.replaceChildren();
    const hero = focus.block;
    if (!hero) {
      host.append(h('h1', { class: 'hero-title' }, info.next ? 'Gerade ist frei.' : 'Heute ist frei.'));
      return;
    }
    host.append(h('p', { class: 'kicker' }, focus.overdue ? 'Noch offen' : 'Jetzt'));
    host.append(h('h1', { class: 'hero-title' }, hero.title));
    if (!focus.overdue) {
      host.append(h('p', { class: 'remain', id: 'remain' }, 'noch ' + L.durText(Math.max(0, Math.ceil(hero.start + hero.dur - n)))));
    }
    host.append(h('p', { class: 'muted' }, L.rangeLabel(hero.start, hero.dur)));
    const btn = h('button', { type: 'button', class: 'btn' }, 'Fertig');
    btn.addEventListener('click', () => finish(hero.id));
    host.append(btn);
  }

  function blockButton(b) {
    const btn = h('button', { type: 'button', class: 'row' });
    btn.append(h('span', { class: 'row-time' }, L.fmt(b.start)));
    const text = h('span', { class: 'row-text' });
    text.append(h('span', { class: 'row-title' }, b.title));
    text.append(h('span', { class: 'row-meta' }, L.durText(b.dur)));
    btn.append(text);
    btn.addEventListener('click', () => openEditor(b));
    return btn;
  }

  function renderNext(next, hero) {
    const host = $('#next');
    host.replaceChildren();
    if (!next || next === hero) { host.hidden = true; return; }
    host.hidden = false;
    host.append(h('h2', { class: 'sec-title' }, 'Danach'));
    host.append(blockButton(next));
  }

  function renderRest(info, hero, n) {
    const host = $('#rest');
    host.replaceChildren();
    const rest = info.list.filter((b) => {
      if (b === hero || b === info.next || b.done) return false;
      if (b.start > n) return true;
      return L.isOpenTask(b);
    });
    if (!rest.length) { host.hidden = true; return; }
    host.hidden = false;
    host.append(h('h2', { class: 'sec-title' }, 'Heute noch'));
    rest.forEach((b) => host.append(blockButton(b)));
  }

  function renderInbox() {
    const host = $('#inbox-sec');
    host.replaceChildren();
    const list = (state.inbox || []).filter((b) => b && L.isSafeId(b.id));
    if (!list.length) { host.hidden = true; return; }
    host.hidden = false;
    host.append(h('h2', { class: 'sec-title' }, 'Auch noch'));
    list.forEach((b) => {
      const btn = h('button', { type: 'button', class: 'row solo' });
      btn.append(h('span', { class: 'row-title' }, b.title));
      btn.addEventListener('click', () => scheduleInbox(b.id));
      host.append(btn);
    });
  }

  function finish(id) {
    commit('Geschafft', () => {
      const b = materialize(todayKey()).blocks.find((x) => x.id === id);
      if (b) b.done = true;
    });
  }

  function scheduleInbox(id) {
    const item = state.inbox.find((x) => x.id === id);
    if (!item) return;
    const k = todayKey();
    const dur = L.clampTime(0, item.dur || ADD_MIN).dur;
    const start = L.suggestStart(getDay(k).blocks, dur, {
      nowMin: nowMin(), isToday: true, dayStart: state.dayStart, dayEnd: state.dayEnd
    });
    commit(null, () => {
      const used = collectUsed();
      used.delete(id);
      materialize(k).blocks.push(L.normBlock({
        id: item.id, title: item.title, type: item.type, icon: item.icon,
        start, dur, subtasks: item.subtasks, done: false
      }, used));
      state.inbox = state.inbox.filter((x) => x.id !== id);
    });
  }

  function addTask(title) {
    const text = title.trim();
    if (!text) return;
    const k = todayKey();
    const start = L.suggestStart(getDay(k).blocks, ADD_MIN, {
      nowMin: nowMin(), isToday: true, dayStart: state.dayStart, dayEnd: state.dayEnd
    });
    const ok = commit(null, () => {
      materialize(k).blocks.push(L.normBlock({
        title: text, type: 'focused', dur: ADD_MIN, start
      }, collectUsed()));
    });
    if (ok) $('#add-title').value = '';
  }

  function openEditor(block) {
    const time = L.clampTime(block.start, block.dur);
    ed = { id: block.id, start: time.start, dur: time.dur };
    $('#ed-title').value = block.title;
    $('#ed-when').textContent = L.rangeLabel(time.start, time.dur);
    $('#editor').showModal();
    $('#ed-title').focus();
  }

  function saveEditor() {
    if (!ed || busy) return;
    const title = $('#ed-title').value.trim();
    const current = ed;
    $('#editor').close();
    ed = null;
    commit(null, () => {
      const b = materialize(todayKey()).blocks.find((x) => x.id === current.id);
      if (!b) return;
      if (title) b.title = title.slice(0, 80);
    });
  }

  function deleteCurrent() {
    if (!ed || busy) return;
    const id = ed.id;
    $('#editor').close();
    ed = null;
    commit('Gelöscht', () => {
      const day = materialize(todayKey());
      day.blocks = day.blocks.filter((x) => x.id !== id);
    });
  }

  function tick() {
    const t = todayKey();
    if (t !== lastToday) {
      const prev = lastToday;
      lastToday = t;
      carryForward(prev, t);
      clearDrafts();
      render();
      return;
    }
    if ($('#app').hidden) return;
    const n = nowMin();
    const clock = $('#when');
    if (clock) clock.textContent = dateFmt.format(nowDate()) + ' · ' + L.fmt(Math.floor(n));
    const info = L.nowInfo(safeBlocks(getDay(t)), n);
    const focus = focusOf(info, n);
    const id = focus.block ? focus.block.id : null;
    if (id !== liveHeroId) { render(); return; }
    const remain = $('#remain');
    if (remain && focus.block && !focus.overdue) {
      remain.textContent = 'noch ' + L.durText(Math.max(0, Math.ceil(focus.block.start + focus.block.dur - n)));
    }
  }

  $('#start-go').addEventListener('click', () => {
    state.onboarded = true;
    if (persistAllowed) save();
    render();
    const field = $('#add-title');
    if (field) field.focus();
  });

  let addLock = false;
  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (addLock || busy) return;
    addLock = true;
    addTask($('#add-title').value);
    setTimeout(() => { addLock = false; }, 0);
  });

  let editLock = false;
  $('#ed-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (editLock) return;
    editLock = true;
    saveEditor();
    setTimeout(() => { editLock = false; }, 0);
  });
  $('#ed-delete').addEventListener('click', deleteCurrent);
  $('#editor').addEventListener('close', () => { ed = null; });
  $('#editor').addEventListener('click', (e) => { if (e.target === $('#editor')) $('#editor').close(); });

  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  if (darkMQ.addEventListener) darkMQ.addEventListener('change', () => { if (state.theme === 'auto') applyTheme(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  setInterval(tick, 1000);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (had) toast('Neue Version ist da.', { label: 'Neu laden', fn: () => location.reload() });
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  carryForward(L.addDays(todayKey(), -1), todayKey());
  render();
  window.__tagesplaner = {
    get state() { return state; },
    get persistAllowed() { return persistAllowed; }
  };
})();
