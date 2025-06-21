class Rectangle {
    constructor() {
        this.startPoint = null;
        this.endPoint = null;
    }

    startDrawing(x, y) {
        this.startPoint = { x, y };
    }

    finishDrawing(x, y) {
        this.endPoint = { x, y };
        // Logic to draw the rectangle on the canvas would go here
    }

    getRectangle() {
        if (this.startPoint && this.endPoint) {
            return {
                x: Math.min(this.startPoint.x, this.endPoint.x),
                y: Math.min(this.startPoint.y, this.endPoint.y),
                width: Math.abs(this.startPoint.x - this.endPoint.x),
                height: Math.abs(this.startPoint.y - this.endPoint.y)
            };
        }
        return null;
    }
}

export default Rectangle;