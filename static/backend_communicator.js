/***************************************************************************
 * Backend Communicator - Handles all backend communication logic
 ***************************************************************************/

const BACKEND_URL = "http://127.0.0.1:8000";
const RECONNECTION_TIMEOUT = 3000;

export class BackendCommunicator {
  // -------------------------------
  // Star CRUD Operations
  // -------------------------------
  
  static async createStar(x, y, message) {
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch(`${BACKEND_URL}/stars`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ x, y, message }),
      });
      return await this._handleResponse(resp);
    } catch (e) {
      console.error("Error creating star:", e);
      return null;
    }
  }

  static async removeStarByID(starId) {
    try {
      const resp = await fetch(`${BACKEND_URL}/stars/${starId}`, {
        method: "DELETE"
      });
      return await this._handleResponse(resp);
    } catch (e) {
      console.error("Error removing star:", e);
      return null;
    }
  }

  static async removeAllStars() {
    try {
      const resp = await fetch(`${BACKEND_URL}/stars`, {
        method: "DELETE"
      });
      return await this._handleResponse(resp);
    } catch (e) {
      console.error("Error clearing stars:", e);
      return null;
    }
  }

  // -------------------------------
  // Star Data Fetching
  // -------------------------------
  
  static async fetchInitialStars() {
    try {
      const resp = await fetch(`${BACKEND_URL}/stars`);
      return await this._handleResponse(resp);
    } catch (err) {
      console.error("Error fetching stars:", err);
      return [];
    }
  }

  static async fetchStarDetails(starId) {
    try {
      const response = await fetch(`${BACKEND_URL}/stars/${starId}`);
      return await this._handleResponse(response);
    } catch (error) {
      console.error("Error fetching star details:", error);
      return null;
    }
  }

  // -------------------------------
  // SSE Connection Management
  // -------------------------------
  
  static createEventSource() {
    const token = localStorage.getItem('token');
    const url = new URL(`${BACKEND_URL}/stars/stream`);
    url.searchParams.append('token', token);
    return new EventSource(url.href);
  }

  // -------------------------------
  // Helper Methods
  // -------------------------------
  
  static async _handleResponse(response) {
    if (!response.ok) {
      const error = await response.text();
      console.error("Request failed:", response.status, error);
      return null;
    }
    return await response.json();
  }
}