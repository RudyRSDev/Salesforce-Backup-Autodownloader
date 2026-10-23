(function () {
  // 1. Find the download links using the specific class from your HTML
  const downloadLinks = Array.from(
    document.querySelectorAll("a.actionLink"),
  ).filter((link) => link.innerText.toLowerCase().trim() === "download");

  const actualUrls = [];

  // 2. Decode and extract the raw download paths
  downloadLinks.forEach((link) => {
    let href = link.getAttribute("href") || "";
    if (href.includes("srcUp")) {
      let match = href.match(/srcUp\(([^)]+)\)/);
      if (match && match[1]) {
        let decodedUrl = decodeURIComponent(match[1]).replace(
          /^['"]|['"]$/g,
          "",
        );
        actualUrls.push(decodedUrl);
      }
    } else if (href.includes("servlet.OrgExport")) {
      let startIdx = href.indexOf("/servlet/");
      if (startIdx !== -1) {
        actualUrls.push(href.substring(startIdx));
      } else {
        actualUrls.push(href);
      }
    }
  });

  const finalUrls = actualUrls.map(
    (url) => new URL(url, window.location.origin).href,
  );
  const totalFiles = finalUrls.length;

  if (totalFiles === 0) {
    console.error(
      "No URLs extracted. Make sure you are in the correct frame.",
    );
    return; // Stop execution
  }

  // --- 3. RESUME STATE ---
  const STORAGE_KEY = "sf_export_resume_index";
  const END_STORAGE_KEY = "sf_export_resume_end";
  const savedIndexValue = localStorage.getItem(STORAGE_KEY);
  const savedIndex = savedIndexValue === null ? null : Number(savedIndexValue);
  const savedEndValue = localStorage.getItem(END_STORAGE_KEY);
  const savedEnd = savedEndValue === null ? totalFiles : Number(savedEndValue);
  const hasSavedProgress =
    savedIndex !== null &&
    Number.isInteger(savedIndex) &&
    savedIndex >= 0 &&
    savedIndex < totalFiles;

  if (savedIndexValue !== null && !hasSavedProgress) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(END_STORAGE_KEY);
  }

  // --- 4. FLOATING UI SETUP (DaisyUI Light Theme) ---
  let uiBox = document.getElementById("sf-dl-tracker");
  if (!uiBox) {
    uiBox = document.createElement("div");
    uiBox.id = "sf-dl-tracker";
    uiBox.className = "sf-card";
    document.body.appendChild(uiBox);

    if (!document.getElementById("sf-dl-styles")) {
      const style = document.createElement("style");
      style.id = "sf-dl-styles";
      style.textContent = `
        #sf-dl-tracker.sf-card { position:fixed;bottom:24px;right:24px;width:320px;box-sizing:border-box;padding:20px;background:#fff;color:#1f2937;border:1px solid #d1d5db;border-radius:16px;z-index:999999;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04); }
        #sf-dl-tracker .sf-brand,#sf-dl-options .sf-brand { display:flex;align-items:center;gap:10px; }
        .sf-cloud-mark { display:block;flex:none;width:40px;height:32px; }
        #sf-dl-tracker .sf-title { margin:0;font-size:18px;font-weight:700;color:#111827; }
        #sf-dl-tracker .sf-subtitle { margin:10px 0;color:#4b5563; }
        #sf-dl-tracker .sf-row { display:flex;align-items:center;justify-content:space-between;gap:12px; }
        #sf-dl-tracker .sf-progress-track { width:100%;height:10px;overflow:hidden;border-radius:999px;background:#e5e7eb; }
        #sf-dl-tracker .sf-progress-bar { height:100%;border-radius:inherit;background:#0176d3;transition:width .5s linear; }
        #sf-dl-tracker .sf-actions { display:flex;justify-content:flex-end;margin-top:14px; }
        #sf-dl-tracker .sf-btn,#sf-dl-options .sf-btn { display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border:1px solid transparent;border-radius:8px;background:#0176d3!important;color:#fff!important;font:600 14px ui-sans-serif,system-ui,sans-serif;cursor:pointer;text-shadow:none!important;box-shadow:none!important; }
        #sf-dl-tracker .sf-btn:hover,#sf-dl-options .sf-btn-primary:hover { background:#014486!important; }
        #sf-dl-tracker .sf-btn-danger,#sf-dl-options .sf-btn-danger { background:#dc2626!important;color:#fff!important; }
        #sf-dl-tracker .sf-btn-danger:hover,#sf-dl-options .sf-btn-danger:hover { background:#b91c1c!important; }
        #sf-dl-options { position:fixed;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:16px;background:rgba(17,24,39,.6);z-index:1000001;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        #sf-dl-options .sf-dialog { box-sizing:border-box;width:min(100%,480px);max-height:90vh;overflow:auto;padding:24px;background:#fff;color:#1f2937;border:1px solid #d1d5db;border-radius:16px;box-shadow:0 20px 25px rgba(0,0,0,.25); }
        #sf-dl-options .sf-title { margin:0;font-size:20px;font-weight:700;color:#111827; }
        #sf-dl-options .sf-description { margin:16px 0;color:#4b5563; }
        #sf-dl-options .sf-fields { display:flex;gap:12px;margin-bottom:16px; }
        #sf-dl-options .sf-field { flex:1;display:block;font-size:13px;font-weight:600; }
        #sf-dl-options .sf-input { box-sizing:border-box;width:100%;min-height:40px;margin-top:5px;padding:8px 10px;border:1px solid #9ca3af;border-radius:8px;background:#fff;color:#1f2937;font:14px ui-sans-serif,system-ui,sans-serif; }
        #sf-dl-options .sf-input:focus { outline:2px solid #0176d3;outline-offset:1px;border-color:#0176d3; }
        #sf-dl-options .sf-error { margin:8px 0;color:#b91c1c;font-size:13px; }
        #sf-dl-options .sf-actions { display:flex;justify-content:flex-end;gap:8px;margin-top:20px; }
        @media(max-width:480px) { #sf-dl-tracker.sf-card { right:12px;bottom:12px;width:min(320px,calc(100vw - 24px)); } #sf-dl-options .sf-fields { flex-direction:column; } }
      `;
      document.head.appendChild(style);
    }

    // Add event delegation for the new stop button
    uiBox.addEventListener("click", (e) => {
      if (e.target.id === "sf-stop-btn") {
        window.sfExporterStopped = true;
      }
    });
  }

  const getDownloadOptions = () =>
    new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.id = "sf-dl-options";
      const defaultStart = hasSavedProgress ? savedIndex + 1 : 1;
      const defaultEnd =
        hasSavedProgress &&
        Number.isInteger(savedEnd) &&
        savedEnd > savedIndex &&
        savedEnd <= totalFiles
          ? savedEnd
          : totalFiles;
      modal.innerHTML = `
        <section class="sf-dialog" role="dialog" aria-modal="true" aria-labelledby="sf-dl-title">
          <div class="sf-brand">
            <svg class="sf-cloud-mark" viewBox="0 0 640 512" role="img" aria-label="Cloud">
              <path fill="#0176d3" d="M0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4 4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32 167.6 32 96 103.6 96 192c0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336z"/>
            </svg>
            <h2 id="sf-dl-title" class="sf-title">Backup Downloader</h2>
          </div>
          <p class="sf-description">${hasSavedProgress ? `Previous progress found. The last requested file was ${savedIndex + 1}.` : `${totalFiles} download files found.`}</p>
          <div class="sf-fields">
            <label class="sf-field">First file
              <input class="sf-input" id="sf-dl-start" type="number" min="1" max="${totalFiles}" value="${defaultStart}">
            </label>
            <label class="sf-field">Last file
              <input class="sf-input" id="sf-dl-end" type="number" min="1" max="${totalFiles}" value="${defaultEnd}">
            </label>
          </div>
          <label class="sf-field">Wait between downloads (seconds, minimum 60)
            <input class="sf-input" id="sf-dl-wait" type="number" min="60" step="1" value="60">
          </label>
          <p id="sf-dl-error" class="sf-error" role="alert" hidden></p>
          <div class="sf-actions">
            <button type="button" data-action="download" class="sf-btn sf-btn-primary">Download</button>
            <button type="button" data-action="cancel" class="sf-btn sf-btn-danger">Cancel</button>
          </div>
        </section>`;

      document.body.appendChild(modal);

      modal.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const action = button.dataset.action;
        if (action === "cancel") {
          modal.remove();
          resolve(null);
          return;
        }

        const startInput = modal.querySelector("#sf-dl-start");
        const endInput = modal.querySelector("#sf-dl-end");
        const waitInput = modal.querySelector("#sf-dl-wait");
        let firstFile = Number(startInput.value);
        let lastFile = Number(endInput.value);
        const waitSeconds = Number(waitInput.value);

        const error = modal.querySelector("#sf-dl-error");
        if (
          !Number.isInteger(firstFile) ||
          !Number.isInteger(lastFile) ||
          firstFile < 1 ||
          lastFile > totalFiles ||
          firstFile > lastFile
        ) {
          error.textContent = `Enter a valid file range from 1 to ${totalFiles}.`;
          error.hidden = false;
          return;
        }
        if (!Number.isSafeInteger(waitSeconds) || waitSeconds < 60) {
          error.textContent = "Wait time must be a whole number of at least 60 seconds.";
          error.hidden = false;
          return;
        }

        modal.remove();
        resolve({
          startIndex: firstFile - 1,
          endIndex: lastFile,
          waitMs: waitSeconds * 1000,
        });
      });
    });

  // Reset flag when starting a new run
  window.sfExporterStopped = false;

  // --- 5. MASTER IFRAME (RAM Saver) ---
  let masterFrame = document.getElementById("sf-master-dl-frame");
  if (!masterFrame) {
    masterFrame = document.createElement("iframe");
    masterFrame.id = "sf-master-dl-frame";
    masterFrame.style.display = "none";
    document.body.appendChild(masterFrame);
  }

  // --- 6. PRECISION ASYNC EXECUTION ---
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  (async function startDownloading() {
    const options = await getDownloadOptions();
    if (!options) {
      console.log("Download cancelled.");
      return;
    }
    const { startIndex, endIndex, waitMs } = options;
    let lastFileProcessed = startIndex;

    localStorage.setItem(END_STORAGE_KEY, endIndex);
    for (let i = startIndex; i < endIndex; i++) {
      if (window.sfExporterStopped) break;

      const fileNumber = i + 1;
      lastFileProcessed = fileNumber;

      // Save state (the current file being processed)
      localStorage.setItem(STORAGE_KEY, i);

      masterFrame.src = "about:blank";
      await wait(500);
      masterFrame.src = finalUrls[i];

      console.log(
        `[${new Date().toLocaleTimeString()}] Download ${fileNumber} requested.`,
      );

      if (fileNumber % 50 === 0) {
        console.clear();
        console.log(
          `Console cleared to save memory. Continuing from file ${fileNumber}...`,
        );
      }

      if (fileNumber < endIndex) {
        const deadline = Date.now() + waitMs;

        while (!window.sfExporterStopped) {
          const remainingMs = Math.max(0, deadline - Date.now());
          const secRemaining = (remainingMs / 1000).toFixed(1);
          const percent = (((waitMs - remainingMs) / waitMs) * 100).toFixed(1);

          uiBox.innerHTML = `
            <div class="sf-brand">
              <svg class="sf-cloud-mark" viewBox="0 0 640 512" role="img" aria-label="Cloud">
                <path fill="#0176d3" d="M0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4 4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32 167.6 32 96 103.6 96 192c0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336z"/>
              </svg>
              <h2 class="sf-title">Backup Downloader</h2>
            </div>
            <div class="sf-row sf-subtitle">
              <span>File <b>${fileNumber}</b> of <b>${totalFiles}</b></span>
              <span>${percent}%</span>
            </div>
            <p class="sf-subtitle">Waiting ${secRemaining}s before the next download</p>
            <div class="sf-progress-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
              <div class="sf-progress-bar" style="width:${percent}%"></div>
            </div>
            <div class="sf-actions">
              <button id="sf-stop-btn" class="sf-btn sf-btn-danger" type="button">Stop</button>
            </div>`;

          if (remainingMs === 0) break;
          await wait(Math.min(500, remainingMs));
        }
      }
    }

    if (window.sfExporterStopped) {
      uiBox.innerHTML = `
        <div class="sf-brand">
          <svg class="sf-cloud-mark" viewBox="0 0 640 512" role="img" aria-label="Cloud">
            <path fill="#0176d3" d="M0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4 4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32 167.6 32 96 103.6 96 192c0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336z"/>
          </svg>
          <h2 class="sf-title">Export stopped</h2>
        </div>
        <p class="sf-subtitle">Stopped at file ${lastFileProcessed}. Progress saved.</p>`;
      console.log("Export stopped. You can resume later.");
    } else {
      uiBox.innerHTML = `
        <div class="sf-brand">
          <svg class="sf-cloud-mark" viewBox="0 0 640 512" role="img" aria-label="Cloud">
            <path fill="#0176d3" d="M0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4 4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32 167.6 32 96 103.6 96 192c0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336z"/>
          </svg>
          <h2 class="sf-title">Downloads complete</h2>
        </div>
        <p class="sf-subtitle">${endIndex - startIndex} files processed (files ${startIndex + 1}-${endIndex}).</p>`;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(END_STORAGE_KEY);
      console.log("All downloads complete.");
    }
  })();
})();
