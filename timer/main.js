// main.js — the "backend" of the app. Runs in Node, has full OS access. (ONLY file allowed to touch real OS features (windows, taskbar).)
// The UI (renders.js) is sandboxed and can't reach any of this directly, that's why preload exists as a safe bridge between the two.

const { app, BrowserWindow, ipcMain, screen } = require('electron');

let win; // keep a reference so it isn't garbage-collected while open
const BASE_HEIGHT = 280;     // your resting size — width never changes, only height
const EXPANDED_HEIGHT = 450; // grown height while the task queue panel is open

function createWindow() {
  win = new BrowserWindow({
    width: 200, height: BASE_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // WHY? some Windows setups render a white flash without this explicit transparent hex
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false, //we need the taskbar icon to exist so setProgressBar() has something to draw on
    webPreferences: {
      preload: __dirname + '/preload.js', // absolute path required, or Electron silently fails to load it
      contextIsolation: true, //security setting to keep the UI's JS world separate from Node's, preload is the only bridge
    },
  });

  win.loadFile('index.html');
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win.setPosition(width - 220, height - 300);
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

// We adjust `y` by the height difference so the window grows UPWARD from wherever it currently sits, instead of extending off the bottom of the screen or jumping to a different spot
ipcMain.on('resize-for-tasks', (event, expand) => {
  const targetHeight = expand ? EXPANDED_HEIGHT : BASE_HEIGHT;
  const bounds = win.getBounds();
  const heightDiff = targetHeight - bounds.height;
  win.setBounds({
    x: bounds.x,
    y: bounds.y - heightDiff, // grow up, shrink down; bottom edge stays put
    width: bounds.width,
    height: targetHeight,
  });
});