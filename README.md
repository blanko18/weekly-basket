# Weekly Basket for Android

The same Weekly Basket app as the Claude version, packaged as an installable Android app (APK).

- Works fully offline. Lists are stored on the phone.
- **Share** (the arrow icon on the home screen, or "Share this list / template" in a list's ⋯ menu) sends lists and templates through Android's share sheet: as a Weekly Basket file the other person imports, or as plain text anyone can read.
- **Import**: + New → **Import shared file**. A plain text list can be pasted into the **Items** box instead.
- Reports can be saved or shared as a picture, text or spreadsheet.
- **Voice add**: tap the mic in the add bar and say items ("rice, eggs and two kilos pork"). Uses Android's built-in speech recognition, no API key.
- **Inventory**: your products with how they're printed on receipts and their last prices (home screen, *Products & receipt codes*). Ships with 40 products from an SM receipt; names you fix while scanning are added automatically. The receipt reader matches each line against it, fills unreadable prices and fixes one-digit misreads.
- **Basic template**: ships with the same 40 products.
- **Scan a receipt**: in a list, tap *Scan receipt*, take a photo, review the matches, and prices are filled in and items checked off. Text is read on the phone with Tesseract (bundled, offline, no API key). The build runs `npm run test:ocr` to check the reader before every APK.
- It does not sync with the Claude-hosted version. To move your lists over, use Share → *Send as Weekly Basket file* in the Claude version, then import that file in the app.

## Build it with GitHub Actions (no Android Studio needed)

1. Create a new GitHub repository and upload everything in this folder (the hidden `.github` folder too). Do **not** upload the `keep-private` folder.
2. In the repository go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `KEYSTORE_BASE64`: the full contents of `keep-private/KEYSTORE_BASE64.txt`
   - `KEYSTORE_PASSWORD`: the password in `keep-private/SIGNING-KEY-INFO.txt`
3. Go to **Actions → Build Weekly Basket APK → Run workflow** (it also runs on every push to `main`). It takes about 5 minutes.
4. The signed APK appears under **Releases** as `WeeklyBasket.apk`.

### Sharing the app with other people

- Send `WeeklyBasket.apk` directly (Messenger, Viber, Google Drive, email), or
- If the repository is **public**, share this link, which always points to the newest build:
  `https://github.com/<your-user>/<your-repo>/releases/latest/download/WeeklyBasket.apk`
  The repository holds no secrets (the signing key lives in GitHub secrets), so making it public is safe.

On the phone: open the APK, allow "Install unknown apps" for the browser or file app when asked, then tap Install. Google Play Protect may show a warning for apps from outside the Play Store. Tap "Install anyway".

Updates: run the workflow again and install the new APK over the old one. Lists are kept. This only works while the app is signed with the same key, so keep `keep-private` backed up.

## Build it locally instead (Android Studio)

Needs Node 22+, JDK 21 and Android Studio.

```
npm install
npm run www
npx cap add android
npx capacitor-assets generate --android
npx cap sync android
npx cap open android
```

Then in Android Studio: **Build → Generate Signed App Bundle / APK → APK**, and use `keep-private/weekly-basket-release.jks` with alias `weeklybasket`.

## Changing the app

The whole app is `src/app.html`. Edit it, commit, and the workflow builds a new APK.
