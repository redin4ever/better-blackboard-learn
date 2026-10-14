# Better Blackboard Learn (Fixed)

A repaired Chrome extension for dark mode and custom themes on Blackboard Learn, including universities with their own domain names.

## Features

- Dark mode, preset themes, and custom primary, accent, and sidebar colors.
- Custom course names, course images, and fonts.
- Theme updates for dynamically loaded course pages and frames.
- Readable grade pills, including Arabic scores and ungraded placeholders.
- Course headers, navigation tabs, and active-tab borders follow the selected theme.
- Separate website and embedded PDF scrollbar controls: keep the default, follow the theme, choose custom colors and width, or hide the bar.
- PDF viewers excluded from theme changes.
- Automatic detection of Blackboard Ultra and Classic pages on custom domains.
- A Participants button in Ultra course navigation, with a searchable roster styled like Blackboard's Groups table.
- All announcements below To Do on the Courses home page, combining your classes in newest-first order.

## Automatic detection

The extension recognizes Blackboard generator metadata, bootstrap bodies with vendor metadata, Ultra navigation and component markup, and same-origin Classic scripts or stylesheets. It also checks for markers added after the page loads. A page title, a mention of Blackboard, or an external Blackboard link does not activate theming.

Detected sites are remembered locally for 30 days. On refresh, the saved theme can return on recognized Blackboard routes before the page finishes loading its markers. If Blackboard replaces the extension's styles or rebuilds the page during startup, the extension restores the styles and background scanning.

Same-origin course frames can inherit detection from their Blackboard parent. PDF viewers remain excluded. Heavily customized installations that remove all recognized markers may need additional detection rules.

## Install

1. Download this repository as a ZIP and extract it, or clone it:

   ```sh
   git clone https://github.com/redin4ever/better-blackboard-learn.git
   ```

2. Open `chrome://extensions` and turn off the original Better Blackboard Learn extension if it is installed.
3. Enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`. Allow site access on all sites so detection can work on custom university domains.
4. Refresh Blackboard, open the extension, and select **Dark Mode** or your preferred theme.

Keep the folder in place while using the extension. After updating its files, click **Reload** on `chrome://extensions` and refresh Blackboard. This copy has separate settings from the original extension and does not receive Chrome Web Store updates.

## Website scrollbar

Open the extension and select **Scrollbars**. Select **Website** or **Embedded PDF viewer**, then choose **Default scrollbar**, **Follow theme**, **Custom colors**, or **Hidden** and click **Save**. Theme and custom modes offer thin or normal width. Custom mode also lets you choose the thumb and track colors.

Each target's preference is saved separately and applies to detected Blackboard pages and viewer frames. The Blackboard web PDF toolbar is recognized through its page-number controls, and its scrolling container is identified even when its generated class names change. A recognized web PDF frame on another origin can inherit the association through a recently detected Blackboard referrer. Ordinary third-party frames remain untouched.

Hidden mode keeps wheel, touch, and keyboard scrolling available. **Reset** restores only the selected target's scrollbar. PDF scrollbar customization is off by default and never recolors PDF content. Chrome's built-in PDF viewer cannot be styled by this extension. Styling uses Chrome's [scrollbar properties and pseudo-elements](https://developer.chrome.com/docs/css-ui/scrollbar-styling); website rules exclude PDF viewer elements.

## Course participants

Select **Participants**, immediately before Gradebook in an Ultra course's navigation. The button follows the neighbouring tab's spacing, typography, and title wrappers, including after navigation redraws and window resizing.

The roster shows Name, Role, Username (`userName`), and User ID (`user.id`, with `userId` as a fallback). Search all four columns, filter by role, or select Name to reverse the sort. Results are displayed in pages of 50 rows. Arabic pages use translated controls and isolate names and identifiers for bidirectional text.

The extension requests `/learn/api/v1/courses/{courseId}/memberships?expand=user,courseRole,user.hasEmailAddress` only when the button is selected. It derives the course and origin from the current course navigation, uses the signed-in Blackboard session, and follows same-origin roster pagination. Blackboard must allow the account to view participants. An explicit `viewUserName: false` response hides usernames. Session and permission errors show a message and a Retry button.

Roster data stays in memory while the panel is open and is cleared on closing or switching courses. It is not saved in Chrome storage or sent to another service. Embedded frames do not receive the Participants feature.

## All announcements

On the Courses home page, **All announcements** appears directly below To Do in the same column. It uses the course announcement list's layout, with an Announcement column, message preview and Posted column. Each row identifies the course. Select a title to expand the formatted message and its attachment links, or select the course name to open its announcement page.

The section loads automatically using your signed-in account's full course membership list. It follows course and announcement pagination, requests announcements in pages of ten, and merges all returned published messages by `startDateRestriction` from newest to oldest. Creation and modification dates provide fallbacks when a publication date is missing. Drafts, scheduled future messages, expired non-permanent messages and explicitly denied messages are omitted. Search checks course names, titles and message text across the full list. **Show more** displays another ten messages; **Refresh** reloads your courses and announcements.

Requests use the current site's `/learn/api/v1/courses/{courseId}/announcements` endpoint and signed-in session. Up to three course requests run at once. If a course cannot be loaded, the section identifies the missing course rather than reporting a complete empty list. Blackboard must permit access to the course list and announcements.

The feed is read-only and does not change Blackboard's read tracking. Message formatting and safe HTTP/HTTPS attachment links are preserved. Scripts, embedded viewers, remote images and inline color overrides are excluded from the injected body. Announcements stay in memory and are cleared when you leave the Courses home page; they are not saved in Chrome storage or sent to another service. The section is excluded from course pages, organizations, unrelated sites and embedded frames.

## Validation

Requires Node.js 18 or later; no dependencies are needed.

```sh
npm test
```

The 160 automated checks use simulated DOM, API responses, and Chrome storage fixtures. They cover the announcements feed's direct placement, date sorting, course discovery, pagination, partial failures, formatting, attachment links, search, cancellation, read-only behavior and redraw recovery. They also cover Participants navigation spacing and roster behavior, the supplied Blackboard PDF toolbar, separate scrollbar preferences, theme recovery, automatic detection, PDF exclusions and grade contrast. All roster and announcement test data is synthetic. Signed-in rendering across universities has not been verified through browser automation.

## Permissions

Uses Chrome's `storage` permission for preferences and a local detection cache containing recognized origins, routes, and confirmation times. Content scripts match HTTP and HTTPS pages so Blackboard can be detected on any domain. Chrome documents these patterns in its [match pattern reference](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns).

Unrecognized pages receive no theme styles, preference reads, or Blackboard API requests. Once Blackboard is detected, optional course metadata is requested from the current site's origin. The announcements feed requests your courses and announcements only on a recognized Ultra Courses home page with To Do. Participants requests a roster when its button is selected. See [repair notes](REPAIR-NOTES.md) for the changes.

## Contact

[github.com/redin4ever](https://github.com/redin4ever)

## License and attribution

Based on [Better Blackboard Learn by Parker Williams](https://github.com/ParkerWilliams1/BetterBlackboardLearn), version 1.2.1. The original assets and [MIT license](LICENSE) are retained.
