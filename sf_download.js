// Target all anchor tags that contain the word "download" (case-insensitive)
const downloadLinks = Array.from(document.querySelectorAll("a")).filter(
  (link) => link.innerText.toLowerCase().trim() === "download",
);

const totalFiles = downloadLinks.length;
const intervalMs = 30000; // 30 seconds

if (totalFiles === 0) {
  console.error(
    "❌ Still 0 files found. Make sure you are running this in the correct frame if Salesforce is using an iFrame.",
  );
} else {
  console.log(`🚀 Success! Found ${totalFiles} download links.`);
  console.log(
    `⏱️ Starting sequence... This will take approx ${Math.round((totalFiles * 30) / 60)} minutes.`,
  );

  downloadLinks.forEach((link, index) => {
    setTimeout(() => {
      const fileNumber = index + 1;

      // Trigger download
      link.click();

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Downloaded ${fileNumber} of ${totalFiles}.`,
      );

      if (fileNumber < totalFiles) {
        console.log(`⏳ Waiting 30 seconds for next file...`);
      }
    }, index * intervalMs);
  });
}
