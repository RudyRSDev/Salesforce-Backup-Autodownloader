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
  console.log(`🚀 Found ${totalFiles} links. Setting up hidden downloader...`);

  // 1. Create a hidden iframe to catch the downloads silently
  let iframe = document.getElementById("sf-secret-downloader");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "sf-secret-downloader";
    iframe.name = "sf-secret-downloader";
    iframe.style.display = "none"; // Keep it completely invisible
    document.body.appendChild(iframe);
  }

  // 2. Loop through the links and trigger them
  downloadLinks.forEach((link, index) => {
    setTimeout(() => {
      const fileNumber = index + 1;

      // Route the download action into the hidden iframe
      link.setAttribute("target", "sf-secret-downloader");

      // Execute the native click
      link.click();

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Triggered download ${fileNumber} of ${totalFiles}.`,
      );

      if (fileNumber < totalFiles) {
        console.log(`⏳ Waiting 30 seconds for next file...`);
      } else {
        console.log(`🏁 All downloads triggered!`);
      }
    }, index * intervalMs);
  });
}
