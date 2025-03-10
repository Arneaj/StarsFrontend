// canvas

/***************************************************************************
 * Global variables
 ***************************************************************************/
import {
    startDrone,
    stopDrone,
    addOctaveNote,
    removeOctaveNote
} from './music.js';

import { initializeAudio } from './audio_context.js';

import {
    starIDs,
    starPositions,
    starMessages,
    starLastLikeTime,
    starCreationDate,
    starUserID,
    starUsername,
    updateLists,
    nb_stars,
    starPositionsCPUBuffer,
    starLastLikeCPUBuffer,
    starUserIDCPUBuffer,
    updateStarPositionsBuffer,
    x_min,
    y_min,
    total_map_pixels,
    RECONNECTION_TIMEOUT,
    isInViewport,
    updateMinCoords,
    update_nb_stars,
    zoom,
    update_zoom
} from './globals.js';

import { soundEffectsEnabled } from './sound_state.js';

/***************************************************************************
 * Imports
 ***************************************************************************/
import { BackendCommunicator } from "./backend_communicator.js";
import { StarStreamManager } from "./SSE.js";


function showError(errorText) {
    const errorBoxDiv = document.getElementById('error-box');
    if (!errorBoxDiv) {
        console.error(errorText);
        return;
    }
    const errorSpan = document.createElement('p');
    errorSpan.innerText = errorText;
    errorBoxDiv.appendChild(errorSpan);
    console.error(errorText);
}

export async function starsGraphics() {
    const canvas = document.getElementById('stars_canvas');
    if (!canvas) {
        showError("Canvas element not found!");
        return;
    }

    // 1) Start SSE to catch new star events from the backend
    const starStream = new StarStreamManager(canvas);

    // 2) Fetch existing stars
    await fetchInitialStars();

    // 3) Setup WebGL
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        const isWebGl1Supported = !!document.createElement('canvas').getContext('webgl');
        if (isWebGl1Supported) {
            showError("WebGL 2 not supported, but WebGL 1 might be available.");
        } else {
            showError("No WebGL support at all in this browser/device.");
        }
        return;
    }

    // ----- Shaders -----
    const vertexShaderSource = `#version 300 es
    precision mediump float;
    in vec2 vertexPosition;
    out vec2 position;
    void main() {
        gl_Position = vec4(vertexPosition, 0.0, 1.0);
        position = vertexPosition;
    }`;

    const fragmentShaderSource = `#version 300 es
    precision mediump float;

    uniform float x_min;
    uniform float x_max_minus_x_min;
    uniform float y_min;
    uniform float y_max_minus_y_min;

    uniform int nb_stars;
    uniform vec2 star_positions[400];
    uniform float star_last_likes[200];
    uniform int star_user_ids[200];

    uniform float current_time;
    uniform float smooth_current_time;
    uniform vec2 cursor_position;

    in vec2 position;
    out vec4 outputColor;

    void main() 
    {
        vec2 uv_cursor_position = cursor_position;

        // Convert from clip coords -> [0,1] -> map coordinates
        vec2 uv_position = vec2(
            position.x + 1.0,
            1.0 - position.y
        ) * 0.5;
        uv_position *= vec2(x_max_minus_x_min, y_max_minus_y_min);
        uv_position += vec2(x_min, y_min);

        float d;
        float delta_time;
        float time_falloff;

        vec2 uv_star_position;
        outputColor = vec4(0.0, 0.0, 0.0, 1.0);

        int closest_star_user_id = -1;
        float d_cursor_star_min = 100.0;

        for (int i = 0; i < nb_stars; i++) 
        {
            uv_star_position = star_positions[i];
            d = distance(uv_position, uv_star_position);

            float d_cursor_star = distance(uv_cursor_position, uv_star_position);

            if (d_cursor_star < d_cursor_star_min)
            {
                d_cursor_star_min = d_cursor_star;
                closest_star_user_id = star_user_ids[i];
            }

            delta_time = current_time - star_last_likes[i];
            time_falloff = clamp(1.0-delta_time*0.00001157407, 0.0, 1.0);  // disappears over 24h

            outputColor.xyz += (1.0 + 0.1 * sin(mod(10.0 * smooth_current_time, 6.28318530718)))
                           * ( 
                                vec3(1.0, 0.8, 0.6) * time_falloff + 
                                vec3(1.0, 0.9, 1.0) * (1.0-time_falloff) 
                             )
                           * time_falloff
                           / pow(d * 0.0005, 1.8);
        }

        float d_from_cursor = max(1000.0, 1000.0 * distance(uv_cursor_position, uv_position));
        outputColor.xyz /= max(20000.0, pow(d_from_cursor, 1.0));

        if (closest_star_user_id == -1) return;

        int last_star_index;

        for (int i = 0; i < nb_stars; i++)
        {
            if (star_user_ids[i] != closest_star_user_id) continue;

            last_star_index = i;
            break;
        }

        for (int i = last_star_index+1; i < nb_stars; i++)
        {
            if (star_user_ids[i] != closest_star_user_id) continue;

            vec2 ray_vec = star_positions[i] - star_positions[last_star_index];
            float ray_length = length(ray_vec);
            vec2 ray_dir = ray_vec / ray_length;
            vec2 ray_normal = vec2(-ray_dir.y, ray_dir.x);

            float dist_n = dot(ray_normal, uv_position - star_positions[last_star_index]);

            if (abs(dist_n) > 5.0) 
            {
                last_star_index = i;
                continue;
            }
            
            float dist_u = dot(ray_dir, uv_position - star_positions[last_star_index]);

            if (dist_u > ray_length || dist_u < 0.0) 
            {
                last_star_index = i;
                continue;
            }

            float n_offset = abs(dist_n)*0.2;
            float u_offset = min(dist_u, ray_length - dist_u) / ray_length;

            outputColor.xyz += (1.0 + 0.1 * sin(mod(10.0 * smooth_current_time, 6.28318530718)))
                           * vec3(1.0, 0.9, 1.0)
                           * pow((1.0 - n_offset - u_offset), 3.0)
                           / max(0.5, pow(d_cursor_star_min*0.1, 1.8));

            last_star_index = i;
        }

    }`;

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        showError("Vertex shader compile error: " + gl.getShaderInfoLog(vertexShader));
        return;
    }

    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        showError("Fragment shader compile error: " + gl.getShaderInfoLog(fragmentShader));
        return;
    }

    // Link program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        showError("Shader link error: " + gl.getProgramInfoLog(program));
        return;
    }

    // Full-screen quad
    const quadVerts = new Float32Array([
        -1, 1, 
        -1,-1, 
         1,-1, 
         1, 1
    ]);
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    update_nb_stars(starPositions.length / 2);

    // Uniform locations
    const starUniform = gl.getUniformLocation(program, "star_positions");
    const starLastLikeUniform = gl.getUniformLocation(program, "star_last_likes");
    const starUserIDUniform = gl.getUniformLocation(program, "star_user_ids");

    const timeUniform = gl.getUniformLocation(program, "current_time");
    const smoothTimeUniform = gl.getUniformLocation(program, "smooth_current_time");

    const starCountUniform = gl.getUniformLocation(program, "nb_stars");

    const xMinUniform = gl.getUniformLocation(program, "x_min");
    const xMaxMinusXMinUniform = gl.getUniformLocation(program, "x_max_minus_x_min");
    const yMinUniform = gl.getUniformLocation(program, "y_min");
    const yMaxMinusYMinUniform = gl.getUniformLocation(program, "y_max_minus_y_min");

    const cursorUniform = gl.getUniformLocation(program, "cursor_position");

    // Attribute location
    const positionAttribLoc = gl.getAttribLocation(program, "vertexPosition");
    if (positionAttribLoc < 0) {
        showError("Failed to get vertexPosition attribute location!");
        return;
    }

    // Setup viewport
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.clearColor(0.08, 0.08, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);

    let cursorX = 0, cursorY = 0;
    window.addEventListener("mousemove", (e) => {
        cursorX = e.clientX;
        cursorY = e.clientY;
    });  

    console.log(starUsername);
    

    // Throttling the "fetch missing messages" check
    let lastViewportCheckTime = 0;
    function drawFrame() {  
        gl.useProgram(program);
        gl.enableVertexAttribArray(positionAttribLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.vertexAttribPointer(
            positionAttribLoc,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );

        let smooth_time = performance.now() * 0.001;

        gl.uniform1f(xMinUniform, (x_min + 0.5 * canvas.clientWidth * (1 - zoom)));
        gl.uniform1f(xMaxMinusXMinUniform, canvas.clientWidth*zoom);
        gl.uniform1f(yMinUniform, (y_min + 0.5 * canvas.clientHeight * (1 - zoom)));
        gl.uniform1f(yMaxMinusYMinUniform, canvas.clientHeight*zoom);

        gl.uniform2f(
            cursorUniform, 
            cursorX*zoom + (x_min + 0.5 * canvas.clientWidth * (1 - zoom)), 
            cursorY*zoom + (y_min + 0.5 * canvas.clientHeight * (1 - zoom))
        );

        gl.uniform1f(timeUniform, Date.now() * 0.001 - 1735689600.0);  // seconds since 01/01/2025
        gl.uniform1f(smoothTimeUniform, smooth_time);  // seconds since program started. Used for smooth animations.

        gl.uniform1i(starCountUniform, nb_stars);
        
        if (nb_stars > 0) {
            gl.uniform2fv(starUniform, starPositionsCPUBuffer);
            gl.uniform1fv(starLastLikeUniform, starLastLikeCPUBuffer);
            gl.uniform1iv(starUserIDUniform, starUserIDCPUBuffer);
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        // THROTTLE: check once every 0.5s
        if (smooth_time - lastViewportCheckTime > 0.5) {
            checkMissingMessages(canvas);
            lastViewportCheckTime = smooth_time;
        }

        requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);
}

/**
 * Goes through all known stars. If starMessages[i] is null,
 * but the star is in viewport, fetch that star's message now.
 */
async function checkMissingMessages(canvas) {
    for (let i = 0; i < nb_stars; i++) {
        if (starMessages[i] === null || starUsername[i] === null) {   
            const sx = starPositions[2*i];
            const sy = starPositions[2*i + 1];

            if (isInViewport(canvas, sx, sy)) {
                // Need to fetch star's message
                const starId = starIDs[i];
                try {
                    const fullStar = await BackendCommunicator.fetchStarDetails(starId);
                    if (fullStar && typeof fullStar.message === 'string') {
                        starMessages[i] = fullStar.message;
                        starUsername[i] = fullStar.username;
                    }
                } catch(e) {
                    console.error("Error fetching star message for ID=", starId, e);
                }
            }
        }
    }
}


/***************************************************************************
 * Star popup message handling
 ***************************************************************************/

let last_check = 0;
const throttle_delay = 100;

var starPopupOpen = false;  // tracks if our "add star" or "star info" box is open

let last_hovered_star_id;

export function getMessage(event) {
    if (starPopupOpen) return;

    let canvas = document.getElementById('stars_canvas');

    const now = Date.now();
    if (now - last_check <= throttle_delay) return;
    last_check = now;

    const infoElement = document.getElementById('info');
    if (!infoElement) return;

    let x = event.clientX*zoom + (x_min + 0.5 * canvas.clientWidth * (1 - zoom));
    let y = event.clientY*zoom + (y_min + 0.5 * canvas.clientHeight * (1 - zoom));

    let messageFound = null;
    let msgPosX = 0, msgPosY = 0;
    let msgUser = null;
    
    for (let i = 0; i < nb_stars; i++) {
        const dx = x - starPositions[2*i];
        const dy = y - starPositions[2*i + 1];
        if (dx*dx + dy*dy < 1000) {
            // Found a star
            last_hovered_star_id = starIDs[i];
            messageFound = starMessages[i];
            msgPosX = (starPositions[2*i] - (x_min + 0.5 * canvas.clientWidth * (1 - zoom)))/zoom;
            msgPosY = (starPositions[2*i+1] - (y_min + 0.5 * canvas.clientHeight * (1 - zoom)))/zoom;
            msgUser = starUsername[i];
            break;
        }
    }

    if (!messageFound) {
        // Hide star info if no star is near cursor
        infoElement.style.animation = "0.2s smooth-disappear ease-out";
        infoElement.style.opacity = "0";
        infoElement.style.width = "200px";
        setTimeout(() => {
            if (infoElement.style.opacity === "0") {
                infoElement.style.visibility = "hidden";
            }
        }, 200);
        return;
    }

    // Show star info near the star
    infoElement.innerHTML = `<b>${msgUser}</b><br><br>${messageFound}`;
    infoElement.style.backgroundColor = "rgba(51, 51, 51, 0.95)";
    infoElement.style.top = (msgPosY) + "px";
    infoElement.style.left = (msgPosX + 20) + "px";
    infoElement.style.width = "200px";
    infoElement.style.visibility = "visible";
    infoElement.style.animation = "0.2s smooth-appear ease-in";
    infoElement.style.opacity = "1";
}

// Variables for panning
let last_clicked_x = 0;
let last_clicked_y = 0;

var speed_x = 0;
var speed_y = 0;

var mouseHoldTimeout = null;
var mouseDownDone = false;

// Dragging logic
// window.addEventListener("mousedown", mouseDown);
// window.addEventListener("mousemove", mouseDownAndMove);
// window.addEventListener("mouseup", () => {
//     mouseDownDone = false;
//     last_x = null;
//     last_y = null;
//     last_t = null;
// });

export function mouseDown() {
    if (starPopupOpen) return;
    
    mouseHoldTimeout = setTimeout(() => {
        mouseDownDone = true;
    }, 500);
}

var last_x = null;
var last_y = null;
var last_t = null;

export function mouseDownAndMove(event) {
    if (starPopupOpen) return;
    if (!mouseDownDone && !mouseHoldTimeout) return;

    const canvas = document.getElementById('stars_canvas');

    let x = event.clientX;
    let y = event.clientY;
    let t = Date.now();

    if (last_x === null || last_y === null || last_t === null) {
        last_x = x;
        last_y = y;
        last_t = t;
        return;
    }

    let dx = x - last_x;
    let dy = y - last_y;
    // let dt = Math.max(0.001, t - last_t);

    last_x = x;
    last_y = y;
    last_t = t;

    speed_x += 0.5 * Math.sign(dx) * Math.min(0.1, Math.abs(dx)); // Math.sign(dx/dt) * Math.min(0.1, Math.abs(dx/dt));
    speed_y += 0.5 * Math.sign(dy) * Math.min(0.1, Math.abs(dy)); // Math.sign(dy/dt) * Math.min(0.1, Math.abs(dy/dt));
}

export function stopOnMouseLeave(event) {
    mouseHoldTimeout = null;
    mouseDownDone = false;
}


function updateSpeed() {
    // If no long press, slow down
    if (!mouseDownDone && !mouseHoldTimeout) {
        speed_x *= 0.9;
        speed_y *= 0.9;
    }

    const newXMin = Math.min(total_map_pixels, Math.max(0, x_min - 4*speed_x));
    const newYMin = Math.min(total_map_pixels, Math.max(0, y_min - 4*speed_y));

    updateMinCoords(newXMin, newYMin);  // Update x_min and y_min safely

    setTimeout(updateSpeed, 10);
}
updateSpeed();

/**
 * When the user clicks the canvas:
 *  - If they do a quick click, we open the "Add star" box.
 *  - If they were dragging, we skip it.
 */
export function clickFunction(event) {
    // Cancel any pending hold
    if (mouseHoldTimeout) {
        clearTimeout(mouseHoldTimeout);
        mouseHoldTimeout = null;
    }
    // If it was a long press/drag, reset and do nothing
    if (mouseDownDone) {
        mouseDownDone = false;
        last_x = null;
        last_y = null;
        last_t = null;
        return;
    }
    if (starPopupOpen) return;
    starPopupOpen = true;

    const infoBox = document.getElementById('info');
    if (!infoBox) return;

    let canvas = document.getElementById('stars_canvas');

    let x = event.clientX*zoom + (x_min + 0.5 * canvas.clientWidth * (1 - zoom));
    let y = event.clientY*zoom + (y_min + 0.5 * canvas.clientHeight * (1 - zoom));

    // The box might be visible, so forcibly hide first
    infoBox.style.animation = "0.2s smooth-disappear ease-out";
    infoBox.style.opacity = "0";

    // Show the "Add star" form
    last_clicked_x = x;
    last_clicked_y = y;

    if (infoBox.style.visibility === "hidden") 
    {
        infoBox.innerHTML = `
            <b>Add a star</b><br><br>
            <input type="text" id="star_message" class="button message_input" placeholder="Star message..."><br>
            <b>(max 256 characters)</b>
            <br><br>
            <button id="submit_button" class="button submit_button">Submit message</button>
            <button id="close_star_box" class="button close_button">Close</button>
        `;
        const submitBtn = infoBox.querySelector("#submit_button");
        submitBtn?.addEventListener("click", submitMessage);
    }
    else 
    {
        infoBox.innerHTML += `
            <br><br>
            <button id="like_button" class="button like_button">Like</button>
            <button id="dislike_button" class="button dislike_button">Dislike</button>
            <button id="close_star_box" class="button close_button">Close</button>
        `;
        const likeBtn = infoBox.querySelector("#like_button");
        likeBtn?.addEventListener("click", likeMessage);
        const dislikeBtn = infoBox.querySelector("#dislike_button");
        dislikeBtn?.addEventListener("click", dislikeMessage);
    }
    infoBox.style.visibility = "visible";
    infoBox.style.animation = "0.2s smooth-appear ease-in";
    infoBox.style.opacity = "1";
    infoBox.style.backgroundColor = "rgba(51, 51, 51, 0.95)";
    infoBox.style.top = "40%";
    infoBox.style.left = "25%";
    infoBox.style.width = "50%";

    // Attach listeners to the close buttons
    const closeBtn = infoBox.querySelector("#close_star_box");
    closeBtn?.addEventListener("click", async () => {
        await closeStarPopup(event);
    });
}


/**
 * Called when using the wheel up and down to modify the zoom value
 */
export function zoomAction(event) {
    let dir = Math.sign(event.deltaY);
    
    if (dir < 0) update_zoom( Math.min(zoom*1.01, 5.0) );
    if (dir > 0) update_zoom( Math.max(zoom/1.01, 0.2) );

    console.log(zoom);
}


/**
 * Closes the star info/add popup (the #info element).
 */
export async function closeStarPopup(event) {
    event.stopPropagation();

    const infoBox = document.getElementById('info');
    if (!infoBox) return;

    infoBox.style.animation = "0.2s smooth-disappear ease-out";
    infoBox.style.opacity = "0";
    
    setTimeout(() => {
        if (infoBox.style.opacity === "0") {
            infoBox.style.visibility = "hidden";
        }
    }, 220);

    starPopupOpen = false;
}

/**
 * Called when the user presses Submit in the star box
 */
export async function submitMessage(event) {
    const msgInput = document.getElementById('star_message');
    const message = msgInput ? msgInput.value : "";
    await BackendCommunicator.createStar(last_clicked_x, last_clicked_y, message);
    
    // Play the octave note if sound effects are enabled
    if (soundEffectsEnabled) {
        addOctaveNote();
        // Remove the note after 2 seconds
        setTimeout(() => {
            removeOctaveNote();
        }, 2000);
    }
    
    await closeStarPopup(event);
}

/**
 * Called when the user presses Like in the star box
 */
export async function likeMessage(event) {
    await BackendCommunicator.likeStar(last_hovered_star_id);
    
    // Play the octave note if sound effects are enabled
    if (soundEffectsEnabled) {
        addOctaveNote();
        // Remove the note after 2 seconds
        setTimeout(() => {
            removeOctaveNote();
        }, 2000);
    }

    updateStarPositionsBuffer();
    await closeStarPopup(event);
}

/**
 * Called when the user presses Dislike in the star box
 */
export async function dislikeMessage(event) { // TODO
    await BackendCommunicator.dislikeStar(last_hovered_star_id);
    updateStarPositionsBuffer();
    await closeStarPopup(event);
}


function indexSort(refData) {
    // Create an array of indices [0, 1, 2, ...N].
    var indices = Object.keys(refData);
  
    // Sort array of indices according to the reference data.
    indices.sort(function(indexA, indexB) {
      if (refData[indexA] < refData[indexB]) {
        return -1;
      } else if (refData[indexA] > refData[indexB]) {
        return 1;
      }
      return 0;
    });
  
    // Map array of indices to corresponding values of the target array.
    return indices;
}


function sortByCreationDate( list_of_lists_to_sort, list_of_pos, star_creation_date)
{
    let indices = indexSort(star_creation_date);

    let double_indices = indices.map(function(index) {
        return [2*index, 2*index+1];
    });
    
    double_indices = double_indices.flat();

    for (let i=0; i<list_of_lists_to_sort.length; i++)
    {
        list_of_lists_to_sort[i] = indices.map(function(index) {
            return list_of_lists_to_sort[i][index];
        });
    }

    list_of_pos = double_indices.map(function(index) {
        return list_of_pos[index];
    });         

    return list_of_lists_to_sort.concat([list_of_pos]);
}


/***************************************************************************
 * Fetch initial stars on page load
 ***************************************************************************/
export async function fetchInitialStars() {
    // This returns the full star data, including messages
    const stars = await BackendCommunicator.fetchInitialStars();
    if (stars) {
        starIDs.length       = 0;
        starPositions.length = 0;
        starMessages.length  = 0;
        starLastLikeTime.length = 0;
        starCreationDate.length = 0;
        starUserID.length = 0;
        starUsername.length = 0;

        for (const s of stars) {
            starIDs.push(s.id);
            starPositions.push(s.x, s.y);
            starMessages.push(s.message);
            starLastLikeTime.push(s.last_liked);
            starCreationDate.push(s.creation_date);
            starUserID.push(s.user_id);
            starUsername.push(s.username);
        }

        updateLists(
            sortByCreationDate(
                [starIDs, starMessages, starLastLikeTime, starUserID, starUsername], 
                starPositions,
                starCreationDate
            )
        )

        updateStarPositionsBuffer();
        console.log("Loaded", nb_stars, "stars initially");
    }
}

/***************************************************************************
 * Debug buttons
 ***************************************************************************/
export function addRandomStar() {
    const rx = (Math.random() * 2 - 1).toFixed(2);  // random in [-1, 1]
    const ry = (Math.random() * 2 - 1).toFixed(2);
    const msg = `Random star #${Math.floor(Math.random()*1000)}`;
    BackendCommunicator.createStar(Number(rx), Number(ry), msg);
}

export async function removeStarByIDPrompt() {
    const idStr = prompt("Enter star ID to remove:");
    if (!idStr) return;
    const starID = parseInt(idStr, 10);
    if (!Number.isFinite(starID)) {
        console.error("Invalid ID:", idStr);
        return;
    }
    await BackendCommunicator.removeStarByID(starID);
}

export async function removeAllStars() {
    await BackendCommunicator.removeAllStars();
    starPositions.length = 0;
    starMessages.length = 0;
    updateStarPositionsBuffer();
}

export function toggleSoundEffects() {
    soundEffectsEnabled = !soundEffectsEnabled;
    const soundToggleBtn = document.getElementById('sound_toggle');
    if (soundToggleBtn) {
        soundToggleBtn.textContent = soundEffectsEnabled ? "Disable Sound Effects" : "Enable Sound Effects";
    }
    
    // Always stop the drone when toggling, regardless of new state
    stopDrone().then(() => {
        console.log("Sound effects toggled:", soundEffectsEnabled);
    });
}
