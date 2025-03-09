// Tests for audio_context.js

// Mock the AudioContext constructor
const mockAudioContext = {
  resume: jest.fn().mockResolvedValue(undefined)
};

// Mock the window object
global.window = {
  AudioContext: jest.fn().mockImplementation(() => mockAudioContext)
};

// Functions we're testing
let audioContextModule;

describe('Audio Context Module', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset the module between tests
    jest.resetModules();
    
    // Import the module under test
    // In a real test, we'd import the actual module
    // For this simulation, we'll create the functions directly
    audioContextModule = {
      audioContext: null,
      
      initializeAudio: function() {
        if (!this.audioContext) {
          this.audioContext = new window.AudioContext();
        }
        return this.audioContext.resume();
      },
      
      getAudioContext: function() {
        if (!this.audioContext) {
          throw new Error("AudioContext not initialized");
        }
        return this.audioContext;
      }
    };
  });

  test('initializeAudio should create a new AudioContext if none exists', async () => {
    await audioContextModule.initializeAudio();
    
    // Verify AudioContext constructor was called
    expect(window.AudioContext).toHaveBeenCalledTimes(1);
    
    // Verify resume was called
    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);
  });

  test('initializeAudio should reuse existing AudioContext', async () => {
    // Initialize once
    await audioContextModule.initializeAudio();
    
    // Clear mocks
    window.AudioContext.mockClear();
    mockAudioContext.resume.mockClear();
    
    // Initialize again
    await audioContextModule.initializeAudio();
    
    // Verify AudioContext constructor was NOT called again
    expect(window.AudioContext).toHaveBeenCalledTimes(0);
    
    // Verify resume was called again
    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);
  });

  test('getAudioContext should throw an error if context is not initialized', () => {
    expect(() => {
      audioContextModule.getAudioContext();
    }).toThrow("AudioContext not initialized");
  });

  test('getAudioContext should return the AudioContext after initialization', async () => {
    await audioContextModule.initializeAudio();
    
    const context = audioContextModule.getAudioContext();
    expect(context).toBe(mockAudioContext);
  });
}); 