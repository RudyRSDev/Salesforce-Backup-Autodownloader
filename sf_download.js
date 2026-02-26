// Target all anchor tags that contain the word "download" (case-insensitive)
const downloadLinks = Array.from(document.querySelectorAll("a")).filter(
  (link) => link.innerText.toLowerCase().trim() === "download",
);

const totalFiles = downloadLinks.length;
const intervalMs = 30000; // 30 seconds

if (totalFiles === 0) {
  console.error(
    "❌ 0 files found. Make sure your console target is set to the correct frame.",
  );
} else {
  console.log(`🚀 Success! Found ${totalFiles} download links.`);
  console.log(
    `⏱️ Starting sequence... Estimated time: ${Math.round((totalFiles * 30) / 60)} minutes.`,
  );

  downloadLinks.forEach((link, index) => {
    setTimeout(() => {
      const fileNumber = index + 1;

      // Trigger download in a new tab/window to prevent the parent from refreshing
      window.open(link.href, "_blank");

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Opened download ${fileNumber} of ${totalFiles}.`,
      );

      if (fileNumber < totalFiles) {
        console.log(`⏳ Waiting 30 seconds for next file...`);
      } else {
        console.log(`🏁 All downloads triggered!`);
      }
    }, index * intervalMs);
  });
}
