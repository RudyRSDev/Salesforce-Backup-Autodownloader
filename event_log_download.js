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

  // Helper to pierce through Salesforce's LWC Shadow DOM boundaries
  const deepQuerySelectorAll = (selector, root = document) => {
    const results = [];
    const traverse = (node) => {
      if (!node || !node.querySelectorAll) return;

      // Find matches in the current DOM scope
      const matches = node.querySelectorAll(selector);
      if (matches.length > 0) results.push(...matches);

      // Check all children to see if they have a Shadow DOM, and traverse into them
      const allElements = node.querySelectorAll("*");
      for (const el of allElements) {
        if (el.shadowRoot) traverse(el.shadowRoot);
      }
    };
    traverse(root);
    return [...new Set(results)]; // Remove duplicates
  };

  // Function to dynamically wait and find the download link inside the opened menu
  const waitForDownloadButton = async (text, timeout) => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Grab any anchor tag by piercing through all shadow DOMs
      const elements = deepQuerySelectorAll(
        'a[role="menuitem"], lightning-menu-item a',
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

  // Step 1: Find all the dropdown buttons by penetrating the Shadow DOM.
  // Salesforce's Lightning Datatable hides its contents inside a Shadow DOM,
  // which normal document.querySelectorAll CANNOT see. Our deepQuerySelectorAll fixes this.
  let dropdownButtons = deepQuerySelectorAll(
    "lightning-primitive-cell-actions button, lightning-primitive-cell-actions lightning-button-menu button",
  );

  // Filter out buttons that are clearly not visible
  dropdownButtons = Array.from(dropdownButtons).filter((btn) => {
    const rect = btn.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (dropdownButtons.length === 0) {
    console.error("❌ Could not find any dropdown menu buttons in the table.");
    console.warn(
      "👉 TROUBLESHOOTING: You might be inside an iframe! Look at the top of your Chrome DevTools Console. There is a dropdown that usually says 'top'. Click it and change it to the Salesforce iframe, then run the script again.",
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
