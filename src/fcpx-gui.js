let jQuery = require('jquery');
let $ = jQuery;

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
    if(!document.getElementById("scanProgress")){
        console.warn("UI is not ready...");
        return;
    }
    if(infos.done){
        document.getElementById("spinner").style.display = "none";
    }
    var size = Math.floor((infos.scannedDirectories * 100.0) / infos.totalDirectories);
    if (infos.storageDirectory) {
        size = size / 2 + Math.floor(((filesBackuped + 1) * 50.0) / (infos.backupPromises.length + 1));
    }
    const text = "width: " + size + "%";
    const domScan = document.getElementById("scanProgress");
    domScan.getElementsByTagName("div")[0].style = text;
    document.getElementById("scanText").innerText = infos.message;
    if (infos.fcpxLibraries.length > 0) {
        var html = "";
        infos.fcpxLibraries.forEach((lib,index) => {    
            const mediaSize = lib.totals.media + lib.totals.linkSize;
            const links = lib.totals.linkCount;
            const totalLost = lib.totals.lost;
            html += tag("li", { class: "list-group-item" + (lib.duplicated ? " duplicateLib" : ""), id: "library-" + index });
            if(!lib.duplicated){
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
        $("#nav-library").html('<ul class="list-group">' + html + '</ul>');
        $("#lib-badge").text(infos.fcpxLibraries.length);
    }

    if(infos.fcpxBackups.length > 0){
        html = '';
        infos.fcpxBackups.sort();
        infos.fcpxBackups.forEach((path,index) => {
            // html += tag('li', { class: "list-group-item", id: "fcpx-" + index });
            html += '<small>' + escapeHtml(path) + '</small><br>';
            // html += '</li>';
        })
        jQuery("#nav-autosave").html(html);
        jQuery("#fcpx-badge").text(infos.fcpxBackups.length);
    }
}

module.exports.refreshDisplay = refreshDisplay;

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
