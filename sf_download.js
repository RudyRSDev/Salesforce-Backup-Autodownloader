// 1. Grab all the download URLs
const links = Array.from(document.querySelectorAll("a"))
  .filter((l) => l.innerText.toLowerCase().trim() === "download")
  .map((l) => l.href);

if (links.length > 0) {
  // 2. Open a new blank window to act as our "Download Manager"
  const dlWindow = window.open("", "SF_Manager", "width=400,height=400");
  dlWindow.document.write(`
        <html><body>
            <h3>Salesforce Download Manager</h3>
            <p id="status">Starting ${links.length} downloads...</p>
            <script>
                const urls = ${JSON.stringify(links)};
                let index = 0;
                function triggerNext() {
                    if (index < urls.length) {
                        window.location.href = urls[index];
                        document.getElementById('status').innerText = "Downloading " + (index + 1) + " of " + urls.length;
                        index++;
                        setTimeout(triggerNext, 30000); // 30 second interval
                    } else {
                        document.getElementById('status').innerText = "All downloads complete!";
                    }
                }
                triggerNext();
            </script>
        </body></html>
    `);
} else {
  console.error(
    "No links found. Ensure the console is set to the correct frame.",
  );
}
