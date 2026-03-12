(async () => {
  // ==========================================
  // CONFIGURATION
  // ==========================================
  // Pause between each download to prevent browser crashing or rate limits
  const DELAY_BETWEEN_DOWNLOADS_MS = 2500; // 2.5 seconds

  // Maximum time to wait for the menu to appear after clicking the dropdown
  const MAX_WAIT_FOR_MENU_MS = 3000; // 3 seconds

  // The exact text (or partial text) of the download button inside the menu
  const DOWNLOAD_BUTTON_TEXT = "Download as CSV File";

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Function to dynamically wait and find the download link inside the opened menu
  const waitForDownloadButton = async (text, timeout) => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Grab any anchor tag inside a dropdown or menu item
      const elements = Array.from(
        document.querySelectorAll('a[role="menuitem"], lightning-menu-item a'),
      );

      const targetBtn = elements.find((el) => {
        const hasText = el.textContent.trim().includes(text);
        // A more reliable visibility check for floating Salesforce menus
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;

        return hasText && isVisible;
      });

      if (targetBtn) {
        return targetBtn; // Found it!
      }

      // Wait 100ms before checking again
      await sleep(100);
    }

    return null; // Timed out
  };

  // ==========================================
  // MAIN EXECUTION
  // ==========================================
  console.log("Starting Salesforce Event Log Downloader...");

  // Step 1: Find all the dropdown buttons, strictly restricted to the table area.
  // By looking only inside 'table', '.slds-table', or 'lightning-datatable',
  // we completely avoid clicking menus in the Salesforce top navbar.
  let dropdownButtons = document.querySelectorAll(
    "table lightning-button-menu button, " +
      ".slds-table lightning-button-menu button, " +
      "lightning-datatable lightning-button-menu button, " +
      'table button[title="Show actions"], ' +
      '.slds-table button[title="Show actions"], ' +
      'lightning-datatable button[title="Show actions"], ' +
      "table tbody tr td:last-child button",
  );

  // Filter out buttons that are clearly not dropdowns (optional, but helps accuracy)
  dropdownButtons = Array.from(dropdownButtons).filter(
    (btn) => btn.offsetHeight > 0,
  );

  if (dropdownButtons.length === 0) {
    console.error(
      "❌ Could not find any dropdown menu buttons in the table. You may need to update the CSS selector in the script based on your specific Salesforce page.",
    );
    return;
  }

  console.log(
    `Found ${dropdownButtons.length} potential dropdown menus in the table. Beginning processing...`,
  );

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dropdownButtons.length; i++) {
    const btn = dropdownButtons[i];

    try {
      // 1. Click the row's dropdown menu button
      btn.click();
      console.log(
        `[${i + 1}/${dropdownButtons.length}] Opened dropdown menu...`,
      );

      // 2 & 3. Wait dynamically for the "Download as CSV File" button to appear
      const downloadBtn = await waitForDownloadButton(
        DOWNLOAD_BUTTON_TEXT,
        MAX_WAIT_FOR_MENU_MS,
      );

      if (downloadBtn) {
        // 4. Click the download button
        downloadBtn.click();
        console.log(
          `[${i + 1}/${dropdownButtons.length}] ✅ Clicked '${DOWNLOAD_BUTTON_TEXT}'. Waiting ${DELAY_BETWEEN_DOWNLOADS_MS / 1000}s...`,
        );
        successCount++;
      } else {
        console.warn(
          `[${i + 1}/${dropdownButtons.length}] ⚠️ Could not find '${DOWNLOAD_BUTTON_TEXT}' in the menu. Skipping...`,
        );
        errorCount++;

        // Click the dropdown button again to close it if the download button wasn't found
        btn.click();
      }

      // 5. Wait before proceeding to the next row
      await sleep(DELAY_BETWEEN_DOWNLOADS_MS);
    } catch (err) {
      console.error(`❌ Error processing row ${i + 1}:`, err);
      errorCount++;
    }
  }

  // ==========================================
  // RESULTS
  // ==========================================
  console.log(`\n🎉 Script Finished!`);
  console.log(`✅ Successfully triggered: ${successCount} downloads`);
  console.log(`⚠️ Skipped/Failed: ${errorCount}`);

  if (successCount > 5) {
    console.log(
      "Note: If your browser asked you for permission to 'Download multiple files', make sure to click 'Allow'.",
    );
  }
})();
