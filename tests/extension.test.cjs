const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const content = fs.readFileSync(path.join(root, 'content/content.js'), 'utf8');
const popup = fs.readFileSync(path.join(root, 'popup/popup.js'), 'utf8');
const popupHTML = fs.readFileSync(path.join(root, 'popup/popup.html'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

// A DOM and Chrome-storage fixture. No browser or user session is controlled.
function detectionSelector(selector = '') {
    return /bb-base-layout|^meta|^script\[src\]|^\[bb-translate\]/.test(selector);
}
function matchesDetection(element, selector) {
    return selector.split(',').some(part => {
        const rule = part.trim();
        const tag = /^[\w-]+/.exec(rule)?.[0];
        if (tag && element.tagName.toLowerCase() !== tag.toLowerCase()) return false;
        for (const match of rule.matchAll(/\[([\w-]+)(?:="([^"]*)"( i)?)?\]/g)) {
            const value = element.getAttribute(match[1]);
            if (value === null) return false;
            if (match[2] !== undefined && (match[3] ? value.toLowerCase() !== match[2].toLowerCase() : value !== match[2])) return false;
        }
        return true;
    });
}
class Element {
    constructor(tag = 'div') {
        this.tagName = tag; this.id = ''; this.textContent = ''; this.children = [];
        this.nodeType = 1; this.isConnected = true; this.attributes = {};
        this.computed = { backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', display: 'block' };
        this.listeners = {}; this.style = {}; this.dataset = {}; this.value = ''; this.checked = false;
        const styleValues = new Map();
        this.style.getPropertyValue = key => styleValues.get(key)?.value || '';
        this.style.getPropertyPriority = key => styleValues.get(key)?.priority || '';
        this.style.setProperty = (key, value, priority = '') => styleValues.set(key, { value, priority });
        this.style.removeProperty = key => styleValues.delete(key);
        const classes = new Set();
        this.classList = { add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) };
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    remove() { this.parentNode.children = this.parentNode.children.filter(child => child !== this); }
    replaceChildren(...children) { this.children = []; children.forEach(child => this.appendChild(child)); }
    get options() { return this.children; }
    get parentElement() { return this.parentNode || null; }
    querySelector(selector) { return detectionSelector(selector) ? this.querySelectorAll(selector)[0] || null : this.querySelectorAll().find(element => element.classList.contains('pdfViewer') || element.id === 'viewerContainer') || null; }
    querySelectorAll(selector) { const all = this.children.flatMap(child => [child, ...child.querySelectorAll()]); return detectionSelector(selector) ? all.filter(element => matchesDetection(element, selector)) : all; }
    contains(other) { return this === other || this.querySelectorAll().includes(other); }
    matches(selector) { if (detectionSelector(selector)) return matchesDetection(this, selector); return ['grade-input-display', 'points-text', 'grade-pill', 'customGradePill', 'readonly-pill'].some(name => this.classList.contains(name)) || ['bb-grade-pill', 'bb-grading-schema'].includes(this.tagName); }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    removeAttribute(key) { delete this.attributes[key]; }
    closest(selector = '') {
        if (selector === '.base-grades, .base-grades-wrapper, .base-grades-term-wrapper, .grades-list') {
            if (['base-grades', 'base-grades-wrapper', 'base-grades-term-wrapper', 'grades-list'].some(name => this.classList.contains(name))) return this;
            return this.parentNode?.closest(selector) || null;
        }
        const pdfMatch = this.classList.contains('pdfViewer') || this.classList.contains('textLayer') || this.classList.contains('annotationLayer') || this.id === 'viewerContainer';
        if (selector.startsWith('.pdfViewer,')) return pdfMatch ? this : this.parentNode?.closest(selector) || null;
        const excluded = new Set(['script', 'style', 'link', 'img', 'picture', 'canvas', 'video', 'iframe', 'embed', 'object']);
        if (selector.includes(', svg,')) excluded.add('svg');
        if (excluded.has(this.tagName.toLowerCase()) || this.attributes.contenteditable === 'true' ||
            this.attributes['data-bbl-preserve'] ||
            this.classList.contains('course-banner') || this.classList.contains('vtbegenerated')) return this;
        if (this.classList.contains('pdfViewer') || this.classList.contains('textLayer') || this.classList.contains('annotationLayer') || this.id === 'viewerContainer') return this;
        return this.parentNode?.closest(selector) || null;
    }
    addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
    fire(name) { if (this['on' + name]) this['on' + name]({ target: this });
        for (const handler of this.listeners[name] || []) handler({ target: this }); }
}

function fixture(saved = {}, config = {}) {
    const elements = new Map();
    const head = new Element('head');
    const body = new Element('body');
    const doc = new Element('document');
    doc.head = head; doc.body = body; doc.documentElement = new Element('html');
    doc.appendChild(doc.documentElement);
    doc.documentElement.appendChild(head);
    doc.documentElement.appendChild(body);
    doc.readyState = config.readyState || 'complete';
    doc.contentType = config.contentType || 'text/html';
    if (config.blackboard ?? (!config.host || config.host.endsWith('.blackboard.com'))) {
        const generator = new Element('meta');
        generator.setAttribute('name', 'generator'); generator.setAttribute('content', 'Blackboard Learn');
        body.appendChild(generator);
    }
    doc.createElement = tag => new Element(tag);
    doc.getElementById = id => elements.get(id) || head.children.find(child => child.id === id) || null;
    if (config.popup) {
        for (const match of popupHTML.matchAll(/id="([^"]+)"/g)) {
            const element = new Element(); element.id = match[1]; elements.set(element.id, element);
        }
        for (const [key, value] of [['primary', '#1F1F1F'], ['secondary', '#FFFFFF'], ['sidebar', '#102D70']]) {
            elements.get(key + '-color-input').value = value;
            elements.get(key + '-color-text').value = value;
        }
        elements.get('card-options-select').appendChild(new Element('option'));
    }
    const storage = { ...saved };
    const storageReads = [];
    const listeners = [];
    let deferredRead;
    const chrome = { runtime: { lastError: null }, storage: {
        sync: {
            get(keys, callback) {
                storageReads.push(keys);
                const values = keys == null ? { ...storage } : Object.fromEntries(
                    (Array.isArray(keys) ? keys : [keys]).filter(key => key in storage).map(key => [key, storage[key]]));
                if (!callback) return Promise.resolve(values);
                if (config.defer && keys == null) deferredRead = () => callback(values);
                else queueMicrotask(() => callback(values));
            },
            set(values, callback) {
                const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { oldValue: storage[key], newValue: value }]));
                Object.assign(storage, values);
                queueMicrotask(() => { listeners.forEach(listener => listener(changes, 'sync')); if (callback) callback(); });
                return Promise.resolve();
            }
        },
        onChanged: { addListener: callback => listeners.push(callback) }
    } };
    const window = { location: { origin: (config.protocol || 'https:') + '//' + (config.host || 'learn.example.edu'), hostname: config.host || 'learn.example.edu', pathname: config.pathname || '/ultra/courses/_1_1/outline' } };
    window.top = config.frame ? {} : window;
    window.parent = config.parent || window;
    const requests = [];
    const observers = [];
    const context = vm.createContext({ window, document: doc, chrome, console: { warn() {}, log() {}, error() {} },
        getComputedStyle: element => element.computed,
        requestAnimationFrame: callback => { queueMicrotask(callback); },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; this.connected = false; observers.push(this); }
            observe() { this.connected = true; }
            disconnect() { this.connected = false; }
        },
        CSS: { supports: (_, value) => /^(#[0-9a-f]{3,8}|white|black|orange)$/i.test(value), escape: value => value.replace(/[^\w-]/g, '\\$&') },
        AbortSignal, encodeURIComponent, Map, Set, Promise, URL, Image: class {},
        fetch: async (url, options) => { requests.push({ url, options });
            if (config.fetch) return config.fetch(url, options);
            throw new Error('Simulated unavailable Blackboard API'); }
    });
    return { doc, context, head, storage, storageReads, listeners, observers, window, chrome, elements, requests,
        addPanel(rgb, tag = 'div') { const panel = new Element(tag); panel.computed.backgroundColor = rgb; body.appendChild(panel); return panel; },
        async mutations(records) { for (const observer of observers) if (observer.connected) observer.callback(records); await flush(); },
        async run() { vm.runInContext(content, context); await flush(); },
        async runPopup() { vm.runInContext(popup, context); doc.fire('DOMContentLoaded'); await flush(); },
        async change(values) { await chrome.storage.sync.set(values); await flush(); },
        css() { return doc.getElementById('bbl-theme')?.textContent || ''; },
        release() { deferredRead(); },
        emit(changes, area) { listeners.forEach(listener => listener(changes, area)); }
    };
}

test('saved dark mode starts even when the Blackboard user API fails', async () => {
    const f = fixture({ colorscheme: 'dark' }); await f.run();
    assert.match(f.css(), /--bbl-primary: #1f1f1f/);
    assert.doesNotMatch(f.css(), /color-scheme:/);
    assert.equal(f.requests.length, 1);
});
test('dark mode works when user API returns no userName', async () => {
    const f = fixture({ colorscheme: 'dark' }, { fetch: async () => ({ ok: true, json: async () => ({ id: '_1_1' }) }) });
    await f.run(); assert.ok(f.css());
});
test('dark mode works when user API never completes', async () => {
    const f = fixture({ colorscheme: 'dark' }, { fetch: () => new Promise(() => {}) });
    await f.run(); assert.ok(f.css());
});
test('empty preferences and malformed optional course maps do not crash', async () => {
    const f = fixture({ courseImageMap: {}, courseNameMap: null }); await f.run();
    assert.equal(f.head.children.length, 0);
    await f.change({ colorscheme: 'dark' }); assert.ok(f.css());
    assert.doesNotMatch(f.css(), /undefined|null/);
});
test('custom colors override dark mode in one predictable sheet', async () => {
    const f = fixture({ colorscheme: 'dark', customprimary: '#654321', customsecondary: '#aabbcc', customsidebar: '#112233' });
    await f.run(); assert.match(f.css(), /--bbl-primary: #654321/);
    assert.match(f.css(), /--bbl-accent: #aabbcc/); assert.match(f.css(), /--bbl-sidebar: #112233/);
    assert.equal(f.head.children.length, 1);
});
test('custom accent alone preserves light background', async () => {
    const f = fixture({ customsecondary: '#c80000' }); await f.run();
    assert.match(f.css(), /--bbl-primary: #ffffff/); assert.match(f.css(), /--bbl-accent: #c80000/);
});
test('preset is restored on page load and updates without duplicate sheets', async () => {
    const f = fixture({ theme: { primary: '#111111', accent: 'orange', sidebar: '#222222' } }); await f.run();
    assert.match(f.css(), /--bbl-accent: orange/);
    for (let i = 0; i < 10; i++) await f.change({ theme: { primary: '#333333', accent: '#ffffff', sidebar: '#444444' } });
    assert.match(f.css(), /--bbl-primary: #333333/); assert.equal(f.head.children.length, 1);
});
test('repeated on/off toggles safely remove the theme', async () => {
    const f = fixture(); await f.run();
    for (let i = 0; i < 5; i++) {
        await f.change({ colorscheme: 'default' }); assert.equal(f.css(), '');
        await f.change({ colorscheme: 'dark' }); assert.ok(f.css());
        await f.change({ colorscheme: 'default' }); assert.equal(f.css(), '');
    }
    assert.equal(f.head.children.length, 0);
});
test('removing a saved option restores its default', async () => {
    const f = fixture({ customprimary: '#123456' }); await f.run();
    f.emit({ customprimary: { oldValue: '#123456' } }, 'sync'); assert.equal(f.css(), '');
});
test('changes during initial storage read win over stale saved preferences', async () => {
    const f = fixture({ colorscheme: 'default' }, { defer: true }); await f.run();
    await f.change({ colorscheme: 'dark' }); f.release(); assert.ok(f.css());
});
test('unrelated storage areas cannot change the page theme', async () => {
    const f = fixture({ colorscheme: 'dark' }); await f.run(); const css = f.css();
    f.emit({ colorscheme: { newValue: 'default' } }, 'local'); assert.equal(f.css(), css);
});
test('content starts once at DOM ready and also supports already-loaded pages', async () => {
    const f = fixture({ colorscheme: 'dark' }, { readyState: 'loading' }); await f.run(); assert.equal(f.css(), '');
    f.doc.fire('DOMContentLoaded'); await flush(); assert.ok(f.css());
    f.doc.fire('DOMContentLoaded'); await flush(); assert.equal(f.requests.length, 1);
});
test('course frames get themes without duplicate account requests', async () => {
    const f = fixture({ colorscheme: 'dark' }, { frame: true }); await f.run();
    assert.ok(f.css()); assert.equal(f.requests.length, 0);
});
test('Blackboard cloud domains work and unrelated sites stay untouched', async () => {
    const cloud = fixture({ colorscheme: 'dark' }, { host: 'college.blackboard.com' }); await cloud.run(); assert.ok(cloud.css());
    const other = fixture({ colorscheme: 'dark' }, { host: 'example.com' }); await other.run();
    assert.equal(other.css(), ''); assert.equal(other.requests.length, 0);
});

test('Blackboard generator metadata enables themes on a custom university domain', async () => {
    const f = fixture({ colorscheme: 'dark' }, { host: 'courses.university.example', blackboard: true, pathname: '/' });
    await f.run(); assert.ok(f.css());
    assert.equal(f.requests[0].url, 'https://courses.university.example/learn/api/v1/users/me');
});

test('Ultra navigation markup is detected without a product name or a known domain', async () => {
    const f = fixture({ customprimary: '#123456' }, { host: 'study.university.example', blackboard: false });
    const navigation = f.addPanel('transparent'); navigation.setAttribute('data-analytics-id', 'base.navigation.drawer');
    await f.run(); assert.match(f.css(), /--bbl-primary: #123456/);
});

test('Ultra routes require Blackboard component markup before activating', async () => {
    const f = fixture({ colorscheme: 'dark' }, { host: 'portal.example', blackboard: false, pathname: '/ultra/courses' });
    await f.run(); assert.equal(f.css(), ''); assert.equal(f.storageReads.length, 0);
    const translated = f.addPanel('transparent'); translated.setAttribute('bb-translate', '');
    await f.mutations([{ type: 'childList', addedNodes: [translated] }]); assert.ok(f.css());
});

for (const assetPath of ['/webapps/blackboard/styles.css', '/webapps/bbng/scripts/main.js', '/javascript/blackboard.js?v=2', '/javascript/blackboard/app.js']) {
    test('Classic local assets detect Blackboard at ' + assetPath, async () => {
        const f = fixture({ colorscheme: 'dark' }, { host: 'lms.example.edu', blackboard: false, pathname: '/webapps/portal/execute/tabs/tabAction' });
        const asset = new Element(assetPath.endsWith('.css') ? 'link' : 'script');
        asset.setAttribute(asset.tagName === 'link' ? 'href' : 'src', assetPath);
        if (asset.tagName === 'link') asset.setAttribute('rel', 'stylesheet');
        f.doc.body.appendChild(asset); await f.run(); assert.ok(f.css());
    });
}

test('HTTP Blackboard installations are detected with same-origin API requests', async () => {
    const f = fixture({ colorscheme: 'dark' }, { host: 'learn.example.edu', protocol: 'http:', blackboard: true });
    await f.run(); assert.ok(f.css()); assert.match(f.requests[0].url, /^http:\/\/learn\.example\.edu\//);
});

test('ordinary pages mentioning Blackboard do not receive styles, storage reads, or API calls', async () => {
    const f = fixture({ colorscheme: 'dark', customfont: 'Open Sans' }, { host: 'help.blackboard.com', blackboard: false });
    f.doc.title = 'Blackboard Learn guide';
    const link = f.addPanel('white', 'a'); link.setAttribute('href', 'https://college.blackboard.com/ultra');
    link.textContent = 'Open Blackboard Learn';
    const external = f.addPanel('transparent', 'script'); external.setAttribute('src', 'https://college.blackboard.com/javascript/blackboard.js');
    await f.run(); await f.change({ colorscheme: 'dark' });
    assert.equal(f.head.children.length, 0); assert.equal(f.storageReads.length, 0);
    assert.equal(f.listeners.length, 0); assert.equal(f.requests.length, 0);
});

test('late generator metadata activates once and loads the latest saved preferences', async () => {
    const f = fixture({ colorscheme: 'default' }, { host: 'courses.example.edu', blackboard: false });
    await f.run(); await f.change({ colorscheme: 'dark' }); assert.equal(f.storageReads.length, 0);
    const meta = new Element('meta'); meta.setAttribute('name', 'GeNeRaToR'); meta.setAttribute('content', 'Blackboard Learn 3900');
    f.doc.body.appendChild(meta);
    await f.mutations([{ type: 'childList', addedNodes: [meta] }]);
    assert.ok(f.css()); assert.equal(f.requests.length, 1); assert.equal(f.storageReads.length, 1);
    assert.equal(f.observers[0].connected, false);
    await f.mutations([{ type: 'attributes', target: meta }]); assert.equal(f.requests.length, 1);
});

test('updated metadata is recognized after the initial document load', async () => {
    const f = fixture({ colorscheme: 'dark' }, { host: 'learn.example.edu', blackboard: false });
    const meta = new Element('meta'); meta.setAttribute('name', 'generator'); meta.setAttribute('content', '');
    f.doc.body.appendChild(meta); await f.run(); assert.equal(f.css(), '');
    meta.setAttribute('content', 'Blackboard');
    await f.mutations([{ type: 'attributes', target: meta }]); assert.ok(f.css());
});

test('same-origin course frames inherit detection without duplicating metadata requests', async () => {
    const parent = fixture({}, { host: 'courses.example.edu', blackboard: true });
    const f = fixture({ colorscheme: 'dark' }, { host: 'courses.example.edu', blackboard: false, frame: true,
        parent: { document: parent.doc, location: parent.window.location } });
    await f.run(); assert.ok(f.css()); assert.equal(f.requests.length, 0);
});

test('cross-origin frames do not inherit Blackboard detection', async () => {
    const parent = fixture({}, { host: 'courses.example.edu', blackboard: true });
    const f = fixture({ colorscheme: 'dark' }, { host: 'external.example', blackboard: false, frame: true,
        parent: { document: parent.doc, location: parent.window.location } });
    await f.run(); assert.equal(f.css(), ''); assert.equal(f.storageReads.length, 0);
});

test('PDF frames remain excluded even when their parent is detected as Blackboard', async () => {
    const parent = fixture({}, { host: 'courses.example.edu', blackboard: true });
    const f = fixture({ colorscheme: 'dark' }, { host: 'courses.example.edu', blackboard: false, frame: true,
        pathname: '/files/lecture.pdf', parent: { document: parent.doc, location: parent.window.location } });
    await f.run(); assert.equal(f.css(), ''); assert.equal(f.storageReads.length, 0);
    assert.equal(f.observers.length, 0);
});
test('sidebar matching updates course card backgrounds', async () => {
    const f = fixture({ colorscheme: 'dark', customsidebar: '#135790' }); await f.run();
    assert.match(f.css(), /\.element-card \.element-details.summary[^{}]*\{ background-color: #1f1f1f/);
    await f.change({ matchSidebarToCourseCards: true });
    assert.match(f.css(), /\.element-card \.element-details.summary[^{}]*\{ background-color: #135790/);
});
test('invalid saved colors are ignored rather than injected as CSS', async () => {
    const f = fixture({ colorscheme: 'dark', customprimary: 'undefined', customsecondary: 'red; } body { display:none' });
    await f.run(); assert.match(f.css(), /--bbl-primary: #1f1f1f/); assert.doesNotMatch(f.css(), /display:none|undefined/);
});
test('fonts and course customizations can be applied and cleared without duplicates', async () => {
    const f = fixture({ colorscheme: 'dark', customfont: 'Open Sans', courseImageMap: [['_1_1', 'https://example.com/a.png']], courseNameMap: [['_1_1', 'Course "A"']] });
    await f.run(); assert.equal(f.head.children.length, 4);
    assert.match(f.doc.getElementById('bbl-font').textContent, /Open\+Sans/);
    await f.change({ courseNameMap: [['_1_1', 'Updated']] });
    assert.match(f.doc.getElementById('bbl-names').textContent, /Updated/); assert.equal(f.head.children.length, 4);
    await f.change({ customfont: 'default', courseImageMap: [], courseNameMap: [] }); assert.equal(f.head.children.length, 1);
});
test('course requests use the current university and encode identifiers', async () => {
    const f = fixture({ colorscheme: 'dark' }, { fetch: async url => ({ ok: true, json: async () => {
        if (url.endsWith('/me')) return { userName: 'name/with space' };
        if (url.endsWith('/courses')) return { results: [{ courseId: '_1_1' }] };
        return { courseId: 'CS101' };
    } }) });
    await f.run(); await flush();
    assert.equal(f.requests.length, 3);
    assert.ok(f.requests.every(request => request.url.startsWith('https://learn.example.edu/')));
    assert.match(f.requests[1].url, /name%2Fwith%20space/);
    assert.equal(f.storage.courseshortnames[0], 'CS101');
    assert.ok(f.requests.every(request => request.options.credentials === 'same-origin'));
});
test('popup Dark Mode button toggles saved state and clears overriding themes', async () => {
    const f = fixture({ customprimary: '#abcdef', theme: { primary: '#888888' } }, { popup: true });
    await f.runPopup(); const button = f.elements.get('dark-theme-button');
    button.fire('click'); await flush(); assert.equal(f.storage.colorscheme, 'dark');
    assert.equal(f.storage.customprimary, 'default'); assert.equal(f.storage.theme, 'default');
    assert.ok(button.classList.contains('active'));
    button.fire('click'); await flush(); assert.equal(f.storage.colorscheme, 'default');
    assert.equal(button.classList.contains('active'), false);
});
test('popup Save Theme persists all picked colors, not just Apply clicks', async () => {
    const f = fixture({}, { popup: true }); await f.runPopup();
    f.elements.get('primary-color-input').value = '#112233';
    f.elements.get('secondary-color-input').value = '#445566';
    f.elements.get('sidebar-color-input').value = '#778899';
    f.elements.get('match-sidebar-to-courses').checked = true;
    f.elements.get('save-custom-theme-button').fire('click'); await flush();
    assert.equal(f.storage.customprimary, '#112233'); assert.equal(f.storage.customsecondary, '#445566');
    assert.equal(f.storage.customsidebar, '#778899'); assert.equal(f.storage.matchSidebarToCourseCards, true);
});
test('popup preset selection clears custom overrides', async () => {
    const f = fixture({ customprimary: '#abcdef' }, { popup: true }); await f.runPopup();
    f.elements.get('preset-theme-buttons').children[0].fire('click'); await flush();
    assert.equal(f.storage.customprimary, 'default'); assert.equal(f.storage.theme.primary, '#5a3a7e');
});
test('popup typed hex colors work and invalid input cannot reset the picker', async () => {
    const f = fixture({}, { popup: true }); await f.runPopup();
    const input = f.elements.get('primary-color-text'); input.value = '#123456'; input.fire('input');
    assert.equal(f.elements.get('primary-color-input').value, '#123456');
    input.value = 'invalid'; input.fire('input'); assert.equal(f.elements.get('primary-color-input').value, '#123456');
});
test('popup course reset clears both customization maps', async () => {
    const f = fixture({ courseImageMap: [['_1_1', 'https://example.com/a.png']], courseNameMap: [['_1_1', 'Course']] }, { popup: true });
    await f.runPopup(); f.elements.get('reset-banner-options').fire('click'); await flush();
    assert.equal(f.storage.courseImageMap.length, 0); assert.equal(f.storage.courseNameMap.length, 0);
});
test('background upgrade preserves saved settings and fills missing defaults', async () => {
    const f = fixture({ customprimary: '#123456', colorscheme: 'dark' }); let installed;
    f.chrome.runtime.onInstalled = { addListener: callback => { installed = callback; } };
    vm.runInContext(fs.readFileSync(path.join(root, 'options/background.js'), 'utf8'), f.context);
    await installed(); assert.equal(f.storage.customprimary, '#123456'); assert.equal(f.storage.colorscheme, 'dark');
    assert.equal(f.storage.customsecondary, 'default'); assert.equal(f.storage.courseImageMap.length, 0);
});
test('manifest enables automatic detection on HTTP and HTTPS sites and course frames', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    assert.equal(manifest.manifest_version, 3); assert.equal(manifest.content_scripts[0].all_frames, true);
    assert.deepEqual(manifest.content_scripts[0].matches, ['http://*/*', 'https://*/*']);
    assert.equal(manifest.update_url, undefined); assert.equal(manifest.key, undefined);
    for (const item of [manifest.action.default_popup, manifest.options_page, manifest.background.service_worker,
        ...manifest.content_scripts[0].js, ...Object.values(manifest.icons)]) assert.ok(fs.existsSync(path.join(root, item)), item);
    assert.doesNotMatch(popupHTML, /\son\w+=/);
});

test('white course rows and light-gray side panels are marked for dark backgrounds', async () => {
    const f = fixture({ colorscheme: 'dark' });
    const row = f.addPanel('rgb(255, 255, 255)'); row.setAttribute('role', 'button');
    const sidebar = f.addPanel('rgb(245, 245, 247)', 'aside');
    await f.run(); assert.equal(row.attributes['data-bbl-surface'], 'light');
    assert.equal(sidebar.attributes['data-bbl-surface'], 'light');
    assert.match(f.css(), /\[data-bbl-surface="light"\].*\{\s*background-color: #1f1f1f !important; color: #e7e7e7 !important;/);
});
test('rows loaded after startup receive dark backgrounds', async () => {
    const f = fixture({ colorscheme: 'dark' }); await f.run();
    const row = f.addPanel('rgba(250, 250, 250, 1)');
    await f.mutations([{ type: 'childList', addedNodes: [row] }]);
    assert.equal(row.attributes['data-bbl-surface'], 'light');
});
test('style or class updates can reveal a new white panel', async () => {
    const f = fixture({ colorscheme: 'dark' }); const row = f.addPanel('transparent'); await f.run();
    assert.equal(row.attributes['data-bbl-surface'], undefined);
    row.computed.backgroundColor = 'rgb(255, 255, 255)';
    await f.mutations([{ type: 'attributes', target: row }]);
    assert.equal(row.attributes['data-bbl-surface'], 'light');
});
test('media, course banners, rich-text content and colored status buttons keep their backgrounds', async () => {
    const f = fixture({ colorscheme: 'dark' });
    const media = ['img', 'svg', 'canvas', 'video', 'iframe'].map(tag => f.addPanel('rgb(255, 255, 255)', tag));
    const banner = f.addPanel('rgb(255, 255, 255)'); banner.classList.add('course-banner');
    const authored = f.addPanel('rgb(255, 255, 255)'); authored.classList.add('vtbegenerated');
    const editor = f.addPanel('rgb(255, 255, 255)'); editor.setAttribute('contenteditable', 'true');
    const status = f.addPanel('rgb(20, 210, 70)', 'button');
    const gradient = f.addPanel('rgb(255, 255, 255)'); gradient.computed.backgroundImage = 'linear-gradient(red, blue)';
    await f.run();
    for (const element of [...media, banner, authored, editor, status, gradient])
        assert.equal(element.attributes['data-bbl-surface'], undefined);
});
test('turning dark mode off restores marked backgrounds and stops scanning', async () => {
    const f = fixture({ colorscheme: 'dark' }); const row = f.addPanel('rgb(255, 255, 255)'); await f.run();
    assert.equal(row.attributes['data-bbl-surface'], 'light');
    await f.change({ colorscheme: 'default' }); assert.equal(row.attributes['data-bbl-surface'], undefined);
    assert.equal(f.css(), '');
    const next = f.addPanel('rgb(255, 255, 255)');
    await f.mutations([{ type: 'childList', addedNodes: [next] }]);
    assert.equal(next.attributes['data-bbl-surface'], undefined);
    await f.change({ colorscheme: 'dark' }); assert.equal(next.attributes['data-bbl-surface'], 'light');
});
test('custom themes use the same fallback with their chosen colors', async () => {
    const f = fixture({ customprimary: '#123456', customsecondary: '#abcdef' });
    const row = f.addPanel('rgb(255, 255, 255)'); await f.run();
    assert.equal(row.attributes['data-bbl-surface'], 'light');
    assert.match(f.css(), /\[data-bbl-surface="light"\].*\{\s*background-color: #123456 !important; color: #abcdef !important;/);
});
test('transparent backgrounds and dark panels are not unnecessarily marked', async () => {
    const f = fixture({ colorscheme: 'dark' });
    const elements = ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.3)', 'rgb(31, 31, 31)'].map(value => f.addPanel(value));
    await f.run();
    for (const element of elements) assert.equal(element.attributes['data-bbl-surface'], undefined);
});

test('native PDF documents receive no theme, custom font or API requests', async () => {
    const f = fixture({ colorscheme: 'dark', customfont: 'Open Sans' }, { contentType: 'application/pdf' });
    await f.run(); assert.equal(f.head.children.length, 0); assert.equal(f.requests.length, 0);
    await f.change({ customprimary: '#123456' }); assert.equal(f.head.children.length, 0);
});
test('direct PDF file URLs receive no injected styles', async () => {
    const f = fixture({ colorscheme: 'dark' }, { pathname: '/bbcswebdav/courses/course/notes.PDF' });
    await f.run(); assert.equal(f.head.children.length, 0); assert.equal(f.requests.length, 0);
});
test('standalone PDF.js viewers are skipped', async () => {
    const f = fixture({ colorscheme: 'dark' }, { pathname: '/pdfjs/web/viewer.html' });
    f.addPanel('rgb(255, 255, 255)').classList.add('pdfViewer');
    await f.run(); assert.equal(f.head.children.length, 0); assert.equal(f.requests.length, 0);
});
test('embedded PDF viewer documents are skipped without disabling ordinary course frames', async () => {
    const f = fixture({ colorscheme: 'dark', customfont: 'Open Sans' }, { frame: true });
    f.addPanel('rgb(255, 255, 255)').classList.add('pdfViewer');
    await f.run(); assert.equal(f.head.children.length, 0); assert.equal(f.requests.length, 0);
    const course = fixture({ colorscheme: 'dark' }, { frame: true }); await course.run(); assert.ok(course.css());
});
test('inline PDF pages and text layers keep original backgrounds while the course stays themed', async () => {
    const f = fixture({ colorscheme: 'dark' });
    const course = f.addPanel('rgb(255, 255, 255)');
    const viewer = f.addPanel('rgb(255, 255, 255)'); viewer.classList.add('pdfViewer');
    const page = viewer.appendChild(new Element()); page.computed.backgroundColor = 'rgb(255, 255, 255)';
    const text = page.appendChild(new Element('span')); text.classList.add('textLayer');
    text.computed.backgroundColor = 'rgb(255, 255, 255)';
    await f.run(); assert.equal(course.attributes['data-bbl-surface'], 'light'); assert.ok(f.css());
    for (const element of [viewer, page, text]) assert.equal(element.attributes['data-bbl-surface'], undefined);
});
test('every theme selector excludes PDF viewer roots and their descendants', async () => {
    const f = fixture({ colorscheme: 'dark' }); await f.run();
    const rules = [...f.css().matchAll(/([^{}]+)\{[^{}]*\}/g)]; assert.ok(rules.length > 10);
    for (const rule of rules) {
        const selectors = f.context.splitSelectors(rule[1]);
        for (const selector of selectors) {
            assert.ok(selector.includes(':not(:where(.pdfViewer,'), selector);
            assert.ok(selector.includes(':is(.pdfViewer,'), selector);
        }
    }
});
test('custom font selectors protect PDF text layers and do not change the body font', async () => {
    const f = fixture({ colorscheme: 'dark', customfont: 'Open Sans' }); await f.run();
    const fontCSS = f.doc.getElementById('bbl-font').textContent;
    const selectors = f.context.splitSelectors(fontCSS.slice(fontCSS.indexOf(';') + 1, fontCSS.indexOf('{')));
    for (const selector of selectors) {
        assert.ok(selector.includes(':not(:where(.pdfViewer,'));
        assert.doesNotMatch(selector.trim(), /^body\b/);
    }
});
test('panels converted into PDF viewers lose prior adaptive theme markings', async () => {
    const f = fixture({ colorscheme: 'dark' });
    const viewer = f.addPanel('rgb(255, 255, 255)');
    const page = viewer.appendChild(new Element()); page.computed.backgroundColor = 'rgb(255, 255, 255)';
    await f.run(); assert.equal(page.attributes['data-bbl-surface'], 'light');
    viewer.classList.add('pdfViewer');
    await f.mutations([{ type: 'attributes', target: viewer }]);
    assert.equal(viewer.attributes['data-bbl-surface'], undefined);
    assert.equal(page.attributes['data-bbl-surface'], undefined); assert.ok(f.css());
});
test('late-loading standalone PDF viewers remove earlier injected styles', async () => {
    const f = fixture({ colorscheme: 'dark', customfont: 'Open Sans' }, { pathname: '/pdfjs/web/viewer.html' });
    await f.run(); assert.equal(f.head.children.length, 2);
    const viewer = f.addPanel('rgb(255, 255, 255)'); viewer.classList.add('pdfViewer');
    await f.mutations([{ type: 'childList', addedNodes: [viewer] }]);
    assert.equal(f.head.children.length, 0);
});
test('PDF exclusions preserve pseudo-element syntax and nested selector lists', async () => {
    const f = fixture({ colorscheme: 'dark' }); await f.run();
    const css = f.context.scopeThemeCSS('input::placeholder, .panel:is(.a, .b) { color: red; }');
    const selectors = f.context.splitSelectors(css.slice(0, css.indexOf('{')));
    assert.equal(selectors.length, 2); assert.match(selectors[0], /\)\)::placeholder$/);
    assert.match(selectors[1], /^\s*\.panel:is\(\.a, \.b\):not/);
});

test('neutral white striped placeholders are replaced by the selected theme surface', async () => {
    const f = fixture({ customprimary: '#030f28', customsecondary: '#00ce7c' });
    const panel = f.addPanel('rgba(0, 0, 0, 0)');
    panel.computed.backgroundImage = 'repeating-linear-gradient(45deg, rgb(255, 255, 255) 0px, rgb(255, 255, 255) 8px, rgb(235, 235, 235) 8px, rgb(235, 235, 235) 10px)';
    await f.run(); assert.equal(panel.attributes['data-bbl-surface'], 'light');
    assert.equal(panel.attributes['data-bbl-pattern'], 'true');
    assert.match(f.css(), /\[data-bbl-pattern="true"\][^{}]*\{\s*background-image: none !important;/);
    assert.match(f.css(), /background-color: #030f28 !important/);
});
test('grade placeholders with image-based stripes are cleared and restored when theming is removed', async () => {
    const f = fixture({ colorscheme: 'dark' }, { pathname: '/ultra/grades' });
    const panel = f.addPanel('rgb(255, 255, 255)');
    panel.computed.backgroundImage = 'url("data:image/svg+xml,striped-placeholder")';
    panel.textContent = 'Your recently graded work will appear here';
    await f.run(); assert.equal(panel.attributes['data-bbl-pattern'], 'true');
    await f.change({ colorscheme: 'default' });
    assert.equal(panel.attributes['data-bbl-pattern'], undefined);
    assert.equal(panel.attributes['data-bbl-surface'], undefined);
    assert.equal(panel.computed.backgroundImage, 'url("data:image/svg+xml,striped-placeholder")');
});
test('striped PDF pages, course banners and photos remain unchanged', async () => {
    const f = fixture({ colorscheme: 'dark' });
    const pdf = f.addPanel('rgb(255, 255, 255)'); pdf.classList.add('pdfViewer');
    const banner = f.addPanel('rgb(255, 255, 255)'); banner.classList.add('course-banner');
    for (const element of [pdf, banner]) element.computed.backgroundImage = 'linear-gradient(45deg, rgb(255, 255, 255), rgb(230, 230, 230))';
    const photo = f.addPanel('rgb(255, 255, 255)'); photo.computed.backgroundImage = 'url("https://example.com/photo.jpg")';
    await f.run();
    for (const element of [pdf, banner, photo]) assert.equal(element.attributes['data-bbl-pattern'], undefined);
});

test('the inner grade value overrides black important text-fill and restores its original styling', async () => {
    const f = fixture({ colorscheme: 'dark' });
    const pill = f.addPanel('transparent'); pill.classList.add('grade-pill');
    const inner = pill.appendChild(new Element('bdi')); inner.textContent = '-- / 55';
    inner.style.setProperty('color', 'black', 'important');
    inner.style.setProperty('-webkit-text-fill-color', 'black', 'important');
    await f.run();
    assert.equal(inner.style.getPropertyValue('color'), '#e7e7e7');
    assert.equal(inner.style.getPropertyValue('-webkit-text-fill-color'), '#e7e7e7');
    assert.equal(inner.style.getPropertyPriority('color'), 'important');
    await f.change({ colorscheme: 'default' });
    assert.equal(inner.style.getPropertyValue('color'), 'black');
    assert.equal(inner.style.getPropertyValue('-webkit-text-fill-color'), 'black');
});
test('grade ratios with unfamiliar component classes are identified inside the grades page', async () => {
    const f = fixture({ colorscheme: 'dark' }, { pathname: '/ultra/grades' });
    const pill = f.addPanel('transparent'); pill.textContent = '-- / 55';
    await f.run(); assert.equal(pill.style.getPropertyValue('color'), '#e7e7e7');
    pill.style.setProperty('-webkit-text-fill-color', 'black', 'important');
    await f.mutations([{ type: 'attributes', target: pill }]);
    assert.equal(pill.style.getPropertyValue('-webkit-text-fill-color'), '#e7e7e7');
    await f.change({ customsecondary: '#00ce7c' }); assert.equal(pill.style.getPropertyValue('color'), '#00ce7c');
});
test('SVG grade text receives the theme fill while paths and PDF score text are preserved', async () => {
    const f = fixture({ colorscheme: 'dark' });
    const pill = f.addPanel('transparent'); pill.classList.add('grade-pill');
    const svg = pill.appendChild(new Element('svg'));
    const text = svg.appendChild(new Element('text')); text.textContent = '-- / 55';
    const iconPath = svg.appendChild(new Element('path')); iconPath.style.setProperty('fill', 'white');
    const pdf = f.addPanel('transparent'); pdf.classList.add('pdfViewer');
    const pdfScore = pdf.appendChild(new Element('span')); pdfScore.classList.add('grade-pill');
    pdfScore.textContent = '-- / 55';
    await f.run(); assert.equal(text.style.getPropertyValue('fill'), '#e7e7e7');
    assert.equal(iconPath.style.getPropertyValue('fill'), 'white');
    assert.equal(pdfScore.style.getPropertyValue('color'), '');
});

test('the supplied grade-ellipsis markup resets black filters and colors on the wrapper and bdi', async () => {
    const f = fixture({ theme: { primary: '#030f28', accent: '#00ce7c', sidebar: '#02101f' } });
    const pill = f.addPanel('transparent', 'span');
    pill.classList.add('grade-input-display', 'grade-ellipsis');
    pill.setAttribute('bb-tooltip', ''); pill.setAttribute('enhanced-tooltip', 'true');
    pill.setAttribute('tooltip-position', 'bottom'); pill.setAttribute('aria-describedby', 'tooltip-id_27');
    const sr = pill.appendChild(new Element('span')); sr.classList.add('sr-only');
    const value = pill.appendChild(new Element('bdi')); value.textContent = '--';
    for (const element of [pill, value]) {
        element.style.setProperty('color', 'black');
        element.style.setProperty('-webkit-text-fill-color', 'black');
        element.style.setProperty('filter', 'brightness(0)');
        element.style.setProperty('opacity', '.4');
    }
    await f.run();
    for (const element of [pill, value]) {
        assert.equal(element.style.getPropertyValue('color'), '#00ce7c');
        assert.equal(element.style.getPropertyValue('-webkit-text-fill-color'), '#00ce7c');
        assert.equal(element.style.getPropertyValue('filter'), 'none');
        assert.equal(element.style.getPropertyValue('opacity'), '1');
    }
    const exactRule = [...f.css().matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(rule =>
        rule[1].includes(':root body .grade-input-display.grade-ellipsis > bdi:not'));
    assert.ok(exactRule);
    assert.match(exactRule[2], /filter: none !important/);
    assert.match(exactRule[2], /-webkit-text-fill-color: #00ce7c !important/);
    assert.equal(value.textContent, '--'); assert.equal(pill.attributes['aria-describedby'], 'tooltip-id_27');
});

test('the supplied filled green Arabic score pill receives contrasting dark text', async () => {
    const f = fixture({ customprimary: '#030f28', customsecondary: '#00ce7c' });
    const pill = f.addPanel('rgb(104, 197, 115)');
    pill.classList.add('makeStylesreadonlyPill-0-2-279', 'readonly-pill', 'big-pill', 'customGradePill', 'excellent', 'default');
    const visible = pill.appendChild(new Element('span')); visible.setAttribute('aria-hidden', 'true');
    const score = visible.appendChild(new Element('span')); score.classList.add('js-pill-grade'); score.textContent = '٦';
    const separator = visible.appendChild(new Element('span')); separator.classList.add('makeStylespillSeparator-0-2-283'); separator.textContent = '/';
    const possible = visible.appendChild(new Element('span')); possible.classList.add('pill-points-possible'); possible.textContent = '٦';
    await f.run();
    for (const element of [pill, visible, score, separator, possible]) {
        assert.equal(element.style.getPropertyValue('color'), '#111111');
        assert.equal(element.style.getPropertyValue('-webkit-text-fill-color'), '#111111');
    }
    assert.equal(pill.computed.backgroundColor, 'rgb(104, 197, 115)');
    assert.equal(score.textContent, '٦');
    assert.ok(f.context.contrast([17, 17, 17], [104, 197, 115]) >= 4.5);
});
test('outlined dark pills retain the readable accent instead of receiving dark text', async () => {
    const f = fixture({ customprimary: '#030f28', customsecondary: '#00ce7c' });
    const pill = f.addPanel('rgb(3, 15, 40)'); pill.classList.add('customGradePill');
    const text = pill.appendChild(new Element('span')); text.textContent = '6 / 6';
    await f.run(); assert.equal(text.style.getPropertyValue('color'), '#00ce7c');
    assert.ok(f.context.contrast([0, 206, 124], [3, 15, 40]) >= 4.5);
});
test('redraws re-evaluate contrast when a grade pill changes from a bright to a dark fill', async () => {
    const f = fixture({ customprimary: '#030f28', customsecondary: '#00ce7c' });
    const pill = f.addPanel('rgb(104, 197, 115)'); pill.classList.add('readonly-pill');
    const text = pill.appendChild(new Element('span')); text.textContent = '٦';
    await f.run(); assert.equal(text.style.getPropertyValue('color'), '#111111');
    pill.computed.backgroundColor = 'rgb(10, 20, 30)';
    await f.mutations([{ type: 'attributes', target: pill }]);
    assert.equal(text.style.getPropertyValue('color'), '#00ce7c');
});
