// music.js
// Handles audio functions

console.log("Loading music.js");
import { soundEffectsEnabled as initialSoundEffectsEnabled } from './sound_state.js';
console.log("Imported soundEffectsEnabled:", initialSoundEffectsEnabled);
import { getAudioContext, initializeAudio } from './audio_context.js';

let soundEffectsState = initialSoundEffectsEnabled;
let oscillators = [];
let octaveOscillators = [];
let addInterval, dropInterval;
let melodyOscillators = []; 
let melodyTimeoutId = null;

// C Lydian Mode frequencies
let baseFrequencies = [261.63, 293.66, 329.63, 370, 392, 440, 493.88];

// flag to track if we're in the process of stopping
let isStoppingDrone = false;

let backgroundMusic = null;

// Add a flag to track if we're currently toggling
let isToggling = false;

function fadeOutAndStop(oscObj, duration = 1) {
    const audioContext = getAudioContext();
    const now = audioContext.currentTime;
    oscObj.gainNode.gain.setValueAtTime(oscObj.gainNode.gain.value, now);
    oscObj.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    setTimeout(() => oscObj.oscillator.stop(), (duration * 1000) + 50);
}

export function startDrone() {
    if (!soundEffectsState) return;
    if (oscillators.length > 0 || isStoppingDrone) {  // Also check isStoppingDrone
        console.log("Drone already playing or stopping");
        return;
    }
    
    console.log("Starting drone");
    for (let i = 0; i < 4; i++) addRandomNote();
    addInterval = setInterval(addRandomNote, 4000);
    dropInterval = setInterval(dropNote, 4000);
}

export function stopDrone() {
    console.log("Stopping drone");
    isStoppingDrone = true;
    
    return new Promise((resolve) => {
        if (addInterval) {
            clearInterval(addInterval);
            addInterval = null;
        }
        if (dropInterval) {
            clearInterval(dropInterval);
            dropInterval = null;
        }

        const stopPromises = [];
        oscillators.forEach((osc, i) => {
            stopPromises.push(new Promise(resolveOsc => {
                setTimeout(() => {
                    fadeOutAndStop(osc, 1.5);
                    resolveOsc();
                }, i * 100);
            }));
        });

        Promise.all(stopPromises).then(() => {
            oscillators = [];
            isStoppingDrone = false;  // Reset the stopping flag
            console.log("Drone cleanup complete");
            resolve();
        });
    });
}

export function addOctaveNote() {
    if (!soundEffectsState) return;
    console.log("addOctaveNote called");

    if (octaveOscillators.length > 0) {
        removeOctaveNote();
    }

    const audioContext = getAudioContext();
    let freq = baseFrequencies[Math.floor(Math.random() * baseFrequencies.length)] * 2;
    let osc = audioContext.createOscillator();
    let gainNode = audioContext.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 1);

    osc.connect(gainNode).connect(audioContext.destination);
    osc.start();

    console.log("Started oscillation at freq = ", freq);
    
    const newOsc = { 
        oscillator: osc, 
        gainNode: gainNode, 
        frequency: freq,
        timeoutId: null
    };
    
    octaveOscillators = [newOsc];

    newOsc.timeoutId = setTimeout(() => {
        console.log("Cleaning up octave note");
        if (octaveOscillators.includes(newOsc)) {
            fadeOutAndStop(newOsc, 8);
            octaveOscillators = octaveOscillators.filter(osc => osc !== newOsc);
        }
    }, 8000);
}

export function removeOctaveNote() {
    if (octaveOscillators.length === 0) return;
    
    // Clean up each oscillator
    octaveOscillators.forEach(osc => {
        if (osc.timeoutId) {
            clearTimeout(osc.timeoutId);
        }
        fadeOutAndStop(osc, 1.5);
    });
    
    // Clear the array
    octaveOscillators = [];
}

export function addRandomNote() {
    if (!soundEffectsState) return;
    if (oscillators.length >= baseFrequencies.length) return;

    const audioContext = getAudioContext();
    let freq = baseFrequencies[Math.floor(Math.random() * baseFrequencies.length)];
    let osc = audioContext.createOscillator();
    let gainNode = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 1);
    osc.connect(gainNode).connect(audioContext.destination);
    osc.start();
    oscillators.push({ 
        oscillator: osc, 
        gainNode: gainNode, 
        frequency: freq, 
        addedAt: audioContext.currentTime 
    });
}

function dropNote() {
    if (oscillators.length === 0) return;
    let now = getAudioContext().currentTime;
    let removableNotes = oscillators.filter(osc => now - osc.addedAt > 2);
    if (removableNotes.length === 0) return;
    let randomIndex = Math.floor(Math.random() * removableNotes.length);
    let oscToRemove = removableNotes[randomIndex];
    fadeOutAndStop(oscToRemove, 0.8 + Math.random() * 0.4);
    oscillators = oscillators.filter(osc => osc !== oscToRemove);
}

// Expose functions globally - so they can be used without using modules
window.addOctaveNote = addOctaveNote;
window.removeOctaveNote = removeOctaveNote;
window.startDrone = startDrone;
window.stopDrone = stopDrone;

// moved toggle function
export function toggleSoundEffects() {
    // Prevent multiple toggles from happening simultaneously
    if (isToggling) {
        console.log("Toggle in progress, please wait");
        return;
    }
    
    isToggling = true;
    soundEffectsState = !soundEffectsState;
    const soundToggleBtn = document.getElementById('sound_toggle');
    if (soundToggleBtn) {
        soundToggleBtn.textContent = soundEffectsState ? "Disable Sound Effects" : "Enable Sound Effects";
    }
    
    // Use async/await to ensure proper sequencing
    (async () => {
        try {
            if (soundEffectsState) {
                await stopDrone();  // Make sure any existing drone is fully stopped
                startDrone();
                playLydianMelody();
            } else {
                await stopDrone();
                cleanupMelodyOscillators();
            }
            console.log("Sound effects toggled:", soundEffectsState);
        } catch (err) {
            console.error("Error toggling sound effects:", err);
        } finally {
            isToggling = false;  // Reset the flag when done
        }
    })();
}

// Expose necessary functions globally
window.toggleSoundEffects = toggleSoundEffects;

// Remove the automatic start on page load
// Instead, export a function to start everything
export function initializeAndStartAudio() {
    console.log("Initializing audio...");
    return initializeAudio()
        .then(() => {
            console.log("AudioContext resumed successfully");
            if (soundEffectsState) {
                startDrone();
                playLydianMelody();  // Start the melody
            }
        })
        .catch(err => {
            console.error("Failed to initialize audio:", err);
        });
}

export function initializeBackgroundMusic() {
    backgroundMusic = new Audio();  
    backgroundMusic.loop = false;  // Don't use default looping
    
    // Handle custom looping with specific timing
    backgroundMusic.addEventListener('timeupdate', () => {
        if (backgroundMusic.currentTime >= 40) {  // Reset at 40 seconds
            backgroundMusic.currentTime = 0;  // Return to start
            backgroundMusic.play();
        }
    });
}

// Function to play a melodic sequence on loop
function playLydianMelody() {
    const audioContext = getAudioContext();
    // C Lydian sequence (C, D, E, F#, G, A, B)
    const sequence = [
        { note: baseFrequencies[0], duration: 0.5 },  // C
        { note: baseFrequencies[3], duration: 1.0 }, // F#
        { note: baseFrequencies[4], duration: 1.0 }, // G
        { note: baseFrequencies[5], duration: 0.5 },  // A
        { note: baseFrequencies[3], duration: 0.5 },  // F#
        { note: baseFrequencies[1], duration: 0.5 },  // D
        { note: baseFrequencies[2], duration: 1.0 }, // E
        { note: baseFrequencies[3], duration: 0.75 }, // F#
        { note: baseFrequencies[0], duration: 0.5 },  // C
    ];

    let currentTime = audioContext.currentTime;
    
    sequence.forEach(({ note, duration }) => {
        let osc = audioContext.createOscillator();
        let gainNode = audioContext.createGain();
        
        osc.frequency.value = note;
        osc.type = 'triangle';  // Using triangle wave for a softer sound!
        
        gainNode.gain.setValueAtTime(0.0001, currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.1, currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + duration);
        
        osc.connect(gainNode).connect(audioContext.destination);
        osc.start(currentTime);
        osc.stop(currentTime + duration);
        
        melodyOscillators.push({ oscillator: osc, gainNode: gainNode });
        currentTime += duration;
    });

    // Schedule the next loop
    melodyTimeoutId = setTimeout(() => {
        cleanupMelodyOscillators();
        playLydianMelody();
    }, currentTime * 1000);
}

function cleanupMelodyOscillators() {
    // Clear the timeout first
    if (melodyTimeoutId) {
        clearTimeout(melodyTimeoutId);
        melodyTimeoutId = null;
    }

    melodyOscillators.forEach(osc => {
        try {
            osc.oscillator.stop();
            osc.oscillator.disconnect();
            osc.gainNode.disconnect();
        } catch (e) {
            // Ignore errors from already stopped oscillators
        }
    });
    melodyOscillators = [];
}
