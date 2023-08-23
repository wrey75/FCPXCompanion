/**
 * This source code is dedicated to the scanning and
 * not realted to a UI interface. Nevertheless, all the information
 * is stored there.
 *
 */


var scanErrors = [];
var nbDirectories = 0;
var scannedDirectories = 0;
var totalDirectories = 0;
var rootDisk = null;
var fileMap = {};
var extraFiles = [];
var fcpxLibraries = [];
var autosaved = []; // The backups made by Apple found
var backupStore;
var backupList = []; // Libraries to backup...
var backupDone = -2; // No backup started...
var displayMessage = 'Starting...';

const BACKUP_DIR = '/Volumes/FCPSlave';
// const BACKUP_DIR = "/Users/Shared/FCPSlave"; // For test purposes only

function trace(type, message) {
    window.myAPI.trace(type, message);
}

function notice(type, message) {
    window.myAPI.notice(type, message);
}

function warning(type, message) {
    window.myAPI.warning(type, message);
}

async function deleteFile(path) {
    return await window.myAPI.unlink(path);
}

export function shellOpen(path) {
    window.myAPI.shellOpen(path);
}

async function removeDirectory(path) {
    return await window.myAPI.rmdir(path);
}


async function homedir() {
    return await window.myAPI.homedir();
}

async function scanPList(path) {
    return await window.myAPI.scanPList(path);
}

async function fileStats(path) {
    return await window.myAPI.fileStats(path);
}

async function fileExists(path) {
    return await window.myAPI.fileExists(path);
}

async function mkdirs(path, recursive) {
    return await window.myAPI.mkdirs(path, recursive);
}

async function fileWrite(path, contents) {
    return await window.myAPI.fileWrite(path, contents);
}


async function fslink(current, newOne) {
    // trace('LINK_TO', current + ' --> ' + newOne);
    return await window.myAPI.fslink(current, newOne);
}

/**
 * Rounds to the upper limit in kilobytes (to reflect the usage on the disk rather the
 * true size of the file). Note 1KB is taken by default but 4K could be better.
 *
 * @param {number} the number of bytes
 * @returns a rounded number of bytes
 */
function kilobytes(bytes) {
    return bytes; /* (Math.floor(+bytes / 1024) + 1) * 1024 */;
}

function isVideoFile(path) {
    return path.match(
        /\.(mts|avi|mkv|mov|mp4|m4v|m4a|mp2|mp3|aiff|wav|aac|jpg|jpeg|gif|psd|png|tiff)$/i
    );
}


async function scanEventFiles(library, event, path, sub) {
    const files = await loadDirectory(path);
    for (var i = 0; i < files.length; i++) {
        //console.warn("/// Scan file " + i + ' in event');
        displayMessage = 'Loading "' + event.name + '" (' + i + '/' + files.length + ') in ' + library.name + '...';
        const e = files[i];
        if (e.symLink) {
            try {
                var realPath = path + "/" + e.name;
                // trace("SYMLINK", path + "/" + e.name + " => " + realPath);
                // console.warn("/// Register symlink " + i + ' in event');
                var infos = await registerFile(realPath);
                if (!infos) {
                    event.lost.push({
                        'name': e.name,
                        'path': e.realPath
                    });
                } else {
                    const fileInfos = await fileStats(realPath);
                    event.links.push({
                        md5: infos.md5,
                        path: path + "/" + e.name,
                        name: sub + e.name,
                        resolvedPath: e.realPath,
                        size: fileInfos.size
                    });
                }
            } catch (err) {
                if (err.code === "ENOENT") {
                    event.lost.push({ name: e.name, path: null });
                } else {
                    console.error(e.name + ": " + err.code);
                }
            }
        } else if (e.directory) {
            // Quite unexepected
            console.error("Sub directories are not expected.");
            await scanEventFiles(library, event, path + "/" + e.name, sub + e.name + '/');
        } else {
            // console.warn("/// Register file " + i + ' in event: ' + e.name);
            var infos = await registerFile(path + "/" + e.name);
            event.size += kilobytes(infos.size);
            event.files.push({
                md5: infos.md5,
                path: path + "/" + e.name,
                name: sub + e.name
            });
        }
    }
}

/**
 * Delete the contents of a directory (but NOT the directory itself). Used
 * to delete rendered and prox mdeia.
 *
 * @param {string} path the path to delete
 */
async function deleteDirectoryContents(path) {
    if (await fileExists(path)) {
        var files = await loadDirectory(path);
        for (var i = 0; i < files.length; i++) {
            const entry = files[i];
            var full = path + "/" + entry.name;
            if (entry.directory) {
                await deleteDirectoryContents(full);
                await removeDirectory(full);
                console.log(full + ": rmdir");
            } else {
                await deleteFile(full);
                console.log(full + ": deleted");
            }
        }
    } else {
        console.log(path + ": not found!");
    }
    return true;
}


async function isFinalCutCache(path) {
    if (path.match(/\.fcpcache$/)) {
        var entry = await fileStats(path);
        return entry.directory && (await fileExists(path + "/info.plist"));
    }
    return false;
}

/**
 * Give amount information.
 * 
 * @param {string} lib the library
 * @returns the totals for the library (scans the events)
 */
function countInLibrary(lib) {
    const total = {
        media: 0,
        linkSize: 0,
        linkCount: 0,
        fileCount: 0,
        lost: 0,
    };
    lib.events.forEach((e) => {
        total.media += e.size;
        total.linkCount += e.links.length;
        total.fileCount += e.files.length;
        total.linkSize = 0;
        e.links.forEach(l => {
            total.linkSize += (l.size || 0)
            // console.warn('size', l);
        });
        total.lost += e.lost.length;
    });
    return total;
}

function physicalIndexOf(index) {
    for (var i = 0; i < fcpxLibraries.length; i++) {
        if (fcpxLibraries[i].index == index) return i;
    }
    throw new Error("physicalIndexOf(): conception error!");
    return -1;
}

/**
 * Reload the library based on information available at the index. Quite simple
 * way to do.
 *
 * @param {number} index
 */
async function reloadLibrary(index) {
    const idx = physicalIndexOf(index);
    fcpxLibraries[idx] = await loadLibrary(fcpxLibraries[idx].path);
}

/**
 * Copy a directory including the contents and sub directories.
 * 
 * @param {string} src the source path.
 * @param {string} dst the destination path (created if not exists). 
 */
async function copyDirectory(src, dst, useLinks) {
    var exists = await fileExists(src);
    if (!exists) {
        exists = await fileExists(src + '.localized');
        if (!exists) {
            throw new Error('The source "' + src + '" does not exists!');
        } else {
            src += '.localized';
        }
    }
    const files = await loadDirectory(src);
    await mkdirs(dst, true);
    for (var i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.directory) {
            await copyDirectory(src + '/' + f.name, dst + '/' + f.name);
            return;
        }

        const path = f.symLink ? f.realPath : src + '/' + f.name;
        if (f.size > 2048 && useLinks) {
            // Avoid duplicates for media files.
            var infos = await registerFile(path);
            if (!infos) {
                throw new Error("File not found: " + path);
            }
            const md5path = await backupIfNeeded(infos.md5);
            await fslink(md5path, dst + '/' + f.name);
        } else {
            await copyFile(path, dst + '/' + f.name);
        }
    }
}

async function backupLibrary(library) {
    if (storageDirectory == null) {
        console.log("No FCPBackup disk available.");
        return false;
    }
    if (library.duplicated) {
        console.warn("Can not backup: duplicate library");
        return false;
    }
    const libraryName = backupStore.libs[library.libraryID]?.name || uniqueName(library);
    const libraryPath = storageDirectory + '/Libraries/' + libraryName + '.fcpbundle';
    displayMessage = "Backuping " + library.name + "...";
    const folderPath = storageDirectory + '/Folders' + library.path;
    library.backup = 1;
    // await mkdirs(folderPath, true);
    await mkdirs(libraryPath, true);
    // await mkdirs(folderPath + '/Motion Templates');
    await copyDirectory(library.path + '/Motion Templates', libraryPath + '/Motion Templates');
    await mkdirs(libraryPath + '/__Temp');
    // await copyFile(library.path + '/CurrentVersion.flexolibrary', folderPath + '/CurrentVersion.flexolibrary');
    await copyFile(library.path + '/CurrentVersion.flexolibrary', libraryPath + '/CurrentVersion.flexolibrary');

    // await copyFile(library.path + '/CurrentVersion.plist', folderPath + '/CurrentVersion.plist')
    await copyFile(library.path + '/CurrentVersion.plist', libraryPath + '/CurrentVersion.plist')

    // await copyFile(library.path + '/Settings.plist', folderPath + '/Settings.plist');
    await copyFile(library.path + '/Settings.plist', libraryPath + '/Settings.plist');

    // await copyFile(library.path + '/__Sync__', libraryPath + '__Sync__');
    for (var i = 0; i < library.events.length; i++) {
        const event = library.events[i];
        // const eventDir = folderPath + '/' + event.name;
        // await mkdirs(eventDir, false);
        // await mkdirs(eventDir + '/Original Media', false);
        // await mkdirs(eventDir + '/Transcoded Media', false);
        await mkdirs(libraryPath + '/' + event.name, false);
        await mkdirs(libraryPath + '/' + event.name + '/Original Media', false);
        await mkdirs(libraryPath + '/' + event.name + '/Transcoded Media', false);

        // Backup the projects in the library
        for (var j = 0; j < event.projects.length; j++) {
            // const projectDir = eventDir + '/' + event.projects[j];
            // await mkdirs(projectDir, false);
            await mkdirs(libraryPath + '/' + event.name + '/' + event.projects[j], false);
            // await copyFile(library.path + '/' + event.name + '/' + event.projects[j] + '/CurrentVersion.fcpevent', projectDir + '/CurrentVersion.fcpevent');
            await copyFile(library.path + '/' + event.name + '/' + event.projects[j] + '/CurrentVersion.fcpevent', libraryPath + '/' + event.name + '/' + event.projects[j] + '/CurrentVersion.fcpevent');
        }

        var nb = 0;
        for (var j = 0; j < event.links.length; j++) {
            // warning("CODE", 'Link ' + j);
            displayMessage = "Backuping " + library.name + "(" + event.links[j].path.replace(/.*\//, '') + ')...';
            const md5path = await backupIfNeeded(event.links[j].md5);
            await fslink(md5path, libraryPath + '/' + event.name + '/Original Media/' + event.links[j].name);
            await mkdirs(dirname(storageDirectory + '/Folders' + event.links[j].resolvedPath), true);
            await fslink(md5path, storageDirectory + '/Folders' + event.links[j].resolvedPath);
        }
        for (var j = 0; j < event.files.length; j++) {
            // warning("CODE", 'File ' + j);
            displayMessage = "Backuping " + library.name + "(" + event.files[j].path.replace(/.*\//, '') + ')...';
            const md5path = await backupIfNeeded(event.files[j].md5);
            // console.warn(j +':' + md5path + " \\ " + root + event.files[j].path);
            // await mkdirs(dirname(storageDirectory + '/Folders' + event.files[j].path), true);
            // await fslink(md5path, storageDirectory + '/Folders' + '/' + event.files[j].path);
            await fslink(md5path, libraryPath + '/' + event.name + '/Original Media/' + event.files[j].name);
            const destPath = storageDirectory + '/Folders' + library.path.replace(/\.fcpbundle$/, '_fcpbundle') + '/' + event.name;
            await mkdirs(destPath, true);
            await fslink(md5path, destPath + '/' + event.files[j].name);
        }
    }
    backupStore.libs[library.libraryID].updated = new Date().toISOString();
    backupStore.libs[library.libraryID].lost = library.totals.lost;
    await fileWrite(storageDirectory + "/store.json", JSON.stringify(backupStore));
    library.backup = 2;
    return true;
}

/**
 * Load the library and return the characteristics. Note we must first ensure the
 * library exists and is a valid one.
 *
 * @param {string} path
 * @returns
 */
async function loadLibrary(path) {
    console.log("Loading FCPX " + path + '...');
    var library = await scanPList(path + "/Settings.plist");
    library.events = [];
    library.name = path.replace(/.*\//, "").replace(/\.fcpbundle$/, "");
    library.path = path;
    library.proxySize = +0;
    library.renderSize = +0;
    library.mediaSize = +0;
    library.links = +0;
    library.lost = +0;
    library.backup = 0;

    displayMessage = 'Loading library ' + library.name + '...';
    var eventDir = await loadDirectory(path);
    for (var i = 0; i < eventDir.length; i++) {
        // console.warn("/// Scan event " + i + " in " + library.name);
        const ent = eventDir[i];
        const exist = await fileExists(path + "/" + ent.name + "/CurrentVersion.fcpevent");
        if (exist) {
            var event = {
                name: ent.name,
                size: +0,
                links: [],
                projects: [], // name of projects in the event
                lost: [], // lost symbolic links
                files: [] // List of files
            };
            await scanEventFiles(library, event, path + "/" + ent.name + "/Original Media", '');
            // console.warn("/// Load dir " + i + " in " + library.name);
            const files = await loadDirectory(path + "/" + ent.name);
            for (var j = 0; j < files.length; j++) {
                const f = files[j];
                if (await fileExists(path + "/" + ent.name + "/" + f.name + "/CurrentVersion.fcpevent")) {
                    event.projects.push(f.name);
                }
            }
            event.proxySize = await directorySize(path + "/" + ent.name + "/Transcoded Media");
            event.renderSize = await directorySize(path + "/" + ent.name + "/Render Files");
            library.events.push(event);
            library.renderSize += event.renderSize;
            library.proxySize += event.proxySize;
            library.lost += event.lost.length;
            library.links += event.links.length + event.lost.length;
        }
    }
    library.totals = countInLibrary(library);
    return library;
}

function uniqueName(library) {
    var count = 0;
    Object.values(backupStore.libs).forEach((lib, index) => {
        if (library.name === lib.name) {
            // Use the library identifier
            return library.name + " (" + library.libraryID + ")";
        }
    });

    // The plain name
    return library.name;
}

function addToLibraries(library) {
    var insertAt = fcpxLibraries.length;
    library.index = fcpxLibraries.length;
    library.duplicated = false;
    for (var i = 0; i < fcpxLibraries.length; i++) {
        if (library.libraryID === fcpxLibraries[i].libraryID) {
            insertAt = i + 1;
            library.duplicated = true;
        }
    }
    fcpxLibraries.splice(insertAt, 0, library);

    if (backupStore != null && !library.duplicated) {
        if (backupStore.libs[library.libraryID] && backupStore.libs[library.libraryID].path != library.path) {
            // We found the same library with a different path...
            library.duplicated = true;
        } else if (backupStore.libs[library.libraryID]) {
            backupStore.libs[library.libraryID].last = new Date().toISOString();
        } else {
            const now = new Date().toISOString();
            backupStore.libs[library.libraryID] = {
                last: now,
                first: now,
                id: library.libraryID,
                path: library.path,
                name: uniqueName(library.name),
                updated: null,
            };
        }
    }
}

function addToBackups(lib) {
    backupList.push(lib);
}

async function registerLibrary(path) {
    const stats = await fileStats(path);
    if (path.match(/\.fcpbundle$/) && stats.directory) {
        const found = await fileExists(path + "/__BackupInfo.plist");
        if (found) {
            // we have a backup, not a real library.
            notice("BACKUP", path);
            const idx = autosaved.length + 1;
            autosaved.push({ path: path, index: idx });
            autosaved.sort((a,b) => (a.path.localeCompare(b.path)));
        } else {
            notice("FCPX", path);
            var library = await loadLibrary(path);
            addToLibraries(library);
            addToBackups(library);
            console.log("Registered library " + library.libraryID);
        }
    } else {
        console.error(path + ": NOT A LIBRARY??");
    }
}

/**
 * Returns the signature for the file (a MD5).
 *
 * @param {string} path the path of the fle
 * @returns a MD5
 */
async function fileSignature(path) {
    return await window.myAPI.md5file(path);
}

async function fileRead(path) {
    return await window.myAPI.fileRead(path);
}

async function copyFile(source, destination) {
    return await window.myAPI.copyFile(source, destination);
}

async function registerFile(path) {
    // console.warn("/// Signature of file " + path.replace(/.*\//, ''));
    const md5 = await fileSignature(path);
    if (!md5) {
        // console.warn("/// Not exists " + path.replace(/.*\//, ''));
        return null;
    }
    var entry = fileMap[md5];
    // console.warn("/// Statistics of file " + path.replace(/.*\//, ''));
    const infos = await fileStats(path);
    if (entry == null) {
        entry = {
            'md5': md5,
            'size': infos.size,
            'backuped': 0, // Number of backuped files (0 = none)
            'entries': []
        };
        fileMap[md5] = entry;
    }
    entry.entries.push(path);
    // console.warn("/// Registered of file " + path.replace(/.*\//, ''));
    return entry;
}

/**
 * Scan a directory to get the number of bytes
 *
 * @param {string} path the path to scan
 * @returns the number of bytes
 */
async function directorySize(path) {
    var size = +0;
    if (await fileExists(path)) {
        var files = await loadDirectory(path);
        for (var i = 0; i < files.length; i++) {
            const entry = files[i];
            if (entry.symLink) {
                size += kilobytes(0);
            } else if (entry.directory) {
                size += await directorySize(path + "/" + entry.name);
            } else {
                var infos = await fileStats(path + "/" + entry.name);
                size += kilobytes(infos.size);
            }
        }
    } else {
        trace("NOENT", path);
    }
    if (isNaN(size)) {
        console.error("ERROR AT ", path);
        throw new Error("Something went badly wrong!");
    }
    return size;
}


/**
 * Refresh display 
 */
export function refresh() {
    // console.log("Called refresh() in MAIN");

    const infos = {
        // currentScanned: currentScanned,
        scanErrors: scanErrors,
        "totalDirectories": totalDirectories,
        'nbDirectories': nbDirectories,
        scannedDirectories: scannedDirectories,
        rootDisk: rootDisk,
        filesInMap: Object.keys(fileMap).length,
        extraFiles: extraFiles,
        fcpxLibraries: fcpxLibraries,
        autosave: {
            list: autosaved
        },
        backupStore: (backupStore ? backupStore.libs : []),
        done: false
    };

    // Add backup information
    if (backupDone >= -1) {
        infos.backup = {
            directory: storageDirectory,
            done: Math.max(0, backupDone),
            total: backupList.length,
        };
    }

    if (scannedDirectories < totalDirectories) {
        // Nothing to do...
    } else if (backupDone == -1) {
        backupDone = 0;
        backupList.forEach(lib => {
            backupLibrary(lib).then(() => {
                backupDone++;
            });
        });
    } else if (backupDone == backupList.length) {
        displayMessage = "Everything backuped. You can exit.";
        infos.done = true;
    } else if (backupDone == -2) {
        displayMessage = "Everything scanned. You can exit.";
        infos.done = true;
    }
    infos.message = displayMessage;
    displayMessage += infos.done ? '' : '.';
    return infos;
}

// module.exports.refresh = refresh;

function abbreviate(path, maxLength) {
    if (path.length > maxLength) {
        while (path.length > maxLength && path.indexOf('/') != -1) {
            const parts = path.split('/');
            var newPath = '';
            var removed = false;
            for (var j = 0; j < parts.length; j++) {
                if (parts[j] == '...') {
                    // Nothing to do
                } else if (!removed && j >= parts.length / 2) {
                    removed = true;
                    newPath += '/...';
                } else {
                    newPath += '/' + parts[j];
                }
            }
            path = newPath.substring(1);
        }
    }
    return path;
}

export async function addUserDirectory(path) {
    nbDirectories++;
    scanDirectory(path).then(data => {
        nbDirectories += data.length;
        data.forEach(name => {
            if (name.match('\.(app|photoslibrary)$') || name === 'Backups.backupdb') {
                trace("SKIP", name);
            } else {
                addUserDirectory(path + '/' + name);
            }
        });
        nbDirectories -= (data.length + 1);
    });
}

// module.exports.addUserDirectory = addUserDirectory;

function isValidDirectory(path) {
    return (
        path.match(new RegExp("^/Users/")) || path.match(new RegExp("^/Volumes/"))
    );
}

var storageDirectory = null;

export async function checkForBackupDisk() {
    if (await fileExists(BACKUP_DIR)) {
        storageDirectory = BACKUP_DIR + "/BackupStore";
        if (await fileExists(storageDirectory)) {
            const data = await fileRead(storageDirectory + "/store.json");
            notice("JSON", data);
            backupStore = JSON.parse(data);
            if (!backupStore.version || backupStore.version < 2) {
                const old = backupStore;
                console.log("Upgrade backup store to version 1...")
                backupStore = {
                    version: 2,
                    libs: {},
                };
                console.log("Backup reset.");
            } else {
                console.log("Backup store loaded.");
            }
        } else {
            backupStore = {
                version: 2,
                libs: {},
            };
            await mkdirs(storageDirectory, true);
            await mkdirs(storageDirectory + "/Files", false);
            await mkdirs(storageDirectory + "/Libraries", false);
            await mkdirs(storageDirectory + "/Folders", false);
            await fileWrite(storageDirectory + '/.metadata_never_index', '');
        }
        console.log("SAVE BACKUP STORE.", backupStore);
        await fileWrite(storageDirectory + "/store.json", JSON.stringify(backupStore));
        backupDone = -1;
        return storageDirectory;
    }
    return null;
}

// module.exports.checkForBackupDisk = checkForBackupDisk;

async function loadDirectory(path) {
    // currentScanned = path;
    return await window.myAPI.loadDirectory(path);
}

async function scanDirectory(path) {
    if (path === BACKUP_DIR) {
        trace("FCPBACKUP", path);
        return [];
    }
    nbDirectories++;
    trace("SCAN", path);
    var pathList = [];
    totalDirectories++;
    const files = await loadDirectory(path);
    const dirList = [];
    for (var i = 0; i < files.length; i++) {
        displayMessage = 'Scanning ' + abbreviate(path, 80) + '...';
        const entry = files[i];
        var fullPath = path.replace(/\/$/, "") + "/" + entry.name;
        if (entry.name.match(/^\./)) {
            //console.log("Entry " + fullPath + " ignored.")
        } else if (isVideoFile(fullPath) && entry.file) {
            // notice("VIDEO", fullPath);
            // addToIndex(entry.name, fullPath);
        } else if (fullPath.match(/\.fcpbundle$/)) {
            //  console.warn("Scanning libray...")
            await registerLibrary(fullPath);
        } else if (await isFinalCutCache(fullPath)) {
            notice("CACHE", fullPath);
        } else if (fullPath.match(/^\/(Backups.backupdb|Applications|private|dev|Library|System)$/i)) {
            notice("IGNORE", fullPath);
        } else if (entry.directory) {
            dirList.push(entry.name);
        }
    }
    scannedDirectories++;
    nbDirectories--;
    return dirList;
}


async function backupFile(md5, force) {
    const md5filename = md5 + '.bin';
    const md5dir = storageDirectory + "/Files/" + md5.substring(0, 1) + "/" + md5.substring(0, 2);
    const md5path = md5dir + "/" + md5filename;

    const destExists = await fileExists(md5path);
    if (force || !destExists) {
        const infos = fileMap[md5];
        await mkdirs(md5dir, true);
        displayMessage = "Copy of " + infos.entries[0].replace(/.*\//, '') + "...";
        await copyFile(infos.entries[0], md5path);
    }
    return md5path;
}

function dirname(name) {
    return name.replace(/\/[^/]*$/, '');
}

async function backupIfNeeded(md5) {
    if (!md5) {
        console.error("NO MD5", md5);
    }
    const infos = fileMap[md5];
    if (!infos) {
        console.error("NO INFOS FOR " + md5, md5);
    }
    const md5path = await backupFile(md5, false);
    for (var i = 0; i < infos.length; i++) {
        const path = infos.entries[i];
        const filename = storageDirectory + "/Folders" + path;
        await mkdirs(dirname(filename), true);
        await fslink(md5path, filename);
        console.log("HARD LINK " + filename + " => " + md5filename);
    }
    infos.backuped = true;
    return md5path;
}

window.myAPI.handleCopyProgress((event, value) => {
    displayMessage = value;
})

export function deleteEventDirectory(index, subdir) {
    const idx = physicalIndexOf(index);
    fcpxLibraries[idx].events.forEach((evt) => {
        const path = fcpxLibraries[idx].path + "/" + evt.name + "/" + subdir;
        deleteDirectoryContents(path).then(() => {
            reloadLibrary(index);
            refresh();
        })
    });
}
