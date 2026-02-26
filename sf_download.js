// 1. Find the download links
const downloadLinks = Array.from(document.querySelectorAll("a")).filter(
  (link) => link.innerText.toLowerCase().trim() === "download",
);

const actualUrls = [];

// 2. Rip the true URLs out of Salesforce's srcUp() function
downloadLinks.forEach((link) => {
  let href = link.getAttribute("href");

  if (href && href.includes("srcUp(")) {
    // Extract the hidden string inside srcUp('...')
    const match = href.match(/srcUp\(['"]([^'"]+)['"]\)/);
    if (match && match[1]) {
      let cleanUrl = match[1];
      // Decode it if Salesforce URL-encoded the slashes (e.g. %2Fservlet...)
      if (cleanUrl.includes("%2F") || cleanUrl.includes("%3F")) {
        cleanUrl = decodeURIComponent(cleanUrl);
      }
      // Resolve to a full URL
      actualUrls.push(new URL(cleanUrl, window.location.origin).href);
    }
  } else if (href && !href.startsWith("javascript:")) {
    // Fallback for standard links
    actualUrls.push(link.href);
  }
});

const totalFiles = actualUrls.length;
const intervalMs = 30000; // 30 seconds

if (totalFiles === 0) {
  console.error("❌ 0 URLs extracted. Double-check your iframe target.");
} else {
  console.log(
    `🚀 Successfully ripped ${totalFiles} raw URLs! Bypassing Salesforce scripts...`,
  );

  // 3. Download using the raw URLs
  actualUrls.forEach((url, index) => {
    setTimeout(() => {
      const fileNumber = index + 1;

      // Create a temporary, invisible iframe for the raw URL
      const dlFrame = document.createElement("iframe");
      dlFrame.style.display = "none";
      document.body.appendChild(dlFrame);

      // Trigger download directly from the server endpoint
      dlFrame.src = url;

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Download ${fileNumber} of ${totalFiles} requested.`,
      );

      // Clean up the iframe after 60 seconds
      setTimeout(() => {
        if (document.body.contains(dlFrame)) document.body.removeChild(dlFrame);
      }, 60000);

      if (fileNumber < totalFiles) {
        console.log(`⏳ Waiting 30 seconds for next file...`);
      } else {
        console.log(`🏁 All downloads triggered!`);
      }
    }, index * intervalMs);
  });
}
