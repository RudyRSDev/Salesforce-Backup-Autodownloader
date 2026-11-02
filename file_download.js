(async () => {
  // ==========================================
  // CONFIGURATION
  // ==========================================
  const DELAY_BETWEEN_DOWNLOADS_MS = 1000;
  const MAX_WAIT_FOR_MENU_MS = 3000;
  const MAX_WAIT_FOR_MENU_CLOSE_MS = 1000;
  const SCROLL_SETTLE_MS = 2000;
  const MAX_SCROLLS_WITHOUT_NEW_ROWS = 4;
  // Must match the menu item exactly: Delete and Remove from Record share this menu
  const DOWNLOAD_BUTTON_TEXT = "Download";

  // Covers both the Aura list grid and lightning-datatable row menus
  const ROW_MENU_SELECTOR = [
    "a.rowActionsPlaceHolder",
    "lightning-primitive-cell-actions button",
    "lightning-button-menu button",
    'tr a[aria-haspopup="true"]',
    'tr button[aria-haspopup="true"]',
  ].join(", ");
  const MENU_ITEM_SELECTOR =
    'a[role="menuitem"], button[role="menuitem"], lightning-menu-item a';
  const ITEM_COUNT_SELECTOR =
    ".countSortedByFilteredBy, .test-listViewStatusInfo, .slds-page-header__meta-text, force-list-view-manager-status-info";

  if (window.sfdcFileDownloadRunning) {
    console.warn("File download is already running in this tab.");
    return;
  }
  window.sfdcFileDownloadRunning = true;

  // Global state
  let isRunning = true;
  const processedRowSignatures = new Set();
  const skippedFiles = [];
  let successCount = 0;

  // ==========================================
  // DAISYUI-INSPIRED TRACKER (CSS INJECTION)
  // ==========================================
  const injectUI = () => {
    document.getElementById("sfdc-file-tracker")?.remove();
    document.getElementById("sfdc-file-styles")?.remove();

    const style = document.createElement("style");
    style.id = "sfdc-file-styles";
    style.textContent = `
            #sfdc-file-tracker {
                position:fixed;bottom:24px;right:24px;z-index:999999;box-sizing:border-box;
                width:320px;padding:20px;background:#fff;color:#1f2937;
                border:1px solid #d1d5db;border-radius:16px;
                box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04);
                font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            }
            #sfdc-file-tracker .sf-brand { display:flex;align-items:center;gap:10px;margin-bottom:14px; }
            #sfdc-file-tracker .sf-cloud-mark { display:block;flex:none;width:40px;height:32px; }
            #sfdc-file-tracker h3 { margin:0;font-size:17px;font-weight:700;color:#111827; }
            #sfdc-file-tracker .stat-val { margin-bottom:6px;font-size:32px;font-weight:800;line-height:1.1;color:#0176d3; }
            #sfdc-file-tracker .stat-desc { display:flex;justify-content:space-between;gap:8px;margin-bottom:16px;font-size:13px;color:#6b7280; }
            #sfdc-file-tracker #sfdc-file-eta { color:#0176d3;font-weight:600; }
            #sfdc-file-tracker .sf-progress-container { width:100%;height:10px;margin-bottom:16px;overflow:hidden;border-radius:999px;background:#e5e7eb; }
            #sfdc-file-tracker #sfdc-file-progress-bar { height:100%;width:0%;border-radius:inherit;background:#0176d3;transition:width .3s ease; }
            #sfdc-file-tracker .sf-actions { display:flex;justify-content:flex-end; }
            #sfdc-file-tracker .sf-btn { display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border:0;border-radius:8px;background:#dc2626!important;color:#fff!important;font:600 14px ui-sans-serif,system-ui,sans-serif;cursor:pointer;text-shadow:none!important; }
            #sfdc-file-tracker .sf-btn:hover { background:#b91c1c!important; }
            #sfdc-file-tracker .sf-btn.is-done { background:#0176d3!important; }
            @media(max-width:480px) { #sfdc-file-tracker { right:12px;bottom:12px;width:min(320px,calc(100vw - 24px)); } }
        `;
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.id = "sfdc-file-tracker";
    container.innerHTML = `
            <div class="sf-brand">
                <svg class="sf-cloud-mark" viewBox="0 0 640 512" role="img" aria-label="Cloud">
                    <path fill="#0176d3" d="M0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4 4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32 167.6 32 96 103.6 96 192c0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336z"/>
                </svg>
                <h3>File Export</h3>
            </div>
            <div class="stat-val" id="sfdc-file-count">0</div>
            <div class="stat-desc">
                <span id="sfdc-file-status">Files Downloaded</span>
                <span id="sfdc-file-eta">Est: --</span>
            </div>
            <div class="sf-progress-container" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div id="sfdc-file-progress-bar"></div></div>
            <div class="sf-actions"><button class="sf-btn" id="sfdc-file-btn-stop">Stop</button></div>
        `;
    document.body.appendChild(container);

    document
      .getElementById("sfdc-file-btn-stop")
      .addEventListener("click", () => {
        isRunning = false;
        console.log("Stopping script after current file...");
        document.getElementById("sfdc-file-btn-stop").innerText = "Stopping...";
        document.getElementById("sfdc-file-btn-stop").disabled = true;
      });
  };

  const formatETA = (ms) => {
    if (!ms || ms < 0 || !isFinite(ms)) return "--";
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const updateCountUI = (startTime) => {
    const { total, isExact } = getExpectedTotal();
    const finished = successCount + skippedFiles.length;

    const countEl = document.getElementById("sfdc-file-count");
    if (countEl) {
      countEl.innerText = `${successCount} / ${total}${isExact ? "" : "+"}`;
    }

    const statusEl = document.getElementById("sfdc-file-status");
    if (statusEl) {
      statusEl.innerText = skippedFiles.length
        ? `Files Downloaded, ${skippedFiles.length} skipped`
        : "Files Downloaded";
    }

    const pBar = document.getElementById("sfdc-file-progress-bar");
    if (pBar && total > 0) {
      pBar.style.width = `${Math.min((finished / total) * 100, 100)}%`;
    }

    const etaEl = document.getElementById("sfdc-file-eta");
    if (etaEl) {
      // A "50+" total is only a lower bound, so an ETA from it would mislead
      if (isExact && finished > 0) {
        const timePerFile = (Date.now() - startTime) / finished;
        etaEl.innerText = `Est: ${formatETA(timePerFile * (total - finished))}`;
      } else {
        etaEl.innerText = "Est: --";
      }
    }
  };

  const finishUI = (label) => {
    const btn = document.getElementById("sfdc-file-btn-stop");
    const etaEl = document.getElementById("sfdc-file-eta");
    if (btn) {
      btn.innerText = label;
      btn.classList.add("is-done");
      btn.disabled = true;
    }
    if (etaEl) {
      etaEl.innerText = label;
    }
  };

  // ==========================================
  // POPUP BLOCKER BYPASS / INTERCEPTOR
  // ==========================================
  const originalWindowOpen = window.open;
  window.open = function (url, target, features) {
    // A blank popup is filled in later by the caller, so it needs a real window
    if (!url) return originalWindowOpen.call(window, url, target, features);

    const hiddenLink = document.createElement("a");
    hiddenLink.href = url;
    hiddenLink.download = "";
    hiddenLink.target = "_self";

    document.body.appendChild(hiddenLink);
    hiddenLink.click();
    document.body.removeChild(hiddenLink);

    return { focus: () => {}, close: () => {}, closed: false };
  };

  const redirectBlankFormSubmit = (e) => {
    if (e.target && e.target.getAttribute("target") === "_blank") {
      e.target.setAttribute("target", "_self");
    }
  };
  window.addEventListener("submit", redirectBlankFormSubmit, true);

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

  const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  // Safely climbs out of Shadow DOMs to the body row, ignoring column header menus
  const getBodyRow = (el) => {
    let current = el;
    let row = null;
    while (current) {
      if (current.nodeType === 1) {
        if (current.tagName === "THEAD") return null;
        if (current.getAttribute("role") === "columnheader") return null;
        if (!row && current.tagName === "TR") row = current;
      }
      current = current.parentNode || current.host;
    }
    return row;
  };

  const getFileLink = (tr) =>
    deepQuerySelectorAll('a[data-recordid], a[href*="/069"]', tr)[0];

  // Generates a unique "fingerprint" for a row, handling Virtual Scrolling
  const getRowSignature = (tr) => {
    if (tr.getAttribute("data-row-key-value"))
      return "key-" + tr.getAttribute("data-row-key-value");

    const link = getFileLink(tr);
    if (link) {
      const recordId =
        link.getAttribute("data-recordid") ||
        link.getAttribute("href").match(/069[a-zA-Z0-9]{12,15}/)?.[0];
      if (recordId) return "id-" + recordId;
    }

    if (tr.getAttribute("aria-rowindex"))
      return "row-" + tr.getAttribute("aria-rowindex");
    // Fallback: use the raw text content of the row (stripped of spaces) as a unique ID
    return "text-" + tr.innerText.replace(/\s+/g, "").substring(0, 100);
  };

  const getFileLabel = (tr) =>
    getFileLink(tr)?.textContent.trim() ||
    tr.innerText.trim().split("\n")[0] ||
    "unknown file";

  // Maps each rendered row to its menu button. A row can match more than once;
  // the last match is the rightmost control, which is the row actions menu.
  const getRenderedRows = () => {
    const rows = new Map();
    for (const btn of deepQuerySelectorAll(ROW_MENU_SELECTOR)) {
      if (!isVisible(btn)) continue;
      const tr = getBodyRow(btn);
      if (tr) rows.set(getRowSignature(tr), { btn, tr });
    }
    return rows;
  };

  // Reads the list header (e.g., "12 items" or "50+ items"). A "+" means Salesforce
  // has not loaded every row yet, so the count is only a lower bound.
  const getExpectedTotal = () => {
    const seen = processedRowSignatures.size;
    for (const el of deepQuerySelectorAll(ITEM_COUNT_SELECTOR)) {
      if (!isVisible(el)) continue;
      const match = el.textContent.match(/(\d[\d,]*)(\+?)\s+items?\b/i);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ""), 10);
        return { total: Math.max(count, seen), isExact: !match[2] };
      }
    }
    return { total: seen, isExact: false };
  };

  const findDownloadButton = () =>
    deepQuerySelectorAll(MENU_ITEM_SELECTOR).find((el) => {
      if (el.textContent.trim() !== DOWNLOAD_BUTTON_TEXT) return false;

      const rect = el.getBoundingClientRect();
      const inViewport =
        isVisible(el) &&
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <=
          (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <=
          (window.innerWidth || document.documentElement.clientWidth);

      const style = window.getComputedStyle(el);
      return (
        inViewport && style.opacity !== "0" && style.visibility !== "hidden"
      );
    });

  const waitForDownloadButton = async (timeout) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const targetBtn = findDownloadButton();
      if (targetBtn) return targetBtn;
      await sleep(100);
    }
    return null;
  };

  // A menu left open would hand the next row this row's Download item
  const ensureMenuClosed = async (btn) => {
    const startTime = Date.now();
    while (Date.now() - startTime < MAX_WAIT_FOR_MENU_CLOSE_MS) {
      if (!findDownloadButton()) return;
      await sleep(100);
    }
    btn.click();
    await sleep(300);
  };

  // ==========================================
  // MAIN EXECUTION LOOP (VIRTUAL SCROLLING SAFE)
  // ==========================================
  console.log("Starting Salesforce File Downloader...");

  injectUI();

  let consecutiveScrollsWithoutNewRows = 0;
  const scriptStartTime = Date.now();

  try {
    while (
      isRunning &&
      consecutiveScrollsWithoutNewRows < MAX_SCROLLS_WITHOUT_NEW_ROWS
    ) {
      const renderedRows = getRenderedRows();

      // Find rows we haven't processed yet using row signatures
      const unprocessedItems = [];
      for (const [sig, row] of renderedRows) {
        if (!processedRowSignatures.has(sig)) {
          unprocessedItems.push({ ...row, sig });
        }
      }

      if (unprocessedItems.length === 0) {
        // No new rows found. We need to scroll down to trigger Salesforce to render more.
        const lastRow = [...renderedRows.values()].pop();
        if (lastRow) {
          console.log("Scrolling to load more files...");
          lastRow.btn.scrollIntoView({ behavior: "instant", block: "end" });
        }
        await sleep(SCROLL_SETTLE_MS);
        consecutiveScrollsWithoutNewRows++;
        continue;
      }

      // Reset scroll counter because we found fresh rows
      consecutiveScrollsWithoutNewRows = 0;

      for (const item of unprocessedItems) {
        if (!isRunning) break;

        // Scrolling can recycle a row for another file; the outer loop will pick it up
        if (!item.btn.isConnected || getRowSignature(item.tr) !== item.sig) {
          continue;
        }

        const label = getFileLabel(item.tr);
        processedRowSignatures.add(item.sig);

        try {
          // Ensure the button is fully in view so Salesforce activates the row
          item.btn.scrollIntoView({ behavior: "instant", block: "center" });
          await sleep(150);

          item.btn.click(); // Open menu

          const downloadBtn = await waitForDownloadButton(MAX_WAIT_FOR_MENU_MS);

          if (downloadBtn) {
            // Wait a fraction of a second after the menu appears so the click
            // doesn't land during Salesforce's LWC animations.
            await sleep(300);

            downloadBtn.click();
            successCount++;
            console.log(`Triggered download (${successCount}): ${label}`);
            await ensureMenuClosed(item.btn);
          } else {
            skippedFiles.push(label);
            console.warn(`Skipping "${label}" (no Download option).`);
            item.btn.click(); // Close menu
          }
        } catch (err) {
          skippedFiles.push(label);
          console.warn(`Error on "${label}"; skipping.`, err);
        }

        updateCountUI(scriptStartTime);
        await sleep(DELAY_BETWEEN_DOWNLOADS_MS);
      }
    }
  } finally {
    window.open = originalWindowOpen;
    window.removeEventListener("submit", redirectBlankFormSubmit, true);
    window.sfdcFileDownloadRunning = false;
  }

  if (processedRowSignatures.size === 0) {
    console.error(
      "No file rows found. Open the Files list with View All, and make sure the rows have loaded.",
    );
    finishUI("No files found");
    return;
  }

  updateCountUI(scriptStartTime);
  finishUI(isRunning ? "Done" : "Stopped");

  console.log(`Script finished. Total downloads triggered: ${successCount}.`);
  if (skippedFiles.length > 0) {
    console.warn("Skipped files:", skippedFiles);
  }
  if (successCount > 5) {
    console.log(
      "Note: If your browser asked you for permission to 'Download multiple files', make sure to click 'Allow'.",
    );
  }
})();
