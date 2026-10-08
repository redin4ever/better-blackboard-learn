// Preserve saved colors when updating or reloading the local repair.
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(null);
  const defaults = { colorscheme: 'default', theme: 'default', customprimary: 'default', customsecondary: 'default', customsidebar: 'default', customfont: 'default', courseImageMap: [], courseNameMap: [], matchSidebarToCourseCards: false };
  const missing = Object.fromEntries(Object.entries(defaults).filter(([key]) => !(key in existing)));
  if (Object.keys(missing).length) await chrome.storage.sync.set(missing);
});
