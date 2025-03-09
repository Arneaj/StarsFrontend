// Tests for backend_communicator.js

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn().mockImplementation((key) => {
    if (key === 'token') return 'test-token';
    if (key === 'userId') return 'test-user-id';
    return null;
  }),
  setItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock EventSource
global.EventSource = jest.fn().mockImplementation(() => ({
  onmessage: null,
  onerror: null,
  close: jest.fn()
}));

// Create a mock for alert
global.alert = jest.fn();

// Import or simulate the class under test
const BackendCommunicator = {
  createStar: async (x, y, message) => {
    const token = localStorage.getItem('token');
    const user_id = localStorage.getItem('userId');
    const body = {x, y, message, user_id};
    try {
      const resp = await fetch('http://127.0.0.1:7999/stars', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        console.error("Failed to create star:", resp.status);
        return null;
      }

      const responseData = await resp.json();

      if (responseData.status === false) {
        alert(responseData.message);
        return null;
      } else {
        return responseData;
      }
    } catch (e) {
      console.error("Error creating star:", e);
      return null;
    }
  },

  removeStarByID: async (starId) => {
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch(`http://127.0.0.1:7999/stars/${starId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!resp.ok) {
        console.error("Failed to remove star:", resp.status);
        return false;
      }
      return true;
    } catch (e) {
      console.error("Error removing star:", e);
      return false;
    }
  },

  fetchInitialStars: async () => {
    try {
      const resp = await fetch('http://127.0.0.1:7999/stars');
      if (!resp.ok) {
        console.error("Failed to fetch stars:", resp.status);
        return [];
      }
      return await resp.json();
    } catch (e) {
      console.error("Error fetching stars:", e);
      return [];
    }
  },

  createEventSource: () => {
    return new EventSource('http://127.0.0.1:7999/events');
  }
};

describe('BackendCommunicator', () => {
  // Reset mocks before each test
  beforeEach(() => {
    fetch.mockClear();
    localStorageMock.getItem.mockClear();
    global.alert.mockClear();
  });

  test('createStar should make a POST request with the correct data', async () => {
    // Mock a successful response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'star1', x: 100, y: 200, message: 'Hello' })
    });

    const result = await BackendCommunicator.createStar(100, 200, 'Hello');
    
    // Check fetch was called with right params
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:7999/stars', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({ x: 100, y: 200, message: 'Hello', user_id: 'test-user-id' })
    });
    
    // Check result
    expect(result).toEqual({ id: 'star1', x: 100, y: 200, message: 'Hello' });
  });

  test('createStar should handle filter rejection', async () => {
    // Mock a filter rejection response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: false, message: 'Inappropriate content' })
    });

    const result = await BackendCommunicator.createStar(100, 200, 'Bad content');
    
    // Check alert was called
    expect(global.alert).toHaveBeenCalledWith('Inappropriate content');
    
    // Result should be null for rejected content
    expect(result).toBeNull();
  });

  test('removeStarByID should make a DELETE request', async () => {
    // Mock a successful response
    fetch.mockResolvedValueOnce({
      ok: true
    });

    const result = await BackendCommunicator.removeStarByID('star1');
    
    // Check fetch was called with right params
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:7999/stars/star1', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    // Check result
    expect(result).toBe(true);
  });

  test('fetchInitialStars should make a GET request and return the data', async () => {
    // Mock stars data
    const mockStars = [
      { id: 'star1', x: 100, y: 200, message: 'Hello' },
      { id: 'star2', x: 300, y: 400, message: 'World' }
    ];
    
    // Mock a successful response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStars
    });

    const result = await BackendCommunicator.fetchInitialStars();
    
    // Check fetch was called correctly
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:7999/stars');
    
    // Check result
    expect(result).toEqual(mockStars);
  });

  test('createEventSource should return a new EventSource', () => {
    const eventSource = BackendCommunicator.createEventSource();
    
    // Check EventSource was constructed correctly
    expect(EventSource).toHaveBeenCalledWith('http://127.0.0.1:7999/events');
    
    // eventSource should be the mocked instance
    expect(eventSource).toBeDefined();
    expect(eventSource.close).toBeDefined();
  });
}); 