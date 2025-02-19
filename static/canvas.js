// Run with: 
// cd static
// python3 -m http.server 3000


/***************************************************************************
 * You had these global variables
 ***************************************************************************/
const starPositions = [];
const starMessages = [];
var nb_stars;
const MAX_STARS = 1000; // ensure this is defined somewhere
const RECONNECTION_TIMEOUT = 3000; // e.g. 3 seconds

/***************************************************************************
 *  <<<=== ADDED: Your gateway or backend URL
 *  In a 3-tier setup, the front-end calls the GATEWAY at :8000,
 *  and the gateway forwards to the DB service at :5000.
 ***************************************************************************/

// Should these be global variables? starPositionsCPUBuffer must be referenced by multiple functions.
// Up to you Arnaud! 
const BACKEND_URL = "http://127.0.0.1:8000";
let starPositionsCPUBuffer = new Float32Array(starPositions);

/***************************************************************************
 * Your StarStreamManager, but updated to talk to the gateway
 ***************************************************************************/
class StarStreamManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.eventSource = null;
        this.setupSSE();
    }

    getViewport() {
        const aspect = this.canvas.clientHeight / this.canvas.clientWidth;
        return {
            left: -1,
            right: 1,
            bottom: -aspect,
            top: aspect
        };
    }

    setupSSE() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.eventSource = new EventSource(`${BACKEND_URL}/stars/stream`);

        this.eventSource.onmessage = (event) => {
            try {
                const dataStr = event.data.replace(/'/g, '"');
                const starUpdate = JSON.parse(dataStr);
                this.handleStarUpdate(starUpdate);
            } catch (error) {
                console.error('Error processing star update:', error, event.data);
            }
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            this.eventSource.close();
            setTimeout(() => this.setupSSE(), RECONNECTION_TIMEOUT);
        };

        window.addEventListener('beforeunload', () => {
            if (this.eventSource) {
                this.eventSource.close();
            }
        });
    }

    async handleStarUpdate(starUpdate) {
        if (!starUpdate.star || typeof starUpdate.star.x !== 'number' || 
            typeof starUpdate.star.y !== 'number' || !starUpdate.star.id) {
            console.error('Invalid star data received:', starUpdate);
            return;
        }

        if (starUpdate.event === 'add') {
            const { id, x, y } = starUpdate.star;
            // Check if the star is within the current viewport.
            const bounds = this.getViewport(); // Deepseek! Should this be getting bounds? 
            if (x >= bounds.left && x <= bounds.right && y >= bounds.bottom && y <= bounds.top) {
                // Fetch full star details (including the message)
                const fullStar = await fetchStarDetails(id);
                if (fullStar) {
                    this.addStar(fullStar);
                }
            }
        } else if (starUpdate.event === 'remove') {
            this.removeStar(starUpdate.star);
        } else {
            console.warn('Unknown star update event:', starUpdate.event);
        }

        // Update the starPositionsCPUBuffer
        starPositionsCPUBuffer = new Float32Array(starPositions);
    }

    addStar(star) {
        // Check for duplicates
        for (let i = 0; i < nb_stars; i++) {
            if (starPositions[2 * i] === star.x && 
                starPositions[2 * i + 1] === star.y) {
                console.warn('Duplicate star position detected');
                return;
            }
        }
    
        starPositions.push(star.x, star.y);
        starMessages.push(star.message);
        nb_stars = starPositions.length / 2;
    
        // Update the CPU buffer
        starPositionsCPUBuffer = new Float32Array(starPositions);
    }

    removeStar(star) {
        for (let i = nb_stars - 1; i >= 0; i--) {
            if (starPositions[2 * i] === star.x && 
                starPositions[2 * i + 1] === star.y) {
                starPositions.splice(2 * i, 2);
                starMessages.splice(i, 1);
                nb_stars = starPositions.length / 2;
    
                // Update the CPU buffer
                starPositionsCPUBuffer = new Float32Array(starPositions);
                break;
            }
        }
    }
}

/***************************************************************************
 * For demonstration, let's add a simple createStar() 
 * (which calls the gateway) so you can test adding stars.
 ***************************************************************************/
async function createStar(x, y, message) {
    // Example usage: createStar(0.25, -0.1, "Hello from canvas!");
    const body = { x, y, message };
    try {
        const resp = await fetch(`${BACKEND_URL}/stars`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            console.error("Failed to create star:", resp.status, await resp.text());
        } else {
            const newStar = await resp.json();
            console.log("Created star:", newStar);
        }
    } catch (e) {
        console.error("Error creating star:", e);
    }
}

/***************************************************************************
 * The rest is your existing WebGL code
 ***************************************************************************/
function showError(errorText) 
{
    const errorBoxDiv = document.getElementById('error-box');
    const errorSpan = document.createElement('p');
    errorSpan.innerText = errorText;
    errorBoxDiv.appendChild(errorSpan);
    console.error(errorText);
}
  
async function starsGraphics() 
{
    const canvas = document.getElementById('stars_canvas');
    if (!canvas) {
      showError('Could not find HTML canvas element');
      return;
    }
  
    // 1) Create SSE manager (it will pick up new changes)
    const starStream = new StarStreamManager(canvas);
  
    // 2) Load existing stars that were in the DB before page load
    await fetchInitialStars();
  
    // 3) Proceed with your WebGL initialization/loop:
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        const isWebGl1Supported = !!(document.createElement('canvas')).getContext('webgl');
        if (isWebGl1Supported) {
            showError('WebGL 1 is supported, but not 2');
        } else {
            showError('WebGL is not supported on this device/browser');
        }
        return;
    }
    
    // ----- VERTEX SHADER -----
    const vertexShaderSourceCode = `#version 300 es
    precision mediump float;
    in vec2 vertexPosition;
    out vec2 position;
    void main() {
        gl_Position = vec4(vertexPosition, 0.0, 1.0);
        position = vertexPosition;
    }`;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSourceCode);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const errorMessage = gl.getShaderInfoLog(vertexShader);
      showError(`Failed to compile vertex shader: ${errorMessage}`);
      return;
    }

    // ----- FRAGMENT SHADER -----
    const fragmentShaderSourceCode = `#version 300 es
    precision mediump float;

    uniform float canvas_height_by_width;
    uniform int nb_stars;
    uniform vec2 star_positions[1000];
    uniform float current_time;
    uniform vec2 cursor_position;

    in vec2 position;
    out vec4 outputColor;
  
    void main() {
        vec2 uv_cursor_position = cursor_position * vec2(1.0, canvas_height_by_width);
        vec2 uv_position = position * vec2(1.0, canvas_height_by_width);

        float d[4];
        outputColor = vec4(0.0, 0.0, 0.0, 1.0);

        for (int i=0; i<nb_stars; i++)
        {
            vec2 uv_star_position = star_positions[i] * vec2(1.0, canvas_height_by_width);
            d[i] = distance(uv_position, uv_star_position);
            outputColor += (1.0 + 0.1*sin(10.0*current_time)) * vec4(1.0, 0.9, 0.7, 1.0) 
                / pow(500.0*d[i], 1.8);
        }

        float d_from_cursor = max(0.1, distance(uv_cursor_position, uv_position));
        outputColor.xyz /= max(0.3, pow(5.0*d_from_cursor, 1.0));
    }`;
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSourceCode);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const errorMessage = gl.getShaderInfoLog(fragmentShader);
      showError(`Failed to compile fragment shader: ${errorMessage}`);
      return;
    }

    // ----- ATTACH AND LINK PROGRAM -----
    const starsGraphicsProgram = gl.createProgram();
    gl.attachShader(starsGraphicsProgram, vertexShader);
    gl.attachShader(starsGraphicsProgram, fragmentShader);
    gl.linkProgram(starsGraphicsProgram);
    if (!gl.getProgramParameter(starsGraphicsProgram, gl.LINK_STATUS)) {
      const errorMessage = gl.getProgramInfoLog(starsGraphicsProgram);
      showError(`Failed to link GPU program: ${errorMessage}`);
      return;
    }

    // ----- DEFINE ATTRIBUTES AND UNIFORMS -----
    const backgroundQuad = [-1,1, -1,-1, 1,-1, 1,1];
    const backgroundQuadCPUBuffer = new Float32Array(backgroundQuad);
    const backgroundQuadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundQuadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backgroundQuadCPUBuffer, gl.STATIC_DRAW);

    // const starPositionsCPUBuffer = new Float32Array(starPositions);
    nb_stars = starPositions.length / 2;

    const starUniformLocation = gl.getUniformLocation(starsGraphicsProgram, "star_positions");
    const timeUniformLocation = gl.getUniformLocation(starsGraphicsProgram, "current_time");
    const starNumberUniformLocation = gl.getUniformLocation(starsGraphicsProgram, "nb_stars");
    const heightByWidthUniformLocation = gl.getUniformLocation(starsGraphicsProgram, "canvas_height_by_width");
    const cursorUniformLocation = gl.getUniformLocation(starsGraphicsProgram, "cursor_position");
    const vertexPositionAttributeLocation = gl.getAttribLocation(starsGraphicsProgram, 'vertexPosition');

    if (vertexPositionAttributeLocation < 0) {
      showError(`Failed to get attribute location for vertexPosition`);
      return;
    }
    if (starUniformLocation === null) {
      showError(`Failed to get uniform location for star_positions`);
      return;
    }
    if (timeUniformLocation === null) {
      showError(`Failed to get uniform location for current_time`);
      return;
    }

    // ----- RENDERING -----
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.clearColor(0.08, 0.08, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);

    let cursor_current_X = 0;
    let cursor_current_Y = 0;

    window.addEventListener("mousemove", (e) => {
        cursor_current_X = e.clientX;
        cursor_current_Y = e.clientY;
    });

    function render() {
        const currentTime = performance.now() / 1000;
        gl.useProgram(starsGraphicsProgram);
        gl.enableVertexAttribArray(vertexPositionAttributeLocation);
    
        gl.bindBuffer(gl.ARRAY_BUFFER, backgroundQuadBuffer);
        gl.vertexAttribPointer(
            vertexPositionAttributeLocation, 
            2, 
            gl.FLOAT, 
            false,
            2 * Float32Array.BYTES_PER_ELEMENT,
            0
        );
    
        gl.uniform1f(heightByWidthUniformLocation, canvas.clientHeight / canvas.clientWidth);
        gl.uniform2f(cursorUniformLocation, 
                     2 * cursor_current_X / canvas.clientWidth - 1, 
                     1 - 2 * cursor_current_Y / canvas.clientHeight);
        gl.uniform1f(timeUniformLocation, currentTime);
        gl.uniform1i(starNumberUniformLocation, nb_stars);
        gl.uniform2fv(starUniformLocation, starPositionsCPUBuffer); // Use the updated buffer
    
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

try {
    starsGraphics();
} catch (e) {
    showError(`Uncaught JS exception: ${e}`);
}

/***************************************************************************
 * The rest of your message code remains the same
 ***************************************************************************/
let last_check = 0;
const throttle_delay = 100;

var a_box_is_open = false;

function getMessage(event) {
    if (a_box_is_open) return;

    let now = Date.now(); 
    if (now - last_check <= throttle_delay) return;
    last_check = now;

    const canvas = document.getElementById('stars_canvas');
    let x = 2*event.clientX / canvas.clientWidth - 1;
    let y = 1 - 2*event.clientY / canvas.clientHeight;

    let message = null, message_x, message_y;
    for (var i=0; i<nb_stars; i++){
        const dx = x - starPositions[2*i];
        const dy = y - starPositions[2*i+1];
        if (dx*dx + dy*dy < 0.0003){
            message = starMessages[i];
            message_x = starPositions[2*i];
            message_y = starPositions[2*i+1];
            break;
        }
    }

    const infoElement = document.getElementById('info');
    if (!message){
        infoElement.style.animation = "0.2s smooth-disappear ease-out";
        infoElement.style.opacity = "0";
        infoElement.style.width = "10%";
        return;
    }
    infoElement.innerHTML = "<b>User</b><br><br>" + message;
    infoElement.style.backgroundColor = "#1a04167b";
    infoElement.style.top = ((1-message_y)*canvas.clientHeight/2) + "px";
    infoElement.style.left = ((message_x+1)*canvas.clientWidth/2 + 20) + "px";
    infoElement.style.width = "10%";
    infoElement.style.animation = "0.2s smooth-appear ease-in";
    infoElement.style.opacity = "1";
}

let last_clicked_x = 0;
let last_clicked_y = 0;

function clickFunction(event) {
    if (a_box_is_open) return;
    a_box_is_open = true;

    const info_box = document.getElementById('info');
    const canvas = document.getElementById('stars_canvas');

    initial_opacity = info_box.style.opacity

    info_box.style.animation = "0.2s smooth-disappear ease-out";
    info_box.style.opacity = "0";

    let x = 2*event.clientX / canvas.clientWidth - 1;
    let y = 1 - 2*event.clientY / canvas.clientHeight;
    let text = info_box.innerHTML;

    if (initial_opacity === "0") 
    {
        last_clicked_x = 2*event.clientX / canvas.clientWidth - 1;
        last_clicked_y = 1 - 2*event.clientY / canvas.clientHeight;

        info_box.innerHTML = "<b>Add a star</b><br><br>"
        info_box.innerHTML += `<input type="text" id="star_message" name="star_message" class="button message_input">`

        info_box.style.animation = "0.2s smooth-appear ease-in";
        info_box.style.opacity = "1";

        info_box.innerHTML +=  `<br><br>
                                <button id="submit_button" class="button submit_button" onclick="submitMessage(event)">
                                    Submit message
                                </button>
                                <button id="close_button" class="button close_button" onclick="closeWindow(event)">
                                    Close
                                </button>`;
    } 
    else 
    {
        info_box.style.animation = "0.2s smooth-appear ease-in";
        info_box.style.opacity = "1";

        info_box.innerHTML +=  `<br><br>
                                <button id="like_button" class="button like_button">
                                    Like
                                </button>
                                <button id="dislike_button" class="button dislike_button">
                                    Dislike
                                </button>
                                <button id="close_button" class="button close_button" onclick="closeWindow(event)">
                                    Close
                                </button>`;
    }

    info_box.style.backgroundColor = "#1a0416d7";
    info_box.style.top = "40%";
    info_box.style.left = "25%";
    info_box.style.width = "50%";
}

function closeWindow(event) {
    const info_box = document.getElementById('info');

    info_box.style.animation = "0.2s smooth-disappear ease-out";
    info_box.style.opacity = "0";
    a_box_is_open = false;

    event.stopPropagation()
}

function submitMessage(event) {
    const message_input = document.getElementById('star_message');
    let msg = message_input.value;

    createStar(last_clicked_x, last_clicked_y, msg);

    closeWindow(event)
}



////////////////////////////////////////////////////////////////////
// Mark code starts here.
// This fetches the initial stars on page load.
////////////////////////////////////////////////////////////////////

async function fetchInitialStars() {
    try {
        const resp = await fetch(`${BACKEND_URL}/stars`);
        if (!resp.ok) {
            console.error("Failed to fetch initial stars:", resp.status, await resp.text());
            return;
        }
        const stars = await resp.json(); // an array of {id, x, y, message}
        for (const s of stars) {
            starPositions.push(s.x, s.y);
            starMessages.push(s.message);
        }
        nb_stars = starPositions.length / 2;

        // Update the CPU buffer
        starPositionsCPUBuffer = new Float32Array(starPositions);

        console.log("Loaded", nb_stars, "stars initially");
    } catch (err) {
        console.error("Error fetching initial stars:", err);
    }
}



// Debug buttons to add/remove stars.

/***********************************************************************
 * 1) Create a random star at random X/Y
 ***********************************************************************/
function addRandomStar() {
    const rx = (Math.random() * 2 - 1).toFixed(2);  // random in [-1, 1]
    const ry = (Math.random() * 2 - 1).toFixed(2);
    // Message with star ID
    const msg = `Random star! Random number: ${Math.floor(Math.random() * 1000)}`;
    createStar(Number(rx), Number(ry), msg);
}

/***********************************************************************
 * 2) Remove a star by ID (we'll show a prompt for testing)
 ***********************************************************************/
function removeStarByIDPrompt() {
    const idStr = prompt("Enter the star ID to remove:");
    if (!idStr) return;
    const starID = parseInt(idStr, 10);
    if (!Number.isFinite(starID)) {
        console.error("Invalid ID:", idStr);
        return;
    }
    removeStarByID(starID);
}

/***********************************************************************
 * 3) Actually call the backend to remove a star by ID
 ***********************************************************************/
async function removeStarByID(starId) {
    try {
        const resp = await fetch(`${BACKEND_URL}/stars/${starId}`, {
            method: "DELETE"
        });
        if (!resp.ok) {
            console.error("Failed to remove star ID=" + starId, resp.status, await resp.text());
        } else {
            const removed = await resp.json();
            console.log("Removed star:", removed);
        }
    } catch (e) {
        console.error("Error removing star ID=" + starId, e);
    }
}

/***********************************************************************
 * 4) Clear all stars # NB!!! This is dangerous. Only for admins TODO
 ***********************************************************************/
async function removeAllStars() {
    try {
        const resp = await fetch(`${BACKEND_URL}/stars`, {
            method: "DELETE"
        });
        if (!resp.ok) {
            console.error("Failed to clear all stars:", resp.status, await resp.text());
            return;
        }

        // Clear frontend state
        starPositions.length = 0;
        starMessages.length = 0;
        nb_stars = 0;

        // Update the CPU buffer
        starPositionsCPUBuffer = new Float32Array(starPositions);

        console.log("Removed all stars");
    } catch (e) {
        console.error("Error clearing all stars:", e);
    }
}

/***********************************************************************
 * Helper function to fetch star details by ID
 ***********************************************************************/
async function fetchStarDetails(starId) {
    try {
        const response = await fetch(`${BACKEND_URL}/stars/${starId}`);
        if (!response.ok) {
            console.error("Failed to fetch star details:", response.status, await response.text());
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching star details:", error);
        return null;
    }
}
