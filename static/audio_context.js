let audioContext = null;

export function initializeAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext.resume();
}

export function getAudioContext() {
    if (!audioContext) {
        throw new Error("AudioContext not initialized");
    }
    return audioContext;
} 