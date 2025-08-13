let videoStream;
let cropArea = { x: 100, y: 100, width: 400, height: 300 };
let intervalId = null;
let audioStream = null;
let audioCtx = null;
let detectRafId = null;
let screenDimensions = null;

// 'Start' 버튼: 화면 캡처 및 분석 시작
document.getElementById('start').addEventListener('click', () => {
    if (!videoStream) {
        console.error("[renderer] videoStream 없음! 시작 실패");
        return;
    }
    if (intervalId) {
        console.log("[renderer] 이미 캡처가 진행 중입니다.");
        return;
    }

    console.log("[renderer] 캡처 시작");
    intervalId = setInterval(() => {
        try {
            const video = document.getElementById('screenVideo');
            if (video.readyState < video.HAVE_METADATA) return;

            const scaleX = video.videoWidth / screenDimensions.width;
            const scaleY = video.videoHeight / screenDimensions.height;

            const sourceX = cropArea.x * scaleX;
            const sourceY = cropArea.y * scaleY;
            const sourceWidth = cropArea.width * scaleX;
            const sourceHeight = cropArea.height * scaleY;

            const canvas = document.getElementById('preview');
            canvas.width = cropArea.width;
            canvas.height = cropArea.height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, cropArea.width, cropArea.height);

            const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
            if (base64) {
                window.electronAPI.sendBase64ToPython(base64);
            }
        } catch (err) {
            console.error("[renderer] drawImage 또는 base64 에러:", err);
            clearInterval(intervalId);
            intervalId = null;
        }
    }, 1000);
});

// 'Stop' 버튼: 화면 캡처 중지
document.getElementById('stop').addEventListener('click', () => {
    if (intervalId) {
        console.log("[renderer] 캡처 중지");
        clearInterval(intervalId);
        intervalId = null;
    }
});

// '영역 지정' 버튼
document.getElementById('selectAreaBtn').addEventListener('click', () => {
    console.log("[renderer] 영역 지정 요청");
    window.electronAPI.sendMessage('request-drag-mode');
});

// '챗봇' 버튼
document.getElementById('chatbotBtn').addEventListener('click', () => {
    window.electronAPI.sendMessage('open-chatbot');
});

// '오디오 감지 시작' 버튼
document.getElementById('startAudioBtn').addEventListener('click', startAudioCapture);

// '오디오 감지 중지' 버튼
document.getElementById('stopAudioBtn').addEventListener('click', stopAudioCapture);


// Main 프로세스로부터 화면 소스 ID 수신
window.electronAPI.onScreenSource(async (sourceId) => {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                }
            }
        });
        const video = document.getElementById('screenVideo');
        video.srcObject = videoStream;
        await video.play();
        console.log("[renderer] 비디오 스트림 시작됨");
    } catch (e) {
        console.error("[renderer] getUserMedia 실패:", e);
    }
});

// Main 프로세스로부터 OCR 결과 수신
window.electronAPI.onOCRResult((msg) => {
    appendLog(msg);
});

// Main 프로세스로부터 선택된 캡처 영역 업데이트 수신
window.electronAPI.onAreaUpdated((area) => {
    console.log('[renderer] area-updated 수신:', area);
    cropArea = area;
    document.getElementById('result').innerText = `선택 영역: x=${area.x}, y=${area.y}, w=${area.width}, h=${area.height}`;
});

// 페이지 로드 시 화면 해상도 가져오기
document.addEventListener('DOMContentLoaded', async () => {
    try {
        screenDimensions = await window.electronAPI.getScreenDimensions();
        appendLog(`애플리케이션 시작됨. 화면 해상도: ${screenDimensions.width}x${screenDimensions.height}`);
    } catch (error) {
        console.error('화면 해상도 가져오기 실패:', error);
    }
});


/**
 * '화면의 소리' (시스템 오디오) 캡처를 요청하고 시작하는 함수
 */
async function startAudioCapture() {
    console.log('[renderer] startAudioCapture 시작');
    if (audioCtx) {
        console.log("[renderer] 이미 오디오 감지가 실행 중입니다.");
        return;
    }

    try {
        console.log('[renderer] 시스템 오디오 캡처 팝업을 요청합니다...');
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        console.log('[renderer] 사용자가 공유를 허용했습니다.');

        if (stream.getVideoTracks().length > 0) {
            stream.getVideoTracks()[0].stop();
        }
        audioStream = stream;

        // 오디오 처리 및 분석 설정 함수 호출
        setupAudioProcessing();

    } catch (err) {
        console.error(`[renderer] 팝업 요청 실패: ${err.name}`, err);
        if (err.name === 'NotSupportedError' || err.name === 'NotAllowedError') {
            alert('오디오 캡처가 시스템 설정에 의해 차단되었거나 사용자에 의해 취소되었습니다.\n\nWindows의 마이크 접근 권한을 확인해주세요.');
        }
    }
}

/**
 * Web Audio API를 사용하여 오디오 스트림을 분석하도록 설정하는 함수
 */
function setupAudioProcessing() {
    console.log('[renderer] 오디오 처리 설정 시작');

    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(audioStream);
    const splitter = audioCtx.createChannelSplitter(2);
    const analyserL = audioCtx.createAnalyser();
    const analyserR = audioCtx.createAnalyser();

    analyserL.fftSize = 2048;
    analyserR.fftSize = 2048;

    source.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);

    const dataL = new Uint8Array(analyserL.frequencyBinCount);
    const dataR = new Uint8Array(analyserR.frequencyBinCount);

    const binSize = audioCtx.sampleRate / analyserL.fftSize;
    const lowBin = Math.floor(2000 / binSize);
    const highBin = Math.floor(8000 / binSize);
    let lastDetect = 0;

    function detectLoop() {
        analyserL.getByteFrequencyData(dataL);
        analyserR.getByteFrequencyData(dataR);

        let peakL = 0, peakR = 0;
        for (let i = lowBin; i <= highBin; i++) {
            peakL = Math.max(peakL, dataL[i]);
            peakR = Math.max(peakR, dataR[i]);
        }

        const now = performance.now();
        if (now - lastDetect > 1000 && (peakL > 200 || peakR > 200)) {
            lastDetect = now;
            const diff = peakL - peakR;
            let direction = '중앙';
            if (diff > 50) direction = '왼쪽';
            else if (diff < -50) direction = '오른쪽';

            appendLog(`총성 감지: ${direction} 방향 (L:${peakL}, R:${peakR})`);
        }

        detectRafId = requestAnimationFrame(detectLoop);
    }

    console.log('[renderer] 오디오 감지 루프 시작');
    detectLoop();
}

/**
 * 오디오 캡처 및 분석을 중지하는 함수
 */
function stopAudioCapture() {
    if (detectRafId) {
        cancelAnimationFrame(detectRafId);
        detectRafId = null;
    }
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    console.log('[renderer] 오디오 감지 중지됨');
}

/**
 * 로그 메시지를 화면에 추가하는 헬퍼 함수
 * @param {string} msg - 로그에 추가할 메시지
 */
function appendLog(msg) {
    const log = document.getElementById('log');
    if(log.textContent.length > 5000) log.textContent = ''; // 로그가 너무 길어지면 초기화
    log.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    const container = document.getElementById('log-container');
    container.scrollTop = container.scrollHeight;
}