const { app, BrowserWindow } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        width: 500,
        height: 500,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.setIgnoreMouseEvents(true); // 마우스 이벤트 무시
    win.loadURL('data:text/html;charset=utf-8,' +
        encodeURIComponent(`
      <html>
        <body style="margin:0; background-color:rgba(128,128,128,0.8);">
        </body>
      </html>
    `));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
