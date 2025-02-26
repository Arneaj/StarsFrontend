// SSE.js

class StarStreamManager {
    constructor(canvas, fetchStarDetails, addHandler, removeHandler, backendUrl, reconnectionTimeout) {
        this.canvas = canvas;
        this.fetchStarDetails = fetchStarDetails;
        this.addHandler = addHandler;
        this.removeHandler = removeHandler;
        this.BACKEND_URL = backendUrl;
        this.RECONNECTION_TIMEOUT = reconnectionTimeout;
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

        this.eventSource = new EventSource(`${this.BACKEND_URL}/stars/stream`);

        this.eventSource.onmessage = async (event) => {
            try {
                const dataStr = event.data.replace(/'/g, '"');
                const starUpdate = JSON.parse(dataStr);
                await this.handleStarUpdate(starUpdate);
            } catch (error) {
                console.error('Error processing star update:', error, event.data);
            }
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            this.eventSource.close();
            setTimeout(() => this.setupSSE(), this.RECONNECTION_TIMEOUT);
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
            const bounds = this.getViewport();
            if (x >= bounds.left && x <= bounds.right && y >= bounds.bottom && y <= bounds.top) {
                const fullStar = await this.fetchStarDetails(id);
                if (fullStar && this.addHandler) {
                    this.addHandler(fullStar);
                }
            }
        } else if (starUpdate.event === 'remove') {
            if (this.removeHandler) {
                this.removeHandler(starUpdate.star);
            }
        } else {
            console.warn('Unknown star update event:', starUpdate.event);
        }
    }
}