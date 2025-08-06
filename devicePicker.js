document.addEventListener('DOMContentLoaded', async () => {
    const deviceList = document.getElementById('device-list');

    try {
        console.log('[devicePicker] navigator.mediaDevices.enumerateDevices() 호출');

        // 모든 미디어 장치 목록 가져오기
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log('[devicePicker] 전체 장치 목록:', devices);

        // 오디오 출력 장치만 필터링 (audiooutput)
        const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');
        console.log('[devicePicker] 오디오 출력 장치 개수:', audioOutputDevices.length);
        console.log('[devicePicker] 오디오 출력 장치 목록:', audioOutputDevices);

        if (audioOutputDevices.length === 0) {
            console.warn('[devicePicker] 사용 가능한 오디오 출력 장치가 없음');
            deviceList.innerHTML = '<li>사용 가능한 오디오 출력 장치가 없습니다.</li>';
            return;
        }

        // 목록을 동적으로 생성
        audioOutputDevices.forEach((device, index) => {
            console.log(`[devicePicker] 장치 처리 중: ${index}`, device);

            const listItem = document.createElement('li');
            const deviceLabel = device.label || `출력 장치 ${index + 1}`;
            listItem.textContent = `${deviceLabel} (${device.deviceId.substring(0, 12)}...)`;
            listItem.dataset.deviceId = device.deviceId;
            listItem.dataset.deviceLabel = deviceLabel;

            console.log(`[devicePicker] 리스트 아이템 생성: ${deviceLabel} - ${device.deviceId}`);

            // 항목 클릭 시 이벤트 처리
            listItem.addEventListener('click', () => {
                console.log(`[devicePicker] 장치 선택됨: ${device.deviceId}`);
                console.log(`[devicePicker] 장치 라벨: ${deviceLabel}`);

                // 선택된 장치 ID를 main 프로세스로 전송
                window.electronAPI.setAudioDeviceId({
                    id: device.deviceId,
                    label: deviceLabel
                });
            });

            deviceList.appendChild(listItem);
        });

        console.log('[devicePicker] 모든 장치 리스트 아이템 생성 완료');

    } catch (err) {
        console.error('[devicePicker] 장치 목록을 가져오는 데 실패했습니다:', err);
        console.error('[devicePicker] 에러 스택:', err.stack);
        deviceList.innerHTML = `<li>오류: ${err.message}</li>`;
    }
});
