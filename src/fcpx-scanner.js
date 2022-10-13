const electron = require('electron');
const fs = require('fs');
const tty = require('tty');
const crypto = require('crypto');
// Importing dialog module using remote
// const dialog = electron.remote.dialog;

var scanErrors = [];
var nbDirectories = 0;
var scannedDirectories = 0;
var rootDisk = null;
var fileMap = {};

function scanAddError(path, err) {
    console.error(path + ": " + err);
    scanErrors.push(path + ":" + err);
}

function formattedText(type, message) {
    var texte = "                ".substring(0, 12 - type.length) + type
        + ': ' + message;
    if (tty.isatty(process.stdout.fd)) {
        process.stdout.write("\r                \r");
    }
    return texte;
}

function notice(type, message){
    console.log(formattedText(type, message));
}


function warning(type, message){
    console.warn(formattedText(type, message));
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

function fileSignature(path){
    const BUFFER_SIZE = 64 * 1024;
    const buf = Buffer.alloc(BUFFER_SIZE);
    try {
        const fd = fs.openSync(path);
        const infos = fs.fstatSync(fd);
        const hash = crypto.createHash("md5");
        fs.readSync(fd, buf, {length: Math.min(BUFFER_SIZE,infos.size), position: 0});
        hash.update(Uint8Array.from(buf))
        fs.readSync(fd, buf, {length: Math.min(BUFFER_SIZE,infos.size), position: Math.max(0, infos.size - BUFFER_SIZE)});
        hash.update(Uint8Array.from(buf))
        fs.closeSync(fd);
        return hash.digest('hex');
    } catch(err){
        warning(err.code, path);
        return 'error';
    }
}

function registerFile(path) {
    const md5 = fileSignature(path);
    var entry = fileMap[md5] || [];
    entry.push({
        path: path
    });
    fileMap[md5] = entry;
    notice("REGISTER", md5 + " - " + path + (entry.length > 1 ? " = " + entry[0].path : "" ));
}

function scanDirectories(path) {
    nbDirectories++;
    fs.readdir(path, { withFileTypes: true }, (err, files) => {
        if (err)
            warning(err.code, path);
        else {
            files.forEach(entry => {

                var fullPath = path.replace(/\/$/, '') + '/' + entry.name;
                if (entry.name.match(/^\./)) {
                    //console.log("Entry " + fullPath + " ignored.")
                } else if (isVideoFile(fullPath)) {
                    registerFile(fullPath);
                } else if (isFcpxLibrary(fullPath)) {

                } else if (entry.isSymbolicLink() && !rootDisk) {
                    var path2 = fs.readlinkSync(fullPath);

                    if (path2 == '/') {
                        rootDisk = entry.name;
                        notice("ROOTDISK", entry.name + " (from " + fullPath + ")");
                        scanDirectories('/');
                    }
                    // while (entry.isSymbolicLink()) {
                    //     var path2 = fs.readlinkSync(fullPath);
                    //     notice("SYMLINK", fullPath + " => " + path2);
                    //     entry = fs.statSync(path2);
                    //     fullPath = path2;
                    // }
                } else if (fullPath.match(/^\/(Applications|Library|System)$/)) {
                    notice("IGNORE", fullPath);
                } else if (entry.isDirectory()) {
                    scanDirectories(fullPath);
                }
            })
        }
        scannedDirectories++;
    });
    if (tty.isatty(process.stdout.fd)) {
        process.stdout.write("\r" + scannedDirectories + '/' + nbDirectories + '...');
    }
}

scanDirectories('/Volumes');
// scanDirectories('/Users/wrey');
