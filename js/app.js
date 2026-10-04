import * as store from './store.js';
import { VAULTS } from './vaults.js';
import {
  APPARATUS,
  ALL_EVENTS,
  EVENTS,
  LETTERS,
  LEVELS,
  LEVEL_IDS,
  MAX_PER_EG,
  MAX_ROUTINE,
  SR_MAX_STATIC,
  MIN_SKILLS,
  ROMAN,
  eventOptions,
  fmt,
  scoreAthlete,
} from './scoring.js';
import { findSkill, searchSkills } from './skill-search.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const app = $('#app');
const TABS = ALL_EVENTS;
const state = { user: null, athletes: [], selectedId: null, tab: readTab() };

function readTab() {
  try {
    const t = localStorage.getItem('sv-tab');
    return TABS.includes(t) ? t : 'fx';
  } catch {
    return 'fx';
  }
}

const blankSkill = () => ({ name: '', letter: '', eg: '' });
const DEFAULT_LEVEL = 'int';
const levelOf = (a) => (LEVELS[a?.level] ? a.level : DEFAULT_LEVEL);
const maxSkills = (a) => LEVELS[levelOf(a)].maxSkills;
const blankRoutine = (n) => Array.from({ length: n }, blankSkill);
const isBlank = (s) => !String(s?.name || '').trim() && !s?.letter;
const newAthlete = () => ({
  id: store.newId(),
  name: '',
  club: '',
  level: DEFAULT_LEVEL,
  vault: '',
  routines: Object.fromEntries(EVENTS.map((e) => [e, blankRoutine(LEVELS[DEFAULT_LEVEL].maxSkills)])),
  options: {},
  createdAt: Date.now(),
});

// Partial records: fill in missing fields, and show at least as many skill
// rows as the athlete's level counts. Returns true if the record changed.
function normalize(a) {
  let changed = false;
  if (!LEVELS[a.level]) {
    a.level = DEFAULT_LEVEL;
    changed = true;
  }
  a.routines ||= {};
  a.options ||= {};
  for (const e of EVENTS) {
    const r = [...(a.routines[e] || [])];
    while (r.length < maxSkills(a)) r.push(blankSkill());
    a.routines[e] = r.slice(0, MAX_ROUTINE);
  }
  return changed;
}

const selected = () => state.athletes.find((a) => a.id === state.selectedId);

// ---- Saving ---------------------------------------------------------------

let saveTimer;
function setStatus(text, kind = '') {
  const el = $('#save-status');
  if (el) {
    el.textContent = text;
    el.dataset.kind = kind;
  }
}
function scheduleSave() {
  setStatus('Saving…');
  clearTimeout(saveTimer);
  const athlete = selected();
  saveTimer = setTimeout(async () => {
    try {
      await store.saveAthlete(athlete);
      setStatus('All changes saved', 'ok');
    } catch (err) {
      console.error(err);
      setStatus('Could not save. Check your connection.', 'error');
    }
  }, 600);
}

// ---- Header / auth ---------------------------------------------------------

function renderUserArea() {
  const area = $('#user-area');
  const u = state.user;
  if (!u || u.local) {
    area.innerHTML = '';
    return;
  }
  area.innerHTML = `
    ${u.photoURL ? `<img class="avatar" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer" />` : ''}
    <span class="user-name">${esc(u.displayName || u.email)}</span>
    <button class="topbar-link" id="signout-btn" type="button">Sign out</button>`;
  $('#signout-btn').onclick = () => store.signOut();
}

function renderSignIn() {
  app.innerHTML = '';
  app.appendChild($('#signin-tpl').content.cloneNode(true));
  $('#signin-btn').onclick = async () => {
    const err = $('#signin-error');
    err.hidden = true;
    try {
      await store.signIn();
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user') return;
      err.textContent = `Sign-in failed: ${e?.message || e}`;
      err.hidden = false;
    }
  };
}

// ---- Main layout -----------------------------------------------------------

function renderShell() {
  app.innerHTML = `
    <section class="page-head">
      <div class="page-head-inner">
        <p class="eyebrow">UCG MAG</p>
        <h1>Routine planner</h1>
      </div>
    </section>
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-head">
          <h2 class="subhead">Athletes</h2>
          <button class="btn btn-primary btn-sm" id="add-athlete" type="button">Add athlete</button>
        </div>
        <ul id="athlete-list" class="athlete-list"></ul>
      </aside>
      <section id="editor" class="editor"></section>
    </div>`;
  $('#add-athlete').onclick = addAthlete;
  renderList();
  renderEditor();
}

function sortedAthletes() {
  return [...state.athletes].sort((a, b) =>
    (a.name || '~').localeCompare(b.name || '~', undefined, { sensitivity: 'base' })
  );
}

function renderList() {
  const list = $('#athlete-list');
  if (!list) return;
  if (!state.athletes.length) {
    list.innerHTML = `<li class="empty">No athletes yet.</li>`;
    return;
  }
  list.innerHTML = sortedAthletes()
    .map((a) => {
      const aa = scoreAthlete(a).allAround;
      return `<li>
        <button type="button" data-id="${esc(a.id)}" class="athlete-item${a.id === state.selectedId ? ' active' : ''}">
          <span class="athlete-name">${esc(a.name || 'Unnamed athlete')}</span>
          <span class="athlete-meta">${esc([LEVELS[levelOf(a)].label, a.club].filter(Boolean).join(' · '))}</span>
          <span class="athlete-aa">${fmt(aa)}</span>
        </button>
      </li>`;
    })
    .join('');
  $$('.athlete-item', list).forEach((b) => (b.onclick = () => select(b.dataset.id)));
}

function select(id) {
  state.selectedId = id;
  try {
    localStorage.setItem('sv-selected', id);
  } catch {}
  renderList();
  renderEditor();
}

async function addAthlete() {
  const a = newAthlete();
  state.athletes.push(a);
  select(a.id);
  $('#f-name')?.focus();
  try {
    await store.saveAthlete(a);
  } catch (e) {
    console.error(e);
  }
}

async function removeAthlete() {
  const a = selected();
  if (!a || !confirm(`Delete ${a.name || 'this athlete'} and all of their routines? This can't be undone.`)) return;
  await store.deleteAthlete(a.id);
  state.athletes = state.athletes.filter((x) => x.id !== a.id);
  state.selectedId = sortedAthletes()[0]?.id ?? null;
  renderList();
  renderEditor();
}

// ---- Editor ----------------------------------------------------------------

function vaultOptions(current, level) {
  const groups = {};
  for (const v of VAULTS) (groups[v.eg] ||= []).push(v);
  return (
    `<option value="">— No vault —</option>` +
    Object.entries(groups)
      .map(
        ([eg, list]) =>
          `<optgroup label="Element group ${esc(eg)}">${list
            .map((v) => {
              const banned = level === 'dev' && v.flipping;
              const dv = level === 'adv' ? v.adv : v.value;
              return `<option value="${esc(v.id)}"${v.id === String(current) ? ' selected' : ''}>${esc(v.id)} · ${esc(v.name)} (${banned ? 'not allowed' : fmt(dv)})</option>`;
            })
            .join('')}</optgroup>`
      )
      .join('')
  );
}

const ICON_GRIP = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>`;
const ICON_X = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const ICON_CHEVRON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

// ---- Skill picker ------------------------------------------------------------
// Typing in a skill name (or clicking its arrow) opens a list of UCG and WG
// skills for the apparatus; picking one fills in the name, difficulty and EG.
// Anything else typed is kept as a custom skill with a manual difficulty / EG.
// The list lives on <body> so the routine table's scrolling doesn't clip it.

const picker = { el: null, input: null, items: [], active: -1 };

function pickerEl() {
  if (!picker.el) {
    const el = document.createElement('div');
    el.id = 'skill-pop';
    el.className = 'skill-pop';
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', 'Skills');
    el.hidden = true;
    el.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
    el.addEventListener('click', (e) => {
      const o = e.target.closest('[data-skill]');
      if (o) pickSkill(Number(o.dataset.skill));
    });
    document.body.appendChild(el);
    addEventListener('resize', placePicker);
    addEventListener('scroll', placePicker, true);
    picker.el = el;
  }
  return picker.el;
}

function openPicker(input, query) {
  const el = pickerEl();
  picker.input = input;
  picker.items = searchSkills(input.dataset.event, query);
  picker.active = query && picker.items.length ? 0 : -1;
  input.setAttribute('aria-expanded', 'true');
  renderPicker(query);
  el.hidden = false;
  el.scrollTop = 0;
  placePicker();
}

function closePicker() {
  if (!picker.input) return;
  picker.el.hidden = true;
  picker.input.setAttribute('aria-expanded', 'false');
  picker.input.removeAttribute('aria-activedescendant');
  picker.input = null;
}

function renderPicker(query) {
  const groups = APPARATUS[picker.input.dataset.event].groups;
  const html = [];
  let lastEg;
  picker.items.forEach((s, i) => {
    if (!query && s.eg !== lastEg) {
      html.push(
        `<div class="pop-head" role="presentation">${s.eg ? `EG ${ROMAN[s.eg]} · ${esc(groups[s.eg])}` : 'No element group (no EG bonus)'}</div>`
      );
      lastEg = s.eg;
    }
    html.push(`
      <div class="pop-opt${i === picker.active ? ' active' : ''}" role="option" id="pop-opt-${i}" data-skill="${i}"
        aria-selected="${i === picker.active}"${s.note ? ` title="Note: ${esc(s.note)}"` : ''}>
        <span class="src-badge ${s.src.toLowerCase()}">${s.src}</span>
        <span class="pop-name">${esc(s.name)}${s.eponym ? ` <span class="pop-eponym">(${esc(s.eponym)})</span>` : ''}</span>
        <span class="pop-meta">${esc(s.value)}${s.eg ? ` · EG ${ROMAN[s.eg]}` : ''}</span>
      </div>`);
  });
  html.push(
    picker.items.length
      ? `<div class="pop-foot"><span class="src-badge ucg">UCG</span> UCG Code of Points <span class="src-badge wg">WG</span> World Gymnastics Code of Points. Not listed? Type your own name and set the difficulty and EG.</div>`
      : `<div class="pop-empty">No listed skills match. That's fine: keep your own name and choose the difficulty and element group yourself.</div>`
  );
  picker.el.innerHTML = html.join('');
  setActive(picker.active);
}

function setActive(i) {
  picker.active = i;
  $$('.pop-opt', picker.el).forEach((o) => {
    const on = Number(o.dataset.skill) === i;
    o.classList.toggle('active', on);
    o.setAttribute('aria-selected', on);
    if (on) o.scrollIntoView({ block: 'nearest' });
  });
  if (i >= 0) picker.input.setAttribute('aria-activedescendant', `pop-opt-${i}`);
  else picker.input.removeAttribute('aria-activedescendant');
}

function placePicker() {
  if (!picker.input) return;
  const r = picker.input.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return closePicker();
  const w = Math.min(Math.max(r.width + 60, 440), innerWidth - 16);
  const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
  const below = innerHeight - r.bottom - 12;
  const above = r.top - 12;
  const up = below < 240 && above > below;
  Object.assign(picker.el.style, {
    left: `${left}px`,
    width: `${w}px`,
    maxHeight: `${Math.min(380, up ? above : below)}px`,
    top: up ? '' : `${r.bottom + 4}px`,
    bottom: up ? `${innerHeight - r.top + 4}px` : '',
  });
}

function pickSkill(i) {
  const s = picker.items[i];
  const input = picker.input;
  if (!s || !input) return;
  const event = input.dataset.event;
  const idx = Number(input.dataset.idx);
  Object.assign(selected().routines[event][idx], {
    name: s.label,
    letter: s.value,
    eg: s.eg ? String(s.eg) : '',
    skillId: s.id,
  });
  closePicker();
  renderRoutine(event, { row: idx, part: 'name' });
  scheduleSave();
}

function onPickerKey(ev) {
  const input = ev.target;
  const open = picker.input === input;
  const n = picker.items.length;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (!open) return openPicker(input, '');
    if (!n) return;
    const d = ev.key === 'ArrowDown' ? 1 : -1;
    setActive(picker.active < 0 ? (d > 0 ? 0 : n - 1) : (picker.active + d + n) % n);
  } else if (ev.key === 'Enter' && open && picker.active >= 0) {
    ev.preventDefault();
    pickSkill(picker.active);
  } else if (ev.key === 'Escape' && open) {
    ev.preventDefault();
    closePicker();
  } else if (ev.key === 'Tab') closePicker();
}

function skillRow(event, i, s) {
  const groups = APPARATUS[event].groups;
  const label = `Skill ${i + 1}`;
  const data = `data-event="${event}" data-idx="${i}"`;
  return `
    <div class="skill-row" data-row="${i}">
      <span class="col-num">
        <button type="button" class="drag-handle" data-drag="${event}" data-idx="${i}"
          aria-label="Move ${label}. Drag, or use the up and down arrow keys." title="Drag to reorder">${ICON_GRIP}</button>
        <span class="num">${i + 1}</span>
      </span>
      <span class="col-name skill-combo">
        <input class="skill-input" type="text" placeholder="Search or type a skill" aria-label="${label} name"
          role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="skill-pop" autocomplete="off"
          ${data} data-field="name" value="${esc(s.name)}" />
        <span class="src-badge" data-calc="src"></span>
        <button type="button" class="combo-toggle" data-combo="${event}" data-idx="${i}" tabindex="-1" aria-label="Show ${label} skill list">${ICON_CHEVRON}</button>
      </span>
      <select class="col-letter" aria-label="${label} difficulty" ${data} data-field="letter">
        <option value="">–</option>
        ${LETTERS.map((l) => `<option${l === s.letter ? ' selected' : ''}>${l}</option>`).join('')}
      </select>
      <select class="col-eg" aria-label="${label} element group" ${data} data-field="eg">
        <option value="">EG –</option>
        ${Object.entries(groups)
          .map(([n, g]) => `<option value="${n}"${String(n) === String(s.eg) ? ' selected' : ''}>${ROMAN[n]}. ${esc(g)}</option>`)
          .join('')}
      </select>
      <span class="col-value calc" data-calc="value"></span>
      <span class="col-bonus calc" data-calc="bonus"></span>
      <button type="button" class="remove-skill" data-remove-skill="${event}" data-idx="${i}" aria-label="Remove ${label}" title="Remove skill">${ICON_X}</button>
      <span class="row-flag" data-calc="flag"></span>
    </div>`;
}

function routineRows(event, athlete) {
  return `
    <div class="skill-row skill-head" aria-hidden="true">
      <span class="col-num">#</span>
      <span class="col-name">Skill</span>
      <span class="col-letter">Diff.</span>
      <span class="col-eg">Element group</span>
      <span class="col-value">Value</span>
      <span class="col-bonus">EG bonus</span>
      <span></span>
    </div>
    ${athlete.routines[event].map((s, i) => skillRow(event, i, s)).join('')}`;
}

// Re-draw one event's routine (after add / remove / reorder) and optionally
// focus something in it: { row, part: 'name' | 'handle' } or 'add'.
function renderRoutine(event, focus) {
  const a = selected();
  closePicker();
  $(`[data-routine="${event}"]`).innerHTML = routineRows(event, a);
  updateComputed();
  if (focus === 'add') $(`[data-add-skill="${event}"]`)?.focus();
  else if (focus) {
    const row = $(`[data-routine="${event}"] [data-row="${focus.row}"]`);
    $(focus.part === 'handle' ? '.drag-handle' : '.skill-input', row)?.focus();
  }
}

function moveSkill(event, from, to, focusPart) {
  const list = selected().routines[event];
  if (to < 0 || to >= list.length || to === from) return;
  const [skill] = list.splice(from, 1);
  list.splice(to, 0, skill);
  renderRoutine(event, { row: to, part: focusPart });
  scheduleSave();
}

function onEditorClick(ev) {
  const a = selected();
  const toggle = ev.target.closest('[data-combo]');
  if (toggle) {
    const input = $('.skill-input', toggle.closest('.skill-combo'));
    if (picker.input === input) closePicker();
    else {
      input.focus();
      openPicker(input, '');
    }
    return;
  }
  const add = ev.target.closest('[data-add-skill]');
  if (add) {
    const e = add.dataset.addSkill;
    const list = a.routines[e];
    if (list.length >= MAX_ROUTINE) return;
    list.push(blankSkill());
    renderRoutine(e, { row: list.length - 1, part: 'name' });
    scheduleSave();
    return;
  }
  const remove = ev.target.closest('[data-remove-skill]');
  if (remove) {
    const e = remove.dataset.removeSkill;
    const list = a.routines[e];
    const i = Number(remove.dataset.idx);
    list.splice(i, 1);
    if (list.length < maxSkills(a)) list.push(blankSkill());
    renderRoutine(e, { row: Math.min(i, list.length - 1), part: 'name' });
    scheduleSave();
  }
}

function onEditorKey(ev) {
  if (ev.target.classList.contains('skill-input')) return onPickerKey(ev);
  const h = ev.target.closest('.drag-handle');
  if (!h || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
  ev.preventDefault();
  const from = Number(h.dataset.idx);
  moveSkill(h.dataset.drag, from, from + (ev.key === 'ArrowUp' ? -1 : 1), 'handle');
}

// Drag to reorder: pointer events, so it works with a mouse and on touch screens.
function onEditorPointerDown(ev) {
  const handle = ev.target.closest('.drag-handle');
  if (!handle || ev.button > 0) return;
  ev.preventDefault();
  const event = handle.dataset.drag;
  const from = Number(handle.dataset.idx);
  const container = $(`[data-routine="${event}"]`);
  const rows = $$('.skill-row[data-row]', container);
  const dragged = rows[from];
  const others = rows.filter((r) => r !== dragged);
  const pageMid = (r) => {
    const b = r.getBoundingClientRect();
    return b.top + scrollY + b.height / 2;
  };
  const mids = others.map(pageMid);
  const startY = ev.clientY + scrollY;
  let to = from;

  dragged.classList.add('dragging');

  const clearMarks = () => others.forEach((r) => r.classList.remove('drop-above', 'drop-below'));
  const move = (m) => {
    if (m.clientY < 90) scrollBy(0, -12);
    else if (m.clientY > innerHeight - 60) scrollBy(0, 12);
    const y = m.clientY + scrollY;
    dragged.style.transform = `translateY(${y - startY}px)`;
    to = mids.filter((mid) => mid < y).length;
    clearMarks();
    if (to === from) return;
    if (to < others.length) others[to].classList.add('drop-above');
    else others[others.length - 1].classList.add('drop-below');
  };
  const end = () => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', end);
    removeEventListener('pointercancel', end);
    clearMarks();
    dragged.classList.remove('dragging');
    dragged.style.transform = '';
    if (to !== from) moveSkill(event, from, to, 'handle');
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
}

const EXPORT_TIP =
  "Fills in your level's UCG MAG Start Value Worksheet with the counting skills, one page per event. " +
  'Repeated and non-counting skills are left off.';

function optionControl(event, o, athlete) {
  const v = athlete.options?.[event]?.[o.id];
  const data = `data-option="${event}" data-opt="${o.id}"`;
  let control;
  if (o.kind === 'count') {
    control = `<select ${data} aria-label="${esc(o.label)}">${Array.from({ length: o.max + 1 }, (_, n) => `<option value="${n}"${Number(v || 0) === n ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
  } else if (o.kind === 'mushroom') {
    control = `<select ${data} aria-label="${esc(o.label)}">${Array.from({ length: 11 }, (_, n) => {
      const x = n / 10;
      return `<option value="${x}"${Number(v || 0) === x ? ' selected' : ''}>+${x.toFixed(1)}</option>`;
    }).join('')}</select>`;
  } else {
    control = `<input type="checkbox" ${data}${v ? ' checked' : ''} />`;
  }
  const leading = o.kind === 'check';
  return `
    <label class="event-bonus${o.deduction ? ' requirement' : ''}" data-option-row="${o.id}">
      ${leading ? control : ''}
      <span class="event-bonus-text"><strong>${esc(o.label)}</strong><span>${esc(o.help)}</span></span>
      ${leading ? '' : control}
      <span class="event-bonus-value calc" data-calc="opt-${o.id}"></span>
    </label>`;
}

function eventCard(event, athlete) {
  const ap = APPARATUS[event];
  const level = levelOf(athlete);
  const groups = Object.entries(ap.groups)
    .map(([n, g]) => `<li data-cg="${n}"><span class="cg-badge">${ROMAN[n]}</span><span>${esc(g)}</span></li>`)
    .join('');
  return `
    <article class="card event-card" data-event-card="${event}" id="panel-${event}" data-panel="${event}" role="tabpanel" aria-labelledby="tab-${event}">
      <header class="card-head">
        <h2 class="card-title">${ap.label}</h2>
        <div class="card-head-right">
          <span class="sv-pill" data-sv="${event}"></span>
          <button class="btn btn-ghost btn-sm" type="button" data-export="${event}" title="${EXPORT_TIP}">Export PDF</button>
        </div>
      </header>
      <p class="routine-help">
        List the whole routine in order, and drag <span class="grip-inline">${ICON_GRIP}</span> to reorder.
        <strong>Each skill counts only once</strong>. Your ${maxSkills(athlete)} highest-value skills count toward difficulty,
        with at most ${MAX_PER_EG} from one element group.
        Counting skills are highlighted; repeats and non-counting skills are shaded gray and flagged.
      </p>
      <div class="skill-table" data-routine="${event}">${routineRows(event, athlete)}</div>
      <div class="routine-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-add-skill="${event}">Add skill</button>
        <span class="routine-count" data-calc="count"></span>
      </div>
      ${eventOptions(event, level).map((o) => optionControl(event, o, athlete)).join('')}
      <div class="event-foot">
        <ul class="cg-list">${groups}</ul>
        <dl class="totals">
          <div><dt>Execution</dt><dd>10.0</dd></div>
          <div><dt>Difficulty</dt><dd data-total="difficulty"></dd></div>
          <div><dt>EG bonus</dt><dd data-total="eg"></dd></div>
          <div><dt>Other bonus</dt><dd data-total="bonus"></dd></div>
          <div><dt>Short of ${MIN_SKILLS}</dt><dd data-total="short"></dd></div>
          <div class="grand"><dt>Start value</dt><dd data-total="sv"></dd></div>
        </dl>
        <p class="sv-note" data-calc="sv-note" hidden></p>
      </div>
    </article>`;
}

function vaultCard(athlete) {
  const level = levelOf(athlete);
  return `
    <article class="card vault-card" id="panel-vt" data-panel="vt" role="tabpanel" aria-labelledby="tab-vt">
      <header class="card-head">
        <h2 class="card-title">Vault</h2>
        <div class="card-head-right"><span class="sv-pill" data-sv="vt"></span></div>
      </header>
      <div class="vault-body">
        <label class="field grow"><span>Select your vault</span>
          <select id="f-vault">${vaultOptions(athlete.vault, level)}</select></label>
        <dl class="vault-info" id="vault-info"></dl>
      </div>
      <p class="vault-note" id="vault-note" hidden></p>
    </article>`;
}

function renderEditor() {
  const ed = $('#editor');
  if (!ed) return;
  const a = selected();
  if (!a) {
    ed.innerHTML = `
      <div class="card empty-editor">
        <h2>Add your first athlete</h2>
        <p>Each athlete gets floor, pommel horse, rings, vault, parallel bars and high bar. Start values update as you type, and you can export filled-in UCG start value worksheets.</p>
        <button class="btn btn-primary" type="button" id="empty-add">Add athlete</button>
      </div>`;
    $('#empty-add').onclick = addAthlete;
    return;
  }

  ed.innerHTML = `
    <div class="editor-head">
      <div class="fields">
        <label class="field grow"><span>Gymnast name</span>
          <input id="f-name" type="text" data-field="name" value="${esc(a.name)}" placeholder="Name" /></label>
        <label class="field"><span>Club</span>
          <input id="f-club" type="text" data-field="club" value="${esc(a.club)}" placeholder="Club / school" /></label>
        <label class="field"><span>Level</span>
          <select id="f-level">${LEVEL_IDS.map((l) => `<option value="${l}"${l === levelOf(a) ? ' selected' : ''}>${esc(LEVELS[l].label)}</option>`).join('')}</select></label>
      </div>
      <div class="editor-actions">
        <span id="save-status" class="save-status"></span>
        <button class="btn btn-primary" type="button" id="export-all" title="${EXPORT_TIP}">Export PDF</button>
        <button class="btn btn-quiet" type="button" id="delete-athlete">Delete</button>
      </div>
    </div>

    <div class="summary" id="summary" role="tablist" aria-label="Events"></div>

    ${ALL_EVENTS.map((e) => (e === 'vt' ? vaultCard(a) : eventCard(e, a))).join('')}
  `;

  $('#f-name').oninput = (ev) => {
    a.name = ev.target.value;
    renderListSoon();
    scheduleSave();
  };
  $('#f-club').oninput = (ev) => {
    a.club = ev.target.value;
    renderListSoon();
    scheduleSave();
  };
  $('#f-level').onchange = (ev) => {
    a.level = ev.target.value;
    normalize(a);
    renderList();
    renderEditor();
    scheduleSave();
  };
  $('#f-vault').onchange = (ev) => {
    a.vault = ev.target.value;
    updateComputed();
    scheduleSave();
  };
  $('#delete-athlete').onclick = removeAthlete;
  $('#export-all').onclick = (ev) => runExport(ev.currentTarget, EVENTS);
  $$('[data-export]', ed).forEach((b) => (b.onclick = () => runExport(b, [b.dataset.export])));

  ed.oninput = onSkillInput;
  ed.onclick = onEditorClick;
  ed.onkeydown = onEditorKey;
  ed.onpointerdown = onEditorPointerDown;
  ed.onmousedown = (ev) => ev.target.closest('[data-combo]') && ev.preventDefault(); // keep focus in the skill input
  ed.onfocusout = (ev) => ev.target === picker.input && closePicker();
  $('#summary').onclick = (ev) => {
    const t = ev.target.closest('[data-tab]');
    if (t) selectTab(t.dataset.tab);
  };
  $('#summary').onkeydown = onTabKey;
  updateComputed();
}

function onSkillInput(ev) {
  const t = ev.target;
  const a = selected();
  if (t.dataset.option) {
    const opts = ((a.options ||= {})[t.dataset.option] ||= {});
    opts[t.dataset.opt] = t.type === 'checkbox' ? t.checked : Number(t.value);
    updateComputed();
    scheduleSave();
    return;
  }
  if (!t.dataset.event) return;
  const row = a.routines[t.dataset.event][Number(t.dataset.idx)];
  row[t.dataset.field] = t.value;
  if (t.dataset.field === 'name') {
    // Editing a picked skill's name makes it a custom skill.
    if (row.skillId && findSkill(row.skillId)?.label !== t.value) delete row.skillId;
    openPicker(t, t.value);
  }
  updateComputed();
  scheduleSave();
}

function showPanel() {
  $$('[data-panel]').forEach((el) => (el.hidden = el.dataset.panel !== state.tab));
}

function selectTab(tab, focus = false) {
  state.tab = tab;
  try {
    localStorage.setItem('sv-tab', tab);
  } catch {}
  updateComputed();
  if (focus) $(`#tab-${tab}`)?.focus();
}

function onTabKey(ev) {
  const i = TABS.indexOf(state.tab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[ev.key];
  if (next == null || !ev.target.closest('[role="tab"]')) return;
  ev.preventDefault();
  selectTab(TABS[(next + TABS.length) % TABS.length], true);
}

let listTimer;
function renderListSoon() {
  clearTimeout(listTimer);
  listTimer = setTimeout(renderList, 250);
}

function updateComputed() {
  const a = selected();
  if (!a) return;
  const score = scoreAthlete(a);
  const level = score.level;
  const max = maxSkills(a);

  // Vault
  const v = score.vault;
  $('#vault-info').innerHTML = v
    ? `<div><dt>Element group</dt><dd>${esc(v.eg)}</dd></div>
       <div><dt>VT #</dt><dd>${esc(v.id)}</dd></div>
       <div><dt>D score</dt><dd>${fmt(v.dv)}</dd></div>`
    : '';
  const vNote = $('#vault-note');
  vNote.hidden = !(v?.banned || v?.capped);
  vNote.textContent = v?.banned
    ? 'Flipping vaults are not allowed at the Developmental level and score 0. Choose a handspring vault with no salto.'
    : v?.capped
      ? `Start value capped at ${fmt(LEVELS[level].cap)} (${fmt(v.raw)} before the cap).`
      : '';
  $('[data-sv="vt"]').textContent = v ? v.startValue.toFixed(1) : '—';

  for (const e of EVENTS) {
    const card = $(`[data-event-card="${e}"]`);
    const r = score.events[e];
    for (const it of r.items) {
      const rowEl = $(`[data-row="${it.idx}"]`, card);
      if (!rowEl) continue;
      const repeat = it.status === 'repeat';
      const nonCounting = it.status === 'noncounting';
      rowEl.classList.toggle('is-counting', it.status === 'counting');
      rowEl.classList.toggle('is-repeat', repeat);
      rowEl.classList.toggle('non-counting', nonCounting);
      rowEl.classList.toggle('has-bonus', !!it.bonus);
      $('[data-calc="value"]', rowEl).textContent = repeat ? '—' : it.letter ? fmt(it.value) : '';
      $('[data-calc="bonus"]', rowEl).textContent = it.bonus ? `+${fmt(it.bonus)}` : '';
      // A short flag in place of Value / Bonus keeps every row the same
      // height; the full explanation is in its tooltip.
      const flagEl = $('[data-calc="flag"]', rowEl);
      const overEg = nonCounting && it.reason === 'eg';
      const overSr = nonCounting && it.reason === 'sr';
      flagEl.textContent = repeat
        ? `Repeat of Skill ${it.repeatOf + 1}`
        : overEg
          ? `Over ${MAX_PER_EG} in EG ${ROMAN[it.eg]}`
          : overSr
            ? `Over ${SR_MAX_STATIC} EG II/III`
            : nonCounting
              ? `Not in Top ${max}`
              : '';
      flagEl.title = repeat
        ? `Repeat of skill ${it.repeatOf + 1}: each skill only counts once`
        : overEg
          ? `Only ${MAX_PER_EG} skills from one element group count, so this one doesn't count toward difficulty`
          : overSr
            ? `Only ${SR_MAX_STATIC} EG II or III skills count before a B or higher EG I skill, so this one doesn't count toward difficulty`
            : nonCounting
              ? `Not in your top ${max}, so it doesn't count toward difficulty`
              : '';
      const src = findSkill(a.routines[e][it.idx]?.skillId)?.src || (it.name ? 'Custom' : '');
      const badge = $('[data-calc="src"]', rowEl);
      badge.textContent = src;
      badge.className = `src-badge ${src.toLowerCase()}`;
      badge.title = src === 'Custom' ? 'Not from the skill list: difficulty and EG are set by hand' : '';
      $('.skill-input', rowEl).title = it.name; // long names are cut off in the box
    }
    const filled = r.items.filter((it) => it.status !== 'blank').length;
    $('[data-calc="count"]', card).textContent = `${r.rows.length} of ${max} counting · ${filled} skill${filled === 1 ? '' : 's'} listed`;
    $(`[data-add-skill="${e}"]`, card).hidden = a.routines[e].length >= MAX_ROUTINE;
    $$('.cg-list li', card).forEach((li) => li.classList.toggle('earned', r.egBonus[li.dataset.cg] != null));

    for (const o of eventOptions(e, level)) {
      const row = $(`[data-option-row="${o.id}"]`, card);
      const el = $(`[data-calc="opt-${o.id}"]`, card);
      if (o.deduction) {
        const missing = !a.options?.[e]?.[o.id];
        el.textContent = missing ? `−${fmt(o.value)}` : '';
        row.classList.toggle('on', !missing);
        row.classList.toggle('missing', missing && r.rows.length > 0);
        continue;
      }
      const got = r.optionValues[o.id] || 0;
      el.textContent = got ? `+${fmt(got)}` : '';
      row.classList.toggle('on', !!got);
    }

    $('[data-total="difficulty"]', card).textContent = fmt(r.difficulty);
    $('[data-total="eg"]', card).textContent = fmt(r.egTotal);
    $('[data-total="bonus"]', card).textContent = fmt(r.bonus);
    $('[data-total="short"]', card).textContent = r.shortDeduction ? `−${fmt(r.shortDeduction)}` : '0.0';
    $('[data-total="sv"]', card).textContent = r.startValue.toFixed(1);
    const notes = [];
    if (r.capped) notes.push(`Start value capped at ${fmt(r.cap)} (${fmt(r.raw)} before the cap).`);
    if (r.deductions) notes.push(`Expected neutral deduction −${fmt(r.deductions)}: ${fmt(r.afterDeductions)} after deductions.`);
    const noteEl = $('[data-calc="sv-note"]', card);
    noteEl.textContent = notes.join(' ');
    noteEl.hidden = !notes.length;
    $(`[data-sv="${e}"]`).textContent = r.rows.length ? r.startValue.toFixed(1) : '—';
  }

  // The score tiles double as the event tabs.
  $('#summary').innerHTML =
    ALL_EVENTS.map((id) => {
      const sv = id === 'vt' ? v?.startValue : score.events[id].rows.length ? score.events[id].startValue : null;
      const on = id === state.tab;
      return `<button type="button" class="stat stat-tab${on ? ' active' : ''}" role="tab" id="tab-${id}" data-tab="${id}"
          aria-selected="${on}" aria-controls="panel-${id}" tabindex="${on ? 0 : -1}">
          <span>${APPARATUS[id].short}</span><strong>${sv == null ? '—' : sv.toFixed(1)}</strong></button>`;
    }).join('') + `<div class="stat stat-aa"><span>All-Around</span><strong>${score.allAround.toFixed(1)}</strong></div>`;
  showPanel();

  renderListSoon();
}

async function runExport(button, events) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Building PDF…';
  try {
    const { exportAthletePdf, downloadPdf } = await import('./pdf.js');
    const athlete = selected();
    downloadPdf(await exportAthletePdf(athlete, events), athlete, events);
  } catch (e) {
    console.error(e);
    alert(`Could not create the PDF: ${e?.message || e}`);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

// ---- Boot -----------------------------------------------------------------

async function onUser(user) {
  state.user = user;
  renderUserArea();
  if (!user) {
    state.athletes = [];
    renderSignIn();
    return;
  }
  $('#local-banner').hidden = !user.local;
  app.innerHTML = `<p class="loading">Loading athletes…</p>`;
  try {
    state.athletes = await store.listAthletes();
    for (const a of state.athletes) if (normalize(a)) store.saveAthlete(a).catch(console.error);
  } catch (e) {
    console.error(e);
    app.innerHTML = `<p class="error">Could not load athletes: ${esc(e?.message || e)}</p>`;
    return;
  }
  let remembered = null;
  try {
    remembered = localStorage.getItem('sv-selected');
  } catch {}
  state.selectedId = state.athletes.some((a) => a.id === remembered) ? remembered : sortedAthletes()[0]?.id ?? null;
  renderShell();
}

store.init(onUser).catch((e) => {
  console.error(e);
  app.innerHTML = `<p class="error">Could not start the app: ${esc(e?.message || e)}</p>`;
});
