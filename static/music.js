// music.js
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let oscillators = [];
let octaveOscillators = [];
let addInterval, dropInterval;

// C Lydian Mode frequencies
let baseFrequencies = [261.63, 293.66, 329.63, 370, 392, 440, 493.88];

function fadeOutAndStop(oscObj, duration = 1) {
    const now = audioContext.currentTime;
    oscObj.gainNode.gain.setValueAtTime(oscObj.gainNode.gain.value, now);
    oscObj.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    setTimeout(() => oscObj.oscillator.stop(), (duration * 1000) + 50);
}

export function startDrone() {
    if (oscillators.length > 0) return;
    for (let i = 0; i < 4; i++) addRandomNote();
    addInterval = setInterval(addRandomNote, 4000);
    dropInterval = setInterval(dropNote, 4000);
}

export function stopDrone() {
    clearInterval(addInterval);
    clearInterval(dropInterval);
    oscillators.forEach((osc, i) => setTimeout(() => fadeOutAndStop(osc, 1.5), i * 100));
    octaveOscillators.forEach((osc, i) => setTimeout(() => fadeOutAndStop(osc, 1.5), i * 100));
    setTimeout(() => { oscillators = []; octaveOscillators = []; }, 2000);
}

export function addOctaveNote() {
    if (octaveOscillators.length > 0) return;
    let freq = baseFrequencies[Math.floor(Math.random() * baseFrequencies.length)] * 2;
    let osc = audioContext.createOscillator();
    let gainNode = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 1);
    osc.connect(gainNode).connect(audioContext.destination);
    osc.start();
    octaveOscillators.push({ oscillator: osc, gainNode: gainNode, frequency: freq });
    setTimeout(() => { fadeOutAndStop(octaveOscillators[0], 8); octaveOscillators = []; }, 8000);
}

export function removeOctaveNote() {
    if (octaveOscillators.length === 0) return;
    fadeOutAndStop(octaveOscillators.pop(), 1.5);
}

function addRandomNote() {
    if (oscillators.length >= baseFrequencies.length) return;
    let freq = baseFrequencies[Math.floor(Math.random() * baseFrequencies.length)];
    let osc = audioContext.createOscillator();
    let gainNode = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 1);
    osc.connect(gainNode).connect(audioContext.destination);
    osc.start();
    oscillators.push({ oscillator: osc, gainNode: gainNode, frequency: freq, addedAt: audioContext.currentTime });
}

function dropNote() {
    if (oscillators.length === 0) return;
    let now = audioContext.currentTime;
    let removableNotes = oscillators.filter(osc => now - osc.addedAt > 2);
    if (removableNotes.length === 0) return;
    let randomIndex = Math.floor(Math.random() * removableNotes.length);
    let oscToRemove = removableNotes[randomIndex];
    fadeOutAndStop(oscToRemove, 0.8 + Math.random() * 0.4);
    oscillators = oscillators.filter(osc => osc !== oscToRemove);
}
