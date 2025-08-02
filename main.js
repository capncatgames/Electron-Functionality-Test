const { app, BrowserWindow, ipcMain, desktopCapturer, screen} = require('electron');
const path = require('path'); // 불러오면 디렉토리 경로 쓸 수 있음
const { spawn } = require('child_process'); // 외부 프로그램 쓸 수 있게 해줌 여기서는 파이썬 쓸라고 가져옴


let mainWindow;
let screenCaptureWindow;
let pyProc;

app.whenReady().then(async () => {
    const { screen } = require('electron');
    const { width, height } = screen.getPrimaryDisplay().size;
    // 여기 위에는 첫번째 디스플레이 사이즈 가져와서 전체화면 크기로 만들라고 화면 크기 불러올라고 설정
    console.log(width, height)
    console.log("[main] 앱 시작");
    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        // 위에는 좌표랑 크기, 아래도 대충 이름 보면 알겠지?
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        hasShadow: false,
        skipTaskbar: true,
        focusable: false,
        resizable: false,
        webPreferences: {
            // 여기는 웹 설정 부분인데 그냥 AI한테 물어보소
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile('overlay.html');
    // 이게 변수 이름은 mainWindow인데 이거 매인 윈도우가 아니라  화면 캡쳐하는 부분 설정할때 쓰는 overlay 윈도우야
    mainWindow.setIgnoreMouseEvents(true);
    // 마우스 입력 안되게 설정

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
    // Screen capture window가 놀랍게도 메인 윈도우 역할을 함.
    // 여기서 캡쳐한거랑 ocr결과랑 화면에 디스플레이함

    console.log("[main] 화면 소스 탐색 중...");
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    console.log(sources.length)
    screenCaptureWindow.loadFile('index.html');
    // 절대 이거 loadfile 위치 옮기지 말것
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
    // 이 위에는 화면 sourceId를 renderer쪽에 전달하는 역할을 함

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

    // 화면에서 영역지정 눌렀을 때 Renderer에서 부르는 이벤트 핸들러 그 오버레이창을 맨 앞으로 끌고오고, 클릭 가능하게 만들고, enable-drag 이벤트 호출함
    ipcMain.on('request-drag-mode', () => {
        console.log("[main] request drag")
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.webContents.send('enable-drag');
        mainWindow.setIgnoreMouseEvents(false);

    });

    // 이건 overlay.js에서 부르는 이벤트 핸들러. 자르는 범위를 area-updated 이벤트로 넘기고 마우스 클릭 다시 무시시킴
    ipcMain.on('request-drag-finish', (event, cropArea) => {
        console.log('[main] request-drag-finish 수신:', cropArea);
        // 오버레이 클릭 무시 복구
        mainWindow.setIgnoreMouseEvents(true);
        // 오버레이 상단 취소
        mainWindow.setAlwaysOnTop(false);
        // 기능 창(renderer)에 영역 업데이트 전달
        screenCaptureWindow.webContents.send('area-updated', cropArea);
    });

    ipcMain.handle('get-screen-dimensions', () => {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        return { width, height };
    });
});
