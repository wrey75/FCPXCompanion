const { ipcRenderer, contextBridge } = require("electron");

// Expose protected methods off of window (ie.
// window.api.sendToA) in order to use ipcRenderer
// without exposing the entire object
contextBridge.exposeInMainWorld("api", {
    deleteTranscoded: (idx) => ipcRenderer.send('delete-trancoded', idx),
    deleteRender: (idx) => ipcRenderer.send('delete-render', idx),
    workStatus: () => ipcRenderer.invoke('work-status'),
    addDirectory: (dir) => ipcRenderer.invoke('add-directory', dir),
});

// ipcRenderer.on("refresh", (event, args) => {
//     console.log("Refreshing...");
//     window.refreshStatus(args);
// });
