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
  constructor(tag, doc) { this.tagName = tag; this.nodeType = tag === '#text' ? 3 : tag === '#fragment' ? 11 : 1; this.doc = doc; this.children = []; this.parentElement = null; this.attrs = {}; this.className = ''; this.id = ''; this.dataset = {}; this.events = {}; this.value = ''; this._text = ''; this.style = { values: {}, setProperty(key, value) { this.values[key] = value; } }; }
  get childNodes() { return this.nodeType === 3 ? [] : [...(this._text ? [this.doc.createTextNode(this._text)] : []), ...this.children]; }
  get isConnected() { return this === this.doc.documentElement || Boolean(this.parentElement?.isConnected); }
  get nextElementSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] || null; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  setAttribute(key, value) { if (key === 'id') this.id = String(value); else if (key === 'class') this.className = String(value); else this.attrs[key] = String(value); }
  getAttribute(key) { return key === 'id' ? this.id || null : key === 'class' ? this.className || null : this.attrs[key] ?? null; }
  removeAttribute(key) { delete this.attrs[key]; }
  appendChild(node) { if (node.nodeType === 11) { while (node.children.length) this.appendChild(node.children[0]); return node; } node.remove(); this.children.push(node); node.parentElement = this; return node; }
  insertBefore(node, before) { node.remove(); this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, node); node.parentElement = this; return node; }
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

function decode(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, key) => {
    if (key[0] === '#') return String.fromCodePoint(parseInt(key.slice(key[1].toLowerCase() === 'x' ? 2 : 1), key[1].toLowerCase() === 'x' ? 16 : 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[key.toLowerCase()];
  });
}
// Minimal inert HTML fixture parser. Sanitizer security is also tested directly on constructed nodes.
function parseFixtureHTML(html, doc) {
  const fragment = doc.createDocumentFragment(); const stack = [fragment];
  for (const token of html.match(/<!--[\s\S]*?-->|<\/?[a-z][^>]*>|[^<]+|</gi) || []) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    const match = /^<([\w-]+)([\s\S]*?)\/?\s*>$/.exec(token);
    if (!match) { stack.at(-1).appendChild(doc.createTextNode(decode(token))); continue; }
    const tag = match[1].toLowerCase(); const item = doc.createElement(tag);
    for (const [, key, a, b, c] of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) item.setAttribute(key, decode(a ?? b ?? c ?? ''));
    stack.at(-1).appendChild(item);
    if (!['br', 'hr', 'img', 'input', 'link', 'meta', 'embed'].includes(tag) && !token.endsWith('/>')) stack.push(item);
  }
  return fragment;
}
function createDocument(lang = 'en', readyState = 'complete') {
  const events = {};
  const doc = {
    readyState, createElement(tag) {
      const item = new Node(tag, this);
      if (tag === 'template') Object.defineProperty(item, 'innerHTML', { set(html) { this.content = parseFixtureHTML(html, doc); } });
      return item;
    },
    createElementNS(namespace, tag) { return this.createElement(tag); },
    createDocumentFragment() { return new Node('#fragment', this); },
    createTextNode(text) { const item = new Node('#text', this); item._text = String(text); return item; },
    addEventListener(event, callback) { (events[event] ||= []).push(callback); },
    fire(event) { for (const callback of events[event] || []) callback(); }
  };
  doc.documentElement = new Node('html', doc); doc.documentElement.lang = lang;
  doc.head = doc.documentElement.appendChild(doc.createElement('head')); doc.body = doc.documentElement.appendChild(doc.createElement('body'));
  doc.querySelector = selector => doc.documentElement.querySelector(selector);
  doc.querySelectorAll = selector => doc.documentElement.querySelectorAll(selector);
  doc.getElementById = id => doc.querySelector('#' + id);
  return doc;
}
module.exports = { Node, createDocument };
