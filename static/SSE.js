/***************************************************************************
 * SSE Manager - Handles real-time updates via Server-Sent Events
 ***************************************************************************/

import { BackendCommunicator } from "./backend_communicator.js";

export class StarStreamManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.eventSource = null;
    this.reconnectTimeout = null;
    this._connect();
  }

  _connect() {
    this.eventSource = BackendCommunicator.createEventSource();
    
    this.eventSource.addEventListener('star', (event) => {
      const newStar = JSON.parse(event.data);
      starPositions.push(newStar.x, newStar.y);
      starMessages.push(newStar.message);
      nb_stars = starPositions.length / 2;
      starPositionsCPUBuffer = new Float32Array(starPositions);
    });

    this.eventSource.addEventListener('star-removed', (event) => {
      const removedStar = JSON.parse(event.data);
      this._handleStarRemoval(removedStar.id);
    });

    this.eventSource.onerror = () => {
      this._scheduleReconnection();
    };
  }

  _handleStarRemoval(starId) {
    // Note: Frontend needs ID tracking for proper implementation
    // This is a placeholder for actual removal logic
    console.warn("Star removal not fully implemented - refetching all stars");
    this._refreshStarData();
  }

  async _refreshStarData() {
    const stars = await BackendCommunicator.fetchInitialStars();
    starPositions.length = 0;
    starMessages.length = 0;
    
    stars.forEach(star => {
      starPositions.push(star.x, star.y);
      starMessages.push(star.message);
    });
    
    nb_stars = starPositions.length / 2;
    starPositionsCPUBuffer = new Float32Array(starPositions);
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