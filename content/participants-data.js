(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BBLParticipantsData = factory();
})(globalThis, function() {
  'use strict';
  class RosterError extends Error {
    constructor(code) { super(code); this.name = 'RosterError'; this.code = code; }
  }
  const text = value => typeof value === 'string' ? value.trim() : '';
  function courseIdFromPath(path) {
    const match = /^\/ultra\/courses\/([^/]+)(?:\/|$)/.exec(path || '');
    if (!match) return null;
    try {
      const id = decodeURIComponent(match[1]);
      return id && id.length <= 200 && !/[\\/\s?#\u0000-\u001f]/.test(id) ? id : null;
    } catch { return null; }
  }
  function membershipURL(origin, courseId) {
    const url = new URL('/learn/api/v1/courses/' + encodeURIComponent(courseId) + '/memberships', origin);
    url.searchParams.set('expand', 'user,courseRole,user.hasEmailAddress');
    url.searchParams.set('limit', '5000');
    return url;
  }
  function avatarURL(value, origin) {
    try { const url = new URL(value, origin); return value && url.origin === origin && /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  }
  function participant(member, origin, canViewUserName) {
    const user = member.user && typeof member.user === 'object' ? member.user : {};
    const role = member.courseRole && typeof member.courseRole === 'object' ? member.courseRole : {};
    const roleId = text(role.identifier) || text(member.role);
    const roleName = text(role.displayName) || text(role.name) || text(role.courseName) || text(role.courseName?.displayName) || text(role.courseName?.text);
    const id = text(user.id) || text(member.userId);
    const name = text(user.displayName) || [text(user.givenName), text(user.familyName)].filter(Boolean).join(' ') || text(user.name) || 'Unnamed participant';
    return { id, name, username: canViewUserName ? text(user.userName) : '', roleId,
      role: roleName || ({ S: 'Student', P: 'Instructor' })[roleId] || roleId || 'Participant',
      avatar: avatarURL(user.avatar?.permanentUrl, origin) };
  }
  async function loadMemberships({ origin, courseId, fetch, signal, onPage = () => {} }) {
    const first = membershipURL(origin, courseId);
    let url = first, canViewUserName = true, pages = 0;
    const visited = new Set(), members = new Map();
    while (url) {
      if (signal?.aborted) throw new RosterError('cancelled');
      if (visited.has(url.href) || pages >= 100) throw new RosterError('pagination');
      if (url.origin !== first.origin || url.pathname !== first.pathname || url.username || url.password) throw new RosterError('pagination');
      visited.add(url.href);
      const response = await fetch(url.href, { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' }, signal });
      if (response.status === 401) throw new RosterError('session');
      if (response.status === 403) throw new RosterError('permission');
      if (!response.ok) throw new RosterError('network');
      let data;
      try { data = await response.json(); } catch { throw new RosterError('response'); }
      if (!data || !Array.isArray(data.results)) throw new RosterError('response');
      if (data.permissions?.viewUserName === false) canViewUserName = false;
      for (const member of data.results) {
        if (!member || typeof member !== 'object' || (member.courseId && member.courseId !== courseId)) continue;
        const key = text(member.user?.id) || text(member.userId) || text(member.id);
        if (key) members.set(key, member);
      }
      onPage({ count: members.size, pages: ++pages });
      const next = data.paging?.nextPage;
      if (next && typeof next !== 'string') throw new RosterError('pagination');
      try { url = next ? new URL(next, url) : null; } catch { throw new RosterError('pagination'); }
      if (url && !url.searchParams.has('expand')) url.searchParams.set('expand', first.searchParams.get('expand'));
    }
    if (signal?.aborted) throw new RosterError('cancelled');
    return { rows: [...members.values()].map(member => participant(member, origin, canViewUserName)), canViewUserName };
  }
  function filterParticipants(rows, query = '', role = '', direction = 'asc', locale = undefined) {
    const search = query.trim().toLocaleLowerCase(locale);
    const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
    return rows.filter(row => (!role || row.role === role) && (!search ||
      [row.name, row.username, row.id, row.role].some(value => value.toLocaleLowerCase(locale).includes(search))))
      .sort((a, b) => (collator.compare(a.name, b.name) || collator.compare(a.id, b.id)) * (direction === 'desc' ? -1 : 1));
  }
  return { RosterError, courseIdFromPath, membershipURL, avatarURL, participant, loadMemberships, filterParticipants };
});
