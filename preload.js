const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onScreenSource: (cb) => ipcRenderer.on('set-screen-source', (_, id) => cb(id)),
    sendBase64ToPython: (base64) => ipcRenderer.send('send-captured-base64', base64),
    onOCRResult: (cb) => ipcRenderer.on('ocr-result', (_, msg) => cb(msg)),
    sendMessage: (channel, data) => ipcRenderer.send(channel, data),
    onMessage: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),
    onEnableDrag: (cb) => ipcRenderer.on('enable-drag', () => cb()),
    onAreaUpdated: (cb) => ipcRenderer.on('area-updated', (_, area) => cb(area)),
    getScreenDimensions: () => ipcRenderer.invoke('get-screen-dimensions'),
    getHfToken: () => ipcRenderer.invoke('get-hf-token'),
    getLoopbackDeviceId: () => {
        console.log('[preload] getLoopbackDeviceId 호출');
        return ipcRenderer.invoke('get-loopback-device-id');
    },
    openAudioDevicePicker: () => ipcRenderer.send('open-audio-device-picker'),
    setAudioDeviceId: (deviceId) => ipcRenderer.send('set-audio-device-id', deviceId),
    onUpdateAudioDeviceId: (callback) => ipcRenderer.on('updated-audio-device-id', (event, device) => callback(device))
});
