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

// function jstr(v){
//     return "'" + v.replace('\'', '\\\'') + "'";
// }

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
   
    // if(infos.fcpxBackups.length > 0){
    //     html = '';
    //     infos.fcpxBackups.sort();
    //     infos.fcpxBackups.forEach((path,index) => {
    //         // html += tag('li', { class: "list-group-item", id: "fcpx-" + index });
    //         html += '<small>' + escapeHtml(path) + '</small><br>';
    //         // html += '</li>';
    //     })
    //     jQuery("#nav-autosave").html(html);
        // jQuery("#fcpx-badge").text(infos.fcpxBackups.length);
    // }
}

module.exports.refreshDisplay = refreshDisplay;

// function deleteEventDirectory(index, subdir) {
//     fcpxLibraries[index].events.forEach((evt) => {
//         path = fcpxLibraries[index].path + "/" + evt.name + "/" + subdir;
//         deleteDirectoryContents(path);
//     });
//     reloadLibrary(index);
//     refresh();
// }

// function deleteRender(index) {
//     deleteEventDirectory(index, "Render Files");
//     return false;
// }

// function deleteTranscoded(index) {
//     deleteEventDirectory(index, "Transcoded Media");
//     return false;
// }
