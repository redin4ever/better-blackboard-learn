# Better Blackboard Learn (Fixed)

A repaired Chrome extension for dark mode and custom themes on IAU Blackboard (`vle.iau.edu.sa`) and Blackboard cloud sites (`*.blackboard.com`).

## Features

- Dark mode, preset themes, and custom primary, accent, and sidebar colors.
- Custom course names, course images, and fonts.
- Theme updates for dynamically loaded course pages and frames.
- Readable grade pills, including Arabic scores and ungraded placeholders.
- PDF viewers excluded from theme changes.

## Install

1. Download this repository as a ZIP and extract it, or clone it:

   ```sh
   git clone https://github.com/redin4ever/better-blackboard-learn.git
   ```

2. Open `chrome://extensions` and turn off the original Better Blackboard Learn extension if it is installed.
3. Enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.
4. Refresh Blackboard, open the extension, and select **Dark Mode** or your preferred theme.

Keep the folder in place while using the extension. After updating its files, click **Reload** on `chrome://extensions` and refresh Blackboard. This copy has separate settings from the original extension and does not receive Chrome Web Store updates.

## Validation

Requires Node.js 18 or later; no dependencies are needed.

```sh
npm test
```

The 52 automated checks use simulated DOM and Chrome storage fixtures. They cover theme startup, storage, popup controls, PDF exclusions, background changes, and grade contrast. Signed-in rendering on IAU Blackboard has not been verified through browser automation.

## Permissions

Uses Chrome's `storage` permission for preferences and content scripts on the supported Blackboard domains. Course metadata is requested from the current Blackboard site. See [repair notes](REPAIR-NOTES.md) for the changes.

## Contact

[github.com/redin4ever](https://github.com/redin4ever)

## License and attribution

Based on [Better Blackboard Learn by Parker Williams](https://github.com/ParkerWilliams1/BetterBlackboardLearn), version 1.2.1. The original assets and [MIT license](LICENSE) are retained.
