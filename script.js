class HandGestureDrawing {
    constructor() {
        this.videoElement = document.getElementById('input_video');
        this.handCanvas = document.getElementById('hand_canvas');
        this.handCtx = this.handCanvas.getContext('2d');
        this.drawingCanvas = document.getElementById('drawing_canvas');
        this.drawingCtx = this.drawingCanvas.getContext('2d');
        
        this.isDrawing = false;
        this.isErasing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.currentMode = 'drawing';
        this.hands = null;
        this.camera = null;
        
        this.brushSize = 10;
        this.brushColor = '#ff0000';
        
        this.init();
    }
    
    async init() {
        // Set canvas dimensions
        this.setupCanvases();
        
        // Setup UI controls
        this.setupControls();
        
        // Initialize MediaPipe Hands
        await this.setupHandTracking();
        
        // Start camera
        this.startCamera();
        
        // Setup drawing canvas
        this.setupDrawingCanvas();
        
        this.updateStatus('Ready! Make ✌️ peace sign to start drawing');
    }
    
    setupCanvases() {
        // Hand tracking canvas
        this.handCanvas.width = 640;
        this.handCanvas.height = 480;
        
        // Drawing canvas
        this.drawingCanvas.width = 800;
        this.drawingCanvas.height = 600;
        
        // Clear drawing canvas
        this.clearDrawingCanvas();
    }
    
    setupControls() {
        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearDrawingCanvas();
        });
        
        // Toggle camera
        document.getElementById('toggleCamera').addEventListener('click', () => {
            if (this.camera) {
                this.camera.stop();
                this.camera = null;
                this.updateStatus('Camera stopped');
            } else {
                this.startCamera();
            }
        });
        
        // Brush size
        const brushSizeInput = document.getElementById('brushSize');
        const brushSizeValue = document.getElementById('brushSizeValue');
        
        brushSizeInput.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            brushSizeValue.textContent = this.brushSize;
        });
        
        // Color picker
        const colorPicker = document.getElementById('colorPicker');
        colorPicker.addEventListener('input', (e) => {
            this.brushColor = e.target.value;
        });
    }
    
    async setupHandTracking() {
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.hands.onResults((results) => this.onHandResults(results));
    }
    
    startCamera() {
        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.hands.send({image: this.videoElement});
            },
            width: 640,
            height: 480
        });
        this.camera.start();
        this.updateStatus('Camera started');
    }
    
    setupDrawingCanvas() {
        // Setup event listeners for manual drawing (optional)
        this.drawingCanvas.addEventListener('mousedown', (e) => this.startManualDraw(e));
        this.drawingCanvas.addEventListener('mousemove', (e) => this.manualDraw(e));
        this.drawingCanvas.addEventListener('mouseup', () => this.stopManualDraw());
        this.drawingCanvas.addEventListener('mouseout', () => this.stopManualDraw());
    }
    
    onHandResults(results) {
        // Clear hand canvas
        this.handCtx.save();
        this.handCtx.clearRect(0, 0, this.handCanvas.width, this.handCanvas.height);
        this.handCtx.drawImage(results.image, 0, 0, this.handCanvas.width, this.handCanvas.height);
        
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                // Draw hand landmarks
                drawConnectors(this.handCtx, landmarks, HAND_CONNECTIONS, {
                    color: '#00FF00',
                    lineWidth: 2
                });
                drawLandmarks(this.handCtx, landmarks, {
                    color: '#FF0000',
                    lineWidth: 1
                });
                
                // Process hand gestures
                this.processHandGesture(landmarks);
            }
        }
        
        this.handCtx.restore();
    }
    
    processHandGesture(landmarks) {
        const fingersUp = this.getFingersUp(landmarks);
        const handCenter = this.getHandCenter(landmarks);
        
        // Map coordinates from hand canvas to drawing canvas
        const drawingX = (handCenter.x / this.handCanvas.width) * this.drawingCanvas.width;
        const drawingY = (handCenter.y / this.handCanvas.height) * this.drawingCanvas.height;
        
        // Gesture recognition
        if (this.isPeaceSign(fingersUp)) {
            // Peace sign ✌️ - Drawing mode
            this.setMode('drawing');
            this.drawAtPosition(drawingX, drawingY);
        } else if (this.isFist(fingersUp)) {
            // Fist ✊ - Erasing mode
            this.setMode('erasing');
            this.eraseAtPosition(drawingX, drawingY);
        } else if (this.isThumbsUp(fingersUp)) {
            // Thumbs up 👍 - Clear canvas
            this.clearDrawingCanvas();
            this.setMode('inactive');
        } else if (this.isOpenPalm(fingersUp)) {
            // Open palm ✋ - Stop drawing/erasing
            this.stopDrawing();
            this.setMode('inactive');
        } else if (this.isPointing(fingersUp)) {
            // Pointing 👆 - Draw single point
            this.setMode('drawing');
            this.drawPoint(drawingX, drawingY);
        } else {
            this.stopDrawing();
        }
        
        // Update last position for continuous drawing
        this.lastX = drawingX;
        this.lastY = drawingY;
    }
    
    getFingersUp(landmarks) {
        const fingerTips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
        const fingerPips = [6, 10, 14, 18]; // PIP joints
        
        const fingers = [];
        
        // Thumb (special case)
        fingers.push(landmarks[4].y < landmarks[3].y);
        
        // Other fingers
        for (let i = 0; i < 4; i++) {
            fingers.push(landmarks[fingerTips[i]].y < landmarks[fingerPips[i]].y);
        }
        
        return fingers;
    }
    
    getHandCenter(landmarks) {
        // Calculate center of hand (using palm landmarks)
        const palmPoints = [0, 1, 5, 9, 13, 17];
        let sumX = 0, sumY = 0;
        
        palmPoints.forEach(index => {
            sumX += landmarks[index].x * this.handCanvas.width;
            sumY += landmarks[index].y * this.handCanvas.height;
        });
        
        return {
            x: sumX / palmPoints.length,
            y: sumY / palmPoints.length
        };
    }
    
    isPeaceSign(fingers) {
        // Index and middle finger up, others down
        return fingers[1] && fingers[2] && !fingers[3] && !fingers[4];
    }
    
    isFist(fingers) {
        // All fingers down
        return !fingers[0] && !fingers[1] && !fingers[2] && !fingers[3] && !fingers[4];
    }
    
    isThumbsUp(fingers) {
        // Only thumb up
        return fingers[0] && !fingers[1] && !fingers[2] && !fingers[3] && !fingers[4];
    }
    
    isOpenPalm(fingers) {
        // All fingers up
        return fingers[0] && fingers[1] && fingers[2] && fingers[3] && fingers[4];
    }
    
    isPointing(fingers) {
        // Only index finger up
        return !fingers[0] && fingers[1] && !fingers[2] && !fingers[3] && !fingers[4];
    }
    
    setMode(mode) {
        if (this.currentMode !== mode) {
            this.currentMode = mode;
            const modeElement = document.getElementById('currentMode');
            modeElement.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
            modeElement.className = `mode ${mode}`;
        }
    }
    
    startDrawing(x, y) {
        this.isDrawing = true;
        [this.lastX, this.lastY] = [x, y];
    }
    
    stopDrawing() {
        this.isDrawing = false;
        this.isErasing = false;
    }
    
    drawAtPosition(x, y) {
        if (!this.isDrawing) {
            this.startDrawing(x, y);
            return;
        }
        
        this.drawingCtx.lineWidth = this.brushSize;
        this.drawingCtx.lineCap = 'round';
        this.drawingCtx.strokeStyle = this.brushColor;
        
        this.drawingCtx.beginPath();
        this.drawingCtx.moveTo(this.lastX, this.lastY);
        this.drawingCtx.lineTo(x, y);
        this.drawingCtx.stroke();
        
        [this.lastX, this.lastY] = [x, y];
    }
    
    eraseAtPosition(x, y) {
        if (!this.isErasing) {
            this.isErasing = true;
            [this.lastX, this.lastY] = [x, y];
            return;
        }
        
        this.drawingCtx.lineWidth = this.brushSize * 2;
        this.drawingCtx.lineCap = 'round';
        this.drawingCtx.strokeStyle = '#FFFFFF';
        
        this.drawingCtx.beginPath();
        this.drawingCtx.moveTo(this.lastX, this.lastY);
        this.drawingCtx.lineTo(x, y);
        this.drawingCtx.stroke();
        
        [this.lastX, this.lastY] = [x, y];
    }
    
    drawPoint(x, y) {
        this.drawingCtx.beginPath();
        this.drawingCtx.arc(x, y, this.brushSize / 2, 0, Math.PI * 2);
        this.drawingCtx.fillStyle = this.brushColor;
        this.drawingCtx.fill();
    }
    
    clearDrawingCanvas() {
        this.drawingCtx.fillStyle = '#FFFFFF';
        this.drawingCtx.fillRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        this.updateStatus('Canvas cleared!');
    }
    
    // Manual drawing functions (optional mouse support)
    startManualDraw(e) {
        const rect = this.drawingCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.isDrawing = true;
        this.setMode('drawing');
        [this.lastX, this.lastY] = [x, y];
    }
    
    manualDraw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.drawingCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.drawAtPosition(x, y);
    }
    
    stopManualDraw() {
        this.isDrawing = false;
    }
    
    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
        console.log(`Status: ${message}`);
    }
}

// Initialize the application when page loads
window.addEventListener('DOMContentLoaded', () => {
    const app = new HandGestureDrawing();
});