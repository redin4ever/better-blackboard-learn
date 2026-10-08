# Better Blackboard Learn (Fixed)

A repaired Chrome extension for dark mode and custom themes on Blackboard Learn, including universities with their own domain names.

## Features

- Dark mode, preset themes, and custom primary, accent, and sidebar colors.
- Custom course names, course images, and fonts.
- Theme updates for dynamically loaded course pages and frames.
- Readable grade pills, including Arabic scores and ungraded placeholders.
- Course headers, navigation tabs, and active-tab borders follow the selected theme.
- PDF viewers excluded from theme changes.
- Automatic detection of Blackboard Ultra and Classic pages on custom domains.

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

## Validation

Requires Node.js 18 or later; no dependencies are needed.

```sh
npm test
```

The 78 automated checks use simulated DOM and Chrome storage fixtures. They cover refreshes with delayed page markers, stylesheet removal, rebuilt page heads and bodies, custom-domain detection, unrelated pages, course frames, theme startup, storage, popup controls, PDF exclusions, background changes, and grade contrast. Signed-in rendering across universities has not been verified through browser automation.

## Permissions

Uses Chrome's `storage` permission for preferences and a local detection cache containing recognized origins, routes, and confirmation times. Content scripts match HTTP and HTTPS pages so Blackboard can be detected on any domain. Chrome documents these patterns in its [match pattern reference](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns).

Unrecognized pages receive no theme styles, preference reads, or Blackboard API requests. Once Blackboard is detected, optional course metadata is requested from the current site's origin. See [repair notes](REPAIR-NOTES.md) for the changes.

## Contact

[github.com/redin4ever](https://github.com/redin4ever)

## License and attribution

Based on [Better Blackboard Learn by Parker Williams](https://github.com/ParkerWilliams1/BetterBlackboardLearn), version 1.2.1. The original assets and [MIT license](LICENSE) are retained.
