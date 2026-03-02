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
      let decodedUrl = decodeURIComponent(match[1]);
      decodedUrl = decodedUrl.replace(/^['"]|['"]$/g, "");
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
  // --- 3. RESUME LOGIC ---
  const STORAGE_KEY = "sf_export_resume_index";
  let startIndex = 0;
  const savedIndex = localStorage.getItem(STORAGE_KEY);

  // Check if we have a saved state from before the VM shut down
  if (savedIndex !== null && parseInt(savedIndex) < totalFiles) {
    const wantsResume = confirm(
      `🛑 Previous session found!\n\nDo you want to resume from file ${parseInt(savedIndex) + 1} of ${totalFiles}?\n\n(Click "Cancel" to start over from file 1)`,
    );
    if (wantsResume) {
      startIndex = parseInt(savedIndex);
      console.log(`▶️ Resuming from file ${startIndex + 1}...`);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      console.log(`🔄 Starting fresh from file 1...`);
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

  // --- 5. ASYNC EXECUTION ROUTINE ---
  // We use a promise wrapper here just so we can pause the UI timer easily without crashing the browser
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  (async function startDownloading() {
    for (let i = startIndex; i < totalFiles; i++) {
      const fileNumber = i + 1;

      // Save current progress to browser memory in case the VM shuts down right now
      localStorage.setItem(STORAGE_KEY, i);

      // Inject hidden iframe to trigger download silently
      const dlFrame = document.createElement("iframe");
      dlFrame.style.display = "none";
      document.body.appendChild(dlFrame);
      dlFrame.src = finalUrls[i];

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Download ${fileNumber} requested.`,
      );

      // Cleanup the hidden iframe after 60 seconds
      setTimeout(() => {
        if (document.body.contains(dlFrame)) document.body.removeChild(dlFrame);
      }, 60000);

      // 65-second wait with live progress bar update
      if (fileNumber < totalFiles) {
        for (let sec = 65; sec > 0; sec--) {
          // Create the text-based loading bar
          const completed = Math.floor(((65 - sec) / 65) * 30);
          const progressBars =
            "█".repeat(completed) + "░".repeat(30 - completed);

          uiBox.innerHTML = `
                        <div style="font-weight:bold; margin-bottom:8px;">Salesforce Exporter</div>
                        <div style="margin-bottom:5px;">File: <b>${fileNumber}</b> of ${totalFiles}</div>
                        <div style="font-size:12px; margin-bottom:5px; color:#c9c7c5;">Next download in: ${sec}s</div>
                        <div style="font-family:monospace; font-size:12px; letter-spacing:1px; color:#4bca81;">${progressBars}</div>
                    `;

          await wait(1000); // Tick down exactly 1 second
        }
      }
    }

    // --- CLEANUP AFTER FULL COMPLETION ---
    uiBox.innerHTML = `<div style="font-weight:bold; color:#4bca81;">✅ All ${totalFiles} Downloads Triggered!</div>`;
    localStorage.removeItem(STORAGE_KEY);
    console.log(`🏁 All downloads complete! Resume data cleared.`);
  })();
}
