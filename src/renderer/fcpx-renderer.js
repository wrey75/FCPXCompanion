
import { checkForBackupDisk, addUserDirectory, refresh } from './fcpx-scanner'


checkForBackupDisk().then( path => {
    if(path){
        console.log("Backups will be done at " + path);
    } else {
        console.log("No backup disk.");
    }
})

window.myAPI.homedir().then(h => {
    console.log("HOMEDIR = " + h);
    addUserDirectory(h + "/Movies");
});

addUserDirectory("/Volumes");
window.myAPI.setTitle("xxx");
