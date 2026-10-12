var title = document.getElementById('header');
var mainoptions = document.getElementById('main-options');
var cardoptions = document.getElementById('card-options');
var customthemeoptions = document.getElementById('custom-theme-options');
var presetthemeoptions = document.getElementById('preset-theme-options');
var fontoptions = document.getElementById('font-options');
var reportissueoptions = document.getElementById('report-issue-options');
var colorscheme = 'default';
var courseCardsMatchSidebar;

var courseImageMap = new Map();
var courseNameMap = new Map();

/* Traversing Menus */
document.getElementById('custom-fonts-button').onclick = function() {
  title.style.display = 'none';
  mainoptions.style.display = 'none';
  fontoptions.style.display = 'flex';
}

document.getElementById("preset-themes-button").onclick = function() {
  title.style.display = 'none';
  mainoptions.style.display = 'none';
  presetthemeoptions.style.display = 'flex';
}

document.getElementById("custom-themes-button").onclick = function() {
  title.style.display = 'none';
  mainoptions.style.display = 'none';
  customthemeoptions.style.display = 'flex';
}

document.getElementById("report-issue-button").onclick = function() {
  title.style.display = 'none';
  mainoptions.style.display = 'none';
  reportissueoptions.style.display = 'flex';
}

document.getElementById("custom-cards-button").onclick = function() {
  title.style.display = 'none';
  mainoptions.style.display = 'none';
  cardoptions.style.display = 'flex';

// Function to fill courses dropdown button
function insertCoursesDropdown(courseshortnames, courseIdMap) {
  var select = document.getElementById("card-options-select");
  
  select.replaceChildren(select.options[0]);
  for (let i = 0; i < courseshortnames.length; i++) {
      var option = document.createElement('option');
      option.textContent = courseshortnames[i];
      option.value = courseIdMap.get(courseshortnames[i]);
      select.appendChild(option);
  }
}

chrome.storage.sync.get(['courseshortnames', 'courseIdMap'], result => {
  if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
  }

  var options = result;
  if (options && options.courseshortnames && options.courseIdMap) {
      insertCoursesDropdown(options.courseshortnames, new Map(options.courseIdMap));
  } else {
      console.error('Failed to retrieve data from storage.');
  }
});
}

/* Custom Banner & Course Names */
chrome.storage.sync.get('courseImageMap', result => {
  if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
  }
  if (Array.isArray(result.courseImageMap)) {
      courseImageMap = new Map(result.courseImageMap);
  }
});
chrome.storage.sync.get('courseNameMap', result => {
  if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
  }
  if (Array.isArray(result.courseNameMap)) {
      courseNameMap = new Map(result.courseNameMap);
  }
});

/* Confirm Image Validity and Apply */
document.getElementById('save-banner-options').onclick = function() {
  var linkInput = document.getElementById('card-options-link').value;
  var nameInput = document.getElementById('card-options-name').value;
  var dropdownInput = document.getElementById('card-options-select').value;

  if (nameInput !== "") {
    courseNameMap.set(dropdownInput, nameInput);
  }

  if (linkInput !== "" && linkInput !== "none") {
    let loadImagePromise = new Promise((resolve, reject) => {
      let testImage = new Image();
      testImage.src = linkInput;
      testImage.onload = function() {
        resolve();
      };
      testImage.onerror = function() {
        reject(new Error("Oops! The image link seems to be broken. Please right-click on the image and select 'Copy image address' to get the correct link."));
      };
    });

    loadImagePromise.then(() => {
      courseImageMap.set(dropdownInput, linkInput);
      chrome.storage.sync.set({'courseImageMap': [...courseImageMap]});
    }).catch(error => {
      alert(error.message);
    });
  }

      chrome.storage.sync.set({'selectedcourse': dropdownInput});
      chrome.storage.sync.set({'coursebannerlink': linkInput});
      chrome.storage.sync.set({'coursecardname' : nameInput});
      chrome.storage.sync.set({'courseNameMap': [...courseNameMap]});

      title.style.display = 'block';
      mainoptions.style.display = 'block';
      cardoptions.style.display = 'none';
}

/* Reset Images back to default blackboard values */
document.getElementById('reset-banner-options').onclick = function() {
  chrome.storage.sync.set({'coursebannerlink': 'default'});
  chrome.storage.sync.set({ coursecardname: 'default', courseImageMap: [], courseNameMap: [] });

  title.style.display = 'block';
  mainoptions.style.display = 'block';
  cardoptions.style.display = 'none';
}

/* Dark Theme Toggle */
document.addEventListener('DOMContentLoaded', function() {
    const darkButton = document.getElementById('dark-theme-button');

    // Safety check
    if (!darkButton) return;

    // Set initial state from storage
    chrome.storage.sync.get('colorscheme', function(data) {
        const colorscheme = data.colorscheme || 'default';
        if (colorscheme === 'dark') {
            darkButton.classList.add('active');
        } else {
            darkButton.classList.remove('active');
        }
    });

    // Toggle dark mode on click
    darkButton.onclick = function() {
        chrome.storage.sync.get('colorscheme', function(data) {
            let colorscheme = data.colorscheme || 'default';

            if (colorscheme === 'default') {
                chrome.storage.sync.set({ colorscheme: 'dark', theme: 'default', customprimary: 'default', customsecondary: 'default', customsidebar: 'default' });
                darkButton.classList.add('active');
            } else {
                chrome.storage.sync.set({ 'colorscheme': 'default' });
                darkButton.classList.remove('active');
            }
        });
    };
});

/* Preset Custom Themes */
const presetThemes = [
  { name: "Luna", primary: "#5a3a7e", accent: "#f67599", sidebar: "#3f2859" },
  { name: "Nightfall", primary: "#232323", accent: "#d82934", sidebar: "#141414" },
  { name: "Midnight", primary: "#030f28", accent: "orange", sidebar: "#020918" },
  { name: "Cyber", primary: "#030f28", accent: "#00ce7c", sidebar: "#02101f" },
  { name: "Joker", primary: "#321a47", accent: "#99de1e", sidebar: "#20112f" },
  { name: "Horizon", primary: "#1f1f1f", accent: "#f2c17b", sidebar: "#121212" },
  { name: "Melon", primary: "#1f4437", accent: "#d6686f", sidebar: "#142c23" },
  { name: "Botanical", primary: "#7b9c98", accent: "#101e1c", sidebar: "#4f6f6b" },

  { name: "Flare", primary: "#cd4412", accent: "#ffd93c", sidebar: "#8a2d0c" },
  { name: "Ocean", primary: "#012e40", accent: "#00b4d8", sidebar: "#011d29" },
  { name: "Aurora", primary: "#0d1b2a", accent: "#00ff94", sidebar: "#08121d" },
  { name: "Candy", primary: "#ff79c6", accent: "#fff5b7", sidebar: "#c84f9b" },
  { name: "Storm", primary: "#2e2f3e", accent: "#9d00ff", sidebar: "#1e1f2a" },
  { name: "Forest", primary: "#1b3b1b", accent: "#7bc950", sidebar: "#112611" },
  { name: "Retro Neon", primary: "#3a2e49", accent: "#ff00ff", sidebar: "#241d30" },
  { name: "Gruvbox", primary: "#282828", accent: "#fabd2f", sidebar: "#1d2021" }
];

const themeContainer = document.getElementById("preset-theme-buttons");
presetThemes.forEach(theme => {
  const btn = document.createElement("button");
  btn.textContent = theme.name;
  btn.style.background = theme.primary;
  btn.style.color = theme.accent;
  btn.classList.add("theme-buttons");

  btn.addEventListener("click", () => {
    chrome.storage.sync.set({ theme: { primary: theme.primary, accent: theme.accent, sidebar: theme.sidebar }, customprimary: 'default', customsecondary: 'default', customsidebar: 'default' });
  });

  themeContainer.appendChild(btn);
});
document.getElementById('remove-preset-theme-button').onclick = function() {
  chrome.storage.sync.set({'theme' : 'default'});
  title.style.display = 'block';
  mainoptions.style.display = 'block';
  presetthemeoptions.style.display = 'none';
}
document.getElementById('save-preset-theme-button').onclick = function() {
  title.style.display = 'block';
  mainoptions.style.display = 'block';
  presetthemeoptions.style.display = 'none';
}

/* Color Pickers + Checkbox */
var primarycolorPicker = document.getElementById('primary-color-input');
var primaryText = document.getElementById('primary-color-text');
primarycolorPicker.addEventListener('input', function() {
  primaryText.value = primarycolorPicker.value.toUpperCase();
});
primaryText.addEventListener('input', function() {
  if (/^#[0-9a-f]{6}$/i.test(primaryText.value)) primarycolorPicker.value = primaryText.value;
});

var secondarycolorPicker = document.getElementById('secondary-color-input');
var secondaryText = document.getElementById('secondary-color-text');
secondarycolorPicker.addEventListener('input', function() {
  secondaryText.value = secondarycolorPicker.value.toUpperCase();
});
secondaryText.addEventListener('input', function() {
  if (/^#[0-9a-f]{6}$/i.test(secondaryText.value)) secondarycolorPicker.value = secondaryText.value;
});

var sidebarcolorPicker = document.getElementById('sidebar-color-input');
var sidebarText = document.getElementById('sidebar-color-text');
sidebarcolorPicker.addEventListener('input', function() {
  sidebarText.value = sidebarcolorPicker.value.toUpperCase();
});
sidebarText.addEventListener('input', function() {
  if (/^#[0-9a-f]{6}$/i.test(sidebarText.value)) sidebarcolorPicker.value = sidebarText.value;
});
chrome.storage.sync.get('matchSidebarToCourseCards', function(result) {
  courseCardsMatchSidebar = result.matchSidebarToCourseCards || false;
  document.getElementById('match-sidebar-to-courses').checked = courseCardsMatchSidebar;
});
document.getElementById('match-sidebar-to-courses').onclick = function() {
  courseCardsMatchSidebar = !courseCardsMatchSidebar;
  chrome.storage.sync.set({'matchSidebarToCourseCards': document.getElementById('match-sidebar-to-courses').checked});
}

/* User-Made Custom Theme */
document.getElementById('primary-color-button').onclick = function() {
  chrome.storage.sync.set({'customprimary' : primarycolorPicker.value});
}
document.getElementById('secondary-color-button').onclick = function() {
  chrome.storage.sync.set({'customsecondary' : secondarycolorPicker.value});
} 
document.getElementById('sidebar-color-button').onclick = function() {
  chrome.storage.sync.set({'customsidebar' : sidebarcolorPicker.value});
} 

document.getElementById('remove-custom-theme-button').onclick = function() {
  chrome.storage.sync.get(['defaultPrimary', 'defaultSecondary', 'defaultSidebar'], function(result) {
    var defaultPrimary = result.defaultPrimary || '#1F1F1F';
    var defaultSecondary = result.defaultSecondary || '#FFFFFF';
    var defaultSidebar = result.defaultSidebar || '#102D70';

    primarycolorPicker.value = defaultPrimary;
    document.getElementById('primary-color-text').value = defaultPrimary;

    secondarycolorPicker.value = defaultSecondary;
    document.getElementById('secondary-color-text').value = defaultSecondary;

    sidebarcolorPicker.value = defaultSidebar;
    document.getElementById('sidebar-color-text').value = defaultSidebar;

    // Save 'default' values to Chrome storage
    chrome.storage.sync.set({'customprimary': 'default'});
    chrome.storage.sync.set({'customsecondary': 'default'});
    chrome.storage.sync.set({'customsidebar': 'default'});
  });

  // Display relevant elements
  title.style.display = 'block';
  mainoptions.style.display = 'block';
  customthemeoptions.style.display = 'none';
}

document.getElementById('save-custom-theme-button').onclick = function() {
  chrome.storage.sync.set({
    customprimary: primarycolorPicker.value, customsecondary: secondarycolorPicker.value, customsidebar: sidebarcolorPicker.value,
    primaryColor: primarycolorPicker.value, secondaryColor: secondarycolorPicker.value, sidebarColor: sidebarcolorPicker.value,
    matchSidebarToCourseCards: document.getElementById('match-sidebar-to-courses').checked
  });
  title.style.display = 'block';
  mainoptions.style.display = 'block';
  customthemeoptions.style.display = 'none';
}

/* Custom Font Buttons */
const presetFonts = [
  { label: "Pixelify", family: "Pixelify Sans" },
  { label: "Kanit", family: "Kanit" },
  { label: "Anta", family: "Anta" },
  { label: "Rubik", family: "Rubik" },
  { label: "Open", family: "Open Sans" },
  { label: "Roboto", family: "Roboto Mono" },
  { label: "Space", family: "Space Mono" },
  { label: "Eczar", family: "Eczar Handgloves" },
  { label: "Fira", family: "Fira Sans Handgloves" },
  { label: "Bungee", family: "Bungee" },
  { label: "Slab", family: "Roboto Slab" },
  { label: "Poppins", family: "Poppins" },
  { label: "Montserrat", family: "Montserrat" },
  { label: "Comfort", family: "Comfortaa" },
  { label: "Quicksand", family: "Quicksand" },
  { label: "Nunito", family: "Nunito" }
];

const fontButtons = document.getElementById('custom-font-buttons');
fontButtons.textContent = "";

presetFonts.forEach(font => {
  const btn = document.createElement("button");

  btn.textContent = font.label;
  btn.dataset.font = font.family;
  btn.style.fontFamily = `'${font.family}', sans-serif`;

  fontButtons.appendChild(btn);
});

fontButtons.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const font = btn.dataset.font;
  if (!font) return;

  setCustomFont(font);

  // Reflect in text input
  const input = document.getElementById("user-custom-font");
  if (input) input.value = font;
});

function setCustomFont(fontName) {
  chrome.storage.sync.set({ customfont: fontName });
}

function applyCustomFont() {
  let custom = document.getElementById('user-custom-font').value;
  if (custom) {
    chrome.storage.sync.set({'customfont': custom});
  }
}

// Menu Traversal for Font Options
document.getElementById('remove-font').onclick = () => {
  setCustomFont('default');
  title.style.display = 'block';
  mainoptions.style.display = 'block';
  fontoptions.style.display = 'none';
};
document.getElementById('save-font-options').onclick = function() {
  applyCustomFont();
  title.style.display = 'block';
  mainoptions.style.display = 'block';
  fontoptions.style.display = 'none';
}

/* Give Feeback Button */
document.getElementById("return-to-menu-options").onclick = function() {
  document.body.style.height = '370px';
  reportissueoptions.style.display = 'none';
  title.style.display = 'block';
  mainoptions.style.display = 'block';
}

// Function to apply custom theme to popup
function applyCustomThemeToPopup() {
  chrome.storage.sync.get(['customprimary', 'customsecondary', 'customsidebar', 'primaryColor', 'secondaryColor', 'sidebarColor'], function(saved) {
    if (chrome.runtime.lastError) {
      console.warn('Better Blackboard: color preferences could not be loaded.');
      return;
    }
    const fields = [
      ['primary', primarycolorPicker, '#1F1F1F'],
      ['secondary', secondarycolorPicker, '#FFFFFF'],
      ['sidebar', sidebarcolorPicker, '#102D70']
    ];
    for (const [name, picker, fallback] of fields) {
      const custom = saved['custom' + name];
      const legacy = saved[name + 'Color'];
      const value = /^#[0-9a-f]{6}$/i.test(custom) ? custom : /^#[0-9a-f]{6}$/i.test(legacy) ? legacy : fallback;
      picker.value = value;
      document.getElementById(name + '-color-text').value = value;
    }
  });
}


document.addEventListener('DOMContentLoaded', function() {
  applyCustomThemeToPopup();
});

document.getElementById('primary-color-button').addEventListener('click', function() {
  var primaryColor = primarycolorPicker.value;
  chrome.storage.sync.set({'primaryColor': primaryColor}, function() {
    applyCustomThemeToPopup();
  });
});

document.getElementById('secondary-color-button').addEventListener('click', function() {
  var secondaryColor = secondarycolorPicker.value;
  chrome.storage.sync.set({'secondaryColor': secondaryColor}, function() {
    applyCustomThemeToPopup();
  });
});

document.getElementById('sidebar-color-button').addEventListener('click', function() {
  var sidebarColor = sidebarcolorPicker.value;
  chrome.storage.sync.set({'sidebarColor': sidebarColor}, function() {
    applyCustomThemeToPopup();
  });
});

function updateColor(input) {
  var color = input.value;
  var colorTextId = input.id.replace("-input", "-text");
  document.getElementById(colorTextId).value = color;
}

// Blackboard website scrollbar preferences.
const scrollbarDefaults = { scrollbarMode: 'default', scrollbarWidth: 'thin', scrollbarThumb: '#808080', scrollbarTrack: '#1f1f1f' };
const pdfScrollbarDefaults = { pdfScrollbarMode: 'default', pdfScrollbarWidth: 'thin', pdfScrollbarThumb: '#808080', pdfScrollbarTrack: '#1f1f1f' };
const scrollbarTarget = document.getElementById('scrollbar-target');
const scrollbarPanel = document.getElementById('scrollbar-options');
const scrollbarMode = document.getElementById('scrollbar-mode');
const scrollbarWidth = document.getElementById('scrollbar-width');
const scrollbarThumb = document.getElementById('scrollbar-thumb');
const scrollbarTrack = document.getElementById('scrollbar-track');

function showScrollbarControls() {
  document.getElementById('scrollbar-appearance').hidden = !['theme', 'custom'].includes(scrollbarMode.value);
  document.getElementById('scrollbar-colors').hidden = scrollbarMode.value !== 'custom';
}

function fillScrollbarControls(saved) {
  if (scrollbarTarget.value === 'pdf') {
    saved = Object.fromEntries(Object.keys(scrollbarDefaults).map(key => [key, saved['pdf' + key[0].toUpperCase() + key.slice(1)]]));
  }
  scrollbarMode.value = ['default', 'theme', 'custom', 'hidden'].includes(saved.scrollbarMode) ? saved.scrollbarMode : 'default';
  scrollbarWidth.value = saved.scrollbarWidth === 'normal' ? 'normal' : 'thin';
  scrollbarThumb.value = /^#[0-9a-f]{6}$/i.test(saved.scrollbarThumb) ? saved.scrollbarThumb : scrollbarDefaults.scrollbarThumb;
  scrollbarTrack.value = /^#[0-9a-f]{6}$/i.test(saved.scrollbarTrack) ? saved.scrollbarTrack : scrollbarDefaults.scrollbarTrack;
  showScrollbarControls();
}

function closeScrollbarOptions() {
  scrollbarPanel.style.display = 'none';
  title.style.display = 'block';
  mainoptions.style.display = 'block';
}

document.getElementById('scrollbar-button').onclick = function() {
  title.style.display = 'none';
  mainoptions.style.display = 'none';
  scrollbarPanel.style.display = 'flex';
  scrollbarTarget.value = 'website';
  loadScrollbarControls();
};
function loadScrollbarControls() {
  chrome.storage.sync.get([...Object.keys(scrollbarDefaults), ...Object.keys(pdfScrollbarDefaults)], saved => { fillScrollbarControls(saved); });
}
scrollbarTarget.addEventListener('change', loadScrollbarControls);
scrollbarMode.addEventListener('change', showScrollbarControls);
document.getElementById('save-scrollbar').onclick = function() {
  const values = { scrollbarMode: scrollbarMode.value, scrollbarWidth: scrollbarWidth.value,
    scrollbarThumb: scrollbarThumb.value, scrollbarTrack: scrollbarTrack.value };
  const saved = scrollbarTarget.value === 'pdf' ? Object.fromEntries(Object.entries(values).map(([key, value]) =>
    ['pdf' + key[0].toUpperCase() + key.slice(1), value])) : values;
  chrome.storage.sync.set(saved);
  closeScrollbarOptions();
};
document.getElementById('reset-scrollbar').onclick = function() {
  chrome.storage.sync.set(scrollbarTarget.value === 'pdf' ? pdfScrollbarDefaults : scrollbarDefaults);
  closeScrollbarOptions();
};
document.getElementById('cancel-scrollbar').onclick = closeScrollbarOptions;
