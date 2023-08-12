
import { checkForBackupDisk, addUserDirectory, refresh } from './fcpx-scanner'


checkForBackupDisk().then( path => {
    var elem = document.getElementById("backupContents");
    if(path){
        elem.innerHTML = "Backup will be done at "+ path;
    } else {
        // The text is directly set in the "index.html" file.
        // elem.innerHTML = "You must have a disk named <b>FCPSlave</b> in order to have your data backuped.";
    }
})

window.myAPI.homedir().then(h => {
    console.log("HOMEDIR = " + h);
    addUserDirectory(h + "/Movies");
});

addUserDirectory("/Volumes");
