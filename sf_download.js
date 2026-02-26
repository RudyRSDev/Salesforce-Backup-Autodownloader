// 1. Find the download links
const downloadLinks = Array.from(document.querySelectorAll("a")).filter(
  (link) => link.innerText.toLowerCase().trim() === "download",
);

const actualUrls = [];

// 2. Aggressively rip the URLs out of the href attributes
downloadLinks.forEach((link) => {
  // Get the raw HTML attribute rather than the browser's interpreted href
  let href = link.getAttribute("href") || "";

  if (href.includes("srcUp")) {
    // Grab everything inside the parentheses: srcUp( ... )
    let match = href.match(/srcUp\((.*?)\)/);
    if (match && match[1]) {
      // Get the first parameter and strip out any quotes, spaces, or URL-encoded quotes (%27)
      let rawPath = match[1].split(",")[0].replace(/['"%27\s]/gi, "");

      // Construct the full URL to ensure the browser knows exactly where to go
      let fullUrl = rawPath.startsWith("http")
        ? rawPath
        : window.location.origin +
          (rawPath.startsWith("/") ? "" : "/") +
          rawPath;
      actualUrls.push(fullUrl);
    }
  } else if (!href.startsWith("javascript:")) {
    // Fallback just in case some links are standard
    actualUrls.push(link.href);
  }
});

// 3. Run a quick test on just the first 3 files
const testUrls = actualUrls.slice(0, 3);

if (testUrls.length === 0) {
  console.error(
    "❌ Still 0 URLs extracted. Please right-click one of the 'download' links on the page, select 'Inspect', and tell me exactly what the highlighted HTML code says.",
  );
} else {
  console.log(`🚀 Success! Extracted ${actualUrls.length} total URLs.`);
  console.log(
    `🔬 Testing the first ${testUrls.length} files to ensure they download correctly...`,
  );
  console.log(testUrls); // This will print the raw URLs to your console so you can verify them

  testUrls.forEach((url, index) => {
    setTimeout(() => {
      const fileNumber = index + 1;

      // Inject the hidden iframe to trigger the download directly from the server
      const dlFrame = document.createElement("iframe");
      dlFrame.style.display = "none";
      document.body.appendChild(dlFrame);
      dlFrame.src = url;

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Download ${fileNumber} requested.`,
      );

      // Clean up
      setTimeout(() => {
        if (document.body.contains(dlFrame)) document.body.removeChild(dlFrame);
      }, 60000);
    }, index * 5000); // 5-second interval for the quick test
  });
}
