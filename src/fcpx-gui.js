
function refreshDisplay(infos) {
    if(!document.getElementById("scanProgress")){
        console.warn("UI is not ready...");
        return;
    }
    if(infos.done){
        document.getElementById("spinner").style.display = "none";
    }
    var size = Math.floor((infos.scannedDirectories * 100.0) / infos.totalDirectories);
    if (infos.storageDirectory) {
        size = size / 2 + Math.floor(((filesBackuped + 1) * 50.0) / (infos.backupPromises.length + 1));
    }
    const text = "width: " + size + "%";
    const domScan = document.getElementById("scanProgress");
    domScan.getElementsByTagName("div")[0].style = text;
    // document.getElementById("scanText").innerText = infos.message;
   
}

module.exports.refreshDisplay = refreshDisplay;
