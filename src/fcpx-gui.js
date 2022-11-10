function diskSize(bytes) {
    console.log("diskSize("+bytes+")")
    if (bytes === 0){
        return "0";
    } else if (bytes > 1024 * 1024 * 100) {
        return Number.parseFloat(bytes / 1024 / 1024 / 1024).toFixed(1) + "&nbsp;GB";
    } else if (bytes > 1024 * 100) {
        return Number.parseFloat(bytes / 1024 / 1024).toFixed(1) + "&nbsp;MB";
    } else {
        return Number.parseFloat(bytes / 1024).toFixed(1) + "&nbsp;KB";
    }
}

function escapeHtml(text) {
    var map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
    };

    return text.replace(/[&<>"']/g, function (m) {
        return map[m];
    });
}

function tag(name, attrs) {
    var html = "<" + name;
    if (attrs) {
        Object.keys(attrs).forEach((k) => {
            html += " " + k;
            if (attrs[k]) {
                html += "=" + escapeHtml(attrs[k]);
            }
        });
    }
    html += ">";
    return html;
}

var scannerTimer = setInterval(scanShowProgress, 100);

function scanShowProgress() {
    console.log("show progres...");
    var textToDisplay = "All directories scanned.";
    console.log("progress is " + scannedDirectories + "/" + nbDirectories);
    if (nbDirectories > scannedDirectories) {
        var path = "";
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
        textToDisplay = "Scanning " + path;
    } else {
        clearInterval(scannerTimer);
        document.getElementById("spinner").style.display = "none";
    }
    const size = Math.floor((scannedDirectories * 100.0) / nbDirectories);
    const text = "width: " + size + "%";
    const domScan = document.getElementById("scanProgress");
    domScan.getElementsByTagName("div")[0].style = text;
    document.getElementById("scanText").innerText = textToDisplay;
    if (fcpxLibraries) {
        var html = "";
        fcpxLibraries.forEach((lib, index) => {
            var mediaSize = 0;
            var links = 0;
            lib.events.forEach(e => {
                mediaSize += e.size;
                links += e.links;
            })
            html += tag("a", { class: "list-group-item list-group-item-action", id: "library-" + index });
            html += "<b>" + escapeHtml(lib.name) + "</b> <small>(" + lib.events.length + " events)</small> <br>";
            html += "<small>" + escapeHtml(lib.path) + "</small><br>";
            html += "<small>Transcoded: <b>" + diskSize(lib.proxySize) + '<i class="bi bi-eraser-fill"></i></b>, '
            html += "Rendered: <b>" + diskSize(lib.renderSize) + "</b>, ";
            html +=  "Media: <b>" + diskSize(mediaSize) + "</b>";
            html +=  (lib.links > 0 ? " ("+ links+" references)" : '');
            html +=  "</small><br>";
            // html += JSON.stringify(lib);
            html += "</a>";
        });
        $("#libraryContents").html(html);

        infos = '';
        infos += '<table>';
        infos += '<tr><td>Scanned directories:</td><td>'+ scannedDirectories + '</td></tr>';
        infos += '<tr><td>Total of directories:</td><td>'+ nbDirectories + '</td></tr>';
        infos += '<tr><td>Registered files:</td><td>'+ Object.keys(fileMap).length + '</td></tr>';
        infos += '</table>';
        $("#informationContents").html(infos);
    }
}


/*
Promise.all([
    scanDirectories(homedir + "/Movies" ),
    // scanDirectories("/Volumes"),
]).then((v) => {
    scanShowProgress("DONE");
    console.log(v + " directories scanned.");
});
*/
function selectTab(activeTab) {
    console.log("tab " + activeTab + " selected.");
    $("#tabs .nav-link").each(function (idx) {
        $(this).removeClass("active");
        $("#" + this.id.substring(0, this.id.length - 3) + "Contents").hide();
        $("#tabs #" + activeTab + "Tab").addClass("active");
        $("#" + activeTab + "Contents").show();
    });
}

jQuery(function () {
    ['library', 'backup', 'information'].forEach(tab => {
        $("#" + tab + "Tab").on("click", function () {
            selectTab(tab);
        });
    })
    selectTab("library");
});


const homedir = require('os').homedir();
addUserDirectory(homedir + "/Movies" );
addUserDirectory("/Volumes/FinalCutPro" );
waitEndOfScan();
scanShowProgress("DONE");
