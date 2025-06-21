class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        this.shapes = [];
    }

    renderShapes() {
        this.clearCanvas();
        this.shapes.forEach(shape => {
            shape.draw(this.context);
        });
    }

    clearCanvas() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    addShape(shape) {
        this.shapes.push(shape);
        this.renderShapes();
    }

    removeShape(shape) {
        this.shapes = this.shapes.filter(s => s !== shape);
        this.renderShapes();
    }
}

export default Renderer;