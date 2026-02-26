// 1. Extract ONLY the raw URLs, completely ignoring the clickable elements
const downloadUrls = Array.from(document.querySelectorAll("a"))
  .filter((link) => link.innerText.toLowerCase().trim() === "download")
  .map((link) => link.href)
  .filter((href) => href && !href.includes("javascript:void(0)"));

const totalFiles = downloadUrls.length;
const intervalMs = 30000; // 30 seconds

if (totalFiles === 0) {
  console.error("❌ 0 URLs found. Ensure you are in the correct frame.");
} else {
  console.log(
    `🚀 Found ${totalFiles} valid URLs. Using the iframe injection method...`,
  );

  downloadUrls.forEach((url, index) => {
    setTimeout(() => {
      const fileNumber = index + 1;

      // 2. Create a temporary, invisible iframe for this specific download
      const dlFrame = document.createElement("iframe");
      dlFrame.style.display = "none";

      // 3. Append it to the page and assign the URL to trigger the download directly
      document.body.appendChild(dlFrame);
      dlFrame.src = url;

      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Download ${fileNumber} of ${totalFiles} requested.`,
      );

      // 4. Clean up the invisible iframe after 60 seconds to prevent slowing down the page
      setTimeout(() => {
        if (document.body.contains(dlFrame)) {
          document.body.removeChild(dlFrame);
        }
      }, 60000);

      if (fileNumber < totalFiles) {
        console.log(`⏳ Waiting 30 seconds for next file...`);
      } else {
        console.log(
          `🏁 All downloads triggered! Leave this page open until the last file finishes.`,
        );
      }
    }, index * intervalMs);
  });
}
