/* Tagesplaner – Jetzt, danach, und der Tag als Bild. */
'use strict';

(function () {
  const L = window.TagesplanerLogic;
  const KEY = 'tagesplaner.v2';
  const KEEP_DAYS = 90;
  const PPM = 2.2;
  const TL_PAD = 18;
  const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

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
  let drag = null;
  let suppressClick = false;
  let span = { start: 8 * 60, end: 18 * 60 };

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
  let viewKey = todayKey();

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
  function clearDrafts() { Object.keys(drafts).forEach((k) => delete drafts[k]); }
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
    } catch (e) { return false; }
  }

  let toastTimer = null;
  function hideToast() { const t = $('#toast'); t.hidden = true; t.replaceChildren(); }
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
    if (!save()) { toast(L.saveToast(false, !persistAllowed, null).text); return; }
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
    } finally { busy = false; }
  }

  function carryForward(fromKey, toKey) {
    const src = state.days[fromKey];
    if (!src || !src.blocks) return;
    const open = src.blocks.filter(L.canMove);
    if (!open.length) return;
    const plan = L.planTomorrow(open, getDay(toKey).blocks, { dayStart: state.dayStart, dayEnd: state.dayEnd });
    if (!plan.placed.length) return;
    const snap = JSON.stringify(state);
    try {
      const dest = materialize(toKey);
      const used = collectUsed();
      plan.placed.forEach((copy) => dest.blocks.push(L.normBlock(copy, used)));
      const drop = new Set(plan.removeIds);
      src.blocks = src.blocks.filter((b) => !drop.has(b.id));
      if (!save()) { state = JSON.parse(snap); clearDrafts(); }
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
  function findBlock(id, k) {
    return safeBlocks(getDay(k || viewKey)).find((b) => b.id === id) || null;
  }
  function relName(k, today) {
    if (k === today) return L.greeting(nowMin());
    if (k === L.addDays(today, 1)) return 'Morgen';
    if (k === L.addDays(today, -1)) return 'Gestern';
    return NAMES[L.weekday(k)];
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
    catch (e) { node.replaceChildren(h('p', { class: 'muted' }, 'Dieser Teil lässt sich gerade nicht anzeigen.')); }
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

    const today = todayKey();
    const n = nowMin();
    const onToday = viewKey === today;
    $('#greet').textContent = relName(viewKey, today);
    $('#when').textContent = dateFmt.format(L.keyToDate(viewKey)) + (onToday ? ' · ' + L.fmt(Math.floor(n)) : '');
    $('#jump-today').hidden = onToday;
    renderWeek(today);

    const blocks = safeBlocks(getDay(viewKey));
    const info = onToday ? L.nowInfo(blocks, n) : { cur: null, next: null, list: blocks.slice().sort((a, b) => a.start - b.start) };
    const focus = onToday ? focusOf(info, n) : { block: null, overdue: false };
    liveHeroId = focus.block ? focus.block.id : null;
    section($('#hero'), () => renderHero(onToday, focus, info, n));
    section($('#next'), () => renderNext(onToday ? info.next : null, focus.block));
    section($('#dayview'), () => renderTimeline(blocks, onToday, n));
    section($('#inbox-sec'), () => renderInbox());
    maybeScroll();
  }

  let scrolledFor = null;
  function maybeScroll() {
    if (scrolledFor === viewKey) return;
    scrolledFor = viewKey;
    requestAnimationFrame(() => {
      const target = viewKey === todayKey() ? $('#now-line') : $('#timeline');
      if (!target || target.hidden) return;
      const top = target.getBoundingClientRect().top + window.scrollY - (viewKey === todayKey() ? 210 : 120);
      window.scrollTo(0, Math.max(0, top));
    });
  }

  function renderWeek(today) {
    const host = $('#week');
    host.replaceChildren();
    L.weekKeys(viewKey).forEach((k, i) => {
      const b = h('button', {
        type: 'button',
        class: 'wday' + (k === viewKey ? ' sel' : '') + (k === today ? ' today' : '')
      });
      b.append(h('span', { class: 'wd' }, WD[i]), h('span', { class: 'dn' }, String(L.keyToDate(k).getDate())));
      b.setAttribute('aria-label', dateFmt.format(L.keyToDate(k)));
      if (k === viewKey) b.setAttribute('aria-current', 'date');
      b.addEventListener('click', () => { viewKey = k; render(); });
      host.append(b);
    });
  }

  function renderHero(onToday, focus, info, n) {
    const host = $('#hero');
    host.replaceChildren();
    if (!onToday) { host.hidden = true; return; }
    host.hidden = false;
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
    host.append(h('p', { class: 'muted' }, (hero.fixed === true ? 'Fest · ' : '') + L.rangeLabel(hero.start, hero.dur)));
    const btn = h('button', { type: 'button', class: 'btn' }, 'Fertig');
    btn.addEventListener('click', () => finish(hero.id));
    host.append(btn);
  }

  function renderNext(next, hero) {
    const host = $('#next');
    host.replaceChildren();
    if (!next || next === hero) { host.hidden = true; return; }
    host.hidden = false;
    host.append(h('h2', { class: 'sec-title' }, 'Danach'));
    const btn = h('button', { type: 'button', class: 'row' });
    btn.append(h('span', { class: 'row-time' }, L.fmt(next.start)));
    const text = h('span', { class: 'row-text' });
    text.append(h('span', { class: 'row-title' }, next.title));
    text.append(h('span', { class: 'row-meta' }, (next.fixed === true ? 'Fest · ' : '') + L.durText(next.dur)));
    btn.append(text);
    btn.addEventListener('click', () => openEditor(next));
    host.append(btn);
  }

  function renderTimeline(blocks, onToday, n) {
    let start = state.dayStart;
    let end = state.dayEnd;
    blocks.forEach((b) => {
      start = Math.min(start, Math.floor(b.start / 60) * 60);
      end = Math.max(end, Math.ceil((b.start + b.dur) / 60) * 60);
    });
    end = Math.min(L.DAY, Math.max(end, start + 120));
    span = { start, end };
    const height = TL_PAD + (end - start) * PPM + 12;
    const tl = $('#timeline');
    tl.style.height = height + 'px';
    const hours = $('#hours');
    hours.replaceChildren();
    for (let m = start; m <= end; m += 60) {
      const line = h('div', { class: 'hour' });
      line.style.top = (TL_PAD + (m - start) * PPM) + 'px';
      line.append(h('span', null, L.fmt(m)));
      hours.append(line);
    }
    const host = $('#tblocks');
    host.replaceChildren();
    if (!blocks.length) host.append(h('p', { class: 'empty-day' }, 'Noch nichts an diesem Tag.'));
    const lanes = L.layoutLanes(blocks);
    blocks.forEach((b) => {
      const pos = lanes.get(b.id) || { lane: 0, lanes: 1 };
      const btn = h('button', { type: 'button', class: 'tblock t-' + (b.type || 'focused') + (b.fixed === true ? ' is-fixed' : b.fixed === false ? ' is-free' : '') });
      const top = TL_PAD + (b.start - start) * PPM;
      const hgt = Math.max(48, b.dur * PPM);
      btn.style.top = top + 'px';
      btn.style.height = hgt + 'px';
      const width = 100 / pos.lanes;
      btn.style.left = (pos.lane * width) + '%';
      btn.style.width = 'calc(' + width + '% - 6px)';
      btn.dataset.id = b.id;
      btn.dataset.start = String(b.start);
      btn.append(h('span', { class: 'tb-time' }, L.rangeLabel(b.start, b.dur)));
      btn.append(h('span', { class: 'tb-title' }, b.title));
      if (b.fixed === true) btn.append(h('span', { class: 'tb-tag' }, 'Fest'));
      else if (b.fixed === false) btn.append(h('span', { class: 'tb-tag' }, 'Frei'));
      host.append(btn);
    });
    const now = $('#now-line');
    const showNow = onToday && n >= start && n <= end;
    now.hidden = !showNow;
    if (showNow) now.style.top = (TL_PAD + (n - start) * PPM) + 'px';
    $('#day-label').hidden = true;
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
    const dur = L.clampTime(0, item.dur || 30).dur;
    const start = L.suggestStart(getDay(viewKey).blocks, dur, {
      nowMin: nowMin(), isToday: viewKey === todayKey(), dayStart: state.dayStart, dayEnd: state.dayEnd
    });
    commit(null, () => {
      const used = collectUsed();
      used.delete(id);
      materialize(viewKey).blocks.push(L.normBlock({
        id: item.id, title: item.title, type: item.type || 'focused', icon: item.icon,
        start, dur, subtasks: item.subtasks, done: false, fixed: false
      }, used));
      state.inbox = state.inbox.filter((x) => x.id !== id);
    });
  }

  function addTask(title) {
    const parsed = L.parseQuick(title, { today: todayKey(), selected: viewKey });
    if (!parsed) return;
    const day = parsed.day;
    const existing = getDay(day).blocks;
    const placed = parsed.fixed
      ? L.clampTime(parsed.start, parsed.dur)
      : L.clampTime(L.suggestStart(existing, parsed.dur, {
        nowMin: nowMin(), isToday: day === todayKey(), dayStart: state.dayStart, dayEnd: state.dayEnd
      }), parsed.dur);
    viewKey = day;
    const ok = commit(null, () => {
      materialize(day).blocks.push(L.normBlock({
        title: parsed.title,
        type: parsed.fixed ? 'meeting' : 'focused',
        start: placed.start,
        dur: placed.dur,
        fixed: parsed.fixed
      }, collectUsed()));
    });
    if (ok) $('#add-title').value = '';
  }

  function ensureMinute(min) {
    const sel = $('#ed-m');
    if (![...sel.options].some((o) => Number(o.value) === min)) {
      const opt = h('option', { value: String(min) }, L.fmt(min).slice(3));
      sel.append(opt);
      [...sel.options].sort((a, b) => Number(a.value) - Number(b.value)).forEach((o) => sel.append(o));
    }
  }

  function paintEditor() {
    if (!ed) return;
    const t = L.clampTime(ed.start, ed.dur);
    ed.start = t.start;
    ed.dur = t.dur;
    ensureMinute(t.start % 60);
    $('#ed-h').value = String(Math.floor(t.start / 60));
    $('#ed-m').value = String(t.start % 60);
    $('#ed-when').textContent = (ed.fixed ? 'Fest' : 'Frei') + ' · ' + L.rangeLabel(t.start, t.dur);
    document.querySelectorAll('[data-ed-dur]').forEach((b) => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.edDur) === t.dur));
    });
    $('#ed-fest').setAttribute('aria-pressed', String(ed.fixed));
    $('#ed-frei').setAttribute('aria-pressed', String(!ed.fixed));
  }

  function openEditor(block) {
    const time = L.clampTime(block.start, block.dur);
    ed = { id: block.id, start: time.start, dur: time.dur, fixed: block.fixed === true };
    $('#ed-title').value = block.title;
    paintEditor();
    $('#editor').showModal();
    $('#ed-title').focus();
  }

  function saveEditor() {
    if (!ed || busy) return;
    const title = $('#ed-title').value.trim();
    const current = ed;
    const shown = L.clampTime(current.start, current.dur);
    $('#editor').close();
    ed = null;
    commit(null, () => {
      const b = materialize(viewKey).blocks.find((x) => x.id === current.id);
      if (!b) return;
      if (title) b.title = title.slice(0, 80);
      b.start = shown.start;
      b.dur = shown.dur;
      b.fixed = current.fixed;
    });
  }

  function deleteCurrent() {
    if (!ed || busy) return;
    const id = ed.id;
    $('#editor').close();
    ed = null;
    commit('Gelöscht', () => {
      const day = materialize(viewKey);
      day.blocks = day.blocks.filter((x) => x.id !== id);
    });
  }

  function tick() {
    const t = todayKey();
    if (t !== lastToday) {
      const prev = lastToday;
      lastToday = t;
      if (viewKey === prev) viewKey = t;
      carryForward(prev, t);
      clearDrafts();
      render();
      return;
    }
    if ($('#app').hidden || drag) return;
    const n = nowMin();
    if (viewKey === t) {
      const clock = $('#when');
      if (clock) clock.textContent = dateFmt.format(L.keyToDate(viewKey)) + ' · ' + L.fmt(Math.floor(n));
      const info = L.nowInfo(safeBlocks(getDay(t)), n);
      const focus = focusOf(info, n);
      const id = focus.block ? focus.block.id : null;
      if (id !== liveHeroId) { render(); return; }
      const remain = $('#remain');
      if (remain && focus.block && !focus.overdue) {
        remain.textContent = 'noch ' + L.durText(Math.max(0, Math.ceil(focus.block.start + focus.block.dur - n)));
      }
      const now = $('#now-line');
      if (now && !now.hidden) now.style.top = (TL_PAD + (n - span.start) * PPM) + 'px';
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

  $('#week-prev').addEventListener('click', () => { viewKey = L.addDays(viewKey, -7); render(); });
  $('#week-next').addEventListener('click', () => { viewKey = L.addDays(viewKey, 7); render(); });
  $('#jump-today').addEventListener('click', () => { viewKey = todayKey(); render(); });
  let swipeX = null;
  $('#week').addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
  $('#week').addEventListener('pointerup', (e) => {
    if (swipeX == null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (dx > 48) { viewKey = L.addDays(viewKey, -7); render(); }
    else if (dx < -48) { viewKey = L.addDays(viewKey, 7); render(); }
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
  $('#ed-h').innerHTML = Array.from({ length: 24 }, (_, i) => '<option value="' + i + '">' + String(i).padStart(2, '0') + '</option>').join('');
  $('#ed-m').innerHTML = Array.from({ length: 12 }, (_, i) => '<option value="' + (i * 5) + '">' + String(i * 5).padStart(2, '0') + '</option>').join('');
  $('#ed-h').addEventListener('change', () => {
    if (!ed) return;
    ed.start = Number($('#ed-h').value) * 60 + (ed.start % 60);
    ed.fixed = true;
    paintEditor();
  });
  $('#ed-m').addEventListener('change', () => {
    if (!ed) return;
    ed.start = Math.floor(ed.start / 60) * 60 + Number($('#ed-m').value);
    ed.fixed = true;
    paintEditor();
  });
  document.querySelectorAll('[data-ed-dur]').forEach((b) => b.addEventListener('click', () => {
    if (!ed) return;
    ed.dur = Number(b.dataset.edDur);
    paintEditor();
  }));
  $('#ed-fest').addEventListener('click', () => { if (!ed) return; ed.fixed = true; paintEditor(); });
  $('#ed-frei').addEventListener('click', () => { if (!ed) return; ed.fixed = false; paintEditor(); });
  $('#editor').addEventListener('close', () => { ed = null; });
  $('#editor').addEventListener('click', (e) => { if (e.target === $('#editor')) $('#editor').close(); });

  $('#tblocks').addEventListener('pointerdown', (e) => {
    const node = e.target.closest('.tblock');
    if (!node || drag) return;
    drag = {
      id: node.dataset.id,
      node,
      y0: e.clientY,
      start0: Number(node.dataset.start),
      start: Number(node.dataset.start),
      moved: false,
      pid: e.pointerId
    };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 8) return;
    drag.moved = true;
    e.preventDefault();
    const raw = drag.start0 + dy / PPM;
    const snapped = Math.round(raw / 15) * 15;
    const block = findBlock(drag.id);
    const dur = block ? block.dur : 30;
    drag.start = L.clampTime(snapped, dur).start;
    drag.node.style.top = (TL_PAD + (drag.start - span.start) * PPM) + 'px';
    const time = drag.node.querySelector('.tb-time');
    if (time && block) time.textContent = L.rangeLabel(drag.start, dur);
  }, { passive: false });
  window.addEventListener('pointerup', (e) => endDrag(e));
  window.addEventListener('pointercancel', (e) => endDrag(e));
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 250);
    if (d.start === d.start0) { render(); return; }
    commit(null, () => {
      const b = materialize(viewKey).blocks.find((x) => x.id === d.id);
      if (!b) return;
      b.start = L.clampTime(d.start, b.dur).start;
    });
  }
  $('#tblocks').addEventListener('click', (e) => {
    if (suppressClick) return;
    const node = e.target.closest('.tblock');
    if (!node) return;
    const block = findBlock(node.dataset.id);
    if (block) openEditor(block);
  });

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
    get viewKey() { return viewKey; },
    get persistAllowed() { return persistAllowed; }
  };
})();
