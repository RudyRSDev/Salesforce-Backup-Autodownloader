// Get all links on the page
const links = document.querySelectorAll("a");

// Filter for links that contain the Salesforce download pattern
const downloadLinks = Array.from(links).filter(
  (link) =>
    link.href.includes("servlet.shepherd/document/download") ||
    link.innerText === "Download",
);

const totalFiles = downloadLinks.length;
const intervalMs = 30000; // 30 seconds

console.log(`🚀 Automation Started: ${totalFiles} files found.`);
console.log(
  `⏱️ Interval set to ${intervalMs / 1000} seconds. Please keep this tab open.`,
);

downloadLinks.forEach((link, index) => {
  setTimeout(() => {
    const fileNumber = index + 1;
    const remaining = totalFiles - fileNumber;

    // Trigger the download
    link.click();

    // Log confirmation to the console
    console.log(
      `✅ [${new Date().toLocaleTimeString()}] Started download for file ${fileNumber} of ${totalFiles}.`,
    );

    if (remaining > 0) {
      console.log(`⏳ Next download in 30 seconds... (${remaining} remaining)`);
    } else {
      console.log(
        `🎉 Success! All ${totalFiles} downloads have been initiated.`,
      );
    }
  }, index * intervalMs);
});
