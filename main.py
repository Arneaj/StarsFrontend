# FastAPI server

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import asyncio
import json

from models import StarUpdate
from database import get_stars_in_viewport, star_event_queue

app = FastAPI()

# Mount the static directory so our HTML/JS files are served
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def root():
    # Serve the main page
    return FileResponse("static/index.html")


@app.get("/login", response_class=HTMLResponse)
async def login():
    # For demonstration purposes, the login simply returns the same page.
    return FileResponse("static/index.html")


@app.get("/stars", response_class=HTMLResponse)
async def get_stars(viewport: str = None):
    """
    Given a viewport in the format "x_min,x_max,y_min,y_max", return the stars
    that lie within that region.
    """
    if not viewport:
        raise HTTPException(status_code=400, detail="Viewport parameter is required")
    try:
        x_min, x_max, y_min, y_max = map(float, viewport.split(","))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid viewport format. Expected: x_min,x_max,y_min,y_max",
        )
    stars = get_stars_in_viewport(x_min, x_max, y_min, y_max)
    # Return as JSON (the client can then update the display if needed)
    return json.dumps([star.dict() for star in stars])


@app.get("/stars/stream")
async def stream_stars(request: Request, viewport: str = None):
    """
    SSE endpoint. The client must supply a viewport parameter so that the server
    only pushes events relevant to that region.
    """
    if not viewport:
        raise HTTPException(status_code=400, detail="Viewport parameter is required")
    try:
        x_min, x_max, y_min, y_max = map(float, viewport.split(","))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid viewport format. Expected: x_min,x_max,y_min,y_max",
        )

    async def event_generator():
        # The generator yields events in SSE format.
        while True:
            # If the client disconnects, stop the generator.
            if await request.is_disconnected():
                break
            try:
                # Wait for a new star update event from the async queue.
                event: StarUpdate = await asyncio.wait_for(star_event_queue.get(), timeout=15.0)
            except asyncio.TimeoutError:
                # Timeout every 15 seconds to send a keep-alive comment.
                yield ":\n\n"
            else:
                # Only send the event if the star’s position falls in the viewport.
                if x_min <= event.star.x <= x_max and y_min <= event.star.y <= y_max:
                    data = event.json()
                    yield f"data: {data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    # Run the application using uvicorn.
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
