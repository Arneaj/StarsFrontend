# audio_service/app.py

from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import redis

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:pass@localhost/audio_db'
db = SQLAlchemy(app)
redis_client = redis.Redis(host='localhost', port=6379, db=0)

class AudioEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(50))  # 'star_place', 'background_music'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.String(50))
    metadata = db.Column(db.JSON)

@app.route('/api/audio/star/trigger', methods=['POST'])
def trigger_star_sound():
    user_id = request.json.get('user_id')
    star_id = request.json.get('star_id')
    
    # Rate limiting using Redis
    key = f"star_sound:{user_id}"
    if redis_client.exists(key):
        return jsonify({'error': 'Rate limit exceeded'}), 429
    
    redis_client.setex(key, 1, 'true')  # 1 second cooldown
    
    # Log the event
    event = AudioEvent(
        event_type='star_place',
        user_id=user_id,
        metadata={'star_id': star_id}
    )
    db.session.add(event)
    db.session.commit()
    
    return jsonify({
        'effect_url': '/static/sounds/star-twinkle.mp3',
        'volume': 0.7
    })

@app.route('/api/audio/music/current', methods=['GET'])
def get_current_music():
    # Fetch current track from Spotify API
    return jsonify({
        'track_id': 'spotify:track:xxx',
        'volume': 0.5
    })