let videoStream;
let cropArea = { x: 100, y: 100, width: 400, height: 300 }; // 요거 초기 자르는 부분
let intervalId = null;

// 이거는 뭐 별거 없는데 시작 누르면 발동하는 이벤트 핸들러임
document.getElementById('start').addEventListener('click', () => {
    if (!videoStream) {
        console.error("[renderer] videoStream 없음! 시작 실패");
        return;
    }

    // 비디오 녹화하고 html에다가 영상 전송함
    const canvas = document.getElementById('preview');
    const ctx = canvas.getContext('2d');
    const video = document.getElementById('screenVideo');

    canvas.width = cropArea.width;
    canvas.height = cropArea.height;

    console.log("[renderer] 캡처 시작");
    // 그리고 녹화한 영상에서 이미지 1초마다 자름 (우리가 설정한 영역만큼)
    intervalId = setInterval(() => {
        try {
            ctx.drawImage(
                video,
                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                0, 0, cropArea.width, cropArea.height
            );
            // 자른 이미지 base64로 바꿈
            const base64 = canvas.toDataURL('image/jpeg').split(',')[1];

            if (!base64) {
                console.warn("[renderer] base64 변환 실패");
                return;
            }

            console.log("[renderer] base64 생성, 길이:", base64.length);
            // 그리고 바꾼 base64 main.js로 전송. main에서 파이썬이랑 연동시킴
            window.electronAPI.sendBase64ToPython(base64);
        } catch (err) {
            console.error("[renderer] drawImage 또는 base64 에러:", err);
        }
    }, 1000);
});

// stop누르면 중지시키는거
document.getElementById('stop').addEventListener('click', () => {
    console.log("[renderer] 캡처 중지");
    clearInterval(intervalId);
    intervalId = null;
});

// main.js 파이썬 부분에서 OCR 결과를 받았을때 부르는 이벤트 핸들러
// 여기서는 받은 결과 그 log-container라는 그 검은 공간에다가 출력시키는거
window.electronAPI.onOCRResult((msg) => {
    console.log("[renderer] OCR 결과 수신");
    const log = document.getElementById('log');
    log.textContent += msg + '\n';
    const container = document.getElementById('log-container');
    container.scrollTop = container.scrollHeight;
});

// 이거 영역지정 버튼인데 이거 누르면 영역지정 활성화 할 수 있도록 main.js 영역지정 request 이벤트 호출함
document.getElementById('selectAreaBtn').addEventListener('click', () => {
    console.log("[renderer] 영역 지정 요청");
    appendLog("영역 지정 모드 활성화");
    window.electronAPI.sendMessage('request-drag-mode');
});

// 이거 처음에 sourceId 받아왔는지 확인하고 녹화하는부분.
window.electronAPI.onScreenSource(async (sourceId) => {
    console.log("[renderer] sourceId 수신:", sourceId);
    // SourceId 있는지 확인
    if (!sourceId) {
        console.error("[renderer] sourceId가 undefined입니다!");
        return;
    }

    try {
        // 비디오 설정
        videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minWidth: 1920,
                    maxWidth: 1920,
                    minHeight: 1080,
                    maxHeight: 1080
                }
            }
        });

        // 녹화 설정 및 시작
        const video = document.getElementById('screenVideo');
        video.srcObject = videoStream;
        await video.play();
        console.log("[renderer] video stream 시작됨");
    } catch (e) {
        console.error("[renderer] getUserMedia 실패:", e);
    }
});

// 영역 업데이트 됐을 때 반영하는 핸들러
window.electronAPI.onAreaUpdated((area) => {
    console.log('[renderer] area-updated 수신:', area);
    // 1. cropArea 변수 갱신
    cropArea = area;

    // 2. 결과 텍스트 UI 반영
    document.getElementById('result').innerText =
        `선택 영역: x=${area.x}, y=${area.y}, w=${area.width}, h=${area.height}`;
    appendLog(`영역 업데이트됨: ${JSON.stringify(area)}`);

    // 3.preview 캔버스 크기 조절 및 표시
    const previewCanvas = document.getElementById('preview');
    if (previewCanvas) {
        previewCanvas.width = area.width;
        previewCanvas.height = area.height;
        previewCanvas.style.display = 'block'; // 캔버스를 보이게 함
    }
});

// 로그 업데이트 될때마다 자동으로 스크롤 (그니까 최신로그 보게 하는거)
function appendLog(msg) {
    const log = document.getElementById('log');
    log.textContent += msg + '\n';
    const container = document.getElementById('log-container');
    container.scrollTop = container.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
    appendLog("애플리케이션 시작됨");
});