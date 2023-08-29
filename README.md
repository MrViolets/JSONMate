# JSONMate

JSONMate is a Chrome Extension that helps make JSON more readable by automatically formatting it when viewed in a browser tab.

## Features

- Automatically detects valid JSON.
- Syntax highlighting.
- Collapsible JSON trees.
- Linkified URLs.
- Toggle between formatted and raw views.
- Choose from a list of themes.
- Optimized for speed.

## Install

1. Download and uncompress zip.
2. In Chrome, go to the extensions page at `chrome://extensions/`.
3. Enable Developer Mode.
4. Choose `Load Unpacked` and select the folder.

## Build

1. `npm install` to install dependencies.
2. Update `version` in `manifest.json`.
3. `npm run build`.

## Themes

To add a new theme, include a new object in the themes array in `modules/themes.js` eg:

```
{ name: 'My Theme', fileName: 'my-theme.css', id: 'myTheme' }
```

Then create a new css file for your theme in `content/css/themes` using one of the other existing themes as reference. When the extension is reloaded, the new theme will be available in the action context menu.

## License

JSONMate is licensed under the GNU General Public License version 3.
