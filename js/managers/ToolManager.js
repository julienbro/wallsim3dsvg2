export class ToolManager {
    constructor(app) {
        this.app = app;
        // Ne pas configurer les outils immédiatement car le DOM n'est pas encore prêt
        // L'UIManager s'occupera de la configuration des outils
    }
    
    setupTools() {
        // Cette méthode est maintenant gérée par UIManager
        // Pour éviter les conflits, on la laisse vide ou on vérifie l'existence des éléments
        
        // Vérification sécurisée des éléments avant ajout des gestionnaires
        const elements = [
            'line-tool', 'rect-tool', 'circle-tool', 'arc-tool', 'polyline-tool',
            'box-tool', 'sphere-tool', 'cylinder-tool',
            'select-tool', 'extrude-tool', 'move-tool', 'rotate-tool', 'scale-tool'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                // L'élément existe, le gestionnaire sera ajouté par UIManager
                console.log(`Élément ${id} trouvé`);
            }
        });
    }
    
    setTool(tool) {
        // Annuler le dessin en cours si on change d'outil
        // Deactivate current tool if it's one of the new system tools
        if (this.app.drawingManager) {
            if (this.app.drawingManager.lineTool && this.app.drawingManager.lineTool.active) {
                this.app.drawingManager.lineTool.deactivate();
            }
            if (this.app.drawingManager.rectangleTool && this.app.drawingManager.rectangleTool.active) {
                this.app.drawingManager.rectangleTool.deactivate();
            }
            if (this.app.drawingManager.circleTool && this.app.drawingManager.circleTool.active) {
                this.app.drawingManager.circleTool.deactivate();
            }
            if (this.app.drawingManager.parallelTool && this.app.drawingManager.parallelTool.active) {
                this.app.drawingManager.parallelTool.deactivate();
            }
            if (this.app.drawingManager.trimTool && this.app.drawingManager.trimTool.active) {
                this.app.drawingManager.trimTool.deactivate();
            }
            if (this.app.drawingManager.extendTool && this.app.drawingManager.extendTool.active) {
                this.app.drawingManager.extendTool.deactivate();
            }
            if (this.app.drawingManager.hatchTool && this.app.drawingManager.hatchTool.active) {
                this.app.drawingManager.hatchTool.deactivate();
            }            // If DrawingManager's generic isDrawing is true (e.g. for polyline)
            // Mais ne pas annuler si on réactive le même outil de dessin
            if (this.app.drawingManager.isDrawing && this.app.drawingManager.drawingMode !== tool) {
                 this.app.drawingManager.cancelDrawing(); // This will call endDrawing
                 console.log('🔄 ToolManager: Annulation du mode dessin précédent:', this.app.drawingManager.drawingMode, '-> nouveau:', tool);
            } else if (this.app.drawingManager.isDrawing && this.app.drawingManager.drawingMode === tool) {
                 console.log('🔄 ToolManager: Même outil dessin, pas d\'annulation:', tool);
            }
        }
        if (this.app.extrusionManager && this.app.extrusionManager.isExtruding) {
            this.app.extrusionManager.cancelExtrusion();
        }
        
        // S'assurer que le menu contextuel est caché
        if (this.app.drawingManager && this.app.drawingManager.contextMenu) {
            this.app.drawingManager.hideContextMenu();
        }
          this.app.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        
        // Gérer le curseur d'extrusion
        this.updateCursorForTool(tool);
        
        const sidebarBtn = document.getElementById(`sidebar-${tool}`);
        if (sidebarBtn) sidebarBtn.classList.add('active');
        
        // Si on sélectionne un outil de dessin, démarrer le mode correspondant
        if (['line', 'rect', 'circle', 'polyline', 'arc', 'parallel', 'trim', 'extend', 'hatch', 'surface', 'dimension'].includes(tool)) {
            this.app.drawingManager.startDrawing(tool);
        } else if (tool === 'select') {
            // Le tool 'select' pourrait ne pas nécessiter d'activation immédiate
            // this.app.drawingManager.startDrawing(tool);
        }
        
        // Command output is now mostly handled by individual tool's activate() method.
        // We can set a generic message or remove some of these.
        const cmdOutput = document.getElementById('command-output');
        if (tool === 'select') { // Select tool might not have an activate message
             cmdOutput.textContent = 'Outil Sélection activé.';
        } else if (tool === 'extrude') { // Extrude tool might also manage its own messages
             cmdOutput.textContent = 'Cliquez sur une surface à extruder';
        }
        // For other tools, their activate() method should set the initial message.
        // If not, a generic message can be set here:
        // else {
        //    cmdOutput.textContent = `Outil ${tool} activé.`;
        // }
    }
    
    setTransformMode(mode) {
        this.app.currentTool = 'select';
        this.app.transformControls.setMode(mode);
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${mode === 'translate' ? 'move' : mode}-tool`).classList.add('active');
    }
    
    updateActiveTool(toolName) {
        this.setTool(toolName);
        // Update UI if needed
        if (this.webCad.uiManager) {
            this.webCad.uiManager.updateToolUI(toolName);
        }
    }
    
    updateCursorForTool(tool) {
        // Supprimer tous les curseurs personnalisés précédents
        document.body.classList.remove('extrusion-active');
        if (this.app.renderer && this.app.renderer.domElement) {
            this.app.renderer.domElement.classList.remove('extrusion-cursor');
        }
        
        // Activer le curseur d'extrusion si l'outil est sélectionné
        if (tool === 'extrude') {
            document.body.classList.add('extrusion-active');
            if (this.app.renderer && this.app.renderer.domElement) {
                this.app.renderer.domElement.classList.add('extrusion-cursor');
            }
        }
    }
}
