// preload.js — runs in a special privileged context BEFORE the UI loads.
// contextIsolation:true (set in main.js) blocks the UI from reaching Node/OS APIs directly, for security. This file is the one place allowed to bridge the two worlds, and it only exposes exactly the two functions the UI needs — nothing else from Node or Electron leaks through.

const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {//renders.js will call window.electronAPI.updateProgress(0.42) etc.
  updateProgress: (percent) => ipcRenderer.send('update-progress', percent),
  clearProgress: () => ipcRenderer.send('clear-progress'),
  resizeForTasks: (expand) => ipcRenderer.send('resize-for-tasks', expand), // ask main.js to grow/shrink the window when editing tasks

});