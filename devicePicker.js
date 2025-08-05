document.addEventListener('DOMContentLoaded', async () => {
    const deviceList = document.getElementById('device-list');

    try {
        // 모든 미디어 장치 목록 가져오기
        const devices = await navigator.mediaDevices.enumerateDevices();

        // 오디오 입력 장치만 필터링
        const audioInputDevices = devices.filter(device => device.kind === 'audioinput');

        if (audioInputDevices.length === 0) {
            deviceList.innerHTML = '<li>사용 가능한 오디오 입력 장치가 없습니다.</li>';
            return;
        }

        // 목록을 동적으로 생성
        audioInputDevices.forEach(device => {
            const listItem = document.createElement('li');
            listItem.textContent = device.label || `장치 ${device.deviceId.substring(0, 8)}`;
            listItem.dataset.deviceId = device.deviceId;

            // 항목 클릭 시 이벤트 처리
            listItem.addEventListener('click', () => {
                // 선택된 장치 ID를 main 프로세스로 전송
                window.electronAPI.setAudioDeviceId(device.deviceId);
            });

            deviceList.appendChild(listItem);
        });

    } catch (err) {
        console.error('장치 목록을 가져오는 데 실패했습니다:', err);
        deviceList.innerHTML = `<li>오류: ${err.message}</li>`;
    }
});
