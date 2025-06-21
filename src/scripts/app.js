// This file initializes the application, sets up event listeners, and manages the overall application state.

import { Renderer } from './canvas/renderer.js';
import { Viewport } from './canvas/viewport.js';
import { createToolbar } from './ui/toolbar.js';
import { createMenu } from './ui/menu.js';
import { updateProperties } from './ui/properties.js';

const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);
const viewport = new Viewport(canvas);

function init() {
    createToolbar();
    createMenu();
    setupEventListeners();
}

function setupEventListeners() {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
}

function onMouseDown(event) {
    // Handle mouse down event
}

function onMouseMove(event) {
    // Handle mouse move event
}

function onMouseUp(event) {
    // Handle mouse up event
}

init();