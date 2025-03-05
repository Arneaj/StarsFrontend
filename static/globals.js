// globals.js
export const starIDs = [];        // starIDs[i] => star's integer ID
export const starPositions = [];  // starPositions[2*i], starPositions[2*i + 1] => star's X & Y
export const starMessages = [];   // starMessages[i] => string or null
export const starCreationTime = [];
export let nb_stars = 0;

export let starPositionsCPUBuffer = new Float32Array(starPositions);

export let x_min = 5000;
export let y_min = 5000;

export const total_map_pixels = 10000;
export let zoom = 0;

export const MAX_STARS = 1000;
export const RECONNECTION_TIMEOUT = 3000;

/**
 * Helper to update the Float32Array whenever starPositions changes.
 */
export function updateStarPositionsBuffer() {
    nb_stars = starPositions.length / 2;
    starPositionsCPUBuffer = new Float32Array(starPositions);
}

/**
 * Check if a star at (x, y) is currently in the viewport.
 */
export function isInViewport(canvas, x, y) {
  const left   = x_min;
  const right  = x_min + (canvas?.clientWidth || 0);
  const bottom = y_min;
  const top    = y_min + (canvas?.clientHeight || 0);
  return (x >= left && x <= right && y >= bottom && y <= top);
}

/** Setter function for x_min and y_min */
export function updateMinCoords(newXMin, newYMin) {
    x_min = newXMin;
    y_min = newYMin;
}

/** Setter function for nb_stars */
export function update_nb_stars(newNbStars) {
    nb_stars = newNbStars;
}