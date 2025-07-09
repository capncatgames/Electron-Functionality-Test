const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let screenCaptureWindow;
let pyProc;

app.whenReady().then(async () => {
    console.log("[main] 앱 시작");
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        hasShadow: false,
        skipTaskbar: true,
        focusable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile('overlay.html');
    mainWindow.setIgnoreMouseEvents(true);

    screenCaptureWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        transparent: false,
        frame: true,
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    console.log("[main] 화면 소스 탐색 중...");
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    console.log(sources.length)
    screenCaptureWindow.loadFile('index.html');
    if (sources.length > 0) {
        const sourceId = sources[0].id;
        console.log("[main] 화면 소스 선택됨:", sourceId);

        screenCaptureWindow.webContents.once('did-finish-load', () => {
            console.log("[main] renderer에 sourceId 전달");
            screenCaptureWindow.webContents.send('set-screen-source', sourceId);
        });
    } else {
        console.error("[main] 화면 소스 없음!");
    }

    // Python 시작
    try {
        pyProc = spawn('python3', ['analyze.py']);
        console.log("[main] Python 프로세스 시작됨");

        pyProc.stdout.on('data', (data) => {
            console.log("[main] Python stdout:", data.toString());
            screenCaptureWindow.webContents.send('ocr-result', data.toString());
        });

        pyProc.stderr.on('data', (data) => {
            console.error("[main] Python stderr:", data.toString());
        });

        pyProc.on('close', (code) => {
            console.log(`[main] Python 프로세스 종료 (code ${code})`);
        });
    } catch (err) {
        console.error("[main] Python 실행 실패:", err);
    }

    ipcMain.on('send-captured-base64', (_, base64) => {
        if (!base64) {
            console.warn("[main] 빈 base64 수신됨");
            return;
        }

        console.log("[main] base64 수신됨, 길이:", base64.length);

        if (pyProc) {
            pyProc.stdin.write(base64 + "\n");
        }
    });

    ipcMain.on('request-drag-mode', () => {
        mainWindow.setIgnoreMouseEvents(false);
        console.log("[main] request drag")
        mainWindow.webContents.send('enable-drag');
    });

    ipcMain.on('area-selected', (event, cropArea) => {
        mainWindow.setIgnoreMouseEvents(true);
        screenCaptureWindow.webContents.send('area-updated', cropArea);
    });

});
