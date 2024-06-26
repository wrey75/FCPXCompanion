/**
 * This source code is dedicated to the scanning and
 * not realted to a UI interface. Nevertheless, all the information
 * is stored there.
 *
 */

var currentStep = 0;
var scanErrors = [];
var libraryFound = [];
var scannedDirectories = 0;
var totalDirectories = 0;
var rootDisk = null;
var fileMap = {};
var extraFiles = [];
var fcpxLibraries = [];
var autosaved = []; // The backups made by Apple found
var backupStore;
var backupList = []; // Libraries to backup...
var totalToBackup = 0;
var totalBackuped = 0;
var storageDirectory = null;
var displayMessage = 'Starting...';

const BACKUP_DIR = '/Volumes/FCPSlave';

function trace(type, message) {
    window.myAPI.trace(type, message);
}

function notice(type, message) {
    window.myAPI.notice(type, message);
}

function warning(type, message) {
    window.myAPI.warning(type, message);
}

function deleteFile(path, follow) {
    return window.myAPI.unlink(path, follow);
}

export function shellOpen(path) {
    window.myAPI.shellOpen(path);
}

function removeDirectory(path) {
    return window.myAPI.rmdir(path);
}


function homedir() {
    return window.myAPI.homedir();
}

function scanPList(path) {
    return window.myAPI.scanPList(path);
}

function fileStats(path) {
    return window.myAPI.fileStats(path);
}

function moveFile(src, dst) {
    return window.myAPI.moveFile(src, dst);
}

function fileExists(path) {
    return window.myAPI.fileExists(path);
}

function mkdirs(path, recursive) {
    return window.myAPI.mkdirs(path, recursive);
}

function fileWrite(path, contents) {
    return window.myAPI.fileWrite(path, contents);
}


function fslink(current, newOne) {
    // trace('LINK_TO', current + ' --> ' + newOne);
    return window.myAPI.fslink(current, newOne);
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
async function deleteDirectoryContents(path, follow) {
    if (await fileExists(path)) {
        var files = await loadDirectory(path, true);
        for (var i = 0; i < files.length; i++) {
            const entry = files[i];
            var full = path + "/" + entry.name;
            if (entry.directory) {
                await deleteDirectoryContents(full, follow);
                await removeDirectory(full);
                console.log(full + ": rmdir");
            } else {
                await deleteFile(full, follow);
                console.log(full + ": deleted");
            }
        }
    } else {
        console.log(path + ": not found!");
        return false;
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

/**
 * Reload the library based on information available at the index. Quite simple
 * way to do.
 *
 * @param {number} index
 */
async function reloadLibrary(path) {
    const refreshedLibrary = await loadLibrary(path);
    for(var i = 0; i < fcpxLibraries.length; i++){
        if(fcpxLibraries[i].path === path){
            fcpxLibraries[i] = refreshedLibrary;
        }
    }
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
            // Also copy the subdirectories...
            await copyDirectory(src + '/' + f.name, dst + '/' + f.name, useLinks);
        } else {
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
}

function percent(index, total){
    if(total == 0){
        return '0%';
    } else {
        return (index * 100.0 / total).toFixed(2) + '%';
    }
}

export async function backupLibrary(library) {
    if (storageDirectory == null) {
        console.warn("No FCPBackup disk available.");
        return false;
    }

    if (library.duplicated) {
        console.warn("Can not backup: duplicate library");
        return false;
    }

    console.log("Backup of " + library.libraryID + '...');
    const libraryName = backupStore.libs[library.libraryID]?.name || uniqueName(library);
    const finalLibraryPath = storageDirectory + '/Libraries/' + libraryName + '.fcpbundle';
    const libraryPath = finalLibraryPath + '~';
    displayMessage = "Backuping " + library.name + "...";
    const folderPath = storageDirectory + '/Folders' + library.path;
    library.backup = 1;
    // await mkdirs(folderPath, true);
    await mkdirs(libraryPath, true);
    await mkdirs(libraryPath + '/Motion Templates', false);
    await copyDirectory(library.path + '/Motion Templates', libraryPath + '/Motion Templates', false);
    await mkdirs(libraryPath + '/__Temp');
    // await copyFile(library.path + '/CurrentVersion.flexolibrary', folderPath + '/CurrentVersion.flexolibrary');
    await copyFile(library.path + '/CurrentVersion.flexolibrary', libraryPath + '/CurrentVersion.flexolibrary');

    // await copyFile(library.path + '/CurrentVersion.plist', folderPath + '/CurrentVersion.plist')
    await copyFile(library.path + '/CurrentVersion.plist', libraryPath + '/CurrentVersion.plist')

    // await copyFile(library.path + '/Settings.plist', folderPath + '/Settings.plist');
    await copyFile(library.path + '/Settings.plist', libraryPath + '/Settings.plist');

    // await copyFile(library.path + '/__Sync__', libraryPath + '__Sync__');
    var missingFiles = false;
    var nbLostCopied = 0;
    for (var i = 0; i < library.events.length; i++) {
        const event = library.events[i];
        // const eventDir = folderPath + '/' + event.name;
        // await mkdirs(eventDir, false);
        // await mkdirs(eventDir + '/Original Media', false);
        // await mkdirs(eventDir + '/Transcoded Media', false);
        await mkdirs(libraryPath + '/' + event.name, false);
        await mkdirs(libraryPath + '/' + event.name + '/Original Media', false);
        await mkdirs(libraryPath + '/' + event.name + '/Transcoded Media', false);

        var total = event.links.length + event.files.length + event.projects.length + event.lost.length;
        var nb = 0;
        
        displayMessage = "Backuping " + library.name + '...';
        await copyFile(library.path + '/' + event.name + '/CurrentVersion.fcpevent', libraryPath + '/' + event.name + '/CurrentVersion.fcpevent');

        // Backup the projects in the library
        for (var j = 0; j < event.projects.length; j++) {
            displayMessage = "Backuping " + library.name + " (" + percent(nb++, total) + ')...';
            // const projectDir = eventDir + '/' + event.projects[j];
            // await mkdirs(projectDir, false);
            await mkdirs(libraryPath + '/' + event.name + '/' + event.projects[j], false);
            // await copyFile(library.path + '/' + event.name + '/' + event.projects[j] + '/CurrentVersion.fcpevent', projectDir + '/CurrentVersion.fcpevent');
            await copyFile(library.path + '/' + event.name + '/' + event.projects[j] + '/CurrentVersion.fcpevent', libraryPath + '/' + event.name + '/' + event.projects[j] + '/CurrentVersion.fcpevent');
            totalBackuped++;
        }
        
        for (var j = 0; j < event.links.length; j++) {
            // warning("CODE", 'Link ' + j);
            // displayMessage = "Backuping " + library.name + " (" + event.links[j].path.replace(/.*\//, '') + ')...';
            displayMessage = "Backuping " + library.name + " (" + percent(nb++, total) + ')...';
            const md5path = await backupIfNeeded(event.links[j].md5);
            await fslink(md5path, libraryPath + '/' + event.name + '/Original Media/' + event.links[j].name);
            await mkdirs(dirname(storageDirectory + '/Folders' + event.links[j].resolvedPath), true);
            await fslink(md5path, storageDirectory + '/Folders' + event.links[j].resolvedPath);
            totalBackuped++;
        }

        for (var j = 0; j < event.files.length; j++) {
            // warning("CODE", 'File ' + j);
            // displayMessage = "Backuping " + library.name + " (" + event.files[j].path.replace(/.*\//, '') + ')...';
            displayMessage = "Backuping " + library.name + " (" + percent(nb++, total) + ')...';
            const md5path = await backupIfNeeded(event.files[j].md5);
            // console.warn(j +':' + md5path + " \\ " + root + event.files[j].path);
            // await mkdirs(dirname(storageDirectory + '/Folders' + event.files[j].path), true);
            // await fslink(md5path, storageDirectory + '/Folders' + '/' + event.files[j].path);
            await fslink(md5path, libraryPath + '/' + event.name + '/Original Media/' + event.files[j].name);
            const destPath = storageDirectory + '/Folders' + library.path.replace(/\.fcpbundle$/, '_fcpbundle') + '/' + event.name;
            await mkdirs(destPath, true);
            await fslink(md5path, destPath + '/' + event.files[j].name);
            totalBackuped++;
        }

        // Keep the lost files that already exists in the library!
        for (var j = 0; j < event.lost.length; j++) {
            displayMessage = "Backuping " + library.name + " (" + percent(nb++, total) + ')...';
            const original = `${finalLibraryPath}/${event.name}/Original Media/${event.lost[j].name}`;
            if (await fileExists(original)){
                const dest = `${libraryPath}/${event.name}/Original Media/${event.lost[j].name}`;
                await fslink(original, dest);
                nbLostCopied++;
            } else {
                warning("LOST", original);
            }
        }
        missingFiles = missingFiles || (event.lost.length > 0);
    }

    displayMessage = `Finalizing the backup of "${library.name}"...`;
    if(await deleteDirectoryContents(finalLibraryPath)){
        await removeDirectory(finalLibraryPath);
    }
    await moveFile(libraryPath, finalLibraryPath);

    backupStore.libs[library.libraryID].updated = new Date().toISOString();
    backupStore.libs[library.libraryID].lost = library.totals.lost;
    backupStore.libs[library.libraryID].notLost = nbLostCopied;
    await persistBackupStore();
    library.backup = (library.totals.lost > 0 ? 2 : 3);
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
    // console.log("Loading FCPX " + path + '...');
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
    // console.log("Loaded library " + library.path);
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
    var insertAt = 0;
    library.index = fcpxLibraries.length;
    library.duplicated = false;
    for (var i = 0; i < fcpxLibraries.length; i++) {
        if (library.libraryID === fcpxLibraries[i].libraryID) {
            insertAt = i + 1;
            library.duplicated = true;
        }
    }
    fcpxLibraries.splice(insertAt, 0, library);
}

async function addToBackups(library) {
    if (backupStore != null && !library.duplicated) {
        if (backupStore.libs[library.libraryID]) {
            backupStore.libs[library.libraryID].last = new Date().toISOString();
            if (backupStore.libs[library.libraryID].path != library.path) {
                console.warn("Library moved from " + backupStore.libs[library.libraryID].path + " to " + library.path);
                backupStore.libs[library.libraryID].path = library.path;
            }
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
        for (var i = 0; i < library.events.length; i++) {
            const evt = library.events[i];
            totalToBackup += evt.projects.length + evt.links.length + evt.files.length;
        }
    }
    await persistBackupStore();
    backupList.push(library);
}

async function preregister(path) {
    const stats = await fileStats(path);
    if (path.match(/\.fcpbundle$/) && stats.directory) {
        // console.log("EXISTS __BackupInfo")
        const found = await fileExists(path + "/__BackupInfo.plist");
        if (found) {
            // we have a backup, not a real library.
            notice("AUTOSAVE", path);
            const idx = autosaved.length + 1;
            autosaved.push({ path: path, index: idx });
            autosaved.sort((a, b) => (a.path.localeCompare(b.path)));
        } else {
            libraryFound.push(path);
        }
    }
}

export async function registerLibrary(path) {
    console.log("Register library " + path.replace(/.*\//, '') + '...');
    const stats = await fileStats(path);
    if (path.match(/\.fcpbundle$/) && stats.directory) {
        // console.log("EXISTS __BackupInfo")
        const found = await fileExists(path + "/__BackupInfo.plist");
        if (found) {
            // we have a backup, not a real library.
            notice("AUTOSAVE", path);
            const idx = autosaved.length + 1;
            autosaved.push({ path: path, index: idx });
            autosaved.sort((a, b) => (a.path.localeCompare(b.path)));
            return null;
        } else {
            notice("FCPX", path);
            // console.log("LOAD " + path.replace(/.*\//, ''));
            var library = await loadLibrary(path);
            // console.log("ADD TO LIST " + path.replace(/.*\//, ''));
            addToLibraries(library);
            // console.log("ADD TO BACKUP " + path.replace(/.*\//, ''));
            await addToBackups(library);
            // console.log("Registered library " + library.libraryID);
            return library;
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
function fileSignature(path) {
    return window.myAPI.md5file(path);
}

function fileRead(path) {
    return window.myAPI.fileRead(path);
}

function copyFile(source, destination) {
    return window.myAPI.copyFile(source, destination);
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
                const infos = await fileStats(entry.realPath);
                size += kilobytes(infos.size + 1024); // We add a fictive size for the link
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
    const infos = {
        // currentScanned: currentScanned,
        found: libraryFound.length,
        scanErrors: scanErrors,
        totalDirs: totalDirectories,
        scannedDirs: scannedDirectories,
        rootDisk: rootDisk,
        filesInMap: Object.keys(fileMap).length,
        extraFiles: extraFiles,
        fcpxLibraries: fcpxLibraries,
        autosave: {
            list: autosaved
        },
        backupStore: (backupStore ? backupStore.libs : []),
        totalBackuped: totalBackuped,
        totalToBackup: totalToBackup,
        done: false,
        step: currentStep,
    };

    // Add backup information
    var count = 0;
    fcpxLibraries.forEach(lib => (lib.bakup == 2 ? count++ : 0));
    const backupDone = count;

    if(storageDirectory != null){
        infos.backup = {
            directory: storageDirectory,
            done: backupDone,
            total: backupList.length,
        };
    }

    const progress1 = (totalDirectories == 0 ? 0 : (scannedDirectories * 100 / totalDirectories));
    const progress2 = (libraryFound.length == 0 ? 0 : (fcpxLibraries.length * 100 / libraryFound.length));
    const progress3 = (totalToBackup == 0 ? 0 : (totalBackuped * 100 / totalToBackup));
    infos.progress = (progress1 * 20.0 + progress2 * 20.0 + progress3 * 60.0) / (storageDirectory ? 100.0 : 40.0);

    if (currentStep == 100) {
        displayMessage = "Everything scanned. You can exit.";
        infos.done = true;
    }
    infos.message = displayMessage;
    displayMessage += infos.done ? '' : '.';
    return infos;
}

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

export async function scanUserDirectories(array) {
    await Promise.all(array.map(x => scanDirectory(x)));
    return libraryFound;
}

// /**
//  * Add a directory to be scanned in a asynchronous way.
//  * 
//  * @param {string} path 
//  */
// export function addUserDirectory(path) {
//     nbDirectories++;
//     if (path === BACKUP_DIR) {
//         notice("SKIP", path);
//     }
//     console.log("Added directory " + path);
//     scanDirectory(path).then(data => {
//         nbDirectories += data.length;
//         data.forEach(name => {
//             if (name.match(/\.(app|photoslibrary)$/) || name.match(/^(Applications|private|dev|Library|System|Backups.backupdb)$/)) {
//                 notice("SKIP", name + ' in ' + path);
//             } else {
//                 addUserDirectory(path + '/' + name);
//             }
//         });
//         nbDirectories -= (data.length + 1);
//     });
// }


function isValidDirectory(path) {
    return (
        path.match(new RegExp("^/Users/")) || path.match(new RegExp("^/Volumes/"))
    );
}

/**
 * Persists the backup store.
 */
async function persistBackupStore() {
    if (storageDirectory != null) {
        // console.log("Saving the backup store...", backupStore);
        // const tmpFile = storageDirectory + "/store-tmp.json";
        await fileWrite(storageDirectory + "/store.json", JSON.stringify(backupStore, null, 2));
        // await copyFile(tmpFile, storageDirectory + "/store.json");
        // await deleteFile(storageDirectory + "/store-tmp.json");
    }
}

export function setCurrentStep(current) {
    currentStep = current;
}

export async function checkForBackupDisk() {
    notice("STEP", "Looking for the backup disk...");
    if (await fileExists(BACKUP_DIR)) {
        storageDirectory = BACKUP_DIR + "/BackupStore";
        if (await fileExists(storageDirectory) && await fileExists(storageDirectory + "/store.json")) {
            const data = await fileRead(storageDirectory + "/store.json");
            backupStore = JSON.parse(data);
            if (!backupStore.version || backupStore.version < 2) {
                const old = backupStore;
                console.log("Upgrade backup store to version 2...")
                backupStore = {
                    version: 2,
                    libs: {},
                };
                console.log("Backup store reset.");
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
        await persistBackupStore();
        return storageDirectory;
    }
    return null;
}


async function loadDirectory(path, withHidden = false) {
    // currentScanned = path;
    return await window.myAPI.loadDirectory(path, withHidden);
}

function asRegEx(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanDirectory(path) {
    if (path.match(new RegExp(asRegEx(BACKUP_DIR), 'i'))) {
        warning("SKIP", path);
        return Promise.resolve(0);
    }

    // console.log("Scanning " + path);
    totalDirectories++;
    return new Promise((resolve, reject) => {
        loadDirectory(path).then(files => {
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
                    preregister(path + '/' + entry.name);
                } else if (entry.directory && !(entry.name.match(/\.(app|photoslibrary)$/) || entry.name.match(/^(Applications|private|dev|Library|System|Backups.backupdb)$/))) {
                    dirList.push(scanDirectory(path + '/' + entry.name));
                }
            }
            totalDirectories += dirList.length;
            Promise.all(dirList).then(array => {
                resolve(array.length);
                totalDirectories -= array.length;
            })
            scannedDirectories++;
        })
    });
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
        // console.log("HARD LINK " + filename + " => " + md5filename);
    }
    infos.backuped = true;
    return md5path;
}

window.myAPI.handleCopyProgress((event, value) => {
    displayMessage = value;
})

function physicalIndexOf(index){
    for(var i = 0; i < fcpxLibraries.length; i++){
        if(fcpxLibraries[i].index == index){
            return i;
        }
    }
    throw new Error("Coding error: should return the physical index!");
}

/**
 * or each event of the specified library, delete the contents specified.
 * 
 * @param {string} index the index of the library
 * @param {string} subdir the subdirectory to delete
 * @param {string} follow true in case of a symbolic link, also delete the file linked.
 */
export function deleteEventDirectory(index, subdir, follow) {
    const idx = physicalIndexOf(index);
    fcpxLibraries[idx].events.forEach((evt) => {
        const path = fcpxLibraries[idx].path + "/" + evt.name + "/" + subdir;
        deleteDirectoryContents(path, follow).then(() => {
            reloadLibrary(fcpxLibraries[idx].path);
            refresh();
        })
    });
}
