const { app, BrowserWindow, shell } = require('electron')
const tty = require("tty");
const path = require('path');
const fs = require('fs');
const crypto = require("crypto");
const os = require("os");
const { Dirent } = require('fs');
const sax = require("sax");
var win;

var verbose = 0;

/**
 * Loads a directory.
 * 
 * @param {string} path the path to load
 */
function handleLoadDirectory(path) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(path)) {
            warning("NOENT", path);
            resolve([]);
        }
        fs.readdir(path, { withFileTypes: true }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                const files = [];
                data.forEach(x => {
                    if (x.name.substring(0, 1) != '.' && (x.isSymbolicLink() || x.isFile() || x.isDirectory())) {
                        const infos = {
                            path: path + '/' + x.name,
                            directory: x.isDirectory(),
                            file: x.isFile(),
                            symLink: x.isSymbolicLink(),
                            name: x.name,
                        };
                        if (x.isSymbolicLink()) {
                            infos.realPath = fs.readlinkSync(infos.path);
                        }
                        files.push(infos);
                    }
                });
                resolve(files);
            }
        })
    });
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


/**
 * Returns the signature for the file (a MD5).
 *
 * @param {string} path the path of the fle
 * @returns a MD5
 */
function handleFileSignature(path) {
    return new Promise((resolve, reject) => {
        const BUFFER_SIZE = 128 * 1024;
        const buf = Buffer.alloc(BUFFER_SIZE);
        try {
            if (!fs.existsSync(path)) {
                warning("NOENT", path);
                resolve(null);
            } else {
                const path1 = fs.realpathSync(path);
                const fd = fs.openSync(path1);
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
                resolve(hash.digest("hex"));
            }
        } catch (err) {
            warning(err.code, path);
            reject(err);
        }
    });
}

function handleFileStats(aPath) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(aPath)) {
            const res = fs.statSync(aPath);
            resolve({
                directory: res.isDirectory(),
                file: res.isFile(),
                symLink: res.isSymbolicLink(),
                name: path.basename(aPath),
                size: res.size
            });
        } else {
            resolve({
                directory: false,
                file: false,
                symLink: false,
                name: null,
                size: 0
            });
        }
    });
}

function handleFileExists(path) {
    return new Promise((resolve, reject) => {
        const found = fs.existsSync(path);
        resolve(found);
    });
}

function handleFileRead(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) reject(err);
            resolve(data);
        });
    });
}

function handleFileWrite(path, contents) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, contents,
            (err) => {
                if (err) reject(err);
                resolve(contents.length);
            }
        );
    });
}

function handleMakeDirectory(path, recursive) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(path)) {
            resolve(path);
        } else {
            fs.mkdir(path, { "recursive": recursive }, (err, data) => {
                if (err) reject(err);
                resolve(data);
            });
        }
    });
}

function handleRemoveDirectory(path) {
    return new Promise((resolve, reject) => {
        fs.rmdir(path, (err, data) => {
            if (err) reject(err);
            resolve(data);
        });
    });
}

function handleRemoveFile(path) {
    return new Promise((resolve, reject) => {
        fs.unlink(path, (err, data) => {
            if (err) reject(err);
            resolve(data);
        });
    });
}


/**
 * Copy a file.
 * 
 * @param {string} src the source file (must exist)
 * @param {string} dst the destination file
 * @returns true if copied.
 */
function handleCopyFile(src, dst, event) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(src)) {
            resolve(false);
        }

        const outputDir = path.dirname(dst);
        if (!fs.existsSync(outputDir)) {
            // Create the directory if not exists...
            throw new Error(outputDir + ": the directory MUST exists for file copy!")
        }

        // Copy and rename to ensure no partial copy
        fs.stat(src, function (err, stat) {
            if (err) throw err;
            const filesize = stat.size;
            let bytesCopied = 0;

            const readStream = fs.createReadStream(src,{ highWaterMark: 32 * 1024 * 1024 });
            const writeStream = fs.createWriteStream(dst + '~');

            readStream.on('data', function (buffer) {
                bytesCopied += buffer.length;
                const percentage = ((bytesCopied / filesize) * 100).toFixed(2);
                const text = "Copying " + src.replace(/.*\//, '') + ' (' + percentage + '%)...';
                if(event){
                    const webContents = event.sender;
                    const win = BrowserWindow.fromWebContents(webContents);
                    win.webContents.send('update-copy-progress', text);
                }
            })
            writeStream.on('close', function () {
                fs.renameSync(dst + '~', dst);
                notice("COPIED", src + ' => ' + dst);
                resolve(true);
            })
            readStream.pipe(writeStream);
        })
    });
}

function handleFsLink(ref, newRef) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(newRef)) {
            fs.unlinkSync(newRef);
        }
        fs.link(ref, newRef, err => {
            if (err) throw err;
            notice("LINKED", ref + ' => ' + newRef);
            resolve(true);
        })
    });
}

/**
 *
 * Scan a ".plist" file from Apple.
 *
 * @param {string} path the file to scan
 * @return a model of the values included in the dictionary.
 */
function handleScanPList(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, { encoding: "ascii" }, (err, fileData) => {
            var data = {};
            if (err) reject(err);
            const parser = sax.parser(true);
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
                else if (node.name == "true") {
                    data[key] = true;
                } else if (node.name == "false") {
                    data[key] = false;
                } else {
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
            resolve(data);
        });
    });
}


export function declareHandlers(ipcMain){
    ipcMain.on('set-title', (event, title) => {
        const webContents = event.sender
        const win = BrowserWindow.fromWebContents(webContents)
        win.setTitle("FCPX Companion v." + app.getVersion())
    })
    ipcMain.handle("dir:load", (event, path) => handleLoadDirectory(path))
    ipcMain.on('log:trace', (event, type, message) => trace(type, message));
    ipcMain.on('log:notice', (event, type, message) => notice(type, message));
    ipcMain.on('log:warning', (event, type, message) => warning(type, message));
    ipcMain.on('shell:open', (event, path) => {
        shell.openPath(path);
    });
    ipcMain.handle("file:md5", (event, path) => handleFileSignature(path));
    ipcMain.handle("file:stat", (event, path) => handleFileStats(path));
    ipcMain.handle("file:exists", (event, path) => handleFileExists(path));
    ipcMain.handle("file:read", (event, path) => handleFileRead(path));
    ipcMain.handle("file:plist", (event, path) => handleScanPList(path));
    ipcMain.handle("file:copy", (event, src, dest) => handleCopyFile(src, dest, event));
    ipcMain.handle("file:link", (event, ref, newRef) => handleFsLink(ref, newRef));
    ipcMain.handle("dir:mkdir", (event, path, recursive) => handleMakeDirectory(path, recursive));
    ipcMain.handle("file:remove", (event, path) => handleRemoveFile(path));
    ipcMain.handle("dir:rmdir", (event, path) => handleRemoveDirectory(path));
    ipcMain.handle("file:write", (event, path, contents) => handleFileWrite(path, contents));
    ipcMain.handle("os:homedir", (event) => os.homedir());
 
}




