# Okta Auto-Next (sso.unimelb.edu.au)

Browser extensions that speed up the Okta login flow on `https://sso.unimelb.edu.au/` by:

- (Optional) filling your username
- automatically advancing past the **username -> Next** step

Targets:
- Chrome (MV3)
- Firefox Developer Edition (MV2 packaged `.xpi`)
- Safari (WebExtension wrapped by an Xcode app)

## Security Notes

- If you enable username auto-fill, your username is stored in the extension’s local storage.
- This extension does **not** store passwords.
- Runs only on `https://sso.unimelb.edu.au/*`.

## Build

```bash
./build_all.sh
```

Outputs:
- `dist/okta-auto-next-chrome.zip`
- `dist/okta-auto-next-chrome.crx` (best effort)
- `dist/okta-auto-next-firefox.xpi`
- `dist/safari/` (Xcode project, if `safari-web-extension-converter` is available)

## Install

### Chrome

1. `chrome://extensions`
2. Enable Developer mode
3. Load unpacked -> select `webextension/`

Or install the `.crx` (Chrome restrictions vary by channel/policy).

### Firefox Developer Edition

1. Open `about:addons`
2. Gear icon -> `Install Add-on From File...`
3. Select `dist/okta-auto-next-firefox.xpi`

### Safari (macOS)

Prereqs:
- Xcode installed
- `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- `sudo xcodebuild -license accept`

1. Build (creates `dist/safari/...`):

```bash
./build_all.sh
```

2. Open `dist/safari/Okta Auto-Next/Okta Auto-Next.xcodeproj`
3. Select scheme **Okta Auto-Next** (the app target), `Product -> Run`
4. In the app window, open Safari extension preferences and enable it

## Configure (Enable Username Fill)

1. Click the toolbar icon -> `Options`
2. Enable `Auto-fill username` and set your username value

## Release Artifacts

GitHub Actions builds artifacts on each push and attaches them to the workflow run.
Tagged releases attach the same artifacts.

