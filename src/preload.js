// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('myAPI', {
  loadDirectory: (path) => ipcRenderer.invoke('dir:load', path),
  trace: (type, message) => ipcRenderer.send("log:trace", type, message),
  notice: (type, message) => ipcRenderer.send("log:notice", type, message),
  warning: (type, message) => ipcRenderer.send("log:warning", type, message),
  shellOpen: (path) => ipcRenderer.send("shell:open", path),
  md5file: (path) => ipcRenderer.invoke("file:md5", path),
  fileExists: (path) => ipcRenderer.invoke("file:exists", path),
  fileStats: (path) => ipcRenderer.invoke("file:stat", path),
  scanPList: (path) => ipcRenderer.invoke("file:plist", path),
  homedir: () => ipcRenderer.invoke("os:homedir"),
  fileRead: (path) => ipcRenderer.invoke("file:read", path),
  copyFile: (source, dest) => ipcRenderer.invoke("file:copy", source, dest),
  mkdirs: (path, recursive) => ipcRenderer.invoke("dir:mkdir", path, recursive),
  fslink: (ref, newRef) => ipcRenderer.invoke("file:link", ref, newRef),
  rmdir: (path) => ipcRenderer.send("dir:rmdir", path),
  unlink: (path) => ipcRenderer.send("file:remove", path),
  fileWrite: (path, contents) => ipcRenderer.invoke("file:write", path, contents),
  handleCopyProgress: (callback) => ipcRenderer.on('update-copy-progress', callback)
})