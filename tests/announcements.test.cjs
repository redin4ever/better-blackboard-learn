const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../content/announcements-data.js');
const createUI = require('../content/announcements.js');
const { createDocument } = require('./dom-fixture.cjs');
const origin = 'https://learning.example.edu';
const now = Date.parse('2020-02-01T12:00:00Z');
const response = data => ({ ok: true, status: 200, json: async () => data });
const announcement = (id, courseId = '_a_1', extra = {}) => ({ id, courseId, title: 'Announcement ' + id, isDraft: false, permanent: true,
  body: { rawText: '<p>Example <strong>message</strong>.</p><p><a href="handout.pdf" data-bbtype="attachment">Handout.pdf</a></p>', webLocation: origin + '/files/' },
  createdDate: '2020-01-01T12:00:00Z', startDateRestriction: '2020-01-02T12:00:00Z', readStatus: { isRead: false }, ...extra });
function mockAPI({ courses = [{ courseId: '_a_1', course: { name: 'Course A' } }, { courseId: '_b_1', course: { name: 'Course B' } }], announcements = {}, fail = {}, user = { id: '_me_1' }, coursePageSize = 100 } = {}) {
  const calls = []; let active = 0, peak = 0;
  const fetch = async (value, options) => {
    const url = new URL(value); calls.push({ url, options }); active++; peak = Math.max(peak, active);
    try {
      await new Promise(resolve => setImmediate(resolve));
      if (url.pathname === '/learn/api/v1/users/me') return response(user);
      if (/\/users\/[^/]+\/courses$/.test(url.pathname)) {
        const offset = Number(url.searchParams.get('offset') || 0); const results = courses.slice(offset, offset + coursePageSize);
        return response({ results, paging: { nextPage: offset + results.length < courses.length ? '?offset=' + (offset + results.length) : '' } });
      }
      const detail = /^\/learn\/api\/public\/v1\/courses\/([^/]+)$/.exec(url.pathname);
      if (detail) return response({ id: detail[1], name: 'Resolved course ' + detail[1] });
      const match = /^\/learn\/api\/v1\/courses\/([^/]+)\/announcements$/.exec(url.pathname);
      if (match) {
        const id = decodeURIComponent(match[1]); if (fail[id]) return { ok: false, status: fail[id] };
        const items = announcements[id] || []; const offset = Number(url.searchParams.get('offset') || 0); const results = items.slice(offset, offset + 10);
        return response({ results, paging: { limit: 10, offset, count: results.length, nextPage: offset + results.length < items.length ? '?offset=' + (offset + results.length) : '' } });
      }
      throw Error('Unexpected API route: ' + url.pathname);
    } finally { active--; }
  };
  return { fetch, calls, getPeak: () => peak };
}
test('announcement endpoint uses the current origin and requested date sort', () => {
  const url = model.announcementsURL(origin, '_course_1');
  assert.equal(url.origin, origin); assert.equal(url.pathname, '/learn/api/v1/courses/_course_1/announcements');
  assert.equal(url.searchParams.get('limit'), '10'); assert.equal(url.searchParams.get('offset'), '0'); assert.equal(url.searchParams.get('sort'), 'startDateRestriction(desc)');
});
test('all course and announcement pages are merged in global publication-date order', async () => {
  const items = Array.from({ length: 13 }, (_, i) => announcement('a' + i, '_a_1', { startDateRestriction: new Date(Date.UTC(2020, 0, i + 1)).toISOString() }));
  const api = mockAPI({ coursePageSize: 1, announcements: { _a_1: items, _b_1: [announcement('b', '_b_1', { startDateRestriction: '2020-01-20T12:00:00Z' })] } });
  const result = await model.loadAll({ origin, fetch: api.fetch, now });
  assert.equal(result.courses.length, 2); assert.equal(result.rows.length, 14); assert.equal(result.rows[0].id, 'b'); assert.equal(result.rows[1].id, 'a12');
  assert.equal(result.rows[0].courseName, 'Course B'); assert.ok(api.calls.some(call => call.url.searchParams.get('offset') === '10'));
  for (const { url, options } of api.calls) {
    assert.equal(url.origin, origin); assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    if (url.pathname.endsWith('/announcements')) assert.equal(url.searchParams.get('sort'), 'startDateRestriction(desc)');
  }
});
test('course discovery uses username fallback, resolves names and deduplicates courses', async () => {
  const api = mockAPI({ user: { userName: 'example user' }, courses: [{ courseId: '_a_1' }, { courseId: '_a_1' }, { courseId: '../invalid' }] });
  const courses = await model.loadCourses({ origin, fetch: api.fetch });
  assert.deepEqual(courses, [{ id: '_a_1', name: 'Resolved course _a_1' }]);
  assert.ok(api.calls.some(call => call.url.pathname.includes('/users/userName:example%20user/courses')));
});
test('announcement IDs are deduplicated only within their own course', async () => {
  const api = mockAPI({ announcements: { _a_1: [announcement('same'), announcement('same')], _b_1: [announcement('same', '_b_1')] } });
  const result = await model.loadAll({ origin, fetch: api.fetch, now }); assert.equal(result.rows.length, 2);
});
test('unavailable courses report partial failures without losing other courses', async () => {
  const api = mockAPI({ announcements: { _a_1: [announcement('a')] }, fail: { _b_1: 403 } });
  const result = await model.loadAll({ origin, fetch: api.fetch, now });
  assert.equal(result.rows.length, 1); assert.deepEqual(result.failures, [{ courseId: '_b_1', courseName: 'Course B', code: 'permission' }]);
});
test('requests are bounded to three courses at a time', async () => {
  const api = mockAPI({ courses: Array.from({ length: 12 }, (_, i) => ({ courseId: '_course_' + i, course: { name: 'Course ' + i } })) });
  await model.loadAll({ origin, fetch: api.fetch, now }); assert.ok(api.getPeak() <= 3);
});
for (const nextPage of ['https://external.example/announcements', '/learn/api/v1/users/me', 'https://user:pass@learning.example.edu/learn/api/v1/courses/_a_1/announcements', 'http://[', 12]) {
  test('unsafe announcement pagination is rejected: ' + nextPage, async () => {
    let calls = 0; await assert.rejects(model.pages(model.announcementsURL(origin, '_a_1'), { fetch: async () => { calls++; return response({ results: [], paging: { nextPage } }); } }), { code: 'pagination' }); assert.equal(calls, 1);
  });
}
test('pagination cycles are rejected and missing paging uses offsets', async () => {
  const first = model.announcementsURL(origin, '_a_1');
  await assert.rejects(model.pages(first, { fetch: async () => response({ results: [], paging: { nextPage: first.href } }) }), { code: 'pagination' });
  const offsets = []; const items = await model.pages(first, { fetch: async url => { const offset = Number(new URL(url).searchParams.get('offset')); offsets.push(offset); return response({ results: offset === 0 ? Array.from({ length: 10 }, (_, i) => i) : [10] }); } });
  assert.deepEqual(offsets, [0, 10]); assert.equal(items.length, 11);
});
test('published visibility excludes drafts, future, expired, denied and other-course rows', () => {
  const course = { id: '_a_1', name: 'Course A' };
  for (const extra of [{ isDraft: true }, { startDateRestriction: '2030-01-01' }, { permanent: false, endDateRestriction: '2020-01-01' }, { permissions: { viewCourseOrOrgAnnouncements: false } }, { courseId: '_b_1' }]) assert.equal(model.normalize(announcement('a', '_a_1', extra), course, origin, now), null);
  assert.ok(model.normalize(announcement('a'), course, origin, now));
});
test('date fallback uses creation time and unknown dates sort last', () => {
  const course = { id: '_a_1', name: 'Course A' };
  const undated = model.normalize(announcement('a', '_a_1', { startDateRestriction: null, createdDate: null, modifiedDate: null }), course, origin, now);
  const dated = model.normalize(announcement('b', '_a_1', { startDateRestriction: 'invalid' }), course, origin, now);
  assert.equal(dated.timestamp, Date.parse('2020-01-01T12:00:00Z')); assert.equal(model.sortAnnouncements([undated, dated])[0].id, 'b');
});
for (const [status, code] of [[401, 'session'], [403, 'permission'], [500, 'network']]) test('feed HTTP ' + status + ' maps to an error category', async () => {
  await assert.rejects(model.readJSON(new URL(origin), { fetch: async () => ({ ok: false, status }) }), { code });
});
test('cancelled and timed-out requests cannot populate the feed', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(model.loadAll({ origin, signal: controller.signal, fetch: () => { throw Error('unexpected'); } }), { code: 'cancelled' });
  await assert.rejects(model.readJSON(new URL(origin), { timeoutMs: 5, fetch: (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted')))) }), { code: 'timeout' });
});
test('malformed course lists and announcement pages are rejected', async () => {
  await assert.rejects(model.loadCourses({ origin, fetch: async () => response({}) }), { code: 'response' });
  await assert.rejects(model.pages(model.announcementsURL(origin, '_a_1'), { fetch: async () => response({ results: {} }) }), { code: 'response' });
});
test('formatted messages and relative PDF attachment links are preserved safely', () => {
  const doc = createDocument(); const body = model.announcementBody(announcement('a').body.rawText, doc, origin + '/files/');
  assert.equal(body.fragment.querySelector('strong').textContent, 'message');
  const link = body.fragment.querySelector('a'); assert.equal(link.getAttribute('href'), origin + '/files/handout.pdf');
  assert.equal(link.getAttribute('target'), '_blank'); assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.match(body.preview, /Example message\. Handout.pdf/);
});
test('sanitizer discards scripts, event handlers, inline colors, custom elements and remote images', () => {
  const doc = createDocument(); const source = doc.createDocumentFragment();
  for (const tag of ['script', 'style', 'iframe', 'svg', 'math', 'object', 'form']) { const item = doc.createElement(tag); item.textContent = 'Blocked'; source.appendChild(item); }
  const paragraph = doc.createElement('p'); paragraph.setAttribute('onclick', 'attack()'); paragraph.setAttribute('style', 'color:black'); paragraph.setAttribute('class', 'native-handler'); paragraph.textContent = 'Visible'; source.appendChild(paragraph);
  const custom = doc.createElement('bb-dangerous'); custom.textContent = 'Safe text'; source.appendChild(custom);
  const image = doc.createElement('img'); image.setAttribute('src', 'https://external.example/track'); image.setAttribute('alt', 'Diagram'); source.appendChild(image);
  const result = model.sanitizeNodes(source, doc, origin);
  assert.equal(result.fragment.querySelector('script'), null); assert.equal(result.fragment.querySelector('img'), null); assert.equal(result.fragment.querySelector('bb-dangerous'), null);
  assert.equal(result.fragment.querySelector('p').getAttribute('style'), null); assert.equal(result.fragment.querySelector('p').getAttribute('onclick'), null);
  assert.equal(result.preview, 'Visible Safe text Diagram'); assert.ok(!result.fragment.textContent.includes('Blocked'));
});
test('unsafe attachment URLs are removed while valid external links remain usable', () => {
  const doc = createDocument(); const source = doc.createDocumentFragment();
  for (const href of ['javascript:alert(1)', 'data:text/html,attack', '//user:pass@learning.example.edu/file', 'https://reference.example/reading']) {
    const link = doc.createElement('a'); link.setAttribute('href', href); link.textContent = 'Link'; source.appendChild(link);
  }
  const links = model.sanitizeNodes(source, doc, origin).fragment.querySelectorAll('a');
  assert.ok(links.slice(0, 3).every(link => link.getAttribute('href') === null)); assert.equal(links[3].getAttribute('href'), 'https://reference.example/reading');
});
test('attachment metadata fallback and same-origin body base handle Blackboard body objects', () => {
  const doc = createDocument(); const source = doc.createDocumentFragment(); const link = doc.createElement('a');
  link.setAttribute('data-bbfile', JSON.stringify({ resourceUrl: '/files/example.pdf' })); source.appendChild(link);
  assert.equal(model.sanitizeNodes(source, doc, origin).fragment.querySelector('a').getAttribute('href'), origin + '/files/example.pdf');
  const item = model.normalize(announcement('a', '_a_1', { body: { displayText: '<p>Display</p>', rawText: 'Raw', webLocation: 'https://external.example/files/' } }), { id: '_a_1', name: 'Course A' }, origin, now);
  assert.equal(item.body, '<p>Display</p>'); assert.equal(item.bodyBase, origin + '/');
});

function fixture(api, { lang = 'en', pathname = '/ultra/course', framed = false, readyState = 'complete', hasTodo = true } = {}) {
  const doc = createDocument(lang, readyState); const column = doc.body.appendChild(doc.createElement('div')); column.className = 'todo-panel js-todo-panel-skip-link-target';
  let todo = null;
  function addTodo() { todo = doc.createElement('bb-todo'); const aside = todo.appendChild(doc.createElement('aside')); const heading = aside.appendChild(doc.createElement('h2')); heading.className = 'MuiTypography-root MuiTypography-h3 native-heading'; heading.textContent = 'To Do'; column.appendChild(todo); return todo; }
  if (hasTodo) addTodo();
  const events = {}, win = { location: { origin, pathname }, addEventListener(event, callback) { (events[event] ||= []).push(callback); } }; win.top = framed ? {} : win;
  let observer; let storageListener;
  const extension = createUI({ window: win, document: doc, model, fetch: api.fetch, AbortController,
    MutationObserver: class { constructor(callback) { this.callback = callback; observer = this; } observe() {} disconnect() {} }, requestAnimationFrame: callback => queueMicrotask(callback),
    getComputedStyle: () => ({ color: '#61ca82', backgroundColor: '#080e22' }),
    chrome: { storage: { sync: { get() { throw Error('Feed must not read storage'); }, set() { throw Error('Feed must not save messages'); } }, onChanged: { addListener(callback) { storageListener = callback; } } } } });
  return { extension, doc, column, getTodo: () => todo, addTodo, observer, win, themeChange: () => storageListener?.(), fire: event => (events[event] || []).forEach(callback => callback()) };
}
async function settle(f) { for (let i = 0; i < 100; i++) { await new Promise(resolve => setImmediate(resolve)); if (!f.extension?.getState().loading) return; } throw Error('Feed did not settle'); }
test('home feed is directly adjacent to To Do and uses the native announcement table pattern', async () => {
  const api = mockAPI({ announcements: { _a_1: [announcement('a')], _b_1: [announcement('b', '_b_1', { startDateRestriction: '2020-01-10' })] } });
  const f = fixture(api); await settle(f); const panel = f.doc.getElementById('bbl-home-announcements'), ui = f.extension.getUI();
  assert.equal(f.getTodo().nextElementSibling, panel); assert.equal(panel.parentElement, f.column);
  assert.equal(f.column.getAttribute('data-bbl-announcements-column'), ''); assert.equal(ui.heading.className, 'MuiTypography-root MuiTypography-h3 native-heading');
  assert.ok(ui.table.className.includes('sortable-table')); assert.equal(ui.body.children.length, 2);
  assert.ok(ui.body.children[0].textContent.includes('Course B')); assert.ok(ui.body.children[0].textContent.includes('Announcement b')); assert.equal(ui.body.querySelectorAll('details').length, 2);
  assert.ok(ui.body.querySelector('a').href.startsWith(origin + '/ultra/courses/')); assert.ok(ui.body.querySelectorAll('a').some(link => link.getAttribute('href') === origin + '/files/handout.pdf'));
  const css = fs.readFileSync(path.join(__dirname, '../content/announcements.css'), 'utf8');
  assert.match(css, /justify-content: flex-start !important/); assert.match(css, /flex: 0 0 auto !important; height: auto !important; min-height: 0 !important/); assert.match(css, /margin: 12px 0 0 !important/);
  f.extension.reset();
});
test('search spans all messages and courses, Show more expands the combined list', async () => {
  const api = mockAPI({ announcements: { _a_1: Array.from({ length: 16 }, (_, i) => announcement('a' + i)), _b_1: [announcement('unique', '_b_1')] } }); const f = fixture(api); await settle(f); const ui = f.extension.getUI();
  assert.equal(ui.body.children.length, 10); assert.equal(ui.more.hidden, false); ui.more.fire('click'); assert.equal(ui.body.children.length, 17);
  ui.search.value = 'Course B'; ui.search.fire('input'); assert.equal(ui.body.children.length, 1);
  ui.search.value = 'handout.pdf'; ui.search.fire('input'); assert.equal(ui.body.children.length, 10);
  ui.search.value = 'no match'; ui.search.fire('input'); assert.equal(ui.body.children.length, 0); assert.match(ui.status.textContent, /No matching/); f.extension.reset();
});
test('partial course failures are visible and Refresh retries the current account courses', async () => {
  const failures = { _b_1: 403 }; const api = mockAPI({ announcements: { _a_1: [announcement('a')] }, fail: failures }); const f = fixture(api); await settle(f);
  assert.match(f.extension.getUI().status.textContent, /Course B/); assert.equal(f.extension.getUI().body.children.length, 1);
  delete failures._b_1; const before = api.calls.length; f.extension.getUI().refresh.fire('click'); await settle(f);
  assert.ok(api.calls.length > before); assert.equal(f.extension.getUI().status.hidden, true); f.extension.reset();
});
test('session errors show a sign-in message rather than an empty feed', async () => {
  const f = fixture({ fetch: async () => ({ ok: false, status: 401 }) }); await settle(f);
  assert.match(f.extension.getUI().status.textContent, /session has expired/); assert.equal(f.extension.getUI().refresh.disabled, false); f.extension.reset();
});
test('late To Do rendering, head replacement and panel redraws restore one adjacent feed', async () => {
  const api = mockAPI(); const f = fixture(api, { hasTodo: false }); assert.equal(api.calls.length, 0);
  f.addTodo(); f.observer.callback([{ target: f.column }]); await settle(f); const before = api.calls.length;
  f.doc.getElementById('bbl-home-announcements').remove(); f.doc.getElementById('bbl-announcements-style').remove(); f.extension.reconcile();
  assert.equal(f.doc.querySelectorAll('#bbl-home-announcements').length, 1); assert.equal(f.getTodo().nextElementSibling.id, 'bbl-home-announcements'); assert.ok(f.doc.getElementById('bbl-announcements-style')); assert.equal(api.calls.length, before);
  f.themeChange(); await settle(f); assert.equal(f.doc.querySelectorAll('#bbl-home-announcements').length, 1); f.extension.reset();
});
test('leaving home aborts requests, clears private data and restores native To Do layout', async () => {
  let resolve, signal; const f = fixture({ fetch: (url, options) => { signal = options.signal; return new Promise(done => { resolve = done; }); } });
  f.win.location.pathname = '/ultra/courses/_a_1/outline'; f.fire('popstate'); await new Promise(done => setImmediate(done));
  assert.equal(signal.aborted, true); assert.equal(f.doc.getElementById('bbl-home-announcements'), null); assert.equal(f.column.getAttribute('data-bbl-announcements-column'), null);
  resolve(response({ id: '_me_1' })); await settle(f); assert.equal(f.extension.getState().rows.length, 0);
});
test('unrelated pages, embedded frames and course announcement pages make no feed requests', () => {
  for (const config of [{ pathname: '/unrelated' }, { pathname: '/ultra/courses/_a_1/announcements' }, { framed: true }, { pathname: '/ultra/organizations' }]) {
    const api = mockAPI(); const f = fixture(api, config); assert.equal(api.calls.length, 0); assert.equal(f.doc.getElementById('bbl-home-announcements'), null);
  }
});
test('DOM-ready startup, Arabic labels and read-only rendering preserve supplied fields', async () => {
  const api = mockAPI({ announcements: { _a_1: [announcement('a', '_a_1', { title: '<script>عنوان</script>', body: { rawText: '<p dir="rtl">رسالة تجريبية</p>' } })] } });
  const f = fixture(api, { lang: 'ar', readyState: 'loading' }); assert.equal(api.calls.length, 0); f.doc.fire('DOMContentLoaded'); await settle(f);
  assert.equal(f.extension.getUI().heading.textContent, 'كل الإعلانات'); assert.equal(f.extension.getUI().body.querySelector('script'), null);
  assert.ok(f.extension.getUI().body.textContent.includes('<script>عنوان</script>')); assert.ok(f.extension.getUI().body.querySelector('bdi'));
  assert.ok(api.calls.every(call => call.options.method === 'GET')); f.extension.reset();
});
