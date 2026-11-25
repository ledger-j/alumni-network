# UniCircle Android app (Trusted Web Activity)

A TWA is a thin Android shell that opens https://unicircle.eu full-screen in Chrome. No app code is duplicated; the site stays the single source of truth.

## Requirements (laptop only)
- JDK 17 and the Android SDK (Bubblewrap can download both on first run and asks before doing so).
- Node.js 18+ (for `npx`).
- The DeploymentHub server has no Java, so the build runs on the laptop, not there.
- The site must be live over HTTPS with `manifest.webmanifest`, `sw.js` and the icons deployed. Note: live unicircle.eu is on All-Inkl KAS, so deploy there.

## Steps
1. Create a working folder outside the repo (for example `C:\uc-android`) and open Windows PowerShell there.
2. Initialise from the live manifest:
   `npx @bubblewrap/cli init --manifest=https://unicircle.eu/manifest.webmanifest`
   Use application id `eu.unicircle.app`. When asked, let Bubblewrap create a signing key. Choose the keystore password yourself.
3. Build: `npx @bubblewrap/cli build`. Output: `app-release-bundle.aab` (for Play) and `app-release-signed.apk` (for testing on a phone).
4. Get the signing fingerprint: `npx @bubblewrap/cli fingerprint`. If Play App Signing is used, take the SHA-256 from Play Console (Setup > App signing) instead, not the upload key.
5. Put that SHA-256 into `.well-known/assetlinks.json` (replace `REPLACE_WITH_SHA256_FROM_PLAY_CONSOLE`) and deploy it so it is reachable at `https://unicircle.eu/.well-known/assetlinks.json` as JSON, without a redirect.
6. Play Console: create the app, upload the `.aab` to an internal testing track first, fill in the store listing, the privacy policy URL (https://unicircle.eu/privacy.html) and the data safety form, then promote.

## Human-only steps
- Google Play Console developer account: USD 25 one-off (check the current fee at sign-up).
- The signing key and keystore password stay with the human. Never commit the keystore, its password or Play credentials to this repo.

## What to test
- Installability: Chrome DevTools > Lighthouse (PWA) and Application > Manifest show no errors, and Chrome offers "Install".
- Offline: DevTools > Network > Offline, reload; `offline.html` appears and the retry button works.
- Service worker: Application > Service Workers shows `sw.js` active. After a deploy that changes cached files, bump `VERSION` in `sw.js`.
- TWA verification: the app opens with no browser address bar. If a URL bar shows, assetlinks.json is wrong or unreachable.
- Deep links: open `https://unicircle.eu/#mentoring` from a message, or run `adb shell am start -a android.intent.action.VIEW -d "https://unicircle.eu/#mentoring"`; it should open in the app on that page.
- Shortcuts: long-press the launcher icon; Feed, Messages and Mentor & Tutor appear.
