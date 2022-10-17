/**
 * This source code is dedicated to the scanning and
 * not realted to a UI interface. Nevertheless, all the information
 * is stored there.
 *
 */

//const electron = require('electron');
const fs = require("fs");
const tty = require("tty");
const crypto = require("crypto");
const libxmljs = require("libxmljs");
// Importing dialog module using remote
// const dialog = electron.remote.dialog;

var scanErrors = [];
var nbDirectories = 0;
var scannedDirectories = 0;
var rootDisk = null;
var fileMap = {};
var extraFiles = [];
var fcpxLibraries = [];
var fcpxBackups = [];
var verbose = 1;

function scanAddError(path, err) {
    console.error(path + ": " + err);
    scanErrors.push(path + ":" + err);
}

function formattedText(type, message, color = "none") {
    var texte = "                    ".substring(0, 15 - type.length) + type + ": " + message;
    if (tty.isatty(process.stdout.fd)) {
        process.stdout.write("\r                \r");
        if (color == "green") {
            return "\x1b[32m" + texte + "\x1b[0m";
        } else {
            if (color == "red") {
                return "\x1b[31m" + texte + "\x1b[0m";
            }
        }
    }
    return texte;
}

function trace(type, message) {
    if (verbose > 1) {
        console.log(formattedText(type, message, "green"));
    }
}

function notice(type, message) {
    if (verbose > 0) {
        console.log(formattedText(type, message));
    }
}

function warning(type, message) {
    console.warn(formattedText(type, message, "red"));
}

function scanShowProgress(path) {
    if (path == null) {
        document.getElementById("scanText").innerText = "Done.";
    } else {
        const size = Math.floor((scannedDirectories * 100.0) / nbDirectories);
        const text = "width: " + size + "%";
        const domScan = document.getElementById("scanProgress");
        domScan.getElementsByTagName("div")[0].style = text;
        document.getElementById("scanText").innerText = "Scanning " + path + "...";
    }
}

function isVideoFile(path) {
    return path.match(/\.(mts|avi|mkv|mov|mp4|m4v|wav|mp2|mp3|aiff|jpg|jpeg|gif|png|tiff)$/i);
}

/**
 *
 * Scan a ".plist" file from Apple.
 *
 * @param {string} path the file to scan
 * @return a model of the values included in the dictionary.
 */
function scanPList(path) {
    var data = {};
    var xmlData = fs.readFileSync(path, "utf8");
    var xmlDoc = libxmljs.parseXml(xmlData);
    var children = xmlDoc.get("//dict").childNodes();
    var key = "_";
    children.forEach((child) => {
        if (child.type() == "element") {
            if (child.name() == "key") key = child.text();
            else if (child.name() == "string") data[key] = child.text();
            else if (child.name() == "integer") data[key] = +child.text();
            else if (child.name() == "true") data[key] = true;
            else if (child.name() == "false") data[key] = false;
        }
    });
    return data;
}

function scanEventFiles(library, path) {
    fs.readdir(path, { withFileTypes: true }, (err, files) => {
        if (err) {
            warning(err.code, path);
        } else {
            files.forEach((e) => {
                if (e.isSymbolicLink()) {
                    var realPath = fs.realpathSync(path + "/" + e.name);
                    trace("SYMLINK", path + "/" + e.name + " => " + realPath);
                    var infos = registerFile(realPath);
                    infos.library = library;
                    infos.from = path + "/" + e.name;
                } else if (e.isDirectory()) {
                    scanEventFiles(library, path + "/" + e.name);
                } else {
                    var infos = registerFile(path + "/" + e.name);
                    infos.library = library;
                }
            });
        }
    });
}

function registerLibrary(path) {
    if (path.match(/\.fcpbundle$/)) {
        var entry = fs.statSync(path);
        if (entry.isDirectory()) {
            if (fs.existsSync(path + "/__BackupInfo.plist")) {
                // we have a backup, not a real library.
                notice("BACKUP", path);
                fcpxBackups.push(path);
                return false;
            }
            try {
                var library = scanPList(path + "/Settings.plist");
                library.events = [];
                var eventDir = fs.readdirSync(path, { withFileTypes: true });
                eventDir.forEach((ent) => {
                    if (fs.existsSync(path + "/" + ent.name + "/CurrentVersion.fcpevent")) {
                        library.events.push(ent.name);
                        scanEventFiles(library, path + "/" + ent.name + "/Original Media");
                    }
                });
                fcpxLibraries.push(library);
            } catch (err) {
                console.error(err);
            }
            return true;
        }
    }
    return false;
}

function fileSignature(path) {
    const BUFFER_SIZE = 64 * 1024;
    const buf = Buffer.alloc(BUFFER_SIZE);
    try {
        const fd = fs.openSync(path);
        const infos = fs.fstatSync(fd);
        const hash = crypto.createHash("md5");
        fs.readSync(fd, buf, {
            length: Math.min(BUFFER_SIZE, infos.size),
            position: 0,
        });
        hash.update(Uint8Array.from(buf));
        fs.readSync(fd, buf, {
            length: Math.min(BUFFER_SIZE, infos.size),
            position: Math.max(0, infos.size - BUFFER_SIZE),
        });
        hash.update(Uint8Array.from(buf));
        fs.closeSync(fd);
        return hash.digest("hex");
    } catch (err) {
        warning(err.code, path);
        return "error";
    }
}

function scanExtraFile(path) {
    extraFiles.push(path);
}

function registerFile(path) {
    const md5 = fileSignature(path);
    var entry = fileMap[md5] || [];
    entry.push({
        path: path,
        md5: md5,
    });
    fileMap[md5] = entry;
    trace("REGISTER", md5 + " - " + path + (entry.length > 1 ? " = " + entry[0].path : ""));
    return entry;
}

function scanDirectories(path) {
    return new Promise((resolve, reject) => {
        nbDirectories++;
        //fs.readdir(path, { withFileTypes: true }, (err, files) => {
        //   if (err) {
        //    warning(err.code, path);
        //  } else {
        try {
            var files = fs.readdirSync(path, { withFileTypes: true });
            // console.log(JSON.stringify(files));
            files.forEach((entry) => {
                var fullPath = path.replace(/\/$/, "") + "/" + entry.name;
                if (entry.name.match(/^\./)) {
                    //console.log("Entry " + fullPath + " ignored.")
                } else if (isVideoFile(fullPath) && entry.isFile()) {
                    scanExtraFile(fullPath);
                } else if (registerLibrary(fullPath)) {
                    notice("FCPX", fullPath);
                } else if (entry.isSymbolicLink() && !rootDisk) {
                    var path2 = fs.readlinkSync(fullPath);
                    if (path2 == "/") {
                        rootDisk = entry.name;
                        notice("ROOTDISK", entry.name + " (from " + fullPath + ")");
                        scanDirectories("/");
                    }
                    // while (entry.isSymbolicLink()) {
                    //     var path2 = fs.readlinkSync(fullPath);
                    //     notice("SYMLINK", fullPath + " => " + path2);
                    //     entry = fs.statSync(path2);
                    //     fullPath = path2;
                    // }
                } else if (fullPath.match(/^\/(Applications|private|dev|Library|System)$/)) {
                    notice("IGNORE", fullPath);
                } else if (entry.isDirectory()) {
                    scanDirectories(fullPath);
                }
            });
        } catch (err) {
            warning(err.code, path);
        }
        //  }
        scannedDirectories++;

        if (tty.isatty(process.stdout.fd)) {
            process.stdout.write("\r" + scannedDirectories + "/" + nbDirectories + "...");
        }
        resolve();
    });
    // });
}

/**
 * Once the standard directories are scanned, we scann all the other stuff.
 */
function scanExtraFiles() {
    extraFiles.forEach((p) => registerFile(p));
}

scanDirectories("/Users/wrey/Movies").then(() => {
    notice("INFO", "All the directories have been scanned.");
    
    // notice("INFO", "All basic files analysed.");
    console.log(JSON.stringify(fcpxLibraries, null, 2))
    console.log(JSON.stringify(fcpxBackups, null, 2))
    extraFiles.forEach((path) => registerFile(path));
    console.log(JSON.stringify(fileMap, null, 2))
});

// scanDirectories('/Users/wrey');
