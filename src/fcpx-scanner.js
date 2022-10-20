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
const os = require("os");
// Importing dialog module using remote
// const dialog = electron.remote.dialog;

var currentScanned = "/";
var scanErrors = [];
var nbDirectories = 0;
var scannedDirectories = 0;
var rootDisk = null;
var fileMap = {};
var extraFiles = [];
var fcpxLibraries = [];
var fcpxBackups = [];
var verbose = 1;


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
        process.stdout.write(formattedText(type, message, "green") + "\n");
    }
}

function notice(type, message) {
    if (verbose > 0) {
        //console.log(formattedText(type, message));
        process.stdout.write(formattedText(type, message) + "\n");
    }
}

function warning(type, message) {
    // console.warn(formattedText(type, message, "red"));
    process.stdout.write(formattedText(type, message, "red") + "\n");
}

function isVideoFile(path) {
    return path.match(/\.(mts|avi|mkv|mov|mp4|m4v|m4a|mp2|mp3|aiff|wav|aac|jpg|jpeg|gif|psd|png|tiff)$/i);
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
    // var xmlData = fs.readFileSync(path, "utf8");

    // const xml2js = require("xml2js");
    // var json;
    try {
        var fileData = fs.readFileSync(path, "ascii");
        var sax = require("sax"),
            parser = sax.parser(true);
        var key = "_";
        var mode = 0;
        parser.onerror = function (e) {
            console.error(e);
            process.exit(1);
        };
        parser.ontext = function (t) {
            // console.log('ontext '  + JSON.stringify(t) + ', mode=' + mode, ', key=' + key);
            if (mode == 1) {
                key = t;
            } else if (mode == 2) {
                data[key] = t;
            }
            mode = 0;
            // console.log(JSON.stringify(data));
        };
        parser.onopentag = function (node) {
            // console.log("opentag " + JSON.stringify(node));
            if (node.name == "key") {
                mode = 1;
            } else if (node.name == "string") mode = 2;
            else if (node.name == "integer") mode = 2;
            else if (node.name == "true") mode = 2;
            else if (node.name == "false") mode = 2;
            else {
                mode = 0;
            }
        };
        // parser.onattribute = function (attr) {
        //     // an attribute.  attr has "name" and "value"
        // };
        // parser.onend = function () {
        //     // parser stream is done, and ready to have more stuff written to it.
        // };

        parser.write(fileData).close();
        /*
            var parser = new xml2js.Parser();
            parser.parseString(fileData.substring(0, fileData.length), function (err, result) {
                json = JSON.stringify(result);
                console.log(JSON.stringify(result));
            });
            console.log("File '" + path + "/ was successfully read.\n");
            */
        /*
    // console.log(JSON.stringify(xmlDoc.window));
    var children = xmlDoc.window.document.documentElement;
    var key = "_";
    console.log(JSON.stringify(children));
    children.forEach((child) => {
        if (child.type() == "element") {
            if (child.name() == "key") key = child.text();
            else if (child.name() == "string") data[key] = child.text();
            else if (child.name() == "integer") data[key] = +child.text();
            else if (child.name() == "true") data[key] = true;
            else if (child.name() == "false") data[key] = false;
        }
    });
    */
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
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
                library.name = path.replace(/.*\//, "").replace(/\.fcpbundle$/, "");
                library.path = path;
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
    nbDirectories++;
    return new Promise((resolve, reject) => {
        trace("SCAN", path);
        currentScanned = path;
        fs.readdir(path, { withFileTypes: true }, (err, files) => {
            currentScanned = path;
            promises = [];
            if (err) {
                warning(err.code, path);
            } else {
                // try {
                // var directories = [];
                // var files = fs.readdirSync(path, { withFileTypes: true });
                // console.log(JSON.stringify(files));
                files.forEach((entry) => {
                    var fullPath = path.replace(/\/$/, "") + "/" + entry.name;
                    if (entry.name.match(/^\./)) {
                        //console.log("Entry " + fullPath + " ignored.")
                    } else if (isVideoFile(fullPath) && entry.isFile()) {
                        registerFile(fullPath);
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
                    } else if (
                        fullPath.match(/^\/(Applications|private|dev|Library|System)$/) ||
                        fullPath == os.homedir() + "/Library"
                    ) {
                        notice("IGNORE", fullPath);
                    } else if (entry.isDirectory()) {
                        // directories.push(fullPath);
                        promises.push(scanDirectories(fullPath));
                    }
                });
                // nbDirectories += directories.length + 1;
                // directories.forEach((p) => scanDirectories(p));
                // nbDirectories -= directories.length;
                // } catch (err) {
                //     warning(err.code || err, path);
                // }
            }
            Promise.all(promises).then(() => {
                // scannedDirectories++;
                resolve(nbDirectories);
            }).finally(() => {
                scannedDirectories++;
                if (tty.isatty(process.stdout.fd)) {
                    process.stdout.write("\r" + scannedDirectories + "/" + nbDirectories + "...");
                }
              });
        });
    });
}

// scanDirectories("/Users/wrey/Movies");

// .then(() => {
//     notice("INFO", "All the directories have been scanned.");

//     // notice("INFO", "All basic files analysed.");
//    console.log(JSON.stringify(fcpxLibraries, null, 2))
//    console.log(JSON.stringify(fcpxBackups, null, 2))
//     extraFiles.forEach((path) => registerFile(path));
//     console.log(JSON.stringify(fileMap, null, 2))
// });

// scanDirectories('/Users/wrey');
