const starPositions = [];
const starMessages = [];
var nb_stars;


/** Helper method to output an error message to the screen */
function showError(errorText) 
{
    const errorBoxDiv = document.getElementById('error-box');
    const errorSpan = document.createElement('p');
    errorSpan.innerText = errorText;
    errorBoxDiv.appendChild(errorSpan);
    console.error(errorText);
}
  

function helloTriangle() 
{
    /** @type {HTMLCanvasElement|null} */
    const canvas = document.getElementById('stars_canvas');
    if (!canvas) {
        showError('Could not find HTML canvas element - check for typos, or loading JavaScript file too early');
        return;
    }
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        const isWebGl1Supported = !!(document.createElement('canvas')).getContext('webgl');
        if (isWebGl1Supported) {
            showError('WebGL 1 is supported, but not v2 - try using a different device or browser');
        } else {
            showError('WebGL is not supported on this device - try using a different device or browser');
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
    }
    `;
  
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
            outputColor += (1.0 + 0.1*sin(10.0*current_time)) * vec4(1.0, 0.9, 0.7, 1.0) / pow(1000.0*d[i], 1.8);
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
  
    const helloTriangleProgram = gl.createProgram();
    gl.attachShader(helloTriangleProgram, vertexShader);
    gl.attachShader(helloTriangleProgram, fragmentShader);
    gl.linkProgram(helloTriangleProgram);
    if (!gl.getProgramParameter(helloTriangleProgram, gl.LINK_STATUS)) {
      const errorMessage = gl.getProgramInfoLog(helloTriangleProgram);
      showError(`Failed to link GPU program: ${errorMessage}`);
      return;
    }

    // ----- DEFINE ATTRIBUTES AND UNIFORMS -----

    // Background
    const backgroundQuad = [
        // Top left
        -1.0, 1.0,
        // Bottom left
        -1.0, -1.0,
        // Bottom right
        1.0, -1.0,
        // Top right
        1.0, 1.0
    ];
    const backgroundQuadCPUBuffer = new Float32Array(backgroundQuad);

    const backgroundQuadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundQuadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backgroundQuadCPUBuffer, gl.STATIC_DRAW);

    // Stars
    /*
    const starPositions = [
        0.5, 0.5, 0.0,
        -0.3, 0.0, 0.0,
        0.0, -0.7, 0.0,
        0.4, 0.3, 0.0
    ];
    */

    for (var i=0; i<300; i++)
    {
        starPositions.push(2*Math.random()-1.0);

        if (i%2==0) starMessages.push("Hello there, I'm star " + i/2 + "!");
    }

    const starPositionsCPUBuffer = new Float32Array(starPositions);

    nb_stars = starPositions.length / 2;

    // ----- FIND ATTRIBUTE AND UNIFORM LOCATIONS FOR FUTURE MODIFICATION -----

    const starUniformLocation = gl.getUniformLocation(helloTriangleProgram, "star_positions");
    const timeUniformLocation = gl.getUniformLocation(helloTriangleProgram, "current_time");
    const starNumberUniformLocation = gl.getUniformLocation(helloTriangleProgram, "nb_stars");

    const heightByWidthUniformLocation = gl.getUniformLocation(helloTriangleProgram, "canvas_height_by_width");

    const cursorUniformLocation = gl.getUniformLocation(helloTriangleProgram, "cursor_position");

    const vertexPositionAttributeLocation = gl.getAttribLocation(helloTriangleProgram, 'vertexPosition');


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
  
    // Output merger (how to apply an updated pixel to the output image)
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.clearColor(0.08, 0.08, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
    // Rasterizer (which output pixels are covered by a triangle?)
    gl.viewport(0, 0, canvas.width, canvas.height);

    let cursor_current_X = 0;
    let cursor_current_Y = 0;

    window.addEventListener("mousemove", (e) => {
        cursor_current_X = e.clientX;
        cursor_current_Y = e.clientY;
    })

    function render() {
        // Get the current time in seconds
        const currentTime = performance.now() / 1000;
    
        // Update the uniform
        gl.useProgram(helloTriangleProgram);
        gl.enableVertexAttribArray(vertexPositionAttributeLocation);
      
        // Input assembler (how to read vertex information from buffers?)
        gl.bindBuffer(gl.ARRAY_BUFFER, backgroundQuadBuffer);
        gl.vertexAttribPointer(
            /* index: vertex attrib location */
            vertexPositionAttributeLocation,
            /* size: number of components in the attribute */
            2,
            /* type: type of data in the GPU buffer for this attribute */
            gl.FLOAT,
            /* normalized: if type=float and is writing to a vec(n) float input, should WebGL normalize the ints first? */
            false,
            /* stride: bytes between starting byte of attribute for a vertex and the same attrib for the next vertex */
            2 * Float32Array.BYTES_PER_ELEMENT,
            /* offset: bytes between the start of the buffer and the first byte of the attribute */
            0
        );

        gl.uniform1f(heightByWidthUniformLocation, canvas.clientHeight / canvas.clientWidth);

        gl.uniform2f(cursorUniformLocation, 2*cursor_current_X/canvas.clientWidth-1, 1-2*cursor_current_Y/canvas.clientHeight)
        
        gl.uniform1f(timeUniformLocation, currentTime);

        gl.uniform1i(starNumberUniformLocation, nb_stars);
        gl.uniform2fv(starUniformLocation, starPositionsCPUBuffer); 
    
        // Render your scene
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Draw call (Primitive assembly (which vertices form triangles together?))
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    
        // Request the next frame
        requestAnimationFrame(render);
    }
    
    // Start the rendering loop
    requestAnimationFrame(render);
}
  
try {
    helloTriangle();
} catch (e) {
    showError(`Uncaught JavaScript exception: ${e}`);
}

let last_check = 0;
const throttle_delay = 100; // milliseconds

function getMessage(event) 
{
    let now = Date.now(); 
    if (now - last_check <= throttle_delay) return;

    last_check = now;

    const canvas = document.getElementById('stars_canvas');

    let x = 2*event.clientX / canvas.clientWidth - 1;
    let y = 1 - 2*event.clientY / canvas.clientHeight;

    let message = null;
    let message_x;
    let message_y;

    for (var i=0; i<nb_stars; i++)
    {
        const d_i_sq = (x-starPositions[2*i])**2 + (y-starPositions[2*i+1])**2

        if (d_i_sq < 0.0003)
        {
            message = starMessages[i];
            message_x = starPositions[2*i];
            message_y = starPositions[2*i+1];
            break;
        }
    }

    const infoElement = document.getElementById('info');

    if (message === null)
    {
        infoElement.style.animation = "0.2s smooth-disappear ease-out";
        infoElement.style.opacity = "0";
        return;
    }
    
    infoElement.innerHTML = "<b>User</b><br><br>" + message;
    infoElement.style.top = ((1-message_y)*canvas.clientHeight/2) + "px";
    infoElement.style.left = ((message_x+1)*canvas.clientWidth/2 + 20) + "px";

    infoElement.style.animation = "0.2s smooth-appear ease-in";
    infoElement.style.opacity = "1";
}

function clickFunction(event)
{
    const info_box = document.getElementById('info');
    const canvas = document.getElementById('stars_canvas');

    let x = 2*event.clientX / canvas.clientWidth - 1;
    let y = 1 - 2*event.clientY / canvas.clientHeight;

    if (info_box.style.opacity === "0") return;
}