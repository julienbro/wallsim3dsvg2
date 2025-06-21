function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    const tools = [
        { name: 'Line', icon: 'line-icon.png' },
        { name: 'Circle', icon: 'circle-icon.png' },
        { name: 'Rectangle', icon: 'rectangle-icon.png' },
        { name: 'Select', icon: 'select-icon.png' }
    ];

    tools.forEach(tool => {
        const button = document.createElement('button');
        button.className = 'tool-button';
        button.innerHTML = `<img src="assets/icons/${tool.icon}" alt="${tool.name} Tool">`;
        button.title = tool.name;

        button.addEventListener('click', () => {
            // Logic to select the tool
            console.log(`${tool.name} tool selected`);
        });

        toolbar.appendChild(button);
    });

    document.body.appendChild(toolbar);
}

export { createToolbar };