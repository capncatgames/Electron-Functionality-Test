let videoStream;
let cropArea = { x: 100, y: 100, width: 400, height: 300 };
let intervalId = null;

document.getElementById('start').addEventListener('click', () => {
    if (!videoStream) {
        console.error("[renderer] videoStream 없음! 시작 실패");
        return;
    }

    const canvas = document.getElementById('preview');
    const ctx = canvas.getContext('2d');
    const video = document.getElementById('screenVideo');

    canvas.width = cropArea.width;
    canvas.height = cropArea.height;

    console.log("[renderer] 캡처 시작");

    intervalId = setInterval(() => {
        try {
            ctx.drawImage(
                video,
                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                0, 0, cropArea.width, cropArea.height
            );
            const base64 = canvas.toDataURL('image/jpeg').split(',')[1];

            if (!base64) {
                console.warn("[renderer] base64 변환 실패");
                return;
            }

            console.log("[renderer] base64 생성, 길이:", base64.length);
            window.electronAPI.sendBase64ToPython(base64);
        } catch (err) {
            console.error("[renderer] drawImage 또는 base64 에러:", err);
        }
    }, 1000);
});

document.getElementById('stop').addEventListener('click', () => {
    console.log("[renderer] 캡처 중지");
    clearInterval(intervalId);
    intervalId = null;
});

window.electronAPI.onOCRResult((msg) => {
    console.log("[renderer] OCR 결과 수신");
    const log = document.getElementById('log');
    log.textContent += msg + '\n';
    const container = document.getElementById('log-container');
    container.scrollTop = container.scrollHeight;
});

document.getElementById('selectAreaBtn').addEventListener('click', () => {
    console.log("[renderer] 영역 지정 요청");
    appendLog("영역 지정 모드 활성화");
    window.electronAPI.sendMessage('request-drag-mode');
});

window.electronAPI.onScreenSource(async (sourceId) => {
    console.log("[renderer] sourceId 수신:", sourceId);

    if (!sourceId) {
        console.error("[renderer] sourceId가 undefined입니다!");
        return;
    }

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minWidth: 1280,
                    maxWidth: 1280,
                    minHeight: 720,
                    maxHeight: 720
                }
            }
        });

        const video = document.getElementById('screenVideo');
        video.srcObject = videoStream;
        await video.play();
        console.log("[renderer] video stream 시작됨");
    } catch (e) {
        console.error("[renderer] getUserMedia 실패:", e);
    }
});

window.electronAPI.onMessage('area-updated', (area) => {
    cropArea = area;
    document.getElementById('result').innerText =
        `선택 영역: x=${area.x}, y=${area.y}, w=${area.width}, h=${area.height}`;
    appendLog(`영역 업데이트: x=${area.x}, y=${area.y}, w=${area.width}, h=${area.height}`);
});

// 로그 자동 스크롤 함수 추가
function appendLog(msg) {
    const log = document.getElementById('log');
    log.textContent += msg + '\n';
    const container = document.getElementById('log-container');
    container.scrollTop = container.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
    appendLog("애플리케이션 시작됨");
});