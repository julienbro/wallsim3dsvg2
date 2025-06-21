class Circle {
    constructor() {
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.radius = 0;
    }

    startDrawing(x, y) {
        this.isDrawing = true;
        this.startX = x;
        this.startY = y;
    }

    updateRadius(x, y) {
        if (this.isDrawing) {
            this.radius = Math.sqrt(Math.pow(x - this.startX, 2) + Math.pow(y - this.startY, 2));
        }
    }

    finishDrawing() {
        this.isDrawing = false;
        const circleData = {
            x: this.startX,
            y: this.startY,
            radius: this.radius
        };
        this.reset();
        return circleData;
    }

    reset() {
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.radius = 0;
    }
}

export default Circle;