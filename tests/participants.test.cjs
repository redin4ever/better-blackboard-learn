const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../content/participants-data.js');
const createUI = require('../content/participants.js');
const origin = 'https://courses.example.edu';
const courseId = '_course_1';
const member = (id, givenName = 'Example', extra = {}) => ({ courseId, id: 'membership-' + id, role: 'S', user: { id, userName: 'account-' + id, givenName, familyName: 'Student' }, ...extra });
const response = (results, extra = {}) => ({ ok: true, status: 200, json: async () => ({ results, ...extra }) });
const load = (fetch, extra = {}) => model.loadMemberships({ origin, courseId, fetch, ...extra });

test('course identification accepts native routes and rejects malformed IDs', () => {
  assert.equal(model.courseIdFromPath('/ultra/courses/_course_1/outline'), courseId);
  for (const route of ['/learn/courses/a', '/ultra/courses/%2F/outline', '/ultra/courses/%ZZ', '/ultra/courses/a%20b', '/ultra/courses/a%3Fb']) assert.equal(model.courseIdFromPath(route), null);
});
test('roster requests use the current origin, expanded users and session credentials', async () => {
  const result = await load(async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, origin);
    assert.equal(parsed.pathname, '/learn/api/v1/courses/_course_1/memberships');
    assert.equal(parsed.searchParams.get('expand'), 'user,courseRole,user.hasEmailAddress');
    assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    return response([member('_user_1')]);
  });
  assert.equal(result.rows[0].id, '_user_1'); assert.equal(result.rows[0].username, 'account-_user_1');
});
test('pagination keeps expanded users, deduplicates users and excludes other courses', async () => {
  let count = 0;
  const result = await load(async url => {
    assert.equal(new URL(url).searchParams.get('expand'), 'user,courseRole,user.hasEmailAddress');
    return ++count === 1 ? response([member('a')], { paging: { nextPage: '?offset=1' } }) : response([member('a', 'Updated'), member('b'), member('c', 'Other', { courseId: '_other_1' })]);
  });
  assert.equal(count, 2); assert.equal(result.rows.length, 2); assert.equal(result.rows[0].name, 'Updated Student');
});
for (const nextPage of ['https://external.example/memberships', '/learn/api/v1/users', 'https://user:pass@courses.example.edu/learn/api/v1/courses/_course_1/memberships', 'http://[', 42]) {
  test('unsafe or malformed nextPage is rejected: ' + nextPage, async () => {
    let calls = 0;
    await assert.rejects(load(async () => { calls++; return response([], { paging: { nextPage } }); }), { code: 'pagination' });
    assert.equal(calls, 1);
  });
}
test('pagination cycles are rejected', async () => {
  await assert.rejects(load(async () => response([], { paging: { nextPage: model.membershipURL(origin, courseId).href } })), { code: 'pagination' });
});
test('username permission is respected across all pages and search', async () => {
  let count = 0;
  const result = await load(async () => ++count === 1 ? response([member('a')], { paging: { nextPage: '?offset=1' } }) : response([member('b')], { permissions: { viewUserName: false } }));
  assert.equal(result.canViewUserName, false);
  assert.ok(result.rows.every(row => row.username === ''));
  assert.equal(model.filterParticipants(result.rows, 'account-').length, 0);
  assert.equal(result.rows[0].id, 'a');
});
for (const [status, code] of [[401, 'session'], [403, 'permission'], [500, 'network']]) test('HTTP ' + status + ' has a readable error category', async () => {
  await assert.rejects(load(async () => ({ ok: false, status })), { code });
});
test('malformed API responses are rejected', async () => {
  await assert.rejects(load(async () => ({ ok: true, json: async () => { throw Error('JSON'); } })), { code: 'response' });
  await assert.rejects(load(async () => ({ ok: true, json: async () => ({ results: {} }) })), { code: 'response' });
});
test('aborting before loading makes no requests', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(load(() => { throw Error('unexpected request'); }, { signal: controller.signal }), { code: 'cancelled' });
});
test('only same-origin HTTP avatars are accepted', () => {
  assert.equal(model.avatarURL('/avatar/default', origin), origin + '/avatar/default');
  for (const url of ['https://external.example/avatar', 'javascript:alert(1)', 'data:image/svg+xml,test', '//user:pass@courses.example.edu/avatar']) assert.equal(model.avatarURL(url, origin), null);
});
test('normalization supports Arabic, custom roles, missing names and userId fallback', () => {
  const row = model.participant({ userId: 'fallback', user: { givenName: 'اسم', familyName: 'تجريبي' }, courseRole: { displayName: 'مساعد' } }, origin, true);
  assert.equal(row.id, 'fallback'); assert.equal(row.name, 'اسم تجريبي'); assert.equal(row.role, 'مساعد');
  assert.equal(model.participant({}, origin, true).name, 'Unnamed participant');
});
test('search includes all requested columns and name sorting is numeric', () => {
  const rows = ['10', '2', '1'].map(id => model.participant(member(id, 'Person ' + id), origin, true));
  assert.deepEqual(model.filterParticipants(rows).map(row => row.id), ['1', '2', '10']);
  assert.deepEqual(model.filterParticipants(rows, '', '', 'desc').map(row => row.id), ['10', '2', '1']);
  assert.equal(model.filterParticipants(rows, 'account-2').length, 1);
  assert.equal(model.filterParticipants(rows, '', 'Instructor').length, 0);
});

// Small DOM fixture for behavior tests; all accounts and names are synthetic.
function simpleMatch(node, selector) {
  const attrs = [...selector.matchAll(/\[([^\]=^]+)(\^=|=)?(?:"([^"]*)")?\]/g)];
  selector = selector.replace(/\[[^\]]*\]/g, '');
  for (const [, key, op, value] of attrs) {
    const actual = node.getAttribute(key);
    if (actual === null || (op === '=' && actual !== value) || (op === '^=' && !actual.startsWith(value))) return false;
  }
  const tag = selector.match(/^[\w-]+/)?.[0]; if (tag && tag.toLowerCase() !== node.tagName.toLowerCase()) return false;
  const id = selector.match(/#([\w-]+)/)?.[1]; if (id && node.id !== id) return false;
  return [...selector.matchAll(/\.([\w-]+)/g)].every(([, name]) => node.className.split(/\s+/).includes(name));
}
function matches(node, selector) {
  return selector.split(',').some(part => {
    const pieces = part.trim().split(/\s+/); // fixtures have no spaces in attribute values
    if (!simpleMatch(node, pieces.pop())) return false;
    let ancestor = node.parentElement;
    while (pieces.length) { const piece = pieces.pop(); while (ancestor && !simpleMatch(ancestor, piece)) ancestor = ancestor.parentElement; if (!ancestor) return false; ancestor = ancestor.parentElement; }
    return true;
  });
}
class Node {
  constructor(tag, doc) { this.tagName = tag; this.doc = doc; this.children = []; this.parentElement = null; this.attrs = {}; this.className = ''; this.id = ''; this.dataset = {}; this.events = {}; this.value = ''; this._text = ''; this.style = { values: {}, setProperty(key, value) { this.values[key] = value; } }; }
  get isConnected() { return this === this.doc.documentElement || Boolean(this.parentElement?.isConnected); }
  get nextElementSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] || null; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  setAttribute(key, value) { if (key === 'id') this.id = String(value); else if (key === 'class') this.className = String(value); else this.attrs[key] = String(value); }
  getAttribute(key) { return key === 'id' ? this.id || null : key === 'class' ? this.className || null : this.attrs[key] ?? null; }
  appendChild(node) { node.remove(); this.children.push(node); node.parentElement = this; return node; }
  insertBefore(node, before) { node.remove(); this.children.splice(this.children.indexOf(before), 0, node); node.parentElement = this; return node; }
  remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; }
  replaceChildren(...nodes) { this.children.forEach(child => { child.parentElement = null; }); this.children = []; this._text = ''; nodes.forEach(node => this.appendChild(node)); }
  querySelectorAll(selector) { const result = []; const visit = node => { for (const child of node.children) { if (matches(child, selector)) result.push(child); visit(child); } }; visit(this); return result; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { let node = this; while (node) { if (matches(node, selector)) return node; node = node.parentElement; } return null; }
  addEventListener(event, callback) { (this.events[event] ||= []).push(callback); }
  fire(event) { for (const callback of this.events[event] || []) callback({ preventDefault() {}, stopPropagation() {}, target: this }); }
  focus() { this.doc.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.fire('close'); }
}
function fixture(fetch, lang = 'en', framed = false) {
  const doc = { readyState: 'complete', createElement(tag) { return new Node(tag, this); }, addEventListener() {} };
  doc.documentElement = new Node('html', doc); doc.documentElement.lang = lang;
  doc.head = doc.documentElement.appendChild(new Node('head', doc)); doc.body = doc.documentElement.appendChild(new Node('body', doc));
  doc.querySelector = selector => doc.documentElement.querySelector(selector);
  doc.querySelectorAll = selector => doc.documentElement.querySelectorAll(selector);
  doc.getElementById = id => doc.querySelector('#' + id);
  const navigation = doc.body.appendChild(doc.createElement('bb-course-navigation'));
  const list = navigation.appendChild(doc.createElement('ul')); list.className = 'bb-ui-navigation-list-horizontal';
  function tab(label, key) {
    const li = list.appendChild(doc.createElement('li')); const link = li.appendChild(doc.createElement('a'));
    link.className = 'MuiButtonBase-root MuiListItemButton-root muiltr-native js-course-grades-tool';
    link.setAttribute('href', '/ultra/courses/' + courseId + '/' + key); link.setAttribute('data-analytics-id', 'course.l1.' + key + '.link');
    const wrap = link.appendChild(doc.createElement('div')); wrap.className = 'MuiListItemText-root muiltr-wrapper';
    const indicator = wrap.appendChild(doc.createElement('div')); indicator.className = 'makeStylesnavigationIndicatorWrapper-example';
    const title = indicator.appendChild(doc.createElement('span')); title.className = 'MuiTypography-root muiltr-title'; title.setAttribute('data-title', label); title.textContent = label; return link;
  }
  tab('Discussions', 'engagement'); const grades = tab('Gradebook', 'grades'); tab('Groups', 'groups-student');
  const courseTitle = doc.body.appendChild(doc.createElement('a')); courseTitle.setAttribute('data-analytics-id', 'course.header.course-title.button'); courseTitle.textContent = 'Example course';
  const events = {}; const win = { location: { origin, pathname: '/ultra/courses/' + courseId + '/outline' }, addEventListener(event, callback) { (events[event] ||= []).push(callback); } }; win.top = framed ? {} : win;
  const spacing = { 'padding-inline-start': '12px', 'padding-inline-end': '12px', 'padding-top': '8px', 'padding-bottom': '8px', 'font-size': '14px', 'line-height': '20px', display: 'flex', 'border-bottom-width': '3px', 'border-bottom-style': 'solid' };
  let observer;
  const api = createUI({ window: win, document: doc, model, fetch, AbortController, setTimeout, clearTimeout,
    requestAnimationFrame: callback => queueMicrotask(callback), MutationObserver: class { constructor(callback) { this.callback = callback; observer = this; } observe() {} disconnect() {} },
    getComputedStyle: () => ({ color: '#61ca82', backgroundColor: '#080e22', getPropertyValue: key => spacing[key] || '' }), chrome: { storage: { onChanged: { addListener() {} } } } });
  return { api, doc, list, grades, spacing, win, observer, fire: event => (events[event] || []).forEach(callback => callback()) };
}
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };
test('nav spacing and wrapper classes match Gradebook; button stays before it without fetching', async () => {
  let calls = 0; const f = fixture(async () => { calls++; return response([]); });
  const item = f.doc.getElementById('bbl-participants-nav'); const button = item.querySelector('button');
  assert.equal(item.nextElementSibling, f.grades.parentElement);
  assert.equal(button.style.values['padding-inline-start'], '12px'); assert.equal(button.style.values['padding-inline-end'], '12px');
  assert.equal(button.children[0].className, 'MuiListItemText-root muiltr-wrapper');
  assert.equal(button.querySelector('[data-title]').className, 'MuiTypography-root muiltr-title');
  assert.equal(button.querySelector('[data-title]').parentElement.className, 'makeStylesnavigationIndicatorWrapper-example');
  assert.equal(button.children[0].tagName, 'div');
  assert.ok(!button.className.includes('js-course-')); assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
  f.list.appendChild(item); f.spacing['padding-inline-end'] = '16px'; f.fire('resize'); await settle();
  assert.equal(item.nextElementSibling, f.grades.parentElement); assert.equal(button.style.values['padding-inline-end'], '16px');
  f.api.reconcile(); assert.equal(f.doc.querySelectorAll('#bbl-participants-nav').length, 1); assert.equal(calls, 0);
});
test('roster safely renders user-level IDs, usernames, avatars and search/sort controls', async () => {
  const f = fixture(async () => response([member('a', '<script>unsafe</script>'), member('b', 'Zulu', { role: 'P' })]));
  f.doc.getElementById('bbl-participants-nav').querySelector('button').fire('click'); await settle();
  const ui = f.api.getUI(); assert.equal(ui.body.children.length, 2); assert.ok(ui.body.textContent.includes('account-a')); assert.ok(!ui.body.textContent.includes('membership-a'));
  assert.ok(ui.body.textContent.includes('<script>unsafe</script>')); assert.equal(ui.body.querySelectorAll('script').length, 0);
  assert.ok(ui.count.textContent.includes('Example course')); assert.equal(ui.nameHead.getAttribute('aria-sort'), 'ascending');
  ui.nameHead.querySelector('button').fire('click'); assert.equal(ui.nameHead.getAttribute('aria-sort'), 'descending');
  ui.search.value = 'account-b'; ui.search.fire('input'); assert.equal(ui.body.children.length, 1);
  ui.search.value = ''; ui.roles.value = 'Student'; ui.roles.fire('change'); assert.equal(ui.body.children.length, 1);
  f.api.close(); assert.equal(ui.body.children.length, 0); assert.equal(f.api.getState().rows.length, 0);
  assert.equal(ui.search.value, ''); assert.equal(ui.count.textContent, '');
});
test('large rosters page 50 rows while searching the full result', async () => {
  const f = fixture(async () => response(Array.from({ length: 61 }, (_, i) => member(String(i), 'Person ' + i)))); f.api.open(); await settle();
  const ui = f.api.getUI(); assert.equal(ui.body.children.length, 50); assert.equal(ui.next.disabled, false);
  ui.next.fire('click'); assert.equal(ui.body.children.length, 11);
  ui.search.value = 'account-60'; ui.search.fire('input'); assert.equal(ui.body.children.length, 1); assert.equal(ui.previous.disabled, true); f.api.close();
});
test('permission error is readable and Retry can recover', async () => {
  let calls = 0; const f = fixture(async () => ++calls === 1 ? { ok: false, status: 403 } : response([member('a')])); f.api.open(); await settle();
  const ui = f.api.getUI(); assert.match(ui.status.textContent, /does not allow/); assert.equal(ui.retry.hidden, false);
  ui.retry.fire('click'); await settle(); assert.equal(ui.body.children.length, 1); assert.equal(ui.retry.hidden, true); f.api.close();
});
test('close aborts loading and stale replies cannot repopulate the table', async () => {
  let resolve, signal; const f = fixture((url, options) => { signal = options.signal; return new Promise(done => { resolve = done; }); });
  f.api.open(); f.api.close(); assert.equal(signal.aborted, true); resolve(response([member('a')])); await settle();
  assert.equal(f.api.getState().rows.length, 0); assert.equal(f.api.getUI().body.children.length, 0);
});
test('course changes close the previous roster and nav redraws restore one button', async () => {
  const f = fixture(async () => response([member('a')])); f.api.open(); await settle();
  f.win.location.pathname = '/ultra/courses/_other_1/outline'; f.fire('popstate'); await settle(); assert.equal(f.api.getDialog().open, false);
  f.doc.getElementById('bbl-participants-nav').remove(); f.api.reconcile(); assert.equal(f.doc.querySelectorAll('#bbl-participants-nav').length, 1);
});
test('embedded frames do not get a roster and Arabic fields use bidi isolation', async () => {
  const framed = fixture(() => { throw Error('unexpected'); }, 'en', true); assert.equal(framed.api, null); assert.equal(framed.doc.getElementById('bbl-participants-nav'), null);
  const f = fixture(async () => response([member('a', 'اسم')]), 'ar'); f.api.open(); await settle();
  assert.equal(f.doc.getElementById('bbl-participants-nav').textContent, 'المشاركون'); assert.equal(f.api.getUI().body.querySelectorAll('bdi').length, 4); f.api.close();
});
