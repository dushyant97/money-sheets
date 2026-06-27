# Privacy Policy — Money Sheets

_Last updated: 16 June 2026_

Money Sheets ("the app") is an offline-first personal finance tracker. By default, **your financial
data never leaves your device** unless you choose to export it yourself. The app also offers an
**optional** cloud sync mode that you can enable with your own database credentials; even then, your
data only ever goes to a database **you own and control** — never to the developer.

## Summary

- **We do not collect any personal data.**
- **We do not have servers, accounts, or sign-in operated by the developer.**
- **We do not share, sell, or transmit your data to us or any third party.**
- **We do not use analytics, advertising, or tracking SDKs.**
- **Optional cloud sync** sends your data only to a Turso database that **you** configure with your
  own credentials. It is off by default.

## What data the app stores

The app stores the financial information you enter — transactions, accounts, categories, budgets,
and settings — **locally on your device**:

- On mobile, via the operating system's on-device app storage (AsyncStorage).
- On the web, via your browser's `localStorage`.

This data is created and controlled entirely by you. It is not accessible to the developer and is
not uploaded anywhere by default.

## Optional cloud sync (Turso)

You may optionally turn on cloud sync from **More → Storage** by entering your own
[Turso](https://turso.tech/) database URL and auth token. When enabled:

- The app stores your ledger (the same data listed above, as a single JSON record) in **your own**
  Turso database so it can sync across devices that use the same credentials.
- Your Turso URL and auth token are stored **only on your device** (AsyncStorage on mobile,
  `localStorage` on the web). They are never sent to the developer.
- The developer operates no server in this flow and never receives, stores, or has access to your
  data or your credentials. Your data is handled solely by Turso under your own account and
  [Turso's privacy terms](https://turso.tech/).
- A local copy is always kept on the device as an offline cache. If the network is unavailable, the
  app falls back to that local copy and resumes syncing when you reconnect.
- You can switch back to local-only storage at any time from the same screen.

## CSV export and import

The app lets you **export** your data to a CSV file and **import** a CSV file you previously saved.

- Export creates a file (or opens your device's share sheet) so you can back up your data to a
  location you choose (email, cloud drive, another device, etc.). What happens to that file after it
  leaves the app is governed by the service or storage you send it to, not by Money Sheets.
- Import reads a CSV file you select and replaces the data currently stored on the device.

These actions are always initiated by you. The app does not export or import anything automatically.

## Permissions

- **File access (mobile):** used only when you tap *Import* or *Export*, so you can pick or save a
  file. The app reads the file you select and nothing else.
- **Internet access:** used **only** when you enable optional Turso cloud sync, to reach the
  database you configured. With sync off, the app makes no network requests for your data.

The app requests no other sensitive permissions (no location, contacts, camera, microphone, or
background network access).

## Children's privacy

The app does not collect data from anyone, including children. It contains no ads and no
in-app purchases.

## Data deletion

Because all data is on your device, you control deletion:

- Use **More → Erase all data** inside the app, or
- Uninstall the app (which removes its on-device storage), or
- For the web app, clear the site's data in your browser.

## Changes to this policy

If this policy changes, the updated version will be published in the app's repository with a new
"Last updated" date.

## Contact

For privacy questions, contact the app developer at: **dushyant.sharma1997@gmail.com**.
