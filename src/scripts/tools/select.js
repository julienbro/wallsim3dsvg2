class Select {
    constructor() {
        this.selectedShape = null;
    }

    selectShape(shape) {
        this.selectedShape = shape;
        // Additional logic to highlight the selected shape
    }

    moveShape(newPosition) {
        if (this.selectedShape) {
            this.selectedShape.position = newPosition;
            // Additional logic to update the canvas
        }
    }

    deselectShape() {
        this.selectedShape = null;
        // Additional logic to remove highlight from the shape
    }
}

export default Select;