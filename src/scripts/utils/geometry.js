export function calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function calculateArea(shape) {
    switch (shape.type) {
        case 'rectangle':
            return shape.width * shape.height;
        case 'circle':
            return Math.PI * Math.pow(shape.radius, 2);
        case 'triangle':
            const { base, height } = shape;
            return (base * height) / 2;
        default:
            return 0;
    }
}