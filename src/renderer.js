/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

// import './css/bootstrap.css';
//import './js/jquery.js';
// import './js/fcpx-gui';

console.log(
  '👋 This message is being logged by "renderer.js", included via webpack'
);

btn = document.getElementById("testBtn");

btn.addEventListener("click", () => {
  const fileList = window.myAPI.loadDirectory("/");
  console.log(fileList);
});


// console.log(window.myAPI.homedir());
checkForBackupDisk().then( path => {
    // console.warn("BACKUP = " + path);
    if(path){
        jQuery("#backupContents").html("Backup will be done at "+ path);
    }
})

window.myAPI.homedir().then(h => {
    console.log("HOMEDIR = " + h);
    addUserDirectory(h + "/Movies");
});
addUserDirectory("/Volumes");
setInterval(refresh, 500);