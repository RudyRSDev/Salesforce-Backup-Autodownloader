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

// 3. Resolve all extracted paths to absolute URLs
const finalUrls = actualUrls.map(
  (url) => new URL(url, window.location.origin).href,
);
const totalFiles = finalUrls.length;

// Set to 65 seconds to clear the 429 Too Many Requests limit safely
const intervalMs = 65000;

if (totalFiles === 0) {
  console.error(
    "❌ No URLs extracted. Make sure you are in the correct frame.",
  );
} else {
  console.log(`🚀 Success! Extracted ${totalFiles} raw URLs.`);
  console.log(
    `⏱️ Starting sequence... Estimated time: ${((totalFiles * 65) / 3600).toFixed(1)} hours.`,
  );

  finalUrls.forEach((url, index) => {
    setTimeout(() => {
      const fileNumber = index + 1;

      // Inject hidden iframe to trigger download silently
      const dlFrame = document.createElement("iframe");
      dlFrame.style.display = "none";
      document.body.appendChild(dlFrame);
      dlFrame.src = url;

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Download ${fileNumber} of ${totalFiles} requested.`,
      );

      // Cleanup the hidden iframe after 60 seconds
      setTimeout(() => {
        if (document.body.contains(dlFrame)) document.body.removeChild(dlFrame);
      }, 60000);

      if (fileNumber < totalFiles) {
        console.log(`⏳ Waiting 65 seconds for the next file...`);
      } else {
        console.log(
          `🏁 All downloads triggered! Leave the browser open until the last file finishes saving.`,
        );
      }
    }, index * intervalMs);
  });
}
