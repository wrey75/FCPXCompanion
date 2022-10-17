const electron = require('electron');
const fs = require('fs');
// Importing dialog module using remote
// const dialog = electron.remote.dialog;

var scanErrors = [];
var nbDirectories = 0;
var scannedDirectories = 0;

function scanAddError(path, err) {
    console.error(path + ": " + err);
    scanErrors.push(path + ":" + err);
}

function scanShowProgress(path) {
    if (path == null) {
        document.getElementById("scanText").innerText = "Done.";
    } else {
        const size = Math.floor(scannedDirectories * 100.0 / nbDirectories);
        const text = "width: " + size + "%";
        const domScan = document.getElementById("scanProgress");
        domScan.getElementsByTagName("div")[0].style = text;
        document.getElementById("scanText").innerText = "Scanning " + path + "...";
    }
}

function isVideoFile(path) {
    return (path.match(/\.(mts|avi|mkv|mov|mp4|m4v|wav|mp2|mp3|aiff|jpg|jpeg|gif|png|tiff)$/i));
}

function isFcpxLibrary(path) {
    if (path.match(/\.fcpbudle$/)) {
        var entry = fs.statSync(fullPath);
        if (entry.isDirectory()) {

        }
    }
    return false;
}

function scanDirectories(path) {
    // console.log("Scanning " + path + "...");
    nbDirectories++;
    scanShowProgress(path);
    fs.readdir(path, (err, files) => {
        scanShowProgress(path);
        if (err)
            scanAddError(path, err);
        else {
            // try {
            //     const files = fs.readdirSync(path);
            if (files) {
                files.forEach(file => {
                    //console.log(file);
                    var fullPath = path + '/' + file;
                    if (file.match(/^\./)) {
                        //console.log("Entry " + fullPath + " ignored.")
                    } else if (isVideoFile(fullPath)) {

                    } else if (isFcpxLibrary(fullPath)) {

                    } else {
                        var entry = fs.statSync(fullPath);
                        if (entry.isDirectory()) {
                            scanDirectories(fullPath);
                        }
                    }
                })
            }

        }
        //         });
        //     }
        // } catch (err) {
        //     console.warn(err);
        // }
        scannedDirectories++;
    });
}

scanDirectories('/Volumes');
    scanShowProgress(null)
