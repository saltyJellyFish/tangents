// main.js — the "backend" of the app. Runs in Node, has full OS access. (ONLY file allowed to touch real OS features (windows, taskbar).)
// The UI (renderer.js) is sandboxed and can't reach any of this directly, that's why preload exists as a safe bridge between the two.

const { app, BrowserWindow, ipcMain, screen } = require('electron');

let win; // keep a reference so it isn't garbage-collected while open

function createWindow() {
  win = new BrowserWindow({
    width: 200, height: 280,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // WHY? some Windows setups render a white flash without this explicit transparent hex
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false, //we need the taskbar icon to exist so setProgressBar() has something to draw on
    webPreferences: {
      preload: __dirname + '/preload.js', //absolute path required, or Electron silently fails to load it
      contextIsolation: true,  //security setting to keep the UI's JS world separate from Node's, preload is the only bridge
    },
  });

  win.loadFile('index.html');
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win.setPosition(width - 220, height - 220);
}

app.whenReady().then(createWindow); // Electron APIs aren't safe to call until this fires!

// Listen for progress updates sent from the UI (renders.js) every timer tick
// this is the actual call that paints the colored bar on the taskbar icon the same API Chrome uses to show download progress
ipcMain.on('update-progress', (event, percent) => {
  win.setProgressBar(percent);
});

//removes the taskbar bar entirely
// ** -1 is Electron's "clear the progress bar" signal
ipcMain.on('clear-progress', () => {
  win.setProgressBar(-1);
});