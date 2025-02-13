# File to handle data storage and updates

import asyncio
from typing import List, Optional
from models import Star, StarUpdate

# In‑memory “database” of stars.
stars_db: List[Star] = []
next_id = 1

# Async queue for star update events.
star_event_queue: asyncio.Queue = asyncio.Queue()


def get_stars_in_viewport(x_min: float, x_max: float, y_min: float, y_max: float) -> List[Star]:
    # This will be done in the db later, come back and change/mock
    return [star for star in stars_db if x_min <= star.x <= x_max and y_min <= star.y <= y_max]


def add_star(x: float, y: float, message: str) -> Star:
    global next_id
    star = Star(id=next_id, x=x, y=y, message=message)
    next_id += 1
    stars_db.append(star)
    update = StarUpdate(event="add", star=star)
    # Enqueue the update event (create a background task for the async queue)
    asyncio.create_task(star_event_queue.put(update))
    return star


def remove_star(star_id: int) -> Optional[Star]:
    # Using list comprehension for efficiency
    star_to_remove = next((star for star in stars_db if star.id == star_id), None)

    if star_to_remove:
        stars_db.remove(star_to_remove)
        # stars_db = [star for star in stars_db if star.id != star_id]
        update = StarUpdate(event="remove", star=star_to_remove)
        asyncio.create_task(star_event_queue.put(update))
        return star_to_remove
    return None


# For demonstration, this will pre-populate the database with some stars
if not stars_db:
    import random
    for i in range(150):
        x = 2 * random.random() - 1  # random x coordinate between -1 and 1
        y = 2 * random.random() - 1  # random y coordinate between -1 and 1
        message = f"Hello there, I'm star {i}!"
        add_star(x, y, message)
