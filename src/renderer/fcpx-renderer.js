
import { checkForBackupDisk, registerLibrary, scanUserDirectories, setCurrentStep, backupLibrary } from './fcpx-scanner'


window.myAPI.setTitle("xxx");

var backupDir;

/**
 * Same as `Promise.all(array.forEach(v => task(v)))` but run the stuff sequentially.
 * There is no advantage to run all th stuff sequentially except the fact that
 * the diplay will be more readalble for the end user.
 * 
 * @param {any} array the array. each element of the array is used as the argument of the function.
 * @param {function} task a function taking one argument. 
 * @returns 
 */
async function executeSequentially(array, task) {
    const result = [];
    for (const i of array) {
        const val = await task(i);
        result.push(val);
    }
    return result;
}

checkForBackupDisk().then(path => {
    setCurrentStep(10);
    if (path) {
        console.log("Backups will be done at " + path);
        backupDir = path;
    } else {
        console.log("No backup disk.");
    }
    return window.myAPI.homedir();
}).then((h) => {
    setCurrentStep(20);
    console.log("HOMEDIR = " + h);
    return scanUserDirectories([h + '/Desktop', h + '/Movies', '/Volumes']);
}).then((pathList) => {
    setCurrentStep(30);
    console.log(pathList.length + " paths to register...");
    return executeSequentially(pathList, registerLibrary);
    // return Promise.all(pathList.map( path => registerLibrary(path)));
}).then((libraries) => {
    console.log(libraries.length + " librairies to backup...");
    setCurrentStep(50);
    if (backupDir) {
        return executeSequentially(libraries.filter(lib => !!lib), backupLibrary);
        // return Promise.all(libraries.filter(lib => !!lib).map(lib => backupLibrary(lib)));
    } else {
        return Promise.resolve([]);
    }
}).then(() => {
    setCurrentStep(100);
    console.log("Everything done!");
});

