let videoStream;
let cropArea = { x: 100, y: 100, width: 400, height: 300 }; // 요거 초기 자르는 부분
let intervalId = null;
let audioStream = null;
let audioCtx = null;
let detectRafId = null;
let currentLoopbackDeviceId = null;

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
            const video = document.getElementById('screenVideo');

            // 1. 오버레이 캔버스의 고정 해상도 (좌표계 기준)
            const overlayCanvasWidth = 1920;
            const overlayCanvasHeight = 1080;

            // 2. 실제 비디오 해상도와 오버레이 좌표계 사이의 스케일링 비율 계산
            const scaleX = video.videoWidth / overlayCanvasWidth;
            const scaleY = video.videoHeight / overlayCanvasHeight;

            // 3. cropArea 좌표를 실제 비디오 좌표계에 맞게 보정
            const sourceX = cropArea.x * scaleX;
            const sourceY = cropArea.y * scaleY;
            const sourceWidth = cropArea.width * scaleX;
            const sourceHeight = cropArea.height * scaleY;

            // 4. 보정된 좌표로 비디오의 특정 영역을 잘라내어 캔버스에 그리기
            const canvas = document.getElementById('preview');
            const ctx = canvas.getContext('2d');
            ctx.drawImage(
                video,
                sourceX, sourceY, sourceWidth, sourceHeight, // 원본 비디오에서 잘라낼 영역 (보정됨)
                0, 0, cropArea.width, cropArea.height      // preview 캔버스에 그릴 위치와 크기
            );

            // 5. base64 변환 및 전송 (기존과 동일)
            const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
            if (base64) {
                window.electronAPI.sendBase64ToPython(base64);
            }
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

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const dimensions = await window.electronAPI.getScreenDimensions();
        screenDimensions = dimensions;
        appendLog(`애플리케이션 시작됨. 화면 해상도: ${screenDimensions.width}x${screenDimensions.height}`);
    } catch (error) {
        console.error('화면 해상도를 가져오는 데 실패했습니다:', error);
        appendLog('오류: 화면 해상도를 가져올 수 없습니다.');
    }
});

document.getElementById('chatbotBtn').addEventListener('click', () => {
    console.log("[renderer] 챗봇 창 열기 요청");
    appendLog("챗봇 창을 여는 중...");
    window.electronAPI.sendMessage('open-chatbot');
});

// 1) “오디오 감지 시작” 버튼 클릭 시 startAudioCapture() 호출
document.getElementById('startAudioBtn').addEventListener('click', () => {
    console.log('[renderer] 오디오 감지 시작 버튼 클릭');
    startAudioCapture().catch(err => console.error('[renderer] startAudioCapture 오류:', err));
});
document.getElementById('stopAudioBtn').addEventListener('click', () => {
    console.log('[renderer] 감지 중지 버튼 클릭');
    stopAudioCapture();
});

// "오디오 장치 선택" 버튼 이벤트 리스너 추가
document.getElementById('pickAudioDeviceBtn').addEventListener('click', () => {
    console.log('[renderer] 오디오 장치 선택 창 열기 요청');
    window.electronAPI.openAudioDevicePicker();
});

// main 프로세스에서 업데이트된 장치 ID를 받는 리스너
window.electronAPI.onUpdateAudioDeviceId((device) => {
    console.log(`[renderer] 선택된 오디오 장치 업데이트: ${device.id}`);
    currentLoopbackDeviceId = device.id;
    document.getElementById('selected-audio-device').textContent = `선택된 장치: ${device.label}`;
});

async function startAudioCapture() {
    console.log('[renderer] startAudioCapture 시작');

    if (!currentLoopbackDeviceId) {
        alert('오디오 출력 장치를 먼저 선택해주세요!');
        throw new Error('출력 장치가 선택되지 않음');
    }

    console.log(`[renderer] 선택된 출력 장치 ID: ${currentLoopbackDeviceId}`);

    try {
        // 시스템 오디오 캡처 (getDisplayMedia 사용)
        console.log('[renderer] 시스템 오디오 캡처 시도 중...');

        audioStream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: {
                channelCount: 2,
                sampleRate: 48000,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        console.log('[renderer] 시스템 오디오 스트림 획득 성공');

    } catch (err) {
        console.error('[renderer] 시스템 오디오 캡처 실패:', err);
        alert('시스템 오디오 캡처에 실패했습니다. 브라우저에서 오디오 공유를 허용해주세요.');
        return;
    }

    let source, splitter, analyserL, analyserR, dataL, dataR;

    try {
        console.log('[renderer] AudioContext 생성');
        audioCtx = new AudioContext();
        source = audioCtx.createMediaStreamSource(audioStream); // audioStream 사용
        splitter = audioCtx.createChannelSplitter(2);
        analyserL = audioCtx.createAnalyser();
        analyserR = audioCtx.createAnalyser();

        analyserL.fftSize = analyserR.fftSize = 2048;
        dataL = new Uint8Array(analyserL.frequencyBinCount);
        dataR = new Uint8Array(analyserR.frequencyBinCount);

        source.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);

        console.log('[renderer] AnalyserNode 설정 완료');
    } catch (err) {
        console.error('[renderer] Web Audio API 설정 오류:', err);
        return;
    }

    let lastDetect = 0;
    const binSize = audioCtx.sampleRate / analyserL.fftSize;
    const lowBin = Math.floor(2000 / binSize);
    const highBin = Math.floor(8000 / binSize);
    console.log('[renderer] 주파수 대역:', lowBin, '-', highBin);

    function detectLoop() {
        try {
            analyserL.getByteFrequencyData(dataL);
            analyserR.getByteFrequencyData(dataR);
        } catch (err) {
            console.error('[renderer] getByteFrequencyData 오류:', err);
            return;
        }

        const now = performance.now();
        let peakL = 0, peakR = 0;

        for (let i = lowBin; i <= highBin; i++) {
            peakL = Math.max(peakL, dataL[i]);
            peakR = Math.max(peakR, dataR[i]);
        }

        // 로그: 매 프레임 좌우 피크 값 (너무 많으니 10프레임마다만)
        if (Math.random() < 0.1) {
            console.log(`[renderer] 피크: L=${peakL}, R=${peakR}`);
        }

        if (now - lastDetect > 1000 && (peakL > 200 || peakR > 200)) {
            lastDetect = now;
            const diff = peakL - peakR;
            let direction = '중앙';
            if (diff > 50) direction = '왼쪽';
            else if (diff < -50) direction = '오른쪽';

            console.log(`[renderer] ${new Date().toLocaleTimeString()} – 총성 감지 (L:${peakL}, R:${peakR}) → ${direction}`);
            appendLog(`총성 감지: ${direction} 방향 (L:${peakL}, R:${peakR})`);
        }

        detectRafId = requestAnimationFrame(detectLoop);
    }

    console.log('[renderer] 검출 루프 시작');
    detectLoop();
}

function stopAudioCapture() {
    // 2.1) RAF 루프 취소
    if (typeof detectRafId === 'number') {
        cancelAnimationFrame(detectRafId);
        console.log('[renderer] detectLoop 중지 (cancelAnimationFrame)');
        detectRafId = null;
    } else {
        console.warn('[renderer] detectLoop ID 없음—이미 중지되었거나 startAudioCapture가 호출되지 않음');
    }

    // 2.2) 스트림 트랙 정지
    if (audioStream) {
        audioStream.getTracks().forEach(track => {
            track.stop();
            console.log(`[renderer] audioStream 트랙 중지: ${track.kind}`);
        });
        audioStream = null;
    } else {
        console.warn('[renderer] audioStream 없음—getUserMedia가 호출되지 않았거나 이미 중지됨');
    }

    // 2.3) AudioContext 종료
    if (audioCtx) {
        audioCtx.close().then(() => {
            console.log('[renderer] AudioContext 종료 완료');
        }).catch(err => {
            console.error('[renderer] AudioContext 종료 오류:', err);
        });
        audioCtx = null;
    } else {
        console.warn('[renderer] audioCtx 없음—AudioContext가 생성되지 않았거나 이미 종료됨');
    }
}