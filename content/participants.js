(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory({ window, document, model: root.BBLParticipantsData, fetch: window.fetch.bind(window),
    MutationObserver, requestAnimationFrame, AbortController, setTimeout, clearTimeout,
    getComputedStyle: window.getComputedStyle.bind(window), chrome });
})(globalThis, function(env) {
  'use strict';
  const { window, document: doc, model, fetch, MutationObserver, requestAnimationFrame, AbortController, setTimeout, clearTimeout, getComputedStyle, chrome } = env;
  const STYLE_TEXT = "#bbl-participants-nav button { border: 0; border-radius: 0; cursor: pointer; font: inherit; color: var(--bbl-accent, inherit); background: var(--bbl-primary, transparent) !important; }\n#bbl-participants-nav button:focus-visible { outline: 2px solid currentColor; outline-offset: -3px; }\n#bbl-participants-dialog {\n  background: var(--bbl-primary, var(--bbl-roster-native-bg, #fff));\n  color: var(--bbl-accent, var(--bbl-roster-native-text, #202124));\n  width: min(1100px, calc(100vw - 48px)); max-height: calc(100vh - 64px);\n  box-sizing: border-box; padding: 24px; margin: auto; border: 1px solid #888;\n  border-radius: 4px; box-shadow: 0 8px 32px #0005; font: inherit;\n}\n#bbl-participants-dialog::backdrop { background: #0008; }\n#bbl-participants-dialog .bbl-roster-header { display: flex; justify-content: space-between; align-items: start; gap: 16px; }\n#bbl-participants-dialog h2 { margin: 0; font-size: 24px; font-weight: 600; color: inherit !important; }\n#bbl-participants-dialog .bbl-roster-description { margin: 8px 0 0; font-size: 14px; }\n#bbl-participants-dialog .bbl-roster-controls { display: flex; gap: 16px; flex-wrap: wrap; align-items: end; margin: 24px 0 16px; }\n#bbl-participants-dialog label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }\n#bbl-participants-dialog .bbl-roster-search-label { flex: 1 1 240px; }\n#bbl-participants-dialog input, #bbl-participants-dialog select {\n  background: inherit; color: inherit; padding: 10px 12px; border: 1px solid #888; border-radius: 2px; font: inherit; min-width: 0;\n}\n#bbl-participants-dialog input::placeholder { color: inherit; opacity: .7; }\n#bbl-participants-dialog select option { background: var(--bbl-primary, var(--bbl-roster-native-bg, #fff)); color: var(--bbl-accent, var(--bbl-roster-native-text, #202124)); }\n#bbl-participants-dialog button {\n  color: inherit; background: transparent; border: 1px solid #888; border-radius: 2px; padding: 8px 12px; font: inherit; cursor: pointer;\n}\n#bbl-participants-dialog button:disabled { opacity: .5; cursor: default; }\n#bbl-participants-dialog :focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }\n#bbl-participants-dialog .bbl-roster-status { margin: 16px 0; min-height: 20px; }\n#bbl-participants-dialog .bbl-roster-table-wrap { overflow-x: auto; }\n#bbl-participants-dialog table { width: 100%; border-collapse: collapse; text-align: start; font-size: 14px; background: transparent; }\n#bbl-participants-dialog th, #bbl-participants-dialog td { padding: 16px 12px; border-bottom: 1px solid #bbb; text-align: start; color: inherit; background: transparent; }\n#bbl-participants-dialog th { font-weight: 600; border-bottom-width: 2px; white-space: nowrap; }\n#bbl-participants-dialog .bbl-roster-sort { display: inline-flex; align-items: center; gap: 8px; border: 0; padding: 0; font-weight: 600; }\n#bbl-participants-dialog .bbl-roster-person { display: flex; gap: 14px; align-items: center; min-height: 32px; min-width: 220px; }\n#bbl-participants-dialog .bbl-roster-avatar { flex: 0 0 32px; width: 32px; height: 32px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: #666; color: #fff !important; }\n#bbl-participants-dialog .bbl-roster-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }\n#bbl-participants-dialog .bbl-roster-name { font-weight: 600; }\n#bbl-participants-dialog .bbl-roster-id { white-space: nowrap; font-variant-numeric: tabular-nums; }\n#bbl-participants-dialog .bbl-roster-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 20px; font-size: 14px; }\n#bbl-participants-dialog .bbl-roster-pages { display: flex; gap: 8px; }\n#bbl-participants-dialog [hidden] { display: none !important; }\n@media (max-width: 600px) {\n  #bbl-participants-dialog { width: calc(100vw - 16px); max-height: calc(100vh - 16px); padding: 16px; }\n  #bbl-participants-dialog .bbl-roster-controls { gap: 12px; }\n}\n";
  if (!model || window.top !== window) return null;
  const arabic = /^ar(?:-|$)/i.test(doc.documentElement.lang || '');
  const labels = arabic ? { participants: 'المشاركون', close: 'إغلاق', search: 'بحث عن مشارك', roles: 'الدور', all: 'كل الأدوار', name: 'الاسم', role: 'الدور', username: 'اسم المستخدم', id: 'معرّف المستخدم', retry: 'إعادة المحاولة', previous: 'السابق', next: 'التالي', loading: 'جارٍ تحميل المشاركين…', empty: 'لا يوجد مشاركون.', noMatches: 'لا توجد نتائج مطابقة.', count: 'مشاركًا' } :
    { participants: 'Participants', close: 'Close', search: 'Search participants', roles: 'Role', all: 'All roles', name: 'Name', role: 'Role', username: 'Username', id: 'User ID', retry: 'Retry', previous: 'Previous', next: 'Next', loading: 'Loading participants…', empty: 'No participants are available.', noMatches: 'No matching participants.', count: 'participants' };
  let navItem = null, navCourse = null, dialog = null, ui = null, activeCourse = null;
  let rows = [], canViewUserName = true, direction = 'asc', page = 0, request = null, generation = 0, queued = false;
  let loading = false, lastError = '', restoreFocus = null;
  const pageSize = 50;
  function element(tag, className = '', text = '') {
    const node = doc.createElement(tag); if (className) node.className = className;
    if (text) node.textContent = text; return node;
  }
  function button(text, action, className = '') { const node = element('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node; }
  function ensureStyle() {
    if (doc.getElementById('bbl-participants-style')) return;
    const style = element('style'); style.id = 'bbl-participants-style'; style.textContent = STYLE_TEXT;
    (doc.head || doc.documentElement).appendChild(style);
  }
  function nativeColors() {
    if (!dialog) return;
    const colors = getComputedStyle(doc.body);
    dialog.style.setProperty('--bbl-roster-native-bg', colors.backgroundColor && !/transparent|rgba\(0, 0, 0, 0\)/.test(colors.backgroundColor) ? colors.backgroundColor : '#ffffff');
    dialog.style.setProperty('--bbl-roster-native-text', colors.color || '#202124');
  }
  function courseNavigation() {
    const list = doc.querySelector('bb-course-navigation ul.bb-ui-navigation-list-horizontal');
    if (!list) return null;
    const template = list.querySelector('a[data-analytics-id="course.l1.grades.link"]') || list.querySelector('a[data-analytics-id="course.l1.calendar.link"]') ||
      list.querySelector('a[data-analytics-id="course.l1.groups-student.link"]') || list.querySelector('a[data-analytics-id^="course.l1."]');
    if (!template) return null;
    let id = null;
    try { const url = new URL(template.getAttribute('href'), window.location.origin); if (url.origin === window.location.origin) id = model.courseIdFromPath(url.pathname); } catch {}
    id ||= model.courseIdFromPath(window.location.pathname);
    const title = doc.querySelector('[data-analytics-id="course.header.course-title.button"]')?.textContent.trim() || '';
    return id ? { list, template, id, title } : null;
  }
  function close() {
    generation++; request?.abort(); request = null; rows = []; activeCourse = null; loading = false;
    if (dialog?.open) dialog.close();
    if (ui) { ui.body.replaceChildren(); ui.roles.replaceChildren(element('option', '', labels.all)); ui.search.value = ''; ui.count.textContent = ''; ui.status.textContent = ''; }
    if (restoreFocus?.isConnected) restoreFocus.focus();
  }
  function createDialog() {
    if (dialog?.isConnected) return;
    dialog = element('dialog', 'MuiPaper-root MuiDialog-paper'); dialog.id = 'bbl-participants-dialog';
    dialog.setAttribute('aria-labelledby', 'bbl-participants-title');
    const header = element('div', 'bbl-roster-header');
    const heading = element('h2', '', labels.participants); heading.id = 'bbl-participants-title';
    const count = element('p', 'bbl-roster-description'); const title = element('div'); title.appendChild(heading); title.appendChild(count);
    header.appendChild(title); header.appendChild(button(labels.close, close)); dialog.appendChild(header);
    const controls = element('div', 'bbl-roster-controls');
    const searchLabel = element('label', 'bbl-roster-search-label', labels.search);
    const search = element('input'); search.type = 'search'; search.placeholder = labels.search; searchLabel.appendChild(search);
    const roleLabel = element('label', '', labels.roles); const roles = element('select'); roleLabel.appendChild(roles);
    controls.appendChild(searchLabel); controls.appendChild(roleLabel); dialog.appendChild(controls);
    const status = element('p', 'bbl-roster-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); dialog.appendChild(status);
    const retry = button(labels.retry, () => load(activeCourse)); retry.hidden = true; dialog.appendChild(retry);
    const wrap = element('div', 'bbl-roster-table-wrap'); const table = element('table', 'MuiTable-root'); table.setAttribute('aria-label', labels.participants);
    const head = element('thead', 'MuiTableHead-root'); const headerRow = element('tr', 'MuiTableRow-root MuiTableRow-head');
    const nameHead = element('th', 'MuiTableCell-root MuiTableCell-head'); nameHead.scope = 'col';
    const sortIcon = element('span', '', '↑'); sortIcon.setAttribute('aria-hidden', 'true');
    const sort = button(labels.name, () => { direction = direction === 'asc' ? 'desc' : 'asc'; page = 0; renderRows(); }, 'bbl-roster-sort MuiTableSortLabel-root'); sort.appendChild(sortIcon); nameHead.appendChild(sort); headerRow.appendChild(nameHead);
    for (const label of [labels.role, labels.username, labels.id]) { const cell = element('th', 'MuiTableCell-root MuiTableCell-head', label); cell.scope = 'col'; headerRow.appendChild(cell); }
    head.appendChild(headerRow); table.appendChild(head); const body = element('tbody', 'MuiTableBody-root'); table.appendChild(body); wrap.appendChild(table); dialog.appendChild(wrap);
    const footer = element('div', 'bbl-roster-footer'); const range = element('span'); footer.appendChild(range);
    const pages = element('div', 'bbl-roster-pages'); const previous = button(labels.previous, () => { page--; renderRows(); }); const next = button(labels.next, () => { page++; renderRows(); });
    pages.appendChild(previous); pages.appendChild(next); footer.appendChild(pages); dialog.appendChild(footer);
    ui = { count, search, roles, status, retry, table, body, nameHead, sortIcon, previous, next, range, footer };
    search.addEventListener('input', () => { page = 0; renderRows(); }); roles.addEventListener('change', () => { page = 0; renderRows(); });
    dialog.addEventListener('close', () => { if (activeCourse) close(); });
    doc.body.appendChild(dialog);
  }
  function renderRows() {
    if (!ui) return;
    ui.body.replaceChildren(); ui.nameHead.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending'); ui.sortIcon.textContent = direction === 'asc' ? '↑' : '↓';
    ui.table.hidden = loading || Boolean(lastError); ui.footer.hidden = loading || Boolean(lastError); ui.retry.hidden = !lastError;
    if (loading) { ui.status.textContent = labels.loading; return; }
    if (lastError) { ui.status.textContent = lastError; return; }
    const filtered = model.filterParticipants(rows, ui.search.value || '', ui.roles.value || '', direction, arabic ? 'ar' : undefined);
    page = Math.max(0, Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1)));
    const start = page * pageSize;
    ui.status.textContent = !rows.length ? labels.empty : !filtered.length ? labels.noMatches : '';
    ui.status.hidden = Boolean(rows.length && filtered.length); ui.count.textContent = (dialog.dataset.courseTitle ? dialog.dataset.courseTitle + ' · ' : '') + rows.length + ' ' + labels.count;
    for (const participant of filtered.slice(start, start + pageSize)) {
      const row = element('tr', 'MuiTableRow-root'); const cell = element('td', 'MuiTableCell-root MuiTableCell-body');
      const person = element('div', 'bbl-roster-person'); const avatar = element('div', 'bbl-roster-avatar MuiAvatar-root MuiAvatar-circular'); avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = [...participant.name][0] || '?';
      if (participant.avatar) { const image = element('img'); avatar.textContent = ''; image.src = participant.avatar; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'same-origin'; image.addEventListener('error', () => { image.remove(); avatar.textContent = [...participant.name][0] || '?'; }); avatar.appendChild(image); }
      const name = element('bdi', 'bbl-roster-name', participant.name); person.appendChild(avatar); person.appendChild(name); cell.appendChild(person); row.appendChild(cell);
      for (const value of [participant.role, canViewUserName ? participant.username || '—' : '—', participant.id || '—']) {
        const detail = element('td', 'MuiTableCell-root MuiTableCell-body'); detail.appendChild(element('bdi', 'bbl-roster-id', value)); row.appendChild(detail);
      }
      ui.body.appendChild(row);
    }
    ui.range.textContent = filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} / ${filtered.length}` : '0 / 0';
    ui.previous.disabled = page === 0; ui.next.disabled = start + pageSize >= filtered.length;
  }
  function errorMessage(error) {
    const code = error.code;
    if (arabic) return code === 'permission' ? 'لا يسمح Blackboard لهذا الحساب بعرض المشاركين.' : code === 'session' ? 'انتهت جلسة Blackboard. سجّل الدخول ثم أعد المحاولة.' : 'تعذر تحميل المشاركين. أعد المحاولة.';
    return code === 'permission' ? 'Blackboard does not allow this account to view course participants.' : code === 'session' ? 'Your Blackboard session has expired. Sign in and try again.' : 'Could not load participants. Please try again.';
  }
  async function load(id) {
    if (!id || !dialog?.open) return;
    request?.abort(); const controller = new AbortController(); request = controller;
    const token = ++generation; rows = []; loading = true; lastError = ''; ui.status.hidden = false; renderRows();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const result = await model.loadMemberships({ origin: window.location.origin, courseId: id, fetch, signal: controller.signal });
      if (token !== generation || activeCourse !== id || !dialog.open) return;
      rows = result.rows; canViewUserName = result.canViewUserName;
      const roles = [...new Set(rows.map(row => row.role))].sort(); ui.roles.replaceChildren();
      const all = element('option', '', labels.all); all.value = ''; ui.roles.appendChild(all);
      for (const role of roles) { const option = element('option', '', role); option.value = role; ui.roles.appendChild(option); }
      ui.roles.value = '';
    } catch (error) {
      if (token !== generation || activeCourse !== id || !dialog.open) return;
      lastError = errorMessage(error);
    } finally {
      clearTimeout(timeout);
      if (token === generation) { request = null; loading = false; ui.status.hidden = false; renderRows(); }
    }
  }
  function open() {
    const nav = courseNavigation(); if (!nav) return;
    ensureStyle(); createDialog(); nativeColors(); restoreFocus = doc.activeElement;
    activeCourse = nav.id; dialog.dataset.courseTitle = nav.title; ui.count.textContent = nav.title;
    direction = 'asc'; page = 0; ui.search.value = ''; ui.roles.value = ''; ui.status.hidden = false;
    if (!dialog.open) dialog.showModal(); ui.search.focus(); void load(nav.id);
  }
  function syncNavAppearance(nav) {
    const link = navItem.querySelector('button');
    link.className = nav.template.className.split(/\s+/).filter(name => name && !/^active$|^Mui-active$|^makeStylesactive|^js-course-/.test(name)).join(' ');
    const nativeText = nav.template.querySelector('.MuiListItemText-root');
    const nativeTitle = nav.template.querySelector('[data-title]');
    link.children[0].className = nativeText?.className || 'MuiListItemText-root';
    const title = link.querySelector('[data-title]');
    title.className = nativeTitle?.className || 'MuiTypography-root MuiTypography-body1';
    // Preserve Blackboard's intermediate title wrappers without copying badges or listeners.
    const wrappers = [];
    let ancestor = nativeTitle?.parentElement;
    while (ancestor && ancestor !== nativeText && ancestor !== nav.template) { wrappers.unshift(ancestor); ancestor = ancestor.parentElement; }
    const structure = wrappers.map(node => node.tagName + '.' + node.className).join('/');
    if (link.dataset.titleStructure !== structure) {
      const wrap = link.children[0]; title.remove(); wrap.replaceChildren();
      let parent = wrap;
      for (const native of wrappers) { const node = element(native.tagName.toLowerCase(), native.className); parent.appendChild(node); parent = node; }
      parent.appendChild(title); link.dataset.titleStructure = structure;
    }
    const style = getComputedStyle(nav.template);
    for (const property of ['padding-inline-start', 'padding-inline-end', 'padding-top', 'padding-bottom', 'margin-inline-start', 'margin-inline-end',
      'display', 'align-items', 'justify-content', 'gap', 'box-sizing', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'white-space', 'text-transform', 'min-width', 'height', 'min-height',
      'border-bottom-width', 'border-bottom-style']) {
      const value = style.getPropertyValue?.(property);
      if (value) link.style.setProperty(property, value);
    }
    link.style.setProperty('border-bottom-color', 'transparent');
    const gradesItem = nav.list.querySelector('a[data-analytics-id="course.l1.grades.link"]')?.parentElement;
    if (gradesItem && navItem.nextElementSibling !== gradesItem) nav.list.insertBefore(navItem, gradesItem);
  }
  function reconcile() {
    const nav = courseNavigation();
    const routeCourse = model.courseIdFromPath(window.location.pathname);
    if (activeCourse && (!nav || nav.id !== activeCourse || (routeCourse && routeCourse !== activeCourse))) close();
    if (!nav) { navItem?.remove(); navItem = null; navCourse = null; return; }
    ensureStyle();
    if (navItem?.isConnected && navItem.parentElement === nav.list) { navCourse = nav.id; syncNavAppearance(nav); return; }
    navItem?.remove(); navCourse = nav.id; navItem = element('li'); navItem.id = 'bbl-participants-nav';
    const link = element('button'); link.type = 'button'; link.className = nav.template.className.split(/\s+/).filter(name => name && !/^active$|^Mui-active$|^makeStylesactive/.test(name)).join(' ');
    link.setAttribute('variant', 'secondary'); link.setAttribute('aria-haspopup', 'dialog'); link.setAttribute('aria-controls', 'bbl-participants-dialog');
    const textWrap = element(nav.template.querySelector('.MuiListItemText-root')?.tagName.toLowerCase() || 'div', 'MuiListItemText-root'); const title = element('span', nav.template.querySelector('[data-title]')?.className || 'MuiTypography-root MuiTypography-body1', labels.participants);
    title.setAttribute('data-title', labels.participants); textWrap.appendChild(title); link.appendChild(textWrap);
    link.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); open(); });
    navItem.appendChild(link); nav.list.appendChild(navItem);
    syncNavAppearance(nav);
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; reconcile(); }); } }
  const observer = new MutationObserver(records => {
    if (records.every(record => record.target?.closest?.('#bbl-participants-dialog, #bbl-participants-nav'))) return;
    schedule();
  });
  function start() { reconcile(); observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] }); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.addEventListener('popstate', schedule); window.addEventListener('hashchange', schedule); window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', start);
  window.addEventListener('pagehide', () => { close(); observer.disconnect(); });
  chrome?.storage?.onChanged?.addListener(() => requestAnimationFrame(nativeColors));
  return { reconcile, open, close, getState: () => ({ activeCourse, navCourse, rows: rows.slice(), loading, error: lastError }), getUI: () => ui, getDialog: () => dialog };
});
