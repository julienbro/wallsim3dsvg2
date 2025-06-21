class Line {
    constructor() {
        this.startPoint = null;
        this.endPoint = null;
    }

    startDrawing(x, y) {
        this.startPoint = { x, y };
    }

    finishDrawing(x, y) {
        this.endPoint = { x, y };
        this.draw();
    }

    draw() {
        if (this.startPoint && this.endPoint) {
            const ctx = this.getContext();
            ctx.beginPath();
            ctx.moveTo(this.startPoint.x, this.startPoint.y);
            ctx.lineTo(this.endPoint.x, this.endPoint.y);
            ctx.stroke();
        }
    }

    getContext() {
        const canvas = document.getElementById('canvas'); // Assuming there's a canvas element with id 'canvas'
        return canvas.getContext('2d');
    }
}

export default Line;