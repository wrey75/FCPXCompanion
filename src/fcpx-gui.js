scanDirectories("/Users/wrey").then((v) => {
    currentScanned = "DONE";
    console.log(v + " directories scanned.");
});

function escapeHtml(text) {
    var map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };

    return text.replace(/[&<>"']/g, function (m) {
        return map[m];
    });
}

function scanShowProgress() {
    var path = "";
    console.log("AT " + currentScanned);
    var parts = currentScanned.split("/");
    if (parts.length > 2) {
        path = parts[0];
        var i = 1;
        while (i < parts.length - 1 && path.length + parts[parts.length - 1].length < 40) {
            path = path + "/" + parts[i++];
        }
        if (i < parts.length - 1) {
            path = path + "/...";
        }
        path = path + "/" + parts[parts.length - 1];
    } else {
        console.error("NOT SPLITTED? ", parts);
        path = currentScanned;
    }
    const size = Math.floor((scannedDirectories * 100.0) / nbDirectories);
    const text = "width: " + size + "%";
    const domScan = document.getElementById("scanProgress");
    domScan.getElementsByTagName("div")[0].style = text;
    document.getElementById("scanText").innerText = "Scanning " + path + "...";
    listOfLibraries = "";
    fcpxLibraries.forEach((lib) => {
        listOfLibraries += "<li><b>" + escapeHtml(lib.name) + "</b> (<small>" + escapeHtml(lib.path) + "</small>)</b></li>";
    });
    document.getElementById("libraryList").innerHTML = listOfLibraries;
}

setInterval(scanShowProgress, 30);
