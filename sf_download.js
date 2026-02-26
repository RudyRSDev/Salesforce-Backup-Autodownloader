// 1. Find the download links using the specific class from your HTML
const downloadLinks = Array.from(
  document.querySelectorAll("a.actionLink"),
).filter((link) => link.innerText.toLowerCase().trim() === "download");

const actualUrls = [];

// 2. Decode and extract the raw download paths
downloadLinks.forEach((link) => {
  let href = link.getAttribute("href") || "";

  if (href.includes("srcUp")) {
    // Extract the encoded string inside srcUp(...)
    let match = href.match(/srcUp\(([^)]+)\)/);
    if (match && match[1]) {
      // Decode the URL (turns %2F into /, %3F into ?, etc.)
      let decodedUrl = decodeURIComponent(match[1]);
      // Strip off the remaining single quotes from the start and end
      decodedUrl = decodedUrl.replace(/^['"]|['"]$/g, "");
      actualUrls.push(decodedUrl);
    }
  } else if (href.includes("servlet.OrgExport")) {
    // For the first link, strip away the Lightning redirect wrapper
    // to get the direct server endpoint
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

if (finalUrls.length === 0) {
  console.error("❌ No URLs extracted. We missed something in the parsing.");
} else {
  console.log(`🚀 Success! Extracted ${finalUrls.length} raw URLs.`);

  // 4. Test the first 3 links
  const testUrls = finalUrls.slice(0, 3);
  console.log("🔬 Testing with these URLs:", testUrls);

  testUrls.forEach((url, index) => {
    setTimeout(() => {
      const fileNumber = index + 1;

      // Inject hidden iframe to trigger download silently
      const dlFrame = document.createElement("iframe");
      dlFrame.style.display = "none";
      document.body.appendChild(dlFrame);
      dlFrame.src = url;

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Download ${fileNumber} requested.`,
      );

      // Cleanup the hidden iframe after 60 seconds
      setTimeout(() => {
        if (document.body.contains(dlFrame)) document.body.removeChild(dlFrame);
      }, 60000);
    }, index * 5000); // 5-second interval for testing
  });
}
