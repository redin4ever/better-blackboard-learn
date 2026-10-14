# Local repair, version 1.2.22

Based on the installed Better Blackboard Learn 1.2.1 extension by Parker Williams.
The upstream MIT license and original assets are retained.

Source: https://github.com/ParkerWilliams1/BetterBlackboardLearn

## Changes

- Add All announcements directly after bb-todo inside the existing todo-panel.
  Keep the marked column in natural-height vertical flow with a 12-pixel gap,
  preventing stretched To Do wrappers from pushing the feed to the page bottom.
  Remove the layout marker when leaving the page to restore native behavior.
- Enumerate the signed-in account's course memberships with pagination. Fetch
  each course's announcements from the current origin, ten per API page, with
  at most three courses in flight. Merge publication dates in descending order;
  report inaccessible courses and support manual refresh without saving bodies.
- Match the supplied native Announcement/Posted list pattern, adding course
  names, search, message previews, expandable bodies, attachment links and a
  Show more control. Respect publication restrictions and denied permissions.
  Reconstruct allowed HTML in an inert template, remove active content and
  inline colors, and leave Blackboard read status unchanged. Clear data and
  abort requests when leaving home; restore the panel after DOM replacement.

- Add a Participants button before Gradebook in Ultra course navigation. Copy
  the native tab's computed padding, font, margins and title wrapper classes;
  refresh those values after window resizing and native navigation redraws.
- Fetch the current course's expanded memberships on demand, using its current
  origin and signed-in session. Follow validated pagination, deduplicate users,
  respect denied username visibility and report session/permission errors.
- Display a Groups-style table with Name, Role, Username and User ID. Add
  search, role filtering, name sorting, 50-row display pages and Arabic controls.
  Render returned text safely, accept only same-origin avatar URLs, abort stale
  requests on close/course changes, and keep roster data out of storage.

- Recognize the supplied toolbar-start-container and pageNumber controls, mark
  their enclosing viewer/scroll container and detect late viewer rendering.
  Remove those markings if the viewer disappears. Support recognized web PDF
  frames on another origin when their referrer belongs to a recently detected
  Blackboard site. Apply only PDF scrollbar settings in those viewer frames.
- Override native scrollbar color and width rules within opted-in PDF viewers,
  alongside Chrome scrollbar pseudo-elements, so viewer CSS cannot mask them.

- Use quiet fallback colors when the popup has no saved palette. Restore valid
  custom color preferences before legacy picker values. Missing preferences no
  longer generate extension errors; genuine storage failures still report a warning.

- Add a separate embedded PDF scrollbar target with its own saved mode, width
  and colors. Keep it off by default. Apply it only within inline viewer roots
  or associated HTML viewer frames, without document theming, fonts
  or course API requests. Native Chrome PDF documents remain untouched.

- Add a Website scrollbar settings panel with default, theme, custom and hidden
  modes. Save the selection across refreshes; custom mode provides thumb and
  track colors, and theme/custom modes provide thin or normal width.
- Keep scrollbar settings independent from dark mode, update them on preference
  changes, and recover removed scrollbar stylesheets during page hydration.
  Default/reset removes the extension's scrollbar styling. Hiding the bar does
  not change overflow or disable scrolling. PDF viewers remain excluded; colors
  use pseudo-elements to avoid inheritance into inline viewers.

- Apply the primary and accent colors to the supplied course-page-header and
  bb-course-navigation markup, including the header toolbar, Home and Courses
  controls, course title, status badge, navigation tabs and active-tab border.
  Use stable component names and analytics attributes instead of generated
  class suffixes. Preserve the banner and all PDF selector exclusions.

- Recognize the Blackboard bootstrap body together with vendor metadata before
  navigation components finish loading.
- Remember structurally detected sites locally for 30 days, restoring saved
  themes on known Blackboard routes during refresh. Unrelated routes and PDFs
  remain excluded; cache failures do not block structural detection.
- Restore extension styles if startup hydration removes them or replaces the
  document head. Reattach surface scanning when the document body is replaced.
  Disabling themes and PDF exclusions take precedence over style recovery.

- Replace feedback contact information with only https://github.com/redin4ever.

- Detect Blackboard on custom domains through generator metadata, Ultra markup
  and same-origin Classic assets without requiring a successful user API response.
- Watch for late-loading detection markers and stop the detection observer after
  activation. Read preferences and register storage listeners only on detected pages.
- Allow same-origin course frames to inherit Blackboard detection, preserving
  PDF exclusions and isolating cross-origin frames.
- Apply dark mode, preset colors and custom colors through a single stylesheet
  with predictable precedence. Custom values override presets and dark defaults.
- Safely turn themes off and replace styles instead of accumulating duplicates.
- Handle missing font preferences and missing or malformed course maps.
- Apply themes inside Blackboard course frames.
- Supplement upstream CSS with stable selectors for Ultra and Classic surfaces.
- Use the theme accent for grade values and score outlines. Remove upstream
  rules that forced grade text and the grade ellipsis to black on dark surfaces.
- Check grade text contrast against the closest opaque pill background. Use
  dark or white text when the accent would be unreadable on a filled status
  pill. Outlined dark pills retain the accent when its contrast is sufficient.
  Cover readonly-pill/customGradePill components and Arabic score spans.
- Remove rectangular borders, outlines and shadows from nested score text and
  unfocused inner grade inputs, keeping the outer score pill border.
- Apply the border reset to the supplied readonly wrapping-input-style pill-style
  markup, including its inner div, grade-input-display span and descendants.
  Apply the accent border to the outer wrapper rather than the inner value span.
- Override inner grade-pill color and text-fill, including inline important
  styles and SVG text. Recognize score ratios in the grades area even when the
  component classes change. Reapply on redraw and restore native inline styles
  when theming is disabled. PDF score text and icon path fills are excluded.
- Add an explicit rule for the supplied grade-input-display grade-ellipsis
  placeholder and its bdi child. Reset color, text-fill, opacity, filter and
  text-shadow so the ungraded -- value stays readable.
- Match the backgrounds of floating Terms/Filters labels, border-notch legends
  and their backing pseudo-elements to the selected primary color. Preserve
  their placement and the PDF exclusions.
- Replace neutral white patterned backgrounds with the selected theme surface.
  Grade placeholders with image-based stripes are also covered. Background
  patterns are restored when theming is removed; media and PDFs remain excluded.
- Detect neutral light panels and course rows by their computed background,
  including elements loaded after startup, and apply the selected background.
  Media, course banners, rich-text content and editors are excluded from this
  fallback. Turning themes off removes the added attributes and stops scanning.
- Use the current university's domain for course metadata, with encoded IDs.
- Keep course API failures separate from theme startup.
- Save all custom theme colors when Save Theme is clicked.
- Clear custom overrides when selecting a preset or enabling Dark Mode.
- Remove inline color handlers that conflict with extension content security policy.
- Preserve saved settings during local extension updates.
- Match HTTP and HTTPS sites for automatic detection without a university allowlist.
- Skip native PDFs, direct PDF file URLs and standalone or embedded PDF viewer
  documents. Exclude inline PDF viewer roots, pages, annotations and text layers
  from every theme selector, custom font selector and adaptive background scan.
- Remove the global color-scheme declaration to avoid inherited dark appearance
  in embedded document viewers. Remove prior background markings when a panel
  becomes a PDF viewer after loading.

The copy uses a separate extension identity and does not update from the Chrome
Web Store. Its settings are separate from those of the original extension.

## Validation

160 automated checks passed with a simulated DOM, synthetic API responses and Chrome storage. They cover
API failure and unavailable responses, saved dark mode, theme precedence,
repeated toggles, startup timing, storage races, custom colors, preset changes,
course frames, course metadata URLs, popup controls and upgrade persistence.
Additional regression checks cover white panels, late-loading rows, class/style
updates, media preservation and reverting the adaptive backgrounds.
PDF regression checks cover native documents, direct file URLs, standalone and
embedded viewers, inline text layers, all CSS selectors, custom fonts, late
viewer initialization and preserving ordinary course theming.
Striped-background checks cover neutral gradients, image-based grade placeholders,
restoring original patterns and preserving PDF pages, banners and photos.
Grade-pill checks cover inner text-fill overrides, redraws, custom accents,
restoring native styles, unfamiliar classes, SVG text and PDF exclusions.
The additional grade-ellipsis fixture reproduces the supplied wrapper, sr-only
span and bdi markup with black text-fill and a brightness-zero filter.
Filled-pill fixtures cover the supplied Arabic score markup on green, an outlined
dark pill and a pill whose background changes during a redraw.
Extension JavaScript files passed syntax checks. Manifest references exist.

Detection checks cover custom university domains, Ultra markup, Classic assets,
HTTP installations, late or updated metadata and same-origin frames. They also
verify that mere product mentions, external assets, cross-origin frames and PDF
documents do not activate themes or cause preference reads and API requests.
Refresh checks cover saved dark and custom themes without initial page markers,
expired caches, storage failures, unrelated routes, bootstrap markup, removed
stylesheets, replaced heads and bodies, disabled themes and late PDF viewers.
Scrollbar checks cover defaults, hidden/custom/theme modes, live changes,
invalid saved values, refresh persistence, stylesheet recovery, popup save/reset
and cancel behavior, unrelated sites and PDF exclusions.
PDF scrollbar checks cover opt-in behavior, independent website preferences,
HTML viewer frames, refresh through remembered parent detection, document color
preservation, native PDF exclusions and separate popup save/reset behavior.
Color-picker checks cover fresh storage without error messages and restoration
of saved custom colors ahead of legacy values.
The supplied-toolbar regressions cover missing viewer classes, scroll wrappers,
late rendering, cross-origin viewer association and excluding ordinary embeds.

No browser automation was used. Signed-in rendering across universities remains
unverified; pages may contain additional selectors not covered by this repair.
