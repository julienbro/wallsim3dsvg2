function updateProperties(selectedShape) {
    const propertiesPanel = document.getElementById('properties-panel');
    
    if (!selectedShape) {
        propertiesPanel.innerHTML = 'No shape selected';
        return;
    }

    propertiesPanel.innerHTML = `
        <h3>Shape Properties</h3>
        <p>Type: ${selectedShape.type}</p>
        <p>Width: ${selectedShape.width || 'N/A'}</p>
        <p>Height: ${selectedShape.height || 'N/A'}</p>
        <p>X: ${selectedShape.x}</p>
        <p>Y: ${selectedShape.y}</p>
        <p>Color: ${selectedShape.color}</p>
    `;
}

export { updateProperties };