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
    getHfToken: () => ipcRenderer.invoke('get-hf-token')
});
