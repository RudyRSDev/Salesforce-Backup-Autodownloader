(async () => {
  // ==========================================
  // CONFIGURATION
  // ==========================================
  // Balance between speed and reliability (1000ms is a safe sweet spot)
  const DELAY_BETWEEN_DOWNLOADS_MS = 1000;
  const MAX_WAIT_FOR_MENU_MS = 3000;
  const DOWNLOAD_BUTTON_TEXT = "Download as CSV File";

  // Global state
  let isRunning = true;
  const processedRowSignatures = new Set();
  let successCount = 0;
  let errorCount = 0;

  // ==========================================
  // DAISY UI STYLE TRACKER (CSS INJECTION)
  // ==========================================
  const injectUI = (totalDownloads) => {
    const style = document.createElement("style");
    style.innerHTML = `
            #sfdc-dl-tracker {
                position: fixed; bottom: 24px; right: 24px; z-index: 999999;
                background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
                border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                padding: 1.5rem; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                width: 320px; border: 1px solid #e5e7eb; color: #1f2937;
            }
            #sfdc-dl-tracker h3 { margin: 0 0 0.5rem 0; font-size: 1.125rem; font-weight: 700; color: #111827; }
            #sfdc-dl-tracker .stat-val { font-size: 2.25rem; font-weight: 800; line-height: 1; margin-bottom: 0.25rem; color: #10b981; }
            #sfdc-dl-tracker .stat-desc { font-size: 0.875rem; color: #6b7280; margin-bottom: 1.5rem; }
            #sfdc-dl-btn-stop {
                width: 100%; padding: 0.75rem; background-color: #ef4444; color: white;
                border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: background-color 0.2s;
            }
            #sfdc-dl-btn-stop:hover { background-color: #dc2626; }
            #sfdc-dl-progress-container { width: 100%; background-color: #e5e7eb; border-radius: 9999px; height: 0.5rem; margin-bottom: 1.5rem; overflow: hidden; }
            #sfdc-dl-progress-bar { background-color: #10b981; height: 100%; width: 0%; transition: width 0.3s ease; }
        `;
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.id = "sfdc-dl-tracker";
    container.innerHTML = `
            <h3>🛡️ Event Log File Export</h3>
            <div class="stat-val" id="sfdc-dl-count">0 / ${totalDownloads}</div>
            <div class="stat-desc" style="display: flex; justify-content: space-between;">
                <span>Files Downloaded</span>
                <span id="sfdc-dl-eta" style="color: #10b981; font-weight: 600;">Est: --</span>
            </div>
            <div id="sfdc-dl-progress-container"><div id="sfdc-dl-progress-bar"></div></div>
            <button id="sfdc-dl-btn-stop">Stop Script</button>
        `;
    document.body.appendChild(container);

    document
      .getElementById("sfdc-dl-btn-stop")
      .addEventListener("click", () => {
        isRunning = false;
        logToUI("🛑 Stopping script after current file...");
        document.getElementById("sfdc-dl-btn-stop").innerText = "Stopping...";
        document.getElementById("sfdc-dl-btn-stop").style.backgroundColor =
          "#9ca3af";
      });
  };

  const logToUI = (msg) => {
    // Output to console only, keeping the visual UI clean
    console.log(msg);
  };

  const formatETA = (ms) => {
    if (!ms || ms < 0 || !isFinite(ms)) return "--";
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const updateCountUI = (count, total, startTime) => {
    const countEl = document.getElementById("sfdc-dl-count");
    if (countEl) countEl.innerText = `${count} / ${total}`;

    const pBar = document.getElementById("sfdc-dl-progress-bar");
    if (pBar) {
      const percentage = Math.min((count / total) * 100, 100);
      pBar.style.width = `${percentage}%`;
    }

    const etaEl = document.getElementById("sfdc-dl-eta");
    if (etaEl) {
      if (count > 0 && startTime) {
        // Dynamically calculate based on real elapsed time
        const elapsed = Date.now() - startTime;
        const timePerFile = elapsed / count;
        const remainingFiles = total - count;
        etaEl.innerText = `Est: ${formatETA(timePerFile * remainingFiles)}`;
      } else {
        // Static estimate before the first download finishes (Delays + ~500ms for UI/Clicks)
        const estimatedTimePerFile = DELAY_BETWEEN_DOWNLOADS_MS + 500;
        etaEl.innerText = `Est: ${formatETA(estimatedTimePerFile * total)}`;
      }
    }
  };

  const finishUI = () => {
    const pBar = document.getElementById("sfdc-dl-progress-bar");
    const btn = document.getElementById("sfdc-dl-btn-stop");
    const etaEl = document.getElementById("sfdc-dl-eta");
    if (pBar) {
      pBar.style.width = "100%";
    }
    if (btn) {
      btn.innerText = "Done";
      btn.style.backgroundColor = "#10b981";
      btn.disabled = true;
    }
    if (etaEl) {
      etaEl.innerText = "Done";
    }
  };

  // ==========================================
  // POPUP BLOCKER BYPASS / INTERCEPTOR
  // ==========================================
  const originalWindowOpen = window.open;
  window.open = function (url, target, features) {
    const hiddenLink = document.createElement("a");
    hiddenLink.href = url;
    hiddenLink.download = "";
    hiddenLink.target = "_self";

    document.body.appendChild(hiddenLink);
    hiddenLink.click();
    document.body.removeChild(hiddenLink);

    return { focus: () => {}, close: () => {}, closed: false };
  };

  window.addEventListener(
    "submit",
    (e) => {
      if (e.target && e.target.getAttribute("target") === "_blank") {
        e.target.setAttribute("target", "_self");
      }
    },
    true,
  );

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const deepQuerySelectorAll = (selector, root = document) => {
    const results = [];
    const traverse = (node) => {
      if (!node || !node.querySelectorAll) return;
      const matches = node.querySelectorAll(selector);
      if (matches.length > 0) results.push(...matches);

      const allElements = node.querySelectorAll("*");
      for (const el of allElements) {
        if (el.shadowRoot) traverse(el.shadowRoot);
      }
    };
    traverse(root);
    return [...new Set(results)];
  };

  // Safely climbs out of Shadow DOMs to find the parent Table Row (TR)
  const getShadowClosestTR = (el) => {
    let current = el;
    while (current) {
      if (current.nodeType === 1 && current.tagName === "TR") return current;
      current = current.parentNode || current.host;
    }
    return null;
  };

  // Generates a unique "fingerprint" for a row based on its text, handling Virtual Scrolling
  const getRowSignature = (btn) => {
    const tr = getShadowClosestTR(btn);
    if (tr) {
      // Use the row index if Salesforce provides it
      if (tr.getAttribute("aria-rowindex"))
        return "row-" + tr.getAttribute("aria-rowindex");
      if (tr.getAttribute("data-row-key-value"))
        return "key-" + tr.getAttribute("data-row-key-value");
      // Fallback: use the raw text content of the row (stripped of spaces) as a unique ID
      return "text-" + tr.innerText.replace(/\s+/g, "").substring(0, 100);
    }
    return "unknown-" + Math.random();
  };

  const waitForDownloadButton = async (text, timeout) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const elements = deepQuerySelectorAll(
        'a[role="menuitem"], lightning-menu-item a',
      );

      const targetBtn = elements.find((el) => {
        const hasText = el.textContent.trim().includes(text);
        if (!hasText) return false;

        const rect = el.getBoundingClientRect();
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <=
            (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <=
            (window.innerWidth || document.documentElement.clientWidth);

        const style = window.getComputedStyle(el);
        return (
          isVisible && style.opacity !== "0" && style.visibility !== "hidden"
        );
      });

      if (targetBtn) return targetBtn;
      await sleep(100);
    }
    return null;
  };

  // ==========================================
  // MAIN EXECUTION LOOP (VIRTUAL SCROLLING SAFE)
  // ==========================================
  console.log("Starting Salesforce Event Log Downloader...");

  // Auto-detect total downloads from the Salesforce UI text (e.g., "1227 events")
  let totalDownloads = null;
  const textElements = deepQuerySelectorAll(
    'lightning-formatted-rich-text span, span[part="formatted-rich-text"]',
  );

  for (const el of textElements) {
    const text = el.textContent || "";
    if (text.toLowerCase().includes("events")) {
      // Extracts numbers even if formatted with commas (e.g., "1,227 events")
      const match = text.match(/(\d+(?:,\d+)?)\s*events/i);
      if (match && match[1]) {
        totalDownloads = parseInt(match[1].replace(/,/g, ""), 10);
        console.log(
          `✅ Auto-detected total downloads from page: ${totalDownloads}`,
        );
        break;
      }
    }
  }

  // Fallback to prompt if the UI changed and we couldn't find the text
  if (!totalDownloads) {
    const userInput = prompt(
      "Could not auto-detect file count. How many total files are you downloading?",
      "1500",
    );
    totalDownloads = parseInt(userInput, 10) || 1500;
  }

  const TOTAL_EXPECTED_DOWNLOADS = totalDownloads;

  injectUI(TOTAL_EXPECTED_DOWNLOADS);
  logToUI(`🚀 Starting mass download of ${TOTAL_EXPECTED_DOWNLOADS} files...`);

  // Seed the UI with the initial static ETA before the loop starts
  updateCountUI(0, TOTAL_EXPECTED_DOWNLOADS, null);

  let consecutiveScrollsWithoutNewRows = 0;
  const scriptStartTime = Date.now();

  while (isRunning && consecutiveScrollsWithoutNewRows < 4) {
    let allDropdownButtons = deepQuerySelectorAll(
      'lightning-primitive-cell-actions button, lightning-primitive-cell-actions lightning-button-menu button, td[role="gridcell"] lightning-button-menu button',
    );

    // Filter strictly to visible buttons
    allDropdownButtons = allDropdownButtons.filter((btn) => {
      const rect = btn.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    // Find buttons we haven't processed yet using row signatures
    let unprocessedItems = [];
    for (let btn of allDropdownButtons) {
      const sig = getRowSignature(btn);
      if (!processedRowSignatures.has(sig)) {
        unprocessedItems.push({ btn, sig });
      }
    }

    if (unprocessedItems.length === 0) {
      // No new rows found. We need to scroll down to trigger Salesforce to render more.
      if (allDropdownButtons.length > 0) {
        logToUI("📜 Scrolling down to load more files...");
        allDropdownButtons[allDropdownButtons.length - 1].scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
      await sleep(2000); // Give the table time to fetch and render the next batch
      consecutiveScrollsWithoutNewRows++;
      continue;
    }

    // Reset scroll counter because we found fresh rows
    consecutiveScrollsWithoutNewRows = 0;

    for (let item of unprocessedItems) {
      if (!isRunning) break;

      try {
        // Ensure the button is fully in view so Salesforce activates the row
        item.btn.scrollIntoView({ behavior: "instant", block: "center" });
        await sleep(150);

        item.btn.click(); // Open menu

        const downloadBtn = await waitForDownloadButton(
          DOWNLOAD_BUTTON_TEXT,
          MAX_WAIT_FOR_MENU_MS,
        );

        if (downloadBtn) {
          // Vital fix: Wait a tiny fraction of a second AFTER the menu appears before clicking.
          // This prevents the 50% failure rate caused by clicking during Salesforce's LWC animations.
          await sleep(300);

          downloadBtn.click();
          successCount++;
          processedRowSignatures.add(item.sig);

          updateCountUI(
            successCount,
            TOTAL_EXPECTED_DOWNLOADS,
            scriptStartTime,
          );
          logToUI(`✅ Triggered download (${successCount})`);
        } else {
          errorCount++;
          processedRowSignatures.add(item.sig); // Mark as processed anyway so we don't infinitely loop on it
          logToUI(`⚠️ Skipping row (Could not find download link)`);
          item.btn.click(); // Close menu
        }

        await sleep(DELAY_BETWEEN_DOWNLOADS_MS);
      } catch (err) {
        processedRowSignatures.add(item.sig);
        logToUI(`❌ Error on row, skipping...`);
      }
    }
  }

  logToUI(`🎉 Script Finished! Total: ${successCount}`);
  finishUI();

  if (successCount > 5) {
    console.log(
      "Note: If your browser asked you for permission to 'Download multiple files', make sure to click 'Allow'.",
    );
  }
})();
