import { WebCAD } from './core/WebCAD.js';
import { addRectangleDeleteMethods } from './managers/UIManager.js';

document.addEventListener('DOMContentLoaded', () => {
    const app = new WebCAD();
    
    // Ajouter les méthodes de suppression de rectangle
    addRectangleDeleteMethods(app);
    
    // S'assurer que l'app est globalement accessible pour le débogage
    window.app = app;
});
