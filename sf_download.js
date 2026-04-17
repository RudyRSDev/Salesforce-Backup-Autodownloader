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
      "❌ No URLs extracted. Make sure you are in the correct frame.",
    );
    return; // Stop execution
  }

  // --- 3. 3-OPTION RESUME LOGIC ---
  const STORAGE_KEY = "sf_export_resume_index";
  let startIndex = 0;
  const savedIndex = localStorage.getItem(STORAGE_KEY);

  if (savedIndex !== null) {
    const lastRequested = parseInt(savedIndex);

    if (lastRequested < totalFiles) {
      // New 3-Option Prompt
      const choice = prompt(
        `🛑 Previous session found!\n` +
          `The last file requested was File ${lastRequested + 1}.\n\n` +
          `Type the NUMBER of your choice and click OK:\n\n` +
          `[1] RE-DOWNLOAD File ${lastRequested + 1} (Fixes .crdownload crash)\n` +
          `[2] ADVANCE to File ${lastRequested + 2} (Skip the last one)\n` +
          `[3] RESTART from File 1 (Clear all progress)`,
      );

      if (choice === "1") {
        console.log(
          `🔄 Option 1 Selected: Re-downloading File ${lastRequested + 1}...`,
        );
        startIndex = lastRequested;
      } else if (choice === "2") {
        console.log(
          `⏭️ Option 2 Selected: Advancing to File ${lastRequested + 2}...`,
        );
        startIndex = lastRequested + 1;

        // If they advanced past the final file, end the script
        if (startIndex >= totalFiles) {
          console.log(`🏁 Advanced past the last file. Clearing save data.`);
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
      } else if (choice === "3") {
        console.log(`⏮️ Option 3 Selected: Restarting from File 1...`);
        startIndex = 0;
        localStorage.removeItem(STORAGE_KEY);
      } else {
        // If they hit Cancel or typed something else, abort safely
        console.error("❌ Resume cancelled by user. Script aborted.");
        return;
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // --- 4. FLOATING UI SETUP (DaisyUI Light Theme) ---
  let uiBox = document.getElementById("sf-dl-tracker");
  if (!uiBox) {
    uiBox = document.createElement("div");
    uiBox.id = "sf-dl-tracker";
    uiBox.style.cssText =
      'position:fixed; bottom:24px; right:24px; width:320px; background:#ffffff; color:#1f2937; padding:20px; border-radius:1rem; z-index:999999; font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); border:1px solid #e5e7eb; transition:all 0.3s ease;';
    document.body.appendChild(uiBox);

    // Add event delegation for the new stop button
    uiBox.addEventListener("click", (e) => {
      if (e.target.id === "sf-stop-btn") {
        window.sfExporterStopped = true;
      }
    });
  }

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
    let lastFileProcessed = startIndex;

    for (let i = startIndex; i < totalFiles; i++) {
      if (window.sfExporterStopped) break;

      const fileNumber = i + 1;
      lastFileProcessed = fileNumber;

      // Save state (the current file being processed)
      localStorage.setItem(STORAGE_KEY, i);

      // Recycle iframe to trigger download
      masterFrame.src = "about:blank";
      await wait(500);
      masterFrame.src = finalUrls[i];

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Download ${fileNumber} requested.`,
      );

      if (fileNumber % 50 === 0) {
        console.clear();
        console.log(
          `🧹 Console purged to save RAM. Continuing from file ${fileNumber}...`,
        );
      }

      // 60.5 second precision countdown
      if (fileNumber < totalFiles) {
        const totalTicks = 121; // 121 ticks of 500ms = 60.5 seconds

        for (let tick = totalTicks; tick > 0; tick--) {
          if (window.sfExporterStopped) break;

          const secRemaining = (tick / 2).toFixed(1);
          const percent = (((totalTicks - tick) / totalTicks) * 100).toFixed(1);

          uiBox.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                            <div style="font-weight: 700; font-size: 1.125rem; color: #111827;">🚀 SF Exporter</div>
                            <div style="font-size: 0.875rem; font-weight: 600; color: #22c55e;">${percent}%</div>
                        </div>
                        <div style="display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 1rem;">
                            <div>
                                <div style="font-size: 0.875rem; color: #4b5563; margin-bottom: 0.25rem;">
                                    File <b>${fileNumber}</b> of <b>${totalFiles}</b>
                                </div>
                                <div style="font-size: 0.75rem; color: #6b7280;">
                                    Cooldown... (${secRemaining}s remaining)
                                </div>
                            </div>
                            <button id="sf-stop-btn" style="background-color: #ef4444; color: #ffffff; padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; border: none; cursor: pointer; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: opacity 0.2s;">Stop</button>
                        </div>
                        <div style="width: 100%; background-color: #e5e7eb; border-radius: 9999px; height: 0.75rem; overflow: hidden;">
                            <div style="background-color: #22c55e; height: 100%; border-radius: 9999px; width: ${percent}%; transition: width 0.5s linear;"></div>
                        </div>
                    `;

          await wait(500); // 500ms tick
        }
      }
    }

    if (window.sfExporterStopped) {
      uiBox.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <svg style="width: 1.5rem; height: 1.5rem; color: #ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div style="font-weight: 700; font-size: 1.125rem; color: #111827;">Export Stopped</div>
                </div>
                <div style="font-size: 0.875rem; color: #4b5563; margin-top: 0.5rem;">Stopped at file ${lastFileProcessed}. Progress saved.</div>
            `;
      console.log(`🛑 Export manually stopped. You can resume later.`);
    } else {
      uiBox.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <svg style="width: 1.5rem; height: 1.5rem; color: #22c55e;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    <div style="font-weight: 700; font-size: 1.125rem; color: #111827;">All Downloads Triggered!</div>
                </div>
                <div style="font-size: 0.875rem; color: #4b5563; margin-top: 0.5rem;">${totalFiles} files processed.</div>
            `;
      localStorage.removeItem(STORAGE_KEY);
      console.log(`🏁 All downloads complete!`);
    }
  })();
})();
