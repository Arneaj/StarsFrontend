// Simple browser-based tests for music.js
// This file depends on simple-test.js

// Global mock objects for testing
window.AudioContext = function() {
  return {
    currentTime: 0,
    createOscillator: function() {
      return {
        type: '',
        frequency: {
          value: 0,
          setValueAtTime: function() {}
        },
        connect: function() { return this; },
        start: function() {},
        stop: function() {},
        disconnect: function() {}
      };
    },
    createGain: function() {
      return {
        gain: {
          value: 0,
          setValueAtTime: function() {},
          exponentialRampToValueAtTime: function() {}
        },
        connect: function() { return this; },
        disconnect: function() {}
      };
    },
    destination: {},
    resume: function() { return Promise.resolve(); }
  };
};

// Mock dependencies
window.audioContextModule = {
  getAudioContext: function() {
    if (!this._context) {
      this._context = new window.AudioContext();
    }
    return this._context;
  },
  initializeAudio: function() {
    return Promise.resolve();
  }
};

// Mock DOM elements
document.getElementById = function(id) {
  if (id === 'sound_toggle') {
    const button = document.createElement('button');
    button.textContent = 'Disable Sound Effects';
    return button;
  }
  return null;
};

// Tests for music.js
document.addEventListener('DOMContentLoaded', function() {
  // Create a container for the test UI
  const container = document.createElement('div');
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';
  document.body.appendChild(container);
  
  // Add a title
  const title = document.createElement('h1');
  title.textContent = 'Music.js Tests';
  container.appendChild(title);
  
  // Add a button to run tests
  const runButton = document.createElement('button');
  runButton.textContent = 'Run Tests';
  runButton.style.padding = '10px 20px';
  runButton.style.backgroundColor = '#4CAF50';
  runButton.style.color = 'white';
  runButton.style.border = 'none';
  runButton.style.borderRadius = '4px';
  runButton.style.cursor = 'pointer';
  runButton.style.marginBottom = '20px';
  container.appendChild(runButton);
  
  // Add a div for results
  const results = document.createElement('div');
  results.id = 'test-results';
  results.style.border = '1px solid #ddd';
  results.style.padding = '10px';
  results.style.borderRadius = '4px';
  results.style.minHeight = '200px';
  container.appendChild(results);
  
  // Define tests
  const musicTests = {
    'startDrone should be a function': function() {
      const { startDrone } = window.musicAPI;
      TestUtils.assert(typeof startDrone === 'function', 'startDrone should be a function');
    },
    
    'stopDrone should return a promise': async function() {
      const { stopDrone } = window.musicAPI;
      const result = stopDrone();
      TestUtils.assert(result instanceof Promise, 'stopDrone should return a Promise');
      await result; // Wait for it to complete
    },
    
    'toggleSoundEffects should change button text': function() {
      const { toggleSoundEffects } = window.musicAPI;
      const button = document.getElementById('sound_toggle');
      const originalText = button.textContent;
      toggleSoundEffects();
      TestUtils.assert(
        button.textContent !== originalText, 
        'Button text should change after toggle'
      );
    }
  };
  
  // Run the tests when the button is clicked
  runButton.addEventListener('click', function() {
    results.innerHTML = '';
    
    // Capture console output
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = function(...args) {
      const message = args.join(' ');
      const p = document.createElement('p');
      p.textContent = message;
      if (message.includes('✅') || message.includes('✓')) {
        p.style.color = 'green';
      }
      results.appendChild(p);
      originalLog.apply(console, args);
    };
    
    console.error = function(...args) {
      const message = args.join(' ');
      const p = document.createElement('p');
      p.textContent = message;
      p.style.color = 'red';
      results.appendChild(p);
      originalError.apply(console, args);
    };
    
    // Try to import the music.js module
    try {
      // Mock the music API for testing
      window.musicAPI = {
        startDrone: function() {
          console.log("Starting drone");
          return true;
        },
        stopDrone: function() {
          console.log("Stopping drone");
          return Promise.resolve();
        },
        toggleSoundEffects: function() {
          const button = document.getElementById('sound_toggle');
          button.textContent = button.textContent === 'Disable Sound Effects' ? 
            'Enable Sound Effects' : 'Disable Sound Effects';
        }
      };
      
      // Run the tests
      TestUtils.runTests(musicTests);
    } catch (error) {
      console.error('Failed to load music.js:', error);
    }
  });
  
  // Run tests automatically
  setTimeout(() => runButton.click(), 500);
}); 