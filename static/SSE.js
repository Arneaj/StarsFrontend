/***************************************************************************
 * SSE Manager - minimal data from SSE, then fetch full data if in viewport
 ***************************************************************************/
import { BackendCommunicator } from "./backend_communicator.js";
import {
  starIDs,
  starPositions,
  starMessages,
  updateStarPositionsBuffer,
  isInViewport,
  RECONNECTION_TIMEOUT
} from "./globals.js";

export class StarStreamManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.eventSource = null;
    this.reconnectTimeout = null;
    this._connect();
  }

  _connect() {
    this.eventSource = BackendCommunicator.createEventSource();

    // All SSE events come in here as onmessage (the server does not use named events).
    this.eventSource.onmessage = async (event) => {
      console.log("Raw SSE data:", event.data);
      
      try {
        const parsed = JSON.parse(event.data);  // Remove the replace step
        if (parsed.type === 'create') {        // Check parsed.type
          this._handleAddEvent(parsed.data);    // Use parsed.data
        } else if (parsed.type === 'delete') {
          this._handleStarRemoval(parsed.data?.id);
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error, "Received:", event.data);
      }
    };
    

    this.eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      this._scheduleReconnection();
    };
  }

  _handleAddEvent(starData) {
    if (!starData || typeof starData.x !== 'number' || typeof starData.y !== 'number' || !starData.id) {
        console.warn("Malformed star SSE event:", starData);
        return;
    }

    // Add the star with the backend-generated ID
    const i = this._addStarMinimal(starData.id, starData.x, starData.y);

    // Fetch the message if the star is in the viewport
    if (isInViewport(this.canvas, starData.x, starData.y)) {
        this._fetchStarMessage(i, starData.id);
    }
  }

  _addStarMinimal(id, x, y) {
    // For convenience, track the index of this star in the arrays
    // so we know where to put the message.
    starIDs.push(id);
    starPositions.push(x, y);
    starMessages.push(null);  // We haven't fetched it yet
    updateStarPositionsBuffer();

    // Return the index in starIDs/starPositions/starMessages
    return (starIDs.length - 1);
  }

  async _fetchStarMessage(index, starId) {
    try {
      const fullStar = await BackendCommunicator.fetchStarDetails(starId);
      if (!fullStar || typeof fullStar.x !== 'number' || typeof fullStar.y !== 'number') {
        console.warn("fetchStarDetails returned invalid star:", fullStar);
        return;
      }
      // Update the star's message in the array
      starMessages[index] = fullStar.message;
      // No need to update starPositionsBuffer, because x,y didn't change
    } catch (err) {
      console.error("Failed to fetch full star details:", err);
    }
  }

  _handleStarRemoval(starId) {
    console.warn(`Star removal (ID=${starId}) not fully implemented - refetching all stars`);
    this._refreshStarData();
  }

  async _refreshStarData() {
    // fetchInitialStars returns an array of { id, x, y, message }
    const stars = await BackendCommunicator.fetchInitialStars();
    // Clear all local arrays
    starIDs.length = 0;
    starPositions.length = 0;
    starMessages.length = 0;

    for (const s of stars) {
      starIDs.push(s.id);
      starPositions.push(s.x, s.y);
      starMessages.push(s.message); // we already have the message
    }
    updateStarPositionsBuffer();
  }

  _scheduleReconnection() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      console.log("Attempting SSE reconnection...");
      this._connect();
    }, RECONNECTION_TIMEOUT);
  }

  cleanup() {
    if (this.eventSource) this.eventSource.close();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
  }
}
