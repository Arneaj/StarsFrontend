/***************************************************************************
 * Global variables
 ***************************************************************************/
const starPositions = [];
const starMessages = [];
var nb_stars;

var x_min = 5000;
var y_min = 5000;

const total_map_pixels = 10000;
var zoom = 0;

const MAX_STARS = 1000;
const RECONNECTION_TIMEOUT = 3000;

/***************************************************************************
 * Imports
 ***************************************************************************/
import { BackendCommunicator } from "./backend_communicator.js";
import { StarStreamManager } from "./SSE.js";

// We'll recreate starPositionsCPUBuffer whenever starPositions changes
let starPositionsCPUBuffer = new Float32Array(starPositions);

/***************************************************************************
 * WebGL Initialization and Rendering
 ***************************************************************************/
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
    uniform vec2 star_positions[1000];

    uniform float current_time;
    uniform vec2 cursor_position;

    in vec2 position;
    out vec4 outputColor;

    void main() {
        vec2 uv_cursor_position = cursor_position;

        // Convert from clip coords -> [0,1] -> map coordinates
        vec2 uv_position = vec2(
            position.x + 1.0,
            1.0 - position.y
        ) * 0.5;
        uv_position *= vec2(x_max_minus_x_min, y_max_minus_y_min);
        uv_position += vec2(x_min, y_min);

        float d;
        vec2 uv_star_position;
        outputColor = vec4(0.0, 0.0, 0.0, 1.0);

        for (int i = 0; i < nb_stars; i++) {
            uv_star_position = star_positions[i];
            d = distance(uv_position, uv_star_position);
            outputColor += (1.0 + 0.1 * sin(10.0 * current_time))
                           * vec4(1.0, 0.9, 0.7, 1.0) 
                           / pow(d * 0.0005, 1.8);
        }

        float d_from_cursor = max(1000.0, 1000.0 * distance(uv_cursor_position, uv_position));
        outputColor.xyz /= max(20000.0, pow(d_from_cursor, 1.0));
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
    const quadVerts = new Float32Array([-1,1, -1,-1, 1,-1, 1,1]);
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    nb_stars = starPositions.length / 2;

    // Uniform locations
    const starUniform = gl.getUniformLocation(program, "star_positions");
    const timeUniform = gl.getUniformLocation(program, "current_time");
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

    function drawFrame() {
        const now = performance.now() * 0.001; // seconds
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

        gl.uniform1f(xMinUniform, x_min);
        gl.uniform1f(xMaxMinusXMinUniform, canvas.clientWidth);
        gl.uniform1f(yMinUniform, y_min);
        gl.uniform1f(yMaxMinusYMinUniform, canvas.clientHeight);

        gl.uniform2f(cursorUniform, cursorX + x_min, cursorY + y_min);

        gl.uniform1f(timeUniform, now);
        gl.uniform1i(starCountUniform, nb_stars);
        gl.uniform2fv(starUniform, starPositionsCPUBuffer);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);
}

/***************************************************************************
 * Star popup message handling
 ***************************************************************************/

let last_check = 0;
const throttle_delay = 100;

var starPopupOpen = false;  // tracks if our "add star" or "star info" box is open

export function getMessage(event) {
    if (starPopupOpen) return;

    const now = Date.now();
    if (now - last_check <= throttle_delay) return;
    last_check = now;

    const infoElement = document.getElementById('info');
    if (!infoElement) return;

    let x = event.clientX + x_min;
    let y = event.clientY + y_min;

    let messageFound = null;
    let msgPosX = 0, msgPosY = 0;
    for (let i = 0; i < nb_stars; i++) {
        const dx = x - starPositions[2*i];
        const dy = y - starPositions[2*i + 1];
        if (dx*dx + dy*dy < 1000) {
            // Found a star
            messageFound = starMessages[i];
            msgPosX = starPositions[2*i] - x_min;
            msgPosY = starPositions[2*i+1] - y_min;
            break;
        }
    }

    if (!messageFound) {
        // Hide star info if no star is near cursor
        infoElement.style.animation = "0.2s smooth-disappear ease-out";
        infoElement.style.opacity = "0";
        infoElement.style.width = "10%";
        return;
    }
    // Show star info near the star
    infoElement.innerHTML = `<b>User</b><br><br>${messageFound}`;
    infoElement.style.backgroundColor = "#1a04167b";
    infoElement.style.top = (msgPosY) + "px";
    infoElement.style.left = (msgPosX + 20) + "px";
    infoElement.style.width = "10%";
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

var last_x = null;
var last_y = null;
var last_t = null;

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
    let dt = Math.max(0.001, t - last_t);

    last_x = x;
    last_y = y;
    last_t = t;

    speed_x += Math.sign(dx/dt) * Math.min(0.1, Math.abs(dx/dt));
    speed_y += Math.sign(dy/dt) * Math.min(0.1, Math.abs(dy/dt));
}


function updateSpeed() {
    // If no long press, slow down
    if (!mouseDownDone && !mouseHoldTimeout) {
        speed_x *= 0.9;
        speed_y *= 0.9;
    }

    x_min = Math.min(total_map_pixels, Math.max(0, x_min - 3*speed_x));
    y_min = Math.min(total_map_pixels, Math.max(0, y_min - 3*speed_y));

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
        return;
    }
    if (starPopupOpen) return;
    starPopupOpen = true;

    const infoBox = document.getElementById('info');
    if (!infoBox) return;

    let x = event.clientX + x_min;
    let y = event.clientY + y_min;

    // The box might be visible, so forcibly hide first
    infoBox.style.animation = "0.2s smooth-disappear ease-out";
    infoBox.style.opacity = "0";

    // Show the "Add star" form
    last_clicked_x = x;
    last_clicked_y = y;

    infoBox.innerHTML = `
        <b>Add a star</b><br><br>
        <input type="text" id="star_message" class="button message_input" placeholder="Star message...">
        <br><br>
        <button id="submit_button" class="button submit_button">Submit message</button>
        <button id="close_star_box" class="button close_button">Close</button>
    `;
    infoBox.style.animation = "0.2s smooth-appear ease-in";
    infoBox.style.opacity = "1";
    infoBox.style.backgroundColor = "#1a0416d7";
    infoBox.style.top = "40%";
    infoBox.style.left = "25%";
    infoBox.style.width = "50%";

    // Attach listeners to these new buttons
    const submitBtn = infoBox.querySelector("#submit_button");
    const closeBtn  = infoBox.querySelector("#close_star_box");

    submitBtn?.addEventListener("click", submitMessage);
    closeBtn?.addEventListener("click", closeStarPopup);
}

/**
 * Closes the star info/add popup (the #info element).
 */
export function closeStarPopup(event) {
    event.stopPropagation();

    const infoBox = document.getElementById('info');
    if (!infoBox) return;

    infoBox.style.animation = "0.2s smooth-disappear ease-out";
    infoBox.style.opacity = "0";

    starPopupOpen = false;
}

/**
 * Called when the user presses Submit in the star box
 */
export async function submitMessage(event) {
    const msgInput = document.getElementById('star_message');
    const message = msgInput ? msgInput.value : "";
    await BackendCommunicator.createStar(last_clicked_x, last_clicked_y, message);
    closeStarPopup(event);
}

/***************************************************************************
 * Fetch initial stars on page load
 ***************************************************************************/
export async function fetchInitialStars() {
    const stars = await BackendCommunicator.fetchInitialStars();
    if (stars) {
        for (const s of stars) {
            starPositions.push(s.x, s.y);
            starMessages.push(s.message);
        }
        nb_stars = starPositions.length / 2;
        starPositionsCPUBuffer = new Float32Array(starPositions);
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
    nb_stars = 0;
    starPositionsCPUBuffer = new Float32Array(starPositions);
}
