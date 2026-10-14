(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory({ window, document, model: root.BBLAnnouncementsData, fetch: window.fetch.bind(window),
    MutationObserver, requestAnimationFrame, AbortController, getComputedStyle: window.getComputedStyle.bind(window), chrome });
})(globalThis, function(env) {
  'use strict';
  const { window, document: doc, model, fetch, MutationObserver, requestAnimationFrame, AbortController, getComputedStyle, chrome } = env;
  if (!model || window.top !== window) return null;
  const STYLE_TEXT = ".todo-panel[data-bbl-announcements-column] {\n  display: flex !important; flex-direction: column !important; justify-content: flex-start !important;\n  align-items: stretch; gap: 0 !important; height: auto !important; min-height: 0 !important;\n}\n.todo-panel[data-bbl-announcements-column] > bb-todo,\n.todo-panel[data-bbl-announcements-column] > bb-todo > aside {\n  flex: 0 0 auto !important; height: auto !important; min-height: 0 !important; margin-bottom: 0 !important;\n}\n#bbl-home-announcements {\n  background: var(--bbl-primary, var(--bbl-feed-native-bg, #fff)); color: var(--bbl-accent, var(--bbl-feed-native-text, #202124));\n  margin: 12px 0 0 !important; padding: 20px 16px; width: 100%; min-width: 0; box-sizing: border-box; position: static !important; height: auto;\n  flex: 0 0 auto !important; order: 0 !important;\n  border: 1px solid #8888; border-radius: 2px; font: inherit; container-type: inline-size;\n}\n#bbl-home-announcements .bbl-feed-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }\n#bbl-home-announcements h2 { margin: 0; font-size: 20px; line-height: 1.3; color: inherit !important; }\n#bbl-home-announcements .bbl-feed-button { font: inherit; color: inherit; background: transparent; border: 1px solid #888; border-radius: 2px; padding: 6px 10px; cursor: pointer; }\n#bbl-home-announcements .bbl-feed-button:disabled { opacity: .5; cursor: default; }\n#bbl-home-announcements .guidance-wrapper { position: static; display: flex; background: transparent; padding: 0; height: auto; min-height: 0; margin: 0 0 12px; color: inherit; font-size: 13px; }\n#bbl-home-announcements .bbl-feed-search-label { display: block; font-size: 13px; margin: 0 0 16px; }\n#bbl-home-announcements input { display: block; margin-top: 6px; width: 100%; min-width: 0; box-sizing: border-box; padding: 8px 10px; border: 1px solid #888; background: transparent; color: inherit; font: inherit; }\n#bbl-home-announcements input::placeholder { color: inherit; opacity: .7; }\n#bbl-home-announcements .bbl-feed-status { margin: 12px 0; font-size: 14px; }\n#bbl-home-announcements table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; color: inherit; font-size: 14px; background: transparent; }\n#bbl-home-announcements th, #bbl-home-announcements td { background: transparent; color: inherit; padding: 16px 8px; border: 0; border-bottom: 1px solid #8888; text-align: start; vertical-align: top; }\n#bbl-home-announcements th { border-bottom: 2px solid #888; font-weight: 600; }\n#bbl-home-announcements .column-date, #bbl-home-announcements .announcement-status-column { width: 115px; font-size: 13px; }\n#bbl-home-announcements .announcement-header { display: flex; align-items: start; gap: 12px; padding: 0; }\n#bbl-home-announcements .announcement-icon { flex: 0 0 28px; width: 28px; margin: 0; color: inherit; }\n#bbl-home-announcements svg { width: 28px; height: 28px; display: block; color: inherit; }\n#bbl-home-announcements .click-message-detail { flex: 1; min-width: 0; margin: 0; }\n#bbl-home-announcements a { color: inherit; text-decoration: underline; overflow-wrap: anywhere; }\n#bbl-home-announcements .bbl-feed-course { display: block; font-size: 13px; margin-bottom: 6px; }\n#bbl-home-announcements summary { cursor: pointer; list-style: none; }\n#bbl-home-announcements summary::-webkit-details-marker { display: none; }\n#bbl-home-announcements .list-item-title { color: inherit; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }\n#bbl-home-announcements summary:hover .list-item-title { text-decoration: underline; }\n#bbl-home-announcements .three-lines { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; margin: 8px 0 0; padding: 0; color: inherit; line-height: 1.5; font-size: 14px; word-break: normal; overflow-wrap: anywhere; }\n#bbl-home-announcements details[open] .three-lines { display: none; }\n#bbl-home-announcements .bbl-feed-message { margin-top: 16px; overflow-wrap: anywhere; color: inherit; line-height: 1.5; }\n#bbl-home-announcements .bbl-feed-message :is(p, div, span, strong, b, em, li, code, pre, th, td) { color: inherit; background: transparent; }\n#bbl-home-announcements .bbl-feed-message :is(ul, ol) { padding-inline-start: 24px; }\n#bbl-home-announcements .bbl-feed-message pre { white-space: pre-wrap; }\n#bbl-home-announcements .bbl-feed-view { display: inline-block; margin-top: 12px; font-size: 13px; }\n#bbl-home-announcements .bbl-feed-unread { display: inline-block; font-size: 11px; margin-inline-start: 8px; border: 1px solid currentColor; border-radius: 10px; padding: 1px 6px; }\n#bbl-home-announcements .bbl-feed-more { margin-top: 16px; width: 100%; }\n#bbl-home-announcements [hidden] { display: none !important; }\n#bbl-home-announcements :focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }\n@container (max-width: 480px) {\n  #bbl-home-announcements .bbl-feed-header { flex-wrap: wrap; }\n  #bbl-home-announcements thead .column-date { display: none; }\n  #bbl-home-announcements th { display: block; }\n  #bbl-home-announcements td { display: block; width: auto !important; }\n  #bbl-home-announcements .announcement-header-column { border-bottom: 0; padding-bottom: 4px; }\n  #bbl-home-announcements .announcement-status-column { padding-inline-start: 48px; padding-top: 4px; }\n}\n";
  const arabic = /^ar(?:-|$)/i.test(doc.documentElement.lang || '');
  const labels = arabic ? { title: 'كل الإعلانات', announcement: 'الإعلان', posted: 'تاريخ النشر', search: 'بحث في الإعلانات', refresh: 'تحديث', more: 'عرض المزيد', loading: 'جارٍ تحميل الإعلانات…', empty: 'لا توجد إعلانات منشورة.', matches: 'لا توجد نتائج مطابقة.', session: 'انتهت جلسة Blackboard. سجّل الدخول ثم أعد التحديث.', permission: 'لا يسمح Blackboard لهذا الحساب بعرض المقررات.', error: 'تعذر تحميل الإعلانات. أعد التحديث للمحاولة مرة أخرى.', partial: 'تعذر تحميل الإعلانات لبعض المقررات', unread: 'غير مقروء', course: 'عرض إعلانات المقرر', total: 'إعلانًا', unknownDate: 'التاريخ غير متاح' } :
    { title: 'All announcements', announcement: 'Announcement', posted: 'Posted', search: 'Search announcements', refresh: 'Refresh', more: 'Show more', loading: 'Loading announcements…', empty: 'No published announcements.', matches: 'No matching announcements.', session: 'Your Blackboard session has expired. Sign in, then refresh announcements.', permission: 'Blackboard does not allow this account to view its courses.', error: 'Could not load announcements. Select Refresh to try again.', partial: 'Could not load announcements for some courses', unread: 'Unread', course: 'View course announcements', total: 'announcements', unknownDate: 'Date unavailable' };
  let panel = null, ui = null, request = null, generation = 0, queued = false, visited = false, column = null;
  let rows = [], failures = [], loading = false, error = '', shown = 10;
  const dateFormat = new Intl.DateTimeFormat(arabic ? 'ar' : undefined, { dateStyle: 'short', timeStyle: 'short' });
  function node(tag, className = '', text = '') { const item = doc.createElement(tag); if (className) item.className = className; if (text) item.textContent = text; return item; }
  function button(text, action) { const item = node('button', 'MuiButtonBase-root bbl-feed-button', text); item.type = 'button'; item.addEventListener('click', action); return item; }
  function todoRoot() {
    if (!/^\/ultra\/(?:course|courses)\/?$/.test(window.location.pathname) || doc.querySelector('bb-course-navigation')) return null;
    const todo = doc.querySelector('.todo-panel bb-todo');
    return todo && todo.getAttribute('is-for-org') !== 'true' ? todo : null;
  }
  function ensureStyle() {
    if (doc.getElementById('bbl-announcements-style')) return;
    const style = node('style'); style.id = 'bbl-announcements-style'; style.textContent = STYLE_TEXT; (doc.head || doc.documentElement).appendChild(style);
  }
  function syncAppearance(todo) {
    if (column && column !== todo.parentElement) column.removeAttribute('data-bbl-announcements-column');
    column = todo.parentElement; column.setAttribute('data-bbl-announcements-column', '');
    const heading = todo.querySelector('h2'); if (heading && ui.heading.className !== heading.className) ui.heading.className = heading.className;
    const native = getComputedStyle(todo.querySelector('aside') || todo);
    panel.style.setProperty('--bbl-feed-native-bg', native.backgroundColor && !/transparent|rgba\(0, 0, 0, 0\)/.test(native.backgroundColor) ? native.backgroundColor : '#fff');
    panel.style.setProperty('--bbl-feed-native-text', native.color || '#202124');
  }
  function icon() {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M4 9h4l11-5v16L8 15H4V9zm4 6 2 6H6l-2-6M22 9v6'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.5'); path.setAttribute('stroke-linejoin', 'round'); svg.appendChild(path); return svg;
  }
  function createPanel(todo) {
    panel = node('section', 'page-announcement course-announcement-layer'); panel.id = 'bbl-home-announcements'; panel.setAttribute('aria-labelledby', 'bbl-announcements-title');
    const header = node('div', 'bbl-feed-header'); const heading = node('h2', 'MuiTypography-root MuiTypography-h3', labels.title); heading.id = 'bbl-announcements-title';
    header.appendChild(heading); const refresh = button(labels.refresh, () => void load()); header.appendChild(refresh); panel.appendChild(header);
    const guidance = node('div', 'guidance-wrapper'); const count = node('span'); guidance.appendChild(count); panel.appendChild(guidance);
    const searchLabel = node('label', 'bbl-feed-search-label', labels.search); const search = node('input'); search.type = 'search'; search.placeholder = labels.search; searchLabel.appendChild(search); panel.appendChild(searchLabel);
    const status = node('p', 'bbl-feed-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); panel.appendChild(status);
    const table = node('table', 'table-content sortable-table'); const caption = node('caption', 'sr-only', labels.title); table.appendChild(caption);
    const head = node('thead', 'list-item-columns announcement-sort-header'); const headingRow = node('tr', 'list-item-row announcement-sort-row');
    const title = node('th', 'column-title', labels.announcement); title.scope = 'col'; headingRow.appendChild(title);
    const posted = node('th', 'column-date', labels.posted + ' ↓'); posted.scope = 'col'; posted.setAttribute('aria-sort', 'descending'); headingRow.appendChild(posted); head.appendChild(headingRow); table.appendChild(head);
    const body = node('tbody'); table.appendChild(body); panel.appendChild(table);
    const more = button(labels.more, () => { shown += 10; render(); }); more.className += ' bbl-feed-more'; panel.appendChild(more);
    ui = { heading, refresh, count, search, status, table, body, more }; search.addEventListener('input', () => { shown = 10; render(); });
    todo.parentElement.insertBefore(panel, todo.nextElementSibling); syncAppearance(todo); render();
  }
  function render() {
    if (!ui) return;
    ui.body.replaceChildren(); ui.refresh.disabled = loading; ui.search.disabled = loading; ui.table.hidden = loading || Boolean(error); ui.more.hidden = true;
    ui.count.textContent = loading ? '' : rows.length + ' ' + labels.total;
    if (loading) { ui.status.hidden = false; ui.status.textContent = labels.loading; panel.setAttribute('aria-busy', 'true'); return; }
    panel.setAttribute('aria-busy', 'false');
    if (error) { ui.status.hidden = false; ui.status.textContent = error; return; }
    const query = (ui.search.value || '').trim().toLocaleLowerCase();
    const prepared = rows.map(item => {
      const body = model.announcementBody(item.body, doc, item.bodyBase);
      return { item, body };
    }).filter(({ item, body }) => !query || [item.title, item.courseName, body.preview].some(text => text.toLocaleLowerCase().includes(query)));
    const partial = failures.length ? labels.partial + ' (' + failures.map(course => course.courseName).join(', ') + ').' : '';
    ui.status.textContent = partial || (!rows.length ? labels.empty : !prepared.length ? labels.matches : ''); ui.status.hidden = !ui.status.textContent;
    for (const { item, body } of prepared.slice(0, shown)) {
      const row = node('tr', 'announcement-item-row ' + (item.isRead ? 'is-read' : 'is-unread'));
      const content = node('td', 'announcement-header-column');
      const announcement = node('div', 'announcement-header'); const image = node('div', 'announcement-icon'); image.appendChild(icon()); announcement.appendChild(image);
      const message = node('div', 'click-message-detail'); const course = node('a', 'bbl-feed-course'); course.href = item.courseURL; course.appendChild(node('bdi', '', item.courseName)); message.appendChild(course);
      const detail = node('details', 'bbl-feed-detail'); const summary = node('summary'); summary.appendChild(node('bdi', 'list-item-title', item.title));
      if (!item.isRead) summary.appendChild(node('span', 'bbl-feed-unread', labels.unread));
      summary.appendChild(node('p', 'MuiTypography-root MuiTypography-body1 list-item-body three-lines', body.preview)); detail.appendChild(summary);
      const full = node('div', 'bbl-feed-message'); full.setAttribute('dir', 'auto'); full.appendChild(body.fragment); detail.appendChild(full);
      const view = node('a', 'bbl-feed-view', labels.course); view.href = item.courseURL; detail.appendChild(view); message.appendChild(detail); announcement.appendChild(message); content.appendChild(announcement); row.appendChild(content);
      const dateCell = node('td', 'announcement-status-column'); const date = node('time', 'list-item-date-sent', item.timestamp !== null ? dateFormat.format(item.timestamp) : labels.unknownDate);
      if (item.timestamp !== null) date.dateTime = new Date(item.timestamp).toISOString(); dateCell.appendChild(date); row.appendChild(dateCell); ui.body.appendChild(row);
    }
    ui.more.hidden = prepared.length <= shown;
  }
  async function load() {
    if (!todoRoot() || !panel?.isConnected) return;
    request?.abort(); const controller = new AbortController(); request = controller; const token = ++generation;
    visited = true; loading = true; error = ''; rows = []; failures = []; shown = 10; render();
    try {
      const result = await model.loadAll({ origin: window.location.origin, fetch, signal: controller.signal });
      if (generation !== token || !todoRoot() || !panel?.isConnected) return;
      rows = result.rows; failures = result.failures;
      if (failures.some(item => item.code === 'session')) error = labels.session;
    } catch (failure) {
      if (generation !== token || !todoRoot() || !panel?.isConnected) return;
      error = failure.code === 'session' ? labels.session : failure.code === 'permission' ? labels.permission : labels.error;
    } finally { if (generation === token) { loading = false; request = null; render(); } }
  }
  function reset() {
    generation++; request?.abort(); request = null; rows = []; failures = []; visited = false; loading = false; error = '';
    panel?.remove(); panel = null; ui = null; column?.removeAttribute('data-bbl-announcements-column'); column = null; doc.getElementById('bbl-announcements-style')?.remove();
  }
  function reconcile() {
    const todo = todoRoot(); if (!todo) { if (panel || visited) reset(); return; }
    ensureStyle();
    if (!panel?.isConnected) { panel?.remove(); createPanel(todo); }
    else {
      if (panel.parentElement !== todo.parentElement || todo.nextElementSibling !== panel) todo.parentElement.insertBefore(panel, todo.nextElementSibling);
      syncAppearance(todo);
    }
    if (!visited) void load();
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; reconcile(); }); } }
  const observer = new MutationObserver(records => {
    if (records.length && records.every(record => record.target?.closest?.('#bbl-home-announcements'))) return;
    schedule();
  });
  function start() { reconcile(); observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.addEventListener('popstate', schedule); window.addEventListener('hashchange', schedule); window.addEventListener('pageshow', start);
  window.addEventListener('pagehide', () => { reset(); observer.disconnect(); });
  chrome?.storage?.onChanged?.addListener(schedule);
  return { reconcile, load, reset, getUI: () => ui, getState: () => ({ loading, error, rows: rows.slice(), failures: failures.slice() }) };
});
