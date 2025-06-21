class Viewport {
    constructor(canvas, width, height) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        this.width = width;
        this.height = height;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    zoomIn(factor = 1.1) {
        this.scale *= factor;
        this.update();
    }

    zoomOut(factor = 1.1) {
        this.scale /= factor;
        this.update();
    }

    pan(dx, dy) {
        this.offsetX += dx;
        this.offsetY += dy;
        this.update();
    }

    update() {
        this.context.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Additional rendering logic can be added here
    }
}

export default Viewport;