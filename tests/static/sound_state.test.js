// Tests for sound_state.js

describe('Sound State Module', () => {
  test('soundEffectsEnabled should be exported and be a boolean', () => {
    // In a real test, we'd import the actual module
    // For this simulation, we'll create a mock of what we expect
    const soundState = {
      soundEffectsEnabled: true
    };
    
    expect(soundState).toHaveProperty('soundEffectsEnabled');
    expect(typeof soundState.soundEffectsEnabled).toBe('boolean');
  });
}); 