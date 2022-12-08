function diskSize(bytes) {
    // console.log("diskSize("+bytes+")")
    if (bytes === 0) {
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

// var scannerTimer = setInterval(scanShowProgress, 5000);

var backupPromises = [];

function refreshDisplay(infos) {
    console.log("show progress...");
    var textToDisplay = "All directories scanned.";
    // console.log("progress is " + scannedDirectories + "/" + nbDirectories);
    if (infos.nbDirectories > infos.scannedDirectories && infos.nbDirectories > 0) {
        var path = "";
        var parts = infos.currentScanned.split("/");
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
            path = infos.currentScanned;
        }
        textToDisplay = "Scanning " + path;
    } else if (infos.storageDirectory && infos.filesBackuped < infos.backupPromises.length) {
        textToDisplay = "Backuping " + infos.currentBackup;
    } else {
        // clearInterval(scannerTimer);
        document.getElementById("spinner").style.display = "none";
    }
    var size = Math.floor((infos.scannedDirectories * 100.0) / nbDirectories);
    if (infos.storageDirectory) {
        size = size / 2 + Math.floor(((filesBackuped + 1) * 50.0) / (infos.backupPromises.length + 1));
    }
    const text = "width: " + size + "%";
    const domScan = document.getElementById("scanProgress");
    domScan.getElementsByTagName("div")[0].style = text;
    document.getElementById("scanText").innerText = textToDisplay;
    if (fcpxLibraries) {
        var html = "";
        infos.fcpxLibraries.forEach((lib, index) => {
            var mediaSize = 0;
            var links = 0;
            var lost = 0;
            lib.events.forEach((e) => {
                mediaSize += e.size;
                links += e.links;
                lost += e.lost.length;
            });
            html += tag("li", { class: "list-group-item", id: "library-" + index });
            html += "<b>" + escapeHtml(lib.name) + "</b> <small>(" + lib.events.length + " events)</small> <br>";
            html += "<small>" + escapeHtml(lib.path) + "</small><br>";
            html += "<small>";
            if (lib.proxySize == 0) {
                html += "No transcoded media, ";
            } else {
                html += "Transcoded: <b>" + diskSize(lib.proxySize) + "</b> ";
                html +=
                    '<a href="#" onclick="return deleteTranscoded(' +
                    index +
                    ')"><i class="text-warning bi bi-eraser-fill"></i></a>, ';
            }
            if (lib.renderSize > 0) {
                html += "Rendered: <b>" + diskSize(lib.renderSize) + "</b> ";
                html +=
                    '<a href="#" onclick="return deleteRender(' + index + ')"><i class="text-warning bi bi-eraser-fill"></i></a>, ';
            } else {
                html += "No rendered media, ";
            }
            html += "Media: <b>" + diskSize(mediaSize) + "</b>";
            if (links > 0) {
                html += " (" + links + "  links";
                html += lost > 0 ? ', <strong class="text-danger">' + lost + " lost</strong>" : "";
                html += ")";
            }
            html += "</small><br>";
            // html += JSON.stringify(lib);
            html += "</li>";
        });
        $("#libraryContents").html(html);

        infos = "";
        infos += "<table>";
        infos += "<tr><td>Scanned directories:</td><td>" + scannedDirectories + "</td></tr>";
        infos += "<tr><td>Total of directories:</td><td>" + nbDirectories + "</td></tr>";
        infos += "<tr><td>Registered files:</td><td>" + Object.keys(fileMap).length + "</td></tr>";
        if (infos.storageDirectory) {
            infos += "<tr><td>Backup Storage:</td><td>" + storageDirectory + "</td></tr>";
            infos += "<tr><td>Files backuped:</td><td>" + filesBackuped + "</td></tr>";
            infos += "<tr><td>Files to backup:</td><td>" + backupPromises.length + "</td></tr>";
        }
        infos += "</table>";
        jQuery("#informationContents").html(infos);
    }
}

function deleteEventDirectory(index, subdir) {
    fcpxLibraries[index].events.forEach((evt) => {
        path = fcpxLibraries[index].path + "/" + evt.name + "/" + subdir;
        deleteDirectoryContents(path);
    });
    reloadLibrary(index);
    refreshDisplay();
}

function deleteRender(index) {
    deleteEventDirectory(index, "Render Files");
    return false;
}

function deleteTranscoded(index) {
    deleteEventDirectory(index, "Transcoded Media");
    return false;
}

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
    ["library", "backup", "information"].forEach((tab) => {
        $("#" + tab + "Tab").on("click", function () {
            selectTab(tab);
        });
    });
    selectTab("library");
});

/*


const homedir = require("os").homedir();
checkForBackupDisk();
addUserDirectory(homedir + "/Movies");
addUserDirectory("/Volumes/FinalCutPro");
refreshDisplay();

var filesBackuped = 0;

function backupAllFiles() {
    backupPromises = searchBackupFiles(true).map((md5) => {
        console.log("Adding " + md5);
        new Promise((resolve, reject) => {
            currentBackup = fileMap[md5].name;
            backupFile(md5);
            filesBackuped++;
            refreshDisplay();
            resolve(md5);
        });
    });

    Promise.all(backupPromises).then(() => {
        console.log("Backup done. Program terminates.");
    });
}


function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitEndOfScan() {
    var i = 0;
    while (scannedDirectories < nbDirectories) {
        while (i < Math.min(i + 100, promises.length)) {
            promises[i].then(
                (result) => {
                    result.forEach((p) => addUserDirectory(p));
                    process.stdout.write("\r" + scannedDirectories + "/" + nbDirectories + "...");
                },
                (err) => {
                    console.warn(err.message);
                }
            );
            i++;
        }
        await wait(500);
        refreshDisplay();
        console.log("check at " + new Date());
    }
    backupAllFiles();
}

// waitEndOfScan();

*/
