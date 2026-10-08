'use strict';

const domain = window.location.origin;
const defaults = {
    colorscheme: 'default', theme: 'default', customprimary: 'default',
    customsecondary: 'default', customsidebar: 'default', customfont: 'default',
    matchSidebarToCourseCards: false, courseImageMap: [], courseNameMap: []
};
let options = { ...defaults };
let started = false;
let loaded = false;
let earlyChanges = {};
let surfaceObserver = null;
let surfacesEnabled = false;
let scanQueued = false;
const markedSurfaces = new Set();
const scanRoots = new Set();
const gradeTextStyles = new Map();
let gradeAccent = '#e7e7e7';
const themeKeys = new Set(Object.keys(defaults));
const knownBlackboard = window.location.hostname === 'vle.iau.edu.sa' ||
    window.location.hostname.endsWith('.blackboard.com');

const pdfRoots = '.pdfViewer, .pdf-viewer, pdf-viewer, #viewerContainer, .textLayer, .annotationLayer, .canvasWrapper, .react-pdf__Document, .react-pdf__Page, .rpv-core__viewer, .document-viewer, .documentViewer, .file-preview, [data-testid="pdf-viewer"], [data-test-id="pdf-viewer"], [data-analytics-id*="pdf-viewer" i], [class*="pdf-viewer" i], [class*="pdfviewer" i]';
const outsidePDF = `:not(:where(${pdfRoots}, :is(${pdfRoots}) *))`;

function isPDFDocument() {
    const pathname = window.location.pathname || '';
    if (document.contentType === 'application/pdf' || /\.pdf$/i.test(pathname)) return true;
    // An embedded viewer document must not receive themes, fonts or course styles.
    const viewer = document.querySelector(pdfRoots);
    return Boolean(viewer && (window.top !== window || !/^\/ultra(?:\/|$)/.test(pathname)));
}

function clearDocumentStyles() {
    updateSurfaceFix(false);
    for (const id of ['bbl-theme', 'bbl-font', 'bbl-banners', 'bbl-names']) setSheet(id, '');
}

function splitSelectors(value) {
    const selectors = [];
    let start = 0, depth = 0, quote = '';
    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (char === '\\') { i++; continue; }
        if (quote) { if (char === quote) quote = ''; continue; }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === '(' || char === '[') depth++;
        else if (char === ')' || char === ']') depth--;
        else if (char === ',' && depth === 0) { selectors.push(value.slice(start, i)); start = i + 1; }
    }
    selectors.push(value.slice(start));
    return selectors;
}

function scopeThemeCSS(css) {
    // Theme CSS contains only flat rules. Exclude the viewer subtree on each
    // selector, including legacy span/bdi/svg rules and pseudo-elements.
    return css.replace(/([^{}]+)\{([^{}]*)\}/g, (_rule, selectors, declarations) => {
        const scoped = splitSelectors(selectors).map(selector => selector.trim().replace(
            /(::[\w-]+(?:\([^)]*\))?)?$/, (_suffix, pseudo = '') => outsidePDF + pseudo
        ));
        return scoped.join(',\n') + ' {' + declarations + '}';
    });
}

function validColor(value) {
    return typeof value === 'string' && value !== 'default' &&
        CSS.supports('color', value) && !/[;{}]/.test(value);
}

function color(value, fallback) {
    return validColor(value) ? value : fallback;
}

function setSheet(id, css) {
    const old = document.getElementById(id);
    if (!css) {
        if (old) old.remove();
        return;
    }
    const sheet = old || document.createElement('style');
    sheet.id = id;
    sheet.textContent = css;
    if (!old) (document.head || document.documentElement).appendChild(sheet);
}

// Blackboard changes generated class names. Detect neutral light UI backgrounds
// as a fallback, while keeping media, banners and authored/editor content intact.
const surfaceExclusions = 'script, style, link, img, picture, svg, canvas, video, iframe, embed, object, [contenteditable="true"], .vtbegenerated, .course-banner, [class*="course-banner"], [data-bbl-preserve], ' + pdfRoots;
const gradeValueRoots = '.grade-input-display, .points-text, .grade-pill, .customGradePill, .readonly-pill, bb-grade-pill, bb-grading-schema, [class*="gradePill" i], [class*="grade-pill"], [class*="grade-input-display"]';
const gradeTextExclusions = surfaceExclusions.replace(', svg,', ',');

function rgbColor(value) {
    if (typeof value !== 'string') return null;
    const named = { white: '#ffffff', black: '#000000', orange: '#ffa500' };
    value = named[value.toLowerCase()] || value;
    const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
    if (hex) {
        const digits = hex[1].length === 3 ? [...hex[1]].map(char => char + char).join('') : hex[1];
        return [0, 2, 4].map(index => parseInt(digits.slice(index, index + 2), 16)).concat(1);
    }
    const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(value);
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])] : null;
}

function luminance(rgb) {
    const linear = rgb.slice(0, 3).map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}

function contrast(first, second) {
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

function gradeForeground(element) {
    // The same component can be an outlined dark pill or a filled status pill.
    // Read the closest opaque background instead of forcing the accent on both.
    for (let current = element; current?.nodeType === 1; current = current.parentElement) {
        const background = rgbColor(getComputedStyle(current).backgroundColor);
        if (!background || background[3] < .95) continue;
        const accent = rgbColor(gradeAccent);
        if (accent && contrast(accent, background) >= 4.5) return gradeAccent;
        return contrast([17, 17, 17], background) >= contrast([255, 255, 255], background) ? '#111111' : '#ffffff';
    }
    return gradeAccent;
}

function setGradeForeground(element) {
    let saved = gradeTextStyles.get(element);
    if (!saved) { saved = {}; gradeTextStyles.set(element, saved); }
    const foreground = gradeForeground(element);
    const properties = { color: foreground, '-webkit-text-fill-color': foreground,
        filter: 'none', '-webkit-filter': 'none', opacity: '1' };
    if (/^(text|tspan)$/i.test(element.tagName)) properties.fill = foreground;
    for (const [property, value] of Object.entries(properties)) {
        const current = element.style.getPropertyValue(property);
        const priority = element.style.getPropertyPriority(property);
        const previous = saved[property];
        if (!previous || current !== previous.applied || priority !== 'important') {
            saved[property] = { value: current, priority, applied: value };
        } else previous.applied = value;
        if (current !== value || priority !== 'important') element.style.setProperty(property, value, 'important');
    }
}

function restoreGradeForeground(element) {
    const saved = gradeTextStyles.get(element);
    if (!saved) return;
    for (const [property, original] of Object.entries(saved)) {
        if (element.style.getPropertyValue(property) !== original.applied ||
            element.style.getPropertyPriority(property) !== 'important') continue;
        if (original.value) element.style.setProperty(property, original.value, original.priority);
        else element.style.removeProperty(property);
    }
    gradeTextStyles.delete(element);
}

function fixGradeText(root) {
    if (!surfacesEnabled || !root.isConnected) return;
    const candidates = [root, ...root.querySelectorAll('*')];
    for (const element of candidates) {
        if (element.closest(gradeTextExclusions)) {
            restoreGradeForeground(element);
            continue;
        }
        const gradesRegion = /^\/ultra\/.*grades(?:\/|$)/.test(window.location.pathname || '') ||
            element.closest('.base-grades, .base-grades-wrapper, .base-grades-term-wrapper, .grades-list');
        const score = (element.textContent || '').replace(/\s+/g, ' ').trim();
        const scoreValue = gradesRegion && /^(?:[-\u2013\u2014]{1,3}|\d+(?:[.,]\d+)?)\s*\/\s*\d+(?:[.,]\d+)?$/.test(score);
        if (!element.matches(gradeValueRoots) && !scoreValue) continue;
        setGradeForeground(element);
        for (const child of element.querySelectorAll('*')) {
            // SVG paths keep their icon fills. Only SVG text needs an explicit fill.
            if (child.closest(pdfRoots) || /^(canvas|img|video|iframe|embed|object|path)$/i.test(child.tagName)) continue;
            setGradeForeground(child);
        }
    }
    for (const element of gradeTextStyles.keys()) if (!element.isConnected) gradeTextStyles.delete(element);
}

function lightNeutralBackground(value) {
    const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(value);
    if (!match) return false;
    const channels = match.slice(1, 4).map(Number);
    const opacity = match[4] === undefined ? 1 : Number(match[4]);
    return opacity >= 0.8 && Math.min(...channels) >= 180 &&
        Math.max(...channels) - Math.min(...channels) <= 30;
}

function lightNeutralPattern(image) {
    if (!/^(?:repeating-)?(?:linear|radial|conic)-gradient\(/.test(image) || /url\(/i.test(image)) return false;
    const colors = image.match(/rgba?\([^)]*\)/g) || [];
    return colors.length >= 2 && colors.every(lightNeutralBackground);
}

function isGradePlaceholder(element) {
    const gradesPage = /^\/ultra\/grades(?:\/|$)/.test(window.location.pathname || '') ||
        element.closest('.base-grades, .base-grades-wrapper, .base-grades-term-wrapper, .grades-list');
    if (!gradesPage) return false;
    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length < 300 && /when grades are available for this course|your recently graded work will appear here/i.test(text);
}

function markLightSurfaces(root) {
    if (!surfacesEnabled || root.nodeType !== 1 || !root.isConnected) return;
    fixGradeText(root);
    const candidates = [root, ...root.querySelectorAll('*')];
    // Finish computed-style reads before applying attributes to avoid repeated layouts.
    const pending = [];
    for (const element of candidates) {
        if (element.closest(surfaceExclusions)) {
            // A previously ordinary panel can become a PDF viewer after a class
            // change. Restore its background along with all marked descendants.
            if (markedSurfaces.delete(element)) {
                element.removeAttribute('data-bbl-surface');
                element.removeAttribute('data-bbl-pattern');
            }
            continue;
        }
        if (markedSurfaces.has(element)) continue;
        const style = getComputedStyle(element);
        const patterned = lightNeutralPattern(style.backgroundImage) ||
            (style.backgroundImage !== 'none' && isGradePlaceholder(element));
        if (style.display !== 'none' && (patterned ||
            (style.backgroundImage === 'none' && lightNeutralBackground(style.backgroundColor)))) pending.push([element, patterned]);
    }
    for (const [element, patterned] of pending) {
        element.setAttribute('data-bbl-surface', 'light');
        if (patterned) element.setAttribute('data-bbl-pattern', 'true');
        markedSurfaces.add(element);
    }
    for (const element of markedSurfaces) if (!element.isConnected) markedSurfaces.delete(element);
}

function queueSurfaceScan(root) {
    if (!surfacesEnabled || !root || root.nodeType !== 1) return;
    scanRoots.add(root);
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
        scanQueued = false;
        if (!surfacesEnabled) return;
        const roots = [...scanRoots];
        scanRoots.clear();
        for (const element of roots) {
            if (!roots.some(other => other !== element && other.contains(element))) markLightSurfaces(element);
        }
    });
}

function updateSurfaceFix(enabled) {
    surfacesEnabled = enabled;
    if (!enabled) {
        if (surfaceObserver) surfaceObserver.disconnect();
        surfaceObserver = null;
        scanRoots.clear();
        for (const element of gradeTextStyles.keys()) restoreGradeForeground(element);
        for (const element of markedSurfaces) {
            element.removeAttribute('data-bbl-surface');
            element.removeAttribute('data-bbl-pattern');
        }
        markedSurfaces.clear();
        return;
    }
    if (surfaceObserver || !document.body) return;
    markLightSurfaces(document.body);
    surfaceObserver = new MutationObserver(records => {
        if (isPDFDocument()) { clearDocumentStyles(); return; }
        for (const record of records) {
            if (record.type === 'attributes') queueSurfaceScan(record.target);
            else for (const node of record.addedNodes) queueSurfaceScan(node.nodeType === 1 ? node : record.target);
        }
    });
    surfaceObserver.observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style']
    });
}

// Late-loading site styles may reveal additional white backgrounds.
document.addEventListener('load', event => {
    if (event.target?.tagName === 'LINK') queueSurfaceScan(document.body);
}, true);

function renderTheme() {
    const preset = options.theme && typeof options.theme === 'object' ? options.theme : {};
    const dark = options.colorscheme === 'dark';
    const active = dark || [preset.primary, preset.accent, preset.sidebar,
        options.customprimary, options.customsecondary, options.customsidebar].some(validColor);
    if (!active) {
        updateSurfaceFix(false);
        setSheet('bbl-theme', '');
        return;
    }
    // One sheet gives dark mode, presets and custom overrides a deterministic order.
    const primary = color(options.customprimary, color(preset.primary, dark ? '#1f1f1f' : '#ffffff'));
    const accent = color(options.customsecondary, color(preset.accent, dark ? '#e7e7e7' : '#222222'));
    gradeAccent = accent;
    const sidebar = color(options.customsidebar, color(preset.sidebar, dark ? '#161515' : '#102d70'));
    const matchedCard = options.matchSidebarToCourseCards ? sidebar : primary;
    const css = legacyThemeCSS(primary, accent, sidebar, 'theme') + `
      :root { --bbl-primary: ${primary}; --bbl-accent: ${accent}; --bbl-sidebar: ${sidebar}; }
      html, body, #main-content, #content, #contentPanel, .contentPane, .contentBox,
      .locationPane, .base-content, .base-courses, .base-grades, .base-recent-activity,
      .base-profile, .base-calendar, .base-messages, .base-courses-header-container,
      .inner-wrap, .shadow, .portlet, .portlet .content, .portlet h2,
      .stream-item-container, .element-card, .element-details, .calendar-wrapper,
      .vtbegenerated, .dbThread, .db-message, .main-column, .panel,
      .MuiPaper-root, [class*="MuiPaperroot-"], .MuiDialog-paper,
      .MuiDrawer-paper, .MuiTableCell-root, .MuiList-root, .MuiCard-root {
        background-color: ${primary} !important; color: ${accent} !important;
      }
      :root body [data-bbl-surface="light"][data-bbl-surface="light"] {
        background-color: ${primary} !important; color: ${accent} !important;
        border-color: ${dark ? '#454545' : accent} !important;
      }
      :root body [data-bbl-surface="light"][data-bbl-pattern="true"] {
        background-image: none !important;
      }
      h1, h2, h3, h4, h5, h6, p, label, bdi, bb-translate, span,
      a, a:visited, .js-course-title-element, .multi-column-course-id,
      .stream-item-container .content, .element-details .name,
      .MuiTypography-root, [class*="makeStylesbaseText-"], .MuiSvgIcon-root {
        color: ${accent} !important;
      }
      input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]),
      textarea, select, .MuiInputBase-root, .MuiOutlinedInput-root, .MuiSelect-select {
        background-color: ${primary} !important; color: ${accent} !important;
        border-color: ${accent} !important;
      }
      input::placeholder, textarea::placeholder { color: ${accent} !important; opacity: .65; }
      .grade-input-display, .grade-input-display span, .grade-input-display bdi,
      .points-text, .points-text span, .points-text bdi {
        color: ${accent} !important;
      }
      :root body .wrapping-input-style.pill-style, .points-text {
        border-color: ${accent} !important;
      }
      /* Only the outer score pill needs a border. Inner values must not gain
         rectangular outlines when the theme recolors their border color. */
      :root body .grade-input-display > bdi,
      :root body .grade-input-display > span:not(.sr-only),
      :root body .grade-input-display input:not(:focus-visible),
      :root body .wrapping-input-style.readonly.pill-style > div,
      :root body .wrapping-input-style.readonly.pill-style .grade-input-display,
      :root body .wrapping-input-style.readonly.pill-style .grade-input-display *,
      :root body .wrapping-input-style.readonly.pill-style .grade-input-display::before,
      :root body .wrapping-input-style.readonly.pill-style .grade-input-display::after,
      :root body .points-text bdi,
      :root body .points-text span {
        border: 0 !important;
        outline: none !important;
        box-shadow: none !important;
      }
      /* The ungraded placeholder is a separate component state. Reset its
         rendering effects on both the pill and the actual -- text node. */
      :root body .grade-input-display.grade-ellipsis,
      :root body .grade-input-display.grade-ellipsis > bdi,
      :root body .grade-input-display.grade-ellipsis > bdi::before,
      :root body .grade-input-display.grade-ellipsis > bdi::after {
        color: ${accent} !important;
        -webkit-text-fill-color: ${accent} !important;
        filter: none !important;
        -webkit-filter: none !important;
        opacity: 1 !important;
        text-shadow: none !important;
      }
      /* Floating select labels cover the border notch. Match the field surface
         rather than leaving the site's white label backing visible. */
      fieldset > legend, fieldset > legend > span,
      .MuiInputLabel-root, [class*="MuiInputLabelroot-"], [class*="MuiFormLabelroot-"],
      [class*="MuiInputLabelroot-"] > span, [class*="MuiFormLabelroot-"] > span,
      .filter-wrapper label, .filter-wrapper label > span,
      .filter-wrapper legend, .filter-wrapper legend > span {
        background-color: ${primary} !important;
        background-image: none !important;
        color: ${accent} !important;
      }
      .MuiInputLabel-root::before, .MuiInputLabel-root::after,
      [class*="MuiInputLabelroot-"]::before, [class*="MuiInputLabelroot-"]::after,
      [class*="MuiFormLabelroot-"]::before, [class*="MuiFormLabelroot-"]::after,
      .filter-wrapper label::before, .filter-wrapper label::after,
      fieldset > legend::before, fieldset > legend::after {
        background-color: ${primary} !important;
        background-image: none !important;
      }
      #base_tools, #base_tools li, #base_tools a, #navigationPane,
      #courseMenuPalette_contents, #courseMenuPalette_contents a,
      [data-analytics-id="base.navigation.drawer"],
      [data-analytics-id="base.navigation.drawer"] .MuiPaper-root {
        background-color: ${sidebar} !important; color: #ffffff !important;
      }
      #base_tools span, #base_tools bdi, #base_tools bb-translate,
      #courseMenuPalette_contents span { color: #ffffff !important; }
      .element-card .element-details.summary { background-color: ${matchedCard} !important; }
      .element-card .course-banner { background-color: ${matchedCard} !important; }
    `;
    setSheet('bbl-theme', scopeThemeCSS(css));
    for (const element of gradeTextStyles.keys()) setGradeForeground(element);
    updateSurfaceFix(true);
}

function renderFont() {
    const font = options.customfont;
    if (typeof font !== 'string' || !font.trim() || font === 'default') {
        setSheet('bbl-font', '');
        return;
    }
    const query = encodeURIComponent(font.trim()).replace(/%20/g, '+');
    // Apply fonts to text elements directly, avoiding inheritance from body into
    // PDF toolbars and transparent text overlays.
    const selectors = ['button', 'input', 'textarea', 'select', 'bdi', 'bb-translate', 'span', 'a', 'p', 'li', 'label', 'h1', 'h2', 'h3', 'h4'];
    setSheet('bbl-font', `@import url("https://fonts.googleapis.com/css2?family=${query}&display=swap");
        ${selectors.map(selector => selector + outsidePDF).join(', ')} { font-family: ${JSON.stringify(font.trim())}, sans-serif !important; }`);
}

function pairs(value) {
    return Array.isArray(value) ? value.filter(item => Array.isArray(item) && item.length >= 2) : [];
}

function renderCourses() {
    const banners = pairs(options.courseImageMap).map(([id, url]) => {
        if (!id || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return '';
        return `.element-card[data-course-id="${CSS.escape(String(id))}"] .course-banner {
            background-image: url(${JSON.stringify(url)}) !important; }`;
    }).join('\n');
    const names = pairs(options.courseNameMap).map(([id, name]) => {
        if (!id || typeof name !== 'string' || !name || name === 'default') return '';
        const selector = `h4#${CSS.escape('course-name-' + id)}`;
        return `${selector} { visibility: hidden !important; position: relative !important; }
            ${selector}::after { content: ${JSON.stringify(name)} !important;
            visibility: visible !important; position: absolute; inset-inline-start: 0; top: 0; }`;
    }).join('\n');
    setSheet('bbl-banners', banners);
    setSheet('bbl-names', names);
}

function renderOptions() {
    if (isPDFDocument()) { clearDocumentStyles(); return; }
    renderTheme();
    renderFont();
    renderCourses();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    const patch = Object.fromEntries(Object.entries(changes).map(([key, change]) =>
        [key, change.newValue === undefined ? defaults[key] : change.newValue]));
    options = { ...options, ...patch };
    if (!loaded) earlyChanges = { ...earlyChanges, ...patch };
    if (started && loaded && Object.keys(changes).some(key => themeKeys.has(key))) renderOptions();
});

async function readJSON(url) {
    const response = await fetch(url, { credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Blackboard API unavailable');
    return response.json();
}

async function loadCourseList() {
    try {
        const user = await readJSON(domain + '/learn/api/v1/users/me');
        if (!user || typeof user.userName !== 'string' || !user.userName) return;
        const data = await readJSON(domain + '/learn/api/public/v1/users/userName:' + encodeURIComponent(user.userName) + '/courses');
        if (!Array.isArray(data.results)) return;
        const courseIds = data.results.map(item => item.courseId).filter(id => typeof id === 'string');
        const entries = await Promise.all(courseIds.map(async id => {
            try {
                const course = await readJSON(domain + '/learn/api/public/v1/courses/' + encodeURIComponent(id));
                return [course.courseId || course.name || id, id];
            } catch { return [id, id]; }
        }));
        await chrome.storage.sync.set({ courselist: courseIds, courseshortnames: entries.map(([name]) => name), courseIdMap: entries });
    } catch {
        // Course metadata is optional. API/login failures must never disable themes.
    }
}

function startExtension() {
    if (started || !knownBlackboard || isPDFDocument()) return;
    started = true;
    chrome.storage.sync.get(null, saved => {
        if (chrome.runtime.lastError) {
            console.warn('Better Blackboard: saved preferences could not be loaded.');
        }
        options = { ...defaults, ...saved, ...earlyChanges };
        earlyChanges = {};
        loaded = true;
        renderOptions();
    });
    if (window.top === window) void loadCourseList();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startExtension, { once: true });
} else {
    startExtension();
}

function legacyThemeCSS(primaryColor, secondaryColor, sidebarColor, classname) {
    let themecss = `
    bb-ui-icon-large-alert, bb-ui-icon-large-assignments.react-container, bb-ui-icon-large-announcement.react-container, bb-ui-icon-large-grades.react-container, bb-ui-icon-large-document-text.react-container, bb-ui-icon-large-kudos.react-container, bb-ui-icon-large-course.react-container {background: ${primaryColor} !important;} .inner-wrap, li.stream-item-container.notification-default:hover, .element-details.summary, .shadow, .base-profile .profile-content .user-information section ul .data-row, .base-profile .profile-content .user-settings section ul .data-row, .element-image, .element-card.tile.course-color-classic.base-grades-course-tile.active-course, .messages-header.js-course-skip-link-target.flex-container, .element-card.due-item.element-card-deadline.course-color-2, .element-card.element-card-deadline, .calendar-wrapper .element-card-container, .fc-time-grid-event {background: ${primaryColor} !important;} .MuiSvgIconfrontSizeLarge-0-2-66, svg.MuiSvgIconroot-0-2-58.makeStylesdirectionalIcon-0-2-57.makeStylesstrokeIcon-0-2-56.MuiSvgIconcolorPrimary-0-2-59.MuiSvgIconfontSizeLarge-0-2-66, .base-courses-header-container.base-header.themed-background-primary-medium-down.color-selection-live-mode, nav.term-navigator, svg.MuiSvgIconroot-0-2-58.makeStylesstrokeIcon-0-2-56.MuiSvgIconcolorPrimary-0-2-59.MuiSvgIconfontSizeLarge-0-2-66, .element-card.bar {background: ${primaryColor} !important} .MuiSvgIconcolorPrimary-0-2-59, .base-recent-activity .activity-stream .activity-group .stream-item .element-details .context a, .base-recent-activity .activity-stream .activity-group .stream-item .element-details .content, span.date, h2.activity-group-title, span.heading-date, span.time, h2, .js-course-title-element, .multi-column-course-id, span.banner__title-text, h3.subheader.module-wrapper__title, span.link-text, bdi.makeStylesbaseText-0-2-68, .makeStylesbaseText-0-2-138, bdi.makeStylesbaseText-0-2-149, .MuiSvgIconcolorPrimary-0-2-81, svg:not(:root), .calendar-wrapper .calendar-head-container .month-container .month a, .calendar-wrapper .calendar-week .week-letter, .calendar-wrapper .calendar-week .week-day button, .base-grades-wrapper .base-grades-term-wrapper .row.grades-header a, .base-grades-wrapper .base-grades-term-wrapper, .base-grades .grades-list .element-card .element-details .name a, h4.section-title, .messages-container-summary .messages-header .title a, .calendar-wrapper .fc-event-container .element-card .fc-title a, .calendar-wrapper .fc-event-container .element-card .course-link a {color:white !important;} a.js-title-link, h1#main-heading, bdi, span, bb-translate, .filter-wrapper, h3, .element-card .element-details .name a {color: ${secondaryColor} !important} span.grade-input-display.ready, span.points-text bdi, .points-text, span#filter-courses-value, .MuiButtonlabel-0-2-73 {color: ${secondaryColor} !important;} .base-recent-activity .activity-stream .activity-group .stream-item:hover:before {opacity: 0; background-color: transparent;}  a.link-list-component__link.-black, .bb-ui-content-icon, .MuiSvgIconcolorPrimary-0-2-58, .link-list-component.link-list-image-left {background: ${primaryColor} !important; color: ${secondaryColor} !important} bdi.makeStylesbaseText-0-2-45, bdi.makeStylesbaseText-0-2-79, bdi.makeStylesbaseText-0-2-90 {color: white !important;} [bb-click-to-invoke-child].child-is-invokable, svg:not(:root) {background: transparent !important;}
    #base_tools *:hover,
                #base_tools *:active,
                #base_tools *:focus {
                    transition: none !important;
                    transition-property: none !important;
                    transition-duration: 0s !important;
                    transition-delay: 0s !important;
                    transition-timing-function: none !important;
                    animation: none !important;
                }

                div[data-analytics-id="base.navigation.drawer"] > :first-child > :nth-child(2),
                div[data-analytics-id="base.navigation.drawer"] > :first-child > :nth-child(3) {
                    background: ${sidebarColor} !important;
                }

                header[role="banner"] > :first-child, 
                .color-selection-live-mode .themed-logo-background-primary-fill {
                    background-color: ${sidebarColor} !important;
                    padding: 0px;
                }
            
                /* Force your hover color - target existing elements */
                #base_tools a:hover,
                #base_tools li:hover > a,
                #base_tools li:hover .MuiButtonBase-root {
                    background: ${sidebarColor} !important;
                    filter: brightness(1.5);
                }

                /* Active state */
                #base_tools a.active,
                #base_tools a[class*="active"],
                #base_tools li.active > a {
                    background: ${sidebarColor} !important;
                    filter: brightness(1.3);
                }

                .color-selection-live-mode .themed-background-primary-fill-only, .color-selection-live-mode.themed-background-primary-fill-only, .color-selection-live-mode .themed-background-primary-alt-fill-only.disabled:hover, .color-selection-live-mode .integration-navigation-button-content.themed-background-primary-alt-fill-only, .color-selection-live-mode .integration-navigation-button-content-v2.themed-background-primary-alt-fill-only {
                  border: ${sidebarColor} 0px solid
                }

                .react-container {
                  background: ${sidebarColor}
                }
                  
                .element-details.summary {
                    background: ${sidebarColor} !important;
                }`;
    return themecss;
}

