/**
 * This source code is dedicated to the scanning and
 * not realted to a UI interface. Nevertheless, all the information
 * is stored there.
 *
 */

var currentScanned = "/";
var scanErrors = [];
var nbDirectories = 0;
var scannedDirectories = 0;
var totalDirectories = 0;
var rootDisk = null;
var fileMap = {};
var extraFiles = [];
var fcpxLibraries = [];
var fcpxBackups = []; // The backups made by Apple found
var missingFiles = [];

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

function deleteFile(path) {
    window.myAPI.unlink(path);
}

function shellOpen(path) {
    window.myAPI.shellOpen(path);
}

function removeDirectory(path) {
    window.myAPI.rmdir(path);
}


async function homedir() {
    return window.myAPI.homedir();
}

async function scanPList(path) {
    return window.myAPI.scanPList(path);

}

async function fileStats(path) {
    const p = window.myAPI.fileStats(path);
    // console.warn("stats ", p);
    return p;
}

async function fileExists(path) {
    return window.myAPI.fileExists(path);
}

async function mkdirs(path, recursive) {
    return window.myAPI.mkdirs(path, recursive);
}

async function fileWrite(path, contents) {
    return window.myAPI.fileWrite(path, contents);
}


async function fslink(current, newOne) {
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
    return (Math.floor(+bytes / 2048) + 1) * 2048;
}

function isVideoFile(path) {
    return path.match(
        /\.(mts|avi|mkv|mov|mp4|m4v|m4a|mp2|mp3|aiff|wav|aac|jpg|jpeg|gif|psd|png|tiff)$/i
    );
}


async function scanEventFiles(library, event, path) {
    const files = await loadDirectory(path);
    for (var i = 0; i < files.length; i++) {
        const e = files[i];
        if (e.symLink) {
            try {
                var realPath = path + "/" + e.name;
                trace("SYMLINK", path + "/" + e.name + " => " + realPath);
                var infos = await registerFile(realPath);
                if(!infos){
                    event.lost.push({
                        'name' :e.name,
                        'path' : e.realPath
                    });
                } else {
                    event.links.push({
                        md5: infos.md5,
                        path: path + "/" + e.name,
                        resolvedPath: realPath
                    });
                }
            } catch (err) {
                if (err.code === "ENOENT") {
                    event.lost.push({name:e.name, path: null});
                } else {
                    console.error(e.name + ": " + err.code);
                }
            }
        } else if (e.directory) {
            // Quite unexepected
            console.warn("Found a sub-directory...!");
            await scanEventFiles(library, event, path + "/" + e.name);
        } else {
            var infos = await registerFile(path + "/" + e.name);
            event.size += kilobytes(infos.size);
            event.files.push({
                md5: infos.md5,
                path: path + "/" + e.name
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
            const entry = files[i0];
            var full = path + "/" + entry.name;
            if (entry.directory) {
                deleteDirectoryContents(full);
                removeDirectory(full);
                console.log(full + ": rmdir");
            } else {
                deleteFile(full);
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
 * Reload the library based on information available at the index. Quite simple
 * way to do.
 *
 * @param {number} index
 */
function reloadLibrary(index) {
    fcpxLibraries[index] = loadLibrary(fcpxLibraries[index].path);
}

async function backupLibrary(library) {
    const root = storageDirectory + '/Libraries';
    if(library.duplicated){
        console.warn("Can not backup: duplicate library");
        return false;
    }
    library.backup = 1;
    await mkdirs(root + library.path, true);
    await mkdirs(root + library.path + '/Motion Templates');
    await mkdirs(root + library.path + '/__Temp');
    await copyFile(library.path + '/CurrentVersion.flexolibrary', root + library.path + '/CurrentVersion.flexolibrary');
    await copyFile(library.path + '/CurrentVersion.plist', root + library.path + '/CurrentVersion.plist')
    await copyFile(library.path + '/Settings.plist', root + library.path + '/Settings.plist');
    // await copyFile(library.path + '/__Sync__', root + library.path + '__Sync__');
    for(var i = 0; i < library.events.length; i++){
        const event = library.events[i];
        const eventDir = root + library.path + '/' + event.name;
        await mkdirs(eventDir, false);
        await mkdirs(eventDir + '/Original Media', false);
        await mkdirs(eventDir + '/Transcoded Media', false);
        for(var j = 0; j < event.projects.length; j++){
            const projectDir = eventDir + '/'  + event.projects[j];
            await mkdirs(projectDir, false);
            await copyFile(library.path + '/' + event.name + '/' + event.projects[j] + '/CurrentVersion.fcpevent', projectDir + '/CurrentVersion.fcpevent');
        }
        for(var j = 0; j < event.links.length; j++){
            const md5path = await backupIfNeeded(event.links[j].md5);
            await fslink(md5path, root + event.links[j].path);
        }
        for(var j = 0; j < event.files.length; j++){
            const md5path = await backupIfNeeded(event.files[j].md5);
            await fslink(md5path, root + event.files[j].path);
        }
    }
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

    var eventDir = await loadDirectory(path);
    for (var i = 0; i < eventDir.length; i++) {
        const ent = eventDir[i];
        if (await fileExists(path + "/" + ent.name + "/CurrentVersion.fcpevent")) {
            var event = {
                name: ent.name,
                size: +0,
                links: [],
                projects: [], // name of projects in the event
                lost: [], // lost symbolic links
                files: [] // List of files
            };
            await scanEventFiles(
                library,
                event,
                path + "/" + ent.name + "/Original Media"
            );
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
    return library;
}

function addToLibraries(library){
    library.duplicated = false;
    for(var i=0; i < fcpxLibraries.length; i++){
        if(library.libraryID === fcpxLibraries[i].libraryID){
            library.duplicated = true;
        }
    }
    fcpxLibraries.push(library);
}

async function registerLibrary(path) {
    const stats = await fileStats(path);
    if (path.match(/\.fcpbundle$/) && stats.directory) {
        const found = await fileExists(path + "/__BackupInfo.plist");
        if (found) {
            // we have a backup, not a real library.
            notice("BACKUP", path);
            fcpxBackups.push(path);
        } else {
            var library = await loadLibrary(path);
            addToLibraries(library);
            backupLibrary(library);
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
    currentScanned = path;
    // if(await fileExists(path)){
    const md5 = await fileSignature(path);
    if(!md5) return null;
    var entry = fileMap[md5];
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
    trace("REGISTER", md5 + " - " + path);
    return entry;
    // } else {
    //     warning("MISSING", path);
    //     missingFiles.push(path);
    //     return {
    //         path: path,
    //         md5: null,
    //         size: 0,
    //     };;
    // }
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
            entry = files[i];
            if (entry.symbolicLink) {
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
    if(isNaN(size)){
        console.error("ERROR AT ", path);
        throw new Error("Something went badly wrong!");
    }
    return size;
}

function refresh() {
    // console.log("Called refresh() in MAIN");
    const infos = {
        currentScanned: currentScanned,
        scanErrors: scanErrors,
        "totalDirectories": totalDirectories,
        'nbDirectories': nbDirectories,
        scannedDirectories: scannedDirectories,
        rootDisk: rootDisk,
        filesInMap: Object.keys(fileMap).length,
        extraFiles: extraFiles,
        fcpxLibraries: fcpxLibraries,
        fcpxBackups: fcpxBackups,
    };
    refreshDisplay(infos);
}

function addUserDirectory(path) {
    nbDirectories++;
    scanDirectory(path).then(data => {
        // console.warn(data);
        data.forEach(name => {
            addUserDirectory(path + '/' + name);
        });
        nbDirectories--;
    });
}

function isValidDirectory(path) {
    return (
        path.match(new RegExp("^/Users/")) || path.match(new RegExp("^/Volumes/"))
    );
}

var storageDirectory = null;

async function checkForBackupDisk() {
    if (await fileExists(BACKUP_DIR)) {
        storageDirectory = BACKUP_DIR + "/BackupStore";
        if (await fileExists(storageDirectory)) {
            const data = await fileRead(storageDirectory + "/store.json");
            notice("JSON", data);
            backupStore = JSON.parse(data);
            console.log("Backup store loaded.");
        } else {
            backupStore = {};
            await mkdirs(storageDirectory, true);
            await mkdirs(storageDirectory + "/Files", false);
            await mkdirs(storageDirectory + "/Libraries", false);
            await mkdirs(storageDirectory + "/Folders", false);
            await fileWrite(storageDirectory + "/store.json", JSON.stringify({}));
        }
        console.log("BACKUP STORE => " + storageDirectory);
        return storageDirectory;
    }
    return null;
}

function loadDirectory(path) {
    currentScanned = path;
    return window.myAPI.loadDirectory(path);
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
        const entry = files[i];
        var fullPath = path.replace(/\/$/, "") + "/" + entry.name;
        if (entry.name.match(/^\./)) {
            //console.log("Entry " + fullPath + " ignored.")
        } else if (isVideoFile(fullPath) && entry.file) {
            notice("VIDEO", fullPath);
            // addToIndex(entry.name, fullPath);
        } else if (fullPath.match(/\.fcpbundle$/)) {
            //  console.warn("Scanning libray...")
            await registerLibrary(fullPath);
            notice("FCPX", fullPath);
        } else if (await isFinalCutCache(fullPath)) {
            notice("CACHE", fullPath);
            /*  => symbolic links should NOT be followed because scanned elsewhere
                                    } else if (entry.isSymbolicLink()) {
                                        var path2 = fs.readlinkSync(fullPath);
                                        if (isValidDirectory(path2)) {
                                            pathList.push(path2);
                                        }
                                        */
        } else if (fullPath.match(/^\/(Applications|private|dev|Library|System)$/)) {
            notice("IGNORE", fullPath);
        } else if (entry.directory) {
            dirList.push(entry.name);
        }
    }
    scannedDirectories++;
    nbDirectories--;
    return dirList;
}

/*
async function searchBackupFiles(externalFiles) {
    const fileList = [];
    const klist = Object.keys(fileMap).filter((key) => externalFiles || fileMap[key].some((e) => e.library != null));
    for(var i = 0; i < klist.length; i++){
        const md5 = klist[i];
        subdir = md5[0] + "/" + md5.substring(0, 2);
        var files = [];
        if (fileExists(storageDirectory + "/Files/" + md5)) {
            filename = subdir + "/" + md5;
            files = (await loadDirectory(subdir)).filter((name) => name.startsWith(md5));
        }
        if (files.length < 1) {
            fileList.push(md5);
        } else {
            console.log("already: " + files[0]);
        }
    }
    return fileList;
}
*/

async function backupFile(md5, force) {
    const md5filename = md5 + '.bin';
    const md5dir = storageDirectory + "/Files/" + md5.substring(0, 1) + "/" + md5.substring(0, 2);
    const md5path = md5dir + "/" + md5filename;

    const destExists = await fileExists(md5path);
    if (force || !destExists) {
        const infos = fileMap[md5];
        await mkdirs(md5dir, true);
        await copyFile(infos.entries[0].path, md5path);
    }
    return md5path;
}

async function backupIfNeeded(md5) {
    if(!md5){
        console.error("NO MD5", md5);
    }
    const infos = fileMap[md5];
    if(!infos){
        console.error("NO INFOS FOR " + md5, md5);
    }
    const md5path = await backupFile(md5, false);
    for (var i = 0; i < infos.length; i++) {
        const path = infos.entries[i];
        const filename = storageDirectory + "/Folders" + path;
        const dirname = path.dirname(filename);
        await mkdirs(dirname, true);
        await fslink(md5path, filename);
        console.log("HARD LINK " + filename + " => " + md5filename);
    }
    infos.backuped = true;
    return md5path;
}
