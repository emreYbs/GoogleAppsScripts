
# Gmail German Spam Blocker (Google Apps Script)

A lightweight, serverless Google Apps Script that automatically detects German dating/phishing spam in your Gmail account and safely moves it to Trash.

> **Türkçe dokümantasyon için:** `tr/` klasörüne göz atabilirsiniz.

## Features

- **Multi-Layer Detection:** Combines blocked TLDs (e.g., `.biz`), exact spam phrases, and whole-word German keyword scoring.
- **Bot Address Detection:** Uses `RegExp` to catch randomly generated alphanumeric sender addresses.
- **Privacy Alias Protection:** Exempts legitimate relay services (SimpleLogin, Proton Pass, Apple Hide My Email) from the random-address rule.
- **Safe Cleanup:** Moves matched threads to Trash (recoverable for 30 days) or applies a test label before you enable cleanup.

## Setup Instructions

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Copy the code from `en/Code.gs`, paste it into the editor, and save (`Ctrl + S`).
3. Customize the `SETTINGS` section at the top of the file if needed.
4. Select `blockGermanSpam` from the top dropdown, click **Run**, and grant the required Gmail permissions.
5. Open **Triggers** (clock icon on the left) -> **Add Trigger** -> run `blockGermanSpam` on a **Time-driven** schedule (e.g., **Every 15 minutes**).

## Disclaimer

This script runs exclusively inside your own Google account and never sends data to third-party servers. Setting `ACTION_TYPE = "LABEL"` for a few days is recommended to verify accuracy first.

> **Türkçe dokümantasyon için:** [tr/README.md](tr/README.md) dosyasına göz atabilirsiniz.
