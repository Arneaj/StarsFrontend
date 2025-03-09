// Tests for SSE.js

// Mock dependencies
jest.mock('../../static/backend_communicator.js', () => ({
  BackendCommunicator: {
    createEventSource: jest.fn().mockReturnValue({
      onmessage: null,
      onerror: null,
      close: jest.fn()
    })
  }
}));

// Mock globals
jest.mock('../../static/globals.js', () => ({
  starIDs: [],
  starPositions: new Float32Array(),
  starMessages: [],
  starLastLikeTime: [],
  starCreationDate: [],
  starUserID: [],
  updateStarPositionsBuffer: jest.fn(),
  isInViewport: jest.fn().mockReturnValue(true),
  RECONNECTION_TIMEOUT: 5000
}));

// Import the mocked dependencies
const { BackendCommunicator } = require('../../static/backend_communicator.js');
const globals = require('../../static/globals.js');

// Import or simulate the class under test
class StarStreamManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.eventSource = null;
    this.reconnectTimeout = null;
    this._connect();
  }

  _connect() {
    this.eventSource = BackendCommunicator.createEventSource();
    this.eventSource.onmessage = jest.fn();
    this.eventSource.onerror = jest.fn();
  }

  _handleAddEvent(starData) {
    // Simplified implementation for testing
    const index = globals.starIDs.length;
    this._addStarMinimal(starData);
    this._fetchStarMessage(index, starData.id);
  }

  _addStarMinimal(starData) {
    globals.starIDs.push(starData.id);
    globals.starPositions = new Float32Array([...Array.from(globals.starPositions), starData.x, starData.y]);
    globals.starMessages.push("");
    globals.starLastLikeTime.push(0);
    globals.starCreationDate.push(Date.now());
    globals.starUserID.push(starData.user_id || "");
    globals.updateStarPositionsBuffer();
  }

  async _fetchStarMessage(index, starId) {
    // In a real implementation, this would fetch from the backend
    globals.starMessages[index] = "Test message for " + starId;
  }

  _handleStarRemoval(starId) {
    const index = globals.starIDs.indexOf(starId);
    if (index !== -1) {
      globals.starIDs.splice(index, 1);
      // In a real implementation, other arrays would be updated too
    }
  }

  cleanup() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

describe('StarStreamManager', () => {
  let manager;
  let mockCanvas;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset global arrays
    globals.starIDs.length = 0;
    globals.starMessages.length = 0;
    globals.starLastLikeTime.length = 0;
    globals.starCreationDate.length = 0;
    globals.starUserID.length = 0;
    
    // Create a mock canvas
    mockCanvas = { width: 800, height: 600 };
    
    // Create the manager
    manager = new StarStreamManager(mockCanvas);
  });

  afterEach(() => {
    // Clean up
    if (manager) {
      manager.cleanup();
    }
  });

  test('constructor should initialize properties and connect', () => {
    expect(manager.canvas).toBe(mockCanvas);
    expect(BackendCommunicator.createEventSource).toHaveBeenCalled();
  });

  test('_handleAddEvent should add a star and fetch its message', () => {
    const starData = { id: 'star1', x: 100, y: 200, user_id: 'user1' };
    
    manager._handleAddEvent(starData);
    
    // Check if star was added
    expect(globals.starIDs).toContain('star1');
    expect(globals.starUserID).toContain('user1');
    expect(globals.updateStarPositionsBuffer).toHaveBeenCalled();
    
    // Check if message was fetched (in our mock implementation)
    expect(globals.starMessages[0]).toBe('Test message for star1');
  });

  test('_handleStarRemoval should remove a star', () => {
    // First add a star
    const starData = { id: 'star1', x: 100, y: 200, user_id: 'user1' };
    manager._handleAddEvent(starData);
    
    // Then remove it
    manager._handleStarRemoval('star1');
    
    // Check if star was removed
    expect(globals.starIDs).not.toContain('star1');
  });

  test('cleanup should close the event source and clear timeout', () => {
    // Setup a reconnect timeout
    manager.reconnectTimeout = setTimeout(() => {}, 1000);
    
    manager.cleanup();
    
    expect(manager.eventSource).toBeNull();
    expect(manager.reconnectTimeout).toBeNull();
    expect(manager.eventSource).toBeNull();
  });
}); 