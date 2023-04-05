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
var fileIndex = {};
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

function deleteFile(path){
    window.myAPI.unlink(path);
}

function shellOpen(path){
    window.myAPI.shellOpen(path);
}

function removeDirectory(path){
    window.myAPI.rmdir(path);
}


async function homedir() {
    return window.myAPI.homedir();
}

async function scanPList(path){
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

async function fileWrite(path, contents){
    return window.myAPI.fileWrite(path, contents);
}


async function fslink(current, newOne){
    return window.myAPI.fileWrite(current, newOne);
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
    for(var i = 0; i < files.length; i++){
        const e = files[i];
        if (e.symbolicLink) {
            event.links++;
            try {
                var realPath = path + "/" + e.name;
                trace("SYMLINK", path + "/" + e.name + " => " + realPath);
                var infos = await registerFile(realPath);
                infos.library = library;
                infos.event = event;
                infos.from = path + "/" + e.name;
            } catch (err) {
                if (err.code === "ENOENT") {
                    event.lost.push(e.name);
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
            infos.library = library;
            infos.event = event;
            event.size += kilobytes(infos.size);
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
        for(var i = 0; i < files.length; i++){
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
    
    var eventDir = await loadDirectory(path);
    for (var i = 0; i < eventDir.length; i++) {
        const ent = eventDir[i];
        if (await fileExists(path + "/" + ent.name + "/CurrentVersion.fcpevent")) {
            var event = {
                name: ent.name,
                size: +0,
                links: +0,
                projects: [], // name of projects in the event
                lost: [], // lost symbolic links
            };
            await scanEventFiles(
                library,
                event,
                path + "/" + ent.name + "/Original Media"
            );
            const files = await loadDirectory(path + "/" + ent.name);
            for(var j =0; j < files.length; j++){
                const f = files[j];
                if (await fileExists(path +"/" + ent.name + "/" + f.name + "/CurrentVersion.fcpevent" )) {
                    event.projects.push(f.name);
                }
            }
            event.proxySize = await directorySize(path + "/" + ent.name + "/Transcoded Media");
            event.renderSize = await directorySize(path + "/" + ent.name + "/Render Files");
            library.events.push(event);
            library.renderSize += event.renderSize;
            library.proxySize += event.proxySize;
            library.lost += event.lost.length;
            library.links += event.links;
        }
    }
    return library;
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
            fcpxLibraries.push(library);
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

function addToIndex(name, path) {
    if(!(name in fileIndex)) {
        fileIndex[name] = [];
    }
    fileIndex[name].push(path);
}

async function registerFile(path) {
    currentScanned = path;
    // if(await fileExists(path)){
        const md5 = await fileSignature(path);
        var entry = fileMap[md5] || [];
        const infos = await fileStats(path);
        var newEntry = {
            path: path,
            md5: md5,
            size: infos.size,
        };
        entry.push(newEntry);
        fileMap[md5] = entry;
        addToIndex(infos.name, path);
        trace("REGISTER", md5 + " - " + path + (entry.length > 1 ? " = " + entry[0].path : ""));
        return newEntry;
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
    var size = 0;
    if (await fileExists(path)) {
        var files = await loadDirectory(path);
        for(var i = 0; i < files.length; i++){
            entry = files[i];
            if (entry.symbolicLink) {
                size += kilobytes(0);
            } else if (entry.directory) {
                size += directorySize(path + "/" + entry.name);
            } else {
                var infos = fileStats(path + "/" + entry.name);
                size += kilobytes(infos.size);
            }
        }
    } else {
        trace("NOENT", path);
    }
    return size;
}

function refresh() {
    // console.log("Called refresh() in MAIN");
    const infos = {
        currentScanned: currentScanned,
        scanErrors: scanErrors,
        "totalDirectories": totalDirectories,
        "nbDirectories": nbDirectories,
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
            addUserDirectory(path+'/'+name);
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
            await mkdirs(storageDirectory, true );
            await mkdirs(storageDirectory + "/Files", false);
            await mkdirs(storageDirectory + "/Folders", false);
            await fileWrite(storageDirectory + "/store.json",JSON.stringify({}));
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
    if(path === BACKUP_DIR){
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
            addToIndex(entry.name, fullPath);
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

async function backupFile(md5) {
    const infos = fileMap[md5];
    const ext = path.extname(infos[0].path);
    const md5filename = md5 + ext.toLowerCase();
    const md5dir =
        storageDirectory + "/Files/" + md5[0] + "/" + md5.substring(0, 2);
    const md5path = md5dir + "/" + md5filename;

    await mkdirs(md5dir, true);
    await copyFile(infos[0].path, md5path);
    for(var i = 0; i < infos.length; i++){
        f = infos[i];
        const filename = storageDirectory + "/Folders" + f.path;
        const dirname = path.dirname(filename);
        await mkdirs(dirname, true);
        await fslink(md5path, filename);
        console.log("HARD LINK " + filename + " => " + md5filename);
    }
}
