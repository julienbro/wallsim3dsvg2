function createMenu() {
    const menu = document.createElement('div');
    menu.classList.add('menu');

    const fileMenu = document.createElement('div');
    fileMenu.classList.add('menu-item');
    fileMenu.textContent = 'File';
    menu.appendChild(fileMenu);

    const editMenu = document.createElement('div');
    editMenu.classList.add('menu-item');
    editMenu.textContent = 'Edit';
    menu.appendChild(editMenu);

    const viewMenu = document.createElement('div');
    viewMenu.classList.add('menu-item');
    viewMenu.textContent = 'View';
    menu.appendChild(viewMenu);

    const helpMenu = document.createElement('div');
    helpMenu.classList.add('menu-item');
    helpMenu.textContent = 'Help';
    menu.appendChild(helpMenu);

    document.body.appendChild(menu);
}

export { createMenu };