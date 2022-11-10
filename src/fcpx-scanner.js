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

/**
 * Rounds to the upper limit in kilobytes (to reflect the usage on the disk rather the
 * true size of the file). Note 1KB is taken by default but 4K could be better.
 *
 * @param {number} the number of bytes
 * @returns a rounded number of bytes
 */
function kilobytes(bytes) {
    return (Math.floor(+bytes / 2048) + 1) * 2048;
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

function scanEventFiles(library, event, path) {
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
                    infos.event = event;
                    infos.from = path + "/" + e.name;
                    event.links += 1;
                } else if (e.isDirectory()) {
                    // Quite unexepected
                    console.warn("Found a sub-directory...!");
                    scanEventFiles(library, event, path + "/" + e.name);
                } else {
                    var infos = registerFile(path + "/" + e.name);
                    infos.library = library;
                    infos.event = event;
                    event.size += kilobytes(infos.size);
                }
            });
        }
    });
}

function isFinalCutCache(path) {
    if (path.match(/\.fcpcache$/)) {
        var entry = fs.statSync(path);
        return entry.isDirectory() && fs.existsSync(path + "/info.plist");
    }
    return false;
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
                library.proxySize = 0;
                library.renderSize = 0;
                library.mediaSize = 0;
                library.links = 0;
                var eventDir = fs.readdirSync(path, { withFileTypes: true });
                eventDir.forEach((ent) => {
                    if (fs.existsSync(path + "/" + ent.name + "/CurrentVersion.fcpevent")) {
                        var event = {
                            name: ent.name,
                            size: 0,
                            links: 0,
                            projects: [],
                        };
                        scanEventFiles(library, event, path + "/" + ent.name + "/Original Media");
                        fs.readdir(path + "/" + ent.name, { withFileTypes: true }, (err, files) => {
                            files.forEach((f) => {
                                if (fs.existsSync(path + "/" + ent.name + "/" + f.name + "/CurrentVersion.fcpevent")) {
                                    event.projects.push(f.name);
                                }
                            });
                        });
                        event.proxySize = directorySize(path + "/" + ent.name + "/Transcoded Media");
                        event.renderSize = directorySize(path + "/" + ent.name + "/Render Files");
                        library.events.push(event);
                        library.renderSize += event.renderSize;
                        library.proxySize += event.proxySize;
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
    const infos = fs.statSync(path);
    var newEntry = {
        path: path,
        md5: md5,
        size: infos.size,
    };
    entry.push(newEntry);
    fileMap[md5] = entry;
    trace("REGISTER", md5 + " - " + path + (entry.length > 1 ? " = " + entry[0].path : ""));
    return newEntry;
}

/**
 * Scan a directory to get the number of bytes
 *
 * @param {string} path the path to scan
 * @returns the number of bytes
 */
function directorySize(path) {
    var size = 0;
    if (fs.existsSync(path)) {
        var files = fs.readdirSync(path, { withFileTypes: true });
        if (files) {
            files.forEach((entry) => {
                if (entry.isSymbolicLink()) {
                    size += kilobytes(0);
                }
                if (entry.isDirectory()) {
                    size += directorySize(path + "/" + entry.name);
                } else {
                    var infos = fs.statSync(path + "/" + entry.name);
                    size += kilobytes(infos.size);
                }
            });
            // console.warn(path + " = " + size);
        } else {
            console.warn(path + ": can not read");
        }
    } else {
        console.log(path + ": not found!");
    }
    return size;
}

function scanDirectories(path) {
    nbDirectories++;
    return new Promise((resolve, reject) => {
        trace("SCAN", path);
        if (!path.match(new RegExp("^/Users/")) && !path.match(new RegExp("^/Volumes"))) {
            console.warn("ILLEGAL", path);
            scannedDirectories++;
            resolve(nbDirectories);
            return;
        }
        // currentScanned = path;
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
            Promise.all(promises)
                .then(() => {
                    // scannedDirectories++;
                    resolve(nbDirectories);
                })
                .finally(() => {
                    scannedDirectories++;
                    if (tty.isatty(process.stdout.fd)) {
                        process.stdout.write("\r" + scannedDirectories + "/" + nbDirectories + "...");
                    }
                });
        });
    });
}

var promises = [];

function addUserDirectory(path) {
    nbDirectories++;
    promises.push(scanDirectory(path));
}

function isValidDirectory(path) {
    return path.match(new RegExp("^/Users/")) || !path.match(new RegExp("^/Volumes"));
}

function scanDirectory(path) {
    trace("SCAN", path);
    var pathList = [];
    return new Promise((resolve, reject) => {
        fs.readdir(path, { withFileTypes: true }, (err, files) => {
            currentScanned = path;
            if (err) {
                warning(err.code, path);
                reject(err);
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
                    } else if (isFinalCutCache(fullPath)) {
                        notice("CACHE", fullPath);
                    } else if (entry.isSymbolicLink()) {
                        var path2 = fs.readlinkSync(fullPath);
                        if (isValidDirectory(path2)) {
                            pathList.push(path2);
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
                        pathList.push(fullPath);
                    }
                });
                resolve(pathList);
            }
        });
    });
}
