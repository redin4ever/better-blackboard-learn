(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BBLAnnouncementsData = factory();
})(globalThis, function() {
  'use strict';
  class FeedError extends Error { constructor(code) { super(code); this.name = 'FeedError'; this.code = code; } }
  const text = value => typeof value === 'string' ? value.trim() : '';
  const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\\/\s?#\u0000-\u001f]/.test(value);
  const cancelled = signal => { if (signal?.aborted) throw new FeedError('cancelled'); };
  function safeLink(value, base) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try { const url = new URL(value, base); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
  }
  function courseLink(origin, id) { return new URL('/ultra/courses/' + encodeURIComponent(id) + '/announcements', origin).href; }
  function announcementsURL(origin, id) {
    const url = new URL('/learn/api/v1/courses/' + encodeURIComponent(id) + '/announcements', origin);
    url.searchParams.set('limit', '10'); url.searchParams.set('offset', '0'); url.searchParams.set('sort', 'startDateRestriction(desc)'); return url;
  }
  async function readJSON(url, { fetch, signal, timeoutMs = 12000 }) {
    cancelled(signal);
    const controller = new AbortController(); const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetch(url.href, { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' }, signal: controller.signal });
      cancelled(signal);
      if (controller.signal.aborted) throw new FeedError('timeout');
      if (response.status === 401) throw new FeedError('session');
      if (response.status === 403) throw new FeedError('permission');
      if (!response.ok) throw new FeedError('network');
      let data; try { data = await response.json(); } catch { throw new FeedError('response'); }
      cancelled(signal); return data;
    } catch (error) {
      cancelled(signal); if (controller.signal.aborted) throw new FeedError('timeout'); throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  async function pages(first, options) {
    let url = first; const visited = new Set(), results = [];
    while (url) {
      cancelled(options.signal);
      if (visited.has(url.href) || visited.size >= 1000 || url.origin !== first.origin || url.pathname !== first.pathname || url.username || url.password) throw new FeedError('pagination');
      visited.add(url.href);
      const data = await readJSON(url, options);
      if (!data || !Array.isArray(data.results)) throw new FeedError('response');
      results.push(...data.results);
      const next = data.paging?.nextPage;
      if (next != null && typeof next !== 'string') throw new FeedError('pagination');
      try {
        if (next) url = new URL(next, url);
        else if (next === undefined && data.results.length >= Number(url.searchParams.get('limit') || 100)) {
          const offset = Number(url.searchParams.get('offset') || 0); url = new URL(url);
          url.searchParams.set('offset', String(offset + data.results.length));
        } else url = null;
      } catch { throw new FeedError('pagination'); }
      if (url) for (const key of ['sort', 'limit']) if (first.searchParams.has(key)) url.searchParams.set(key, first.searchParams.get(key));
    }
    return results;
  }
  async function pool(items, action, signal) {
    const output = new Array(items.length); let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
      while (cursor < items.length) { cancelled(signal); const index = cursor++; output[index] = await action(items[index], index); }
    }));
    cancelled(signal); return output;
  }
  async function loadCourses({ origin, fetch, signal, timeoutMs }) {
    const options = { fetch, signal, timeoutMs };
    const user = await readJSON(new URL('/learn/api/v1/users/me', origin), options);
    const identifier = validId(user?.id) ? encodeURIComponent(user.id) : text(user?.userName) ? 'userName:' + encodeURIComponent(user.userName) : null;
    if (!identifier) throw new FeedError('response');
    const url = new URL('/learn/api/public/v1/users/' + identifier + '/courses', origin);
    url.searchParams.set('limit', '100'); url.searchParams.set('offset', '0');
    const memberships = await pages(url, options);
    const unique = new Map();
    for (const membership of memberships) {
      const id = membership?.courseId || membership?.course?.id;
      if (validId(id)) unique.set(id, { id, name: text(membership.course?.name) || text(membership.courseName) });
    }
    return pool([...unique.values()], async course => {
      if (course.name) return course;
      try {
        const data = await readJSON(new URL('/learn/api/public/v1/courses/' + encodeURIComponent(course.id), origin), options);
        return { ...course, name: text(data?.name) || text(data?.courseId) || course.id };
      } catch (error) { cancelled(signal); if (error.code === 'session') throw error; return { ...course, name: course.id }; }
    }, signal);
  }
  function dateValue(value) { const parsed = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }
  function normalize(item, course, origin, now) {
    if (!item || typeof item !== 'object' || !validId(item.id) || (item.courseId && item.courseId !== course.id) || item.isDraft === true || item.permissions?.viewCourseOrOrgAnnouncements === false) return null;
    const start = dateValue(item.startDateRestriction), end = dateValue(item.endDateRestriction);
    if ((start !== null && start > now) || (item.permanent !== true && end !== null && end <= now)) return null;
    const timestamp = start ?? dateValue(item.createdDate) ?? dateValue(item.modifiedDate);
    const body = typeof item.body === 'string' ? item.body : text(item.body?.displayText) || text(item.body?.rawText);
    const location = safeLink(item.body?.webLocation, origin);
    return { id: item.id, courseId: course.id, courseName: course.name, title: text(item.title) || 'Untitled announcement',
      timestamp, body, bodyBase: location && new URL(location).origin === origin ? location : origin + '/',
      isRead: item.readStatus?.isRead !== false, courseURL: courseLink(origin, course.id) };
  }
  function sortAnnouncements(rows) { return rows.slice().sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity) || a.courseName.localeCompare(b.courseName) || a.id.localeCompare(b.id)); }
  async function loadAll({ origin, fetch, signal, now = Date.now(), onProgress = () => {}, timeoutMs }) {
    const options = { fetch, signal, timeoutMs };
    const courses = await loadCourses({ origin, ...options });
    let completed = 0; const failures = [];
    const groups = await pool(courses, async course => {
      try {
        const items = await pages(announcementsURL(origin, course.id), options); const unique = new Map();
        for (const item of items) { const row = normalize(item, course, origin, now); if (row) unique.set(row.id, row); }
        return [...unique.values()];
      } catch (error) {
        cancelled(signal); failures.push({ courseId: course.id, courseName: course.name, code: error.code || 'network' }); return [];
      } finally { onProgress({ completed: ++completed, total: courses.length }); }
    }, signal);
    return { rows: sortAnnouncements(groups.flat()), courses, failures };
  }
  const allowed = new Set('a p br span strong b em i u s blockquote ul ol li div h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr th td code pre hr'.split(' '));
  const blocked = new Set('script style iframe object embed link meta svg math input form button select textarea template'.split(' '));
  const blocks = new Set('p div ul ol li blockquote h1 h2 h3 h4 h5 h6 table tr pre br hr'.split(' '));
  function sanitizeNodes(source, doc, base) {
    const fragment = doc.createDocumentFragment(); const words = [];
    function copy(node, parent) {
      if (node.nodeType === 3) { parent.appendChild(doc.createTextNode(node.textContent)); words.push(node.textContent); return; }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase(); if (blocked.has(tag)) return;
      if (tag === 'img') { const alt = text(node.getAttribute('alt')); if (alt) { parent.appendChild(doc.createTextNode(alt)); words.push(' ' + alt + ' '); } return; }
      let target = parent;
      if (allowed.has(tag)) {
        target = doc.createElement(tag);
        if (tag === 'a') {
          let href = node.getAttribute('href');
          if (!href) try { href = JSON.parse(node.getAttribute('data-bbfile') || '{}').resourceUrl; } catch {}
          const url = safeLink(href, base);
          if (url) { target.setAttribute('href', url); target.setAttribute('target', '_blank'); target.setAttribute('rel', 'noopener noreferrer'); }
        }
        const dir = node.getAttribute('dir'); if (dir === 'rtl' || dir === 'ltr' || dir === 'auto') target.setAttribute('dir', dir);
        parent.appendChild(target);
      }
      if (blocks.has(tag)) words.push(' ');
      for (const child of node.childNodes) copy(child, target);
      if (blocks.has(tag)) words.push(' ');
    }
    for (const child of source.childNodes) copy(child, fragment);
    return { fragment, preview: words.join('').replace(/\s+/g, ' ').trim() };
  }
  function announcementBody(html, doc, base) {
    // Template parsing is inert; only reconstructed text and allowed tags reach the page.
    const template = doc.createElement('template'); template.innerHTML = html;
    return sanitizeNodes(template.content, doc, base);
  }
  return { FeedError, announcementsURL, courseLink, safeLink, readJSON, pages, loadCourses, normalize, sortAnnouncements, loadAll, sanitizeNodes, announcementBody };
});
