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

/**
 * 
 * @param {string} name the tag name
 * @param {*} attrs the attributes as a map
 * @returns 
 */
function tag(name, attrs) {
    var html = "<" + name;
    if (attrs) {
        Object.keys(attrs).forEach((k) => {
            html += " " + k;
            if (attrs[k]) {
                html += "=\"" + escapeHtml(attrs[k]) + "\"";
            }
        });
    }
    html += ">";
    return html;
}

// var scannerTimer = setInterval(scanShowProgress, 5000);

function jstr(v){
    return "'" + v.replace('\'', '\\\'') + "'";
}

var backupPromises = [];

function refreshDisplay(infos) {
    //var textToDisplay = "All directories scanned.";
    // jQuery("#debug").html("<pre>" + JSON.stringify(infos, null, 2) +"</pre>");
    if(infos.done){
        document.getElementById("spinner").style.display = "none";
    }
    // if (infos.nbDirectories > 0) {
    //     var path = "";
    //     var parts = infos.currentScanned.split("/");
    //     if (parts.length > 2) {
    //         path = parts[0];
    //         var i = 1;
    //         while (i < parts.length - 1 && (path.length + + parts[i].length + parts[parts.length - 1].length) < 45) {
    //             path = path + "/" + parts[i++];
    //         }
    //         if (i < parts.length - 1) {
    //             path = path + "/...";
    //         }
    //         path = path + "/" + parts[parts.length - 1];
    //     } else {
    //         path = infos.currentScanned;
    //     }
    //     textToDisplay = "Scanning " + path;
    // } else if (infos.storageDirectory && infos.filesBackuped < infos.backupPromises.length) {
    //     textToDisplay = "Backuping " + infos.currentBackup;
    // } else {
    //     document.getElementById("spinner").style.display = "none";
    // }
    var size = Math.floor((infos.scannedDirectories * 100.0) / infos.totalDirectories);
    if (infos.storageDirectory) {
        size = size / 2 + Math.floor(((filesBackuped + 1) * 50.0) / (infos.backupPromises.length + 1));
    }
    const text = "width: " + size + "%";
    const domScan = document.getElementById("scanProgress");
    domScan.getElementsByTagName("div")[0].style = text;
    document.getElementById("scanText").innerText = infos.message;
    if (fcpxLibraries) {
        var html = "";
        infos.fcpxLibraries.forEach((lib,index) => {    
            const mediaSize = lib.totals.media + lib.totals.linkSize;
            const links = lib.totals.linkCount;
            const totalLost = lib.totals.lost;
            html += tag("li", { class: "list-group-item" + (lib.duplicated ? " duplicateLib" : ""), id: "library-" + index });
            if(lib.duplicated){
                html += '<small><code>' + lib.libraryID + '</code></small><br>';
            }
            html += "<b>" + escapeHtml(lib.name) + "</b>"
                + ' <i class="bi bi-box-arrow-up-right" onClick="return shellOpen(' + jstr(lib.path) + ')"></i>'
                + " <small>(";
            if(lib.events.length > 1){
                html += lib.events.length + " events";
            } else if(lib.events.length == 1){
                html += "1 event";
            } else {
                html += "no event";
            }
            html += ")</small> <br>";
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
            if(lib.lost.length > 0){
                className = 'text-danger';
            } else if(lib.backup == 2){
                className = 'text-success';
            } else if(lib.backup == 0){
                className = 'text-muted';
            } else {
                className = '';
            }
            html += '<span class="' + className + '">';
            html += "Media: <b>" + diskSize(lib.totals.media) + '</b> (' + lib.totals.fileCount + ' files)';
            if(lib.totals.linkCount > 0){
                html += " + <b>" + diskSize(lib.totals.linkSize) + '</b> (' + lib.totals.linkCount + ' links)';
            }
            html += '</span>';
            if (totalLost > 0) {
                html += ' <span class="text-danger">and ' + totalLost + " lost</span>";
            }
            html += "</span></small>";
            if(totalLost > 0 && !lib.duplicated){
                for(var i = 0; i < lib.events.length; i++){
                    if(lib.events[i].lost.length > 0){
                        html += '<p>\n' + escapeHtml(lib.events[i].name) + ':<small>';
                        for(var j = 0; j < lib.events[i].lost.length; j++){
                            html += '<br>\n&nbsp;&nbsp;' 
                                        + ' <span class="text-secondary">' + escapeHtml(lib.events[i].lost[j].name) + '</span>'
                                        + ' <small>(<span class="text-danger">' + escapeHtml(lib.events[i].lost[j].path) + '</span>)</small>';
                        }
                        html += '</small></p>';
                    }
                }
            }
            
            // html += JSON.stringify(lib);
            html += "</li>";
        });
        $("#libraryContents").html(html);
        $("#lib-badge").text(fcpxLibraries.length);

        // Informations
        var txt = "";
        txt += "<table>";
        txt += "<tr><td>Scanned directories:</td><td>" + infos.scannedDirectories + "</td></tr>";
        txt += "<tr><td>Total of directories:</td><td>" + infos.totalDirectories + "</td></tr>";
        txt += "<tr><td>Registered files:</td><td>" + infos.filesInMap + "</td></tr>";
        if (infos.storageDirectory) {
            txt += "<tr><td>Backup Storage:</td><td>" + storageDirectory + "</td></tr>";
            txt += "<tr><td>Files backuped:</td><td>" + filesBackuped + "</td></tr>";
            txt += "<tr><td>Files to backup:</td><td>" + backupPromises.length + "</td></tr>";
        }
        txt += "</table>";
        jQuery("#informationData").html(txt);

        // List of backups
        if(infos.backupStore){
            var html = '';
            var array = [... Object.values(infos.backupStore)];
            array.sort((a,b) => a.path.localeCompare(b.path));
            array.forEach( (bck,index) => {
                html += tag("li", { class: "list-group-item", id: "bck-" + index });
                html += '<small><code>' + bck.id + '</code></small><br>'
                html += "<small>" + escapeHtml(bck.path) + "</small><br>"
                html += "<small>First scan: " + new Date(bck.first).toLocaleDateString();
                if(bck.last){
                    html += ", Last seen: " + new Date(bck.last).toLocaleDateString();
                }
                if(bck.updated){
                    html += ", Last backup: " + new Date(bck.updated).toLocaleDateString();
                }
                html += '</small><br>';
                if(bck.lost > 0){
                    html += '<span class="text-danger"><strong>Missing ' + bck.lost + ' files</strong></span><br>';
                }
                //html += JSON.stringify(bck);
                html += '</li>'
            });
            txt += "</table>";
            jQuery("#backupContents").html(html);
        }
    }
}

function deleteEventDirectory(index, subdir) {
    fcpxLibraries[index].events.forEach((evt) => {
        path = fcpxLibraries[index].path + "/" + evt.name + "/" + subdir;
        deleteDirectoryContents(path);
    });
    reloadLibrary(index);
    refresh();
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
