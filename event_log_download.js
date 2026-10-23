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
  // DAISYUI-INSPIRED TRACKER (CSS INJECTION)
  // ==========================================
  const injectUI = (totalDownloads) => {
    const style = document.createElement("style");
    style.textContent = `
            #sfdc-dl-tracker {
                position:fixed;bottom:24px;right:24px;z-index:999999;box-sizing:border-box;
                width:320px;padding:20px;background:#fff;color:#1f2937;
                border:1px solid #d1d5db;border-radius:16px;
                box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04);
                font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            }
            #sfdc-dl-tracker .sf-brand { display:flex;align-items:center;gap:10px;margin-bottom:14px; }
            #sfdc-dl-tracker .sf-cloud-mark { display:block;flex:none;width:40px;height:32px; }
            #sfdc-dl-tracker h3 { margin:0;font-size:17px;font-weight:700;color:#111827; }
            #sfdc-dl-tracker .stat-val { margin-bottom:6px;font-size:32px;font-weight:800;line-height:1.1;color:#0176d3; }
            #sfdc-dl-tracker .stat-desc { display:flex;justify-content:space-between;gap:8px;margin-bottom:16px;font-size:13px;color:#6b7280; }
            #sfdc-dl-tracker #sfdc-dl-eta { color:#0176d3;font-weight:600; }
            #sfdc-dl-tracker .sf-progress-container { width:100%;height:10px;margin-bottom:16px;overflow:hidden;border-radius:999px;background:#e5e7eb; }
            #sfdc-dl-tracker #sfdc-dl-progress-bar { height:100%;width:0%;border-radius:inherit;background:#0176d3;transition:width .3s ease; }
            #sfdc-dl-tracker .sf-actions { display:flex;justify-content:flex-end; }
            #sfdc-dl-tracker .sf-btn { display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border:0;border-radius:8px;background:#dc2626!important;color:#fff!important;font:600 14px ui-sans-serif,system-ui,sans-serif;cursor:pointer;text-shadow:none!important; }
            #sfdc-dl-tracker .sf-btn:hover { background:#b91c1c!important; }
            #sfdc-dl-tracker .sf-btn.is-done { background:#0176d3!important; }
            @media(max-width:480px) { #sfdc-dl-tracker { right:12px;bottom:12px;width:min(320px,calc(100vw - 24px)); } }
        `;
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.id = "sfdc-dl-tracker";
    container.innerHTML = `
            <div class="sf-brand">
                <svg class="sf-cloud-mark" viewBox="0 0 640 512" role="img" aria-label="Cloud">
                    <path fill="#0176d3" d="M0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4 4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32 167.6 32 96 103.6 96 192c0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336z"/>
                </svg>
                <h3>Event Log Export</h3>
            </div>
            <div class="stat-val" id="sfdc-dl-count">0 / ${totalDownloads}</div>
            <div class="stat-desc">
                <span>Files Downloaded</span>
                <span id="sfdc-dl-eta">Est: --</span>
            </div>
            <div class="sf-progress-container" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div id="sfdc-dl-progress-bar"></div></div>
            <div class="sf-actions"><button class="sf-btn" id="sfdc-dl-btn-stop">Stop</button></div>
        `;
    document.body.appendChild(container);

    document
      .getElementById("sfdc-dl-btn-stop")
      .addEventListener("click", () => {
        isRunning = false;
        logToUI("Stopping script after current file...");
        document.getElementById("sfdc-dl-btn-stop").innerText = "Stopping...";
        document.getElementById("sfdc-dl-btn-stop").disabled = true;
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
      btn.classList.add("is-done");
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
          `Auto-detected total downloads from page: ${totalDownloads}`,
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
  logToUI(`Starting download of ${TOTAL_EXPECTED_DOWNLOADS} files...`);

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
        logToUI("Scrolling to load more files...");
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
          logToUI(`Triggered download (${successCount})`);
        } else {
          errorCount++;
          processedRowSignatures.add(item.sig); // Mark as processed anyway so we don't infinitely loop on it
          logToUI("Skipping row (could not find download link).");
          item.btn.click(); // Close menu
        }

        await sleep(DELAY_BETWEEN_DOWNLOADS_MS);
      } catch (err) {
        processedRowSignatures.add(item.sig);
        logToUI("Error on row; skipping.");
      }
    }
  }

  logToUI(`Script finished. Total downloads triggered: ${successCount}.`);
  finishUI();

  if (successCount > 5) {
    console.log(
      "Note: If your browser asked you for permission to 'Download multiple files', make sure to click 'Allow'.",
    );
  }
})();
