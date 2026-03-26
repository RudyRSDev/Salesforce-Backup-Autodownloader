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
      let decodedUrl = decodeURIComponent(match[1]).replace(/^['"]|['"]$/g, "");
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
} else {
  // --- 3. CRASH RECOVERY RESUME LOGIC ---
  const STORAGE_KEY = "sf_export_resume_index";
  let startIndex = 0;
  const savedIndex = localStorage.getItem(STORAGE_KEY);

  if (savedIndex !== null) {
    const lastRequested = parseInt(savedIndex);

    if (lastRequested < totalFiles) {
      // New Crash Recovery Prompt
      const recoverCrash = confirm(
        `🛑 Previous session found!\n\n` +
          `The last file requested was File ${lastRequested + 1}.\n\n` +
          `⚠️ IF THE VM REBOOTED: This file is likely a corrupted '.crdownload'.\n\n` +
          `• Click "OK" to RE-DOWNLOAD File ${lastRequested + 1} and fix the error.\n` +
          `• Click "Cancel" to skip it and move to File ${lastRequested + 2}.`,
      );

      if (recoverCrash) {
        startIndex = lastRequested; // Re-run the broken file
      } else {
        startIndex = lastRequested + 1; // Advance normally

        // If they cancelled and the next index is out of bounds, clear it
        if (startIndex >= totalFiles) {
          localStorage.removeItem(STORAGE_KEY);
          startIndex = 0;
        }
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // --- 4. FLOATING UI SETUP ---
  let uiBox = document.getElementById("sf-dl-tracker");
  if (!uiBox) {
    uiBox = document.createElement("div");
    uiBox.id = "sf-dl-tracker";
    uiBox.style.cssText =
      "position:fixed; bottom:20px; right:20px; width:300px; background:#16325c; color:white; padding:15px; border-radius:8px; z-index:999999; font-family:sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid #0070d2;";
    document.body.appendChild(uiBox);
  }

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
    for (let i = startIndex; i < totalFiles; i++) {
      const fileNumber = i + 1;

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
          const secRemaining = (tick / 2).toFixed(1);
          const completed = Math.floor(((totalTicks - tick) / totalTicks) * 30);
          const progressBars =
            "█".repeat(completed) + "░".repeat(30 - completed);

          uiBox.innerHTML = `
                        <div style="font-weight:bold; margin-bottom:8px;">🚀 SF Precision Exporter</div>
                        <div style="margin-bottom:5px;">File: <b>${fileNumber}</b> of ${totalFiles}</div>
                        <div style="font-size:12px; margin-bottom:5px; color:#c9c7c5;">Cooldown... (${secRemaining}s)</div>
                        <div style="font-family:monospace; font-size:12px; letter-spacing:1px; color:#4bca81;">${progressBars}</div>
                    `;

          await wait(500); // 500ms tick
        }
      }
    }

    uiBox.innerHTML = `<div style="font-weight:bold; color:#4bca81;">✅ All ${totalFiles} Downloads Triggered!</div>`;
    localStorage.removeItem(STORAGE_KEY);
    console.log(`🏁 All downloads complete!`);
  })();
}
