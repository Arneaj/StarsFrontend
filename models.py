# File to define the data structures

from pydantic import BaseModel

class Star(BaseModel):
    id: int
    x: float
    y: float
    message: str

class StarUpdate(BaseModel):
    event: str  # Either "add" or "remove"
    star: Star
