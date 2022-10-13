const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            //preload: path.join(__dirname, 'preload.js'),
        }
    })

    win.loadFile('src/index.html')
    // Open the DevTools.
    win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow()

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
