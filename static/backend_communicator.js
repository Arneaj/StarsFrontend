/***************************************************************************
 * Backend Communicator - Handles all backend communication logic
 ***************************************************************************/

const APPLICATION_URL = "http://127.0.0.1:7999";
const RECONNECTION_TIMEOUT = 3000;

export class BackendCommunicator {
  // -------------------------------
  // Star CRUD Operations
  // -------------------------------

  static async createStar(x, y, message) {
    const token = localStorage.getItem('token');
    const user_id = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const body = {x, y, message, user_id, username};
    try {
      const resp = await fetch(`${APPLICATION_URL}/stars`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        console.error("Failed to create star:", resp.status, await resp.text());
        return null;
      }

      // Parse the JSON response
      const responseData = await resp.json();

      // Check if the response contains a "status" field (from the filter service)
      if (responseData.status === false) {
        // If the filter says the message is bad
        alert(responseData.message);
        return null;
      } else {
        console.log("Created star:", responseData);
        return responseData;
      }
    } catch (e) {
      console.error("Error creating star:", e);
      return null;
    }
  }

  static async removeStarByID(starId) {
    try {
      const resp = await fetch(`${APPLICATION_URL}/stars/${starId}`, {
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
      const resp = await fetch(`${APPLICATION_URL}/stars`, {
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
      const resp = await fetch(`${APPLICATION_URL}/stars`);
      return await this._handleResponse(resp);
    } catch (err) {
      console.error("Error fetching stars:", err);
      return [];
    }
  }

  static async fetchStarDetails(starId) {
    try {
      const response = await fetch(`${APPLICATION_URL}/stars/${starId}`);
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
    const url = new URL(`${APPLICATION_URL}/stars/stream`);
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