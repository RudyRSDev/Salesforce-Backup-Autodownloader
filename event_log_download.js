(async () => {
  // ==========================================
  // CONFIGURATION
  // ==========================================
  // Pause between each download to prevent browser crashing or rate limits
  const DELAY_BETWEEN_DOWNLOADS_MS = 2500; // 2.5 seconds

  // Pause to allow the Salesforce dropdown menu to render after clicking it
  const WAIT_FOR_MENU_MS = 500; // 0.5 seconds

  // The exact text (or partial text) of the download button inside the menu
  const DOWNLOAD_BUTTON_TEXT = "Download as CSV File";

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Function to find the download link inside the opened menu
  const findDownloadButton = (text) => {
    // Look specifically for the Salesforce dropdown structure from your HTML
    const elements = Array.from(
      document.querySelectorAll(
        '.slds-dropdown a[role="menuitem"], lightning-menu-item a',
      ),
    );

    return elements.find((el) => {
      const hasText = el.textContent.trim().includes(text);
      // Ensure we are grabbing the visible menu, not a hidden one left in the DOM
      const isVisible = el.offsetParent !== null || el.offsetWidth > 0;
      return hasText && isVisible;
    });
  };

  // ==========================================
  // MAIN EXECUTION
  // ==========================================
  console.log("Starting Salesforce Event Log Downloader...");

  // Step 1: Find all the dropdown buttons.
  // In Salesforce Lightning, action menus are often within a 'lightning-button-menu'
  // or are buttons with a specific 'Show More' / 'Show Actions' title.
  // We try a few common Salesforce CSS selectors here:
  let dropdownButtons = document.querySelectorAll(
    "table tbody tr td:last-child button, " +
      "lightning-button-menu button, " +
      'button[title="Show actions"], ' +
      ".slds-dropdown-trigger button",
  );

  // Filter out buttons that are clearly not dropdowns (optional, but helps accuracy)
  dropdownButtons = Array.from(dropdownButtons).filter(
    (btn) => btn.offsetHeight > 0,
  );

  if (dropdownButtons.length === 0) {
    console.error(
      "❌ Could not find any dropdown menu buttons. You may need to update the CSS selector in the script based on your specific Salesforce page.",
    );
    return;
  }

  console.log(
    `Found ${dropdownButtons.length} potential dropdown menus. Beginning processing...`,
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

      // 2. Wait a brief moment for the DOM to render the menu items
      await sleep(WAIT_FOR_MENU_MS);

      // 3. Find the "Download as CSV File" button inside the newly opened menu
      const downloadBtn = findDownloadButton(DOWNLOAD_BUTTON_TEXT);

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
