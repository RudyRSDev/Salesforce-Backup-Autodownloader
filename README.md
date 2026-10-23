# Salesforce Backup Autodownloader

`sf_download.js` automates the sequential downloading of Salesforce backup files from the backup page currently open in your browser. It finds the page's **Download** links, extracts their URLs, and requests each download through a hidden iframe while displaying progress in a small on-page tracker.

Both browser scripts use a consistent, DaisyUI-inspired light theme with Salesforce-blue accents and the Font Awesome Free solid cloud icon embedded inline. The styling and icon are bundled in each script, so neither DaisyUI nor Font Awesome needs to be loaded at runtime. The cloud icon is licensed under [CC BY 4.0](https://fontawesome.com/license/free).

This is a browser-page script, not a command-line downloader: it relies on your active Salesforce session, the page's DOM, and browser storage. A terminal `curl` command can download the script, but cannot run it in the context of your logged-in Salesforce tab.

## Requirements

- Be signed in to Salesforce in a desktop browser.
- Open the Salesforce page that lists the backup files and wait for its download links to load.
- Allow the browser to download multiple files from Salesforce, if it asks.

## Run from the browser console

1. Open the Salesforce backup page containing the download links.
2. Open the browser's Developer Tools and select **Console**. If the backup list is in a frame, select that frame's JavaScript context in the console.
3. Run the script using one of these methods:

   **Paste the script:** Open [`sf_download.js`](./sf_download.js), copy its contents, paste them into the console, and press Enter.

   **Load it from a trusted hosted copy:** Replace the example URL with the URL where you host this repository's `sf_download.js`, then run this one-liner in the Salesforce page's console:

   ```js
   fetch("https://YOUR-TRUSTED-HOST/sf_download.js").then((response) => { if (!response.ok) throw new Error(`Script request failed: HTTP ${response.status}`); return response.text(); }).then((code) => (0, eval)(code));
   ```

   Only load and execute a script from a URL you control and trust. It runs with access to the current page.

## Downloads, progress, and resume

- The script recognizes links labeled **Download** that use the Salesforce export link formats it supports. If it finds no matching links, check that the correct page or frame is selected.
- An options dialog appears before each run with **Download** and **Cancel** buttons. Enter the first and last file numbers to download a specific range (for example, 300 through 500). If saved progress is shown, adjust the range fields to retry the last requested file, continue at the next file, or restart from file 1.
- Set the wait between download requests in seconds. The minimum is 60 seconds.
- Progress and the selected range's end are saved in browser local storage under `sf_export_resume_index` and `sf_export_resume_end`.
- The on-page tracker shows progress and has a red **Stop** button. When all selected downloads have been requested, saved progress is cleared. “Complete” means the browser was asked to start each download; confirm that the files actually finished downloading.

## Notes

The script does not authenticate to Salesforce independently, download files from a terminal, or verify the contents of downloaded files. Keep the Salesforce tab open while it runs, and check the browser's download list for errors or incomplete files.
