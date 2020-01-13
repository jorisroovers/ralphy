const electron = require('electron');
const ipcMain = electron.ipcMain;
const app = electron.app;
const shell = electron.shell;
const BrowserWindow = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {


    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: true
        }
    });
    mainWindow.loadURL(`file://${__dirname}/views/index.html`);

    // We can access settings here like this:
    // const storage = require('electron-json-storage');
    // storage.get('settings.user', function (error, data) {
    //     // console.log(data);
    // });

    mainWindow.on('close', function (event) {
        // if we're not really quitting, then just hide the window
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
    app.isQuitting = false;
    createWindow();
});


// Quit when all windows are closed.s
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('before-quit', function () {
    console.log("Quiting!");
    app.isQuitting = true;
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
    }
});

// events send by client
ipcMain.on('toggle-dev-tools', function (event, arg) {
    mainWindow.webContents.toggleDevTools();
});

ipcMain.on('open-external', function (event, arg) {
    console.log("Opening", arg);
    shell.openExternal(arg);
});

ipcMain.on('open-item-in-folder', function (event, arg) {
    console.log("Opening in folder", arg);
    shell.showItemInFolder(arg);
});

ipcMain.on('open-dialog', function (event, id, options) {
    const result = electron.dialog.showOpenDialog(options);
    event.sender.send('open-dialog-result', id, result);
});


ipcMain.on('show-main-window', function (event, arg) {
    // only make the window visible if it's not. This prevents us from refocussing the window when it's already
    // open in the background (which can be really annoying).
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }
});

ipcMain.on('register-for-devtools-updates', function (event) {
    // handle devtool window events
    mainWindow.webContents.on('devtools-opened', function (event, arg) {
        event.sender.send('devtools-toggle', "open");
    });

    mainWindow.webContents.on('devtools-closed', function (event, arg) {
        event.sender.send('devtools-toggle', "closed");
    });

});