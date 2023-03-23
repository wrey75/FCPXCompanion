const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs');
const { Dirent } = require('fs');

var win;

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    })

    win.loadFile('src/index.html')
    // Open the DevTools.
    win.webContents.openDevTools();
}

/**
 * Loads a directory.
 * 
 * @param {string} path the path to load
 */
function handleDirectoryLoad(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, { withFileTypes: true }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                const files = [];
                data.forEach(x => {
                    if (x.name.substring(0, 1) != '.' && (x.isFile() || x.isDirectory())) {
                        files.push({
                            dir: x.isDirectory(),
                            file: x.isFile(),
                            symlink: x.isSymbolicLink(),
                            name: x.name
                        });
                    }
                });
                resolve(files);
            }
        })
    });
}

app.whenReady().then(() => {
    createWindow()
    ipcMain.handle("dir:load", (event, path) => handleDirectoryLoad(path))
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})



