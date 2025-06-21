import * as THREE from 'three';

export class RectangleTool {    constructor(app) {
        this.app = app;
        this.active = false;
        this.startPoint = null;
        this.previewRect = null;
        this.snapHelpers = [];
        this.shiftPressed = false;
        this.tooltip = null;
        this.angleSnap = true;
        this.angleSnapIncrement = 15; // Snap aux angles 15°
        
        // Créer l'info-bulle
        this.createTooltip();
        
        // Écouter les événements clavier pour Shift
        this.keyDownHandler = this.handleKeyDown.bind(this);
        this.keyUpHandler = this.handleKeyUp.bind(this);
        
        // Écouter les événements de clic droit
        this.contextMenuHandler = this.handleContextMenu.bind(this);
    }    activate() {
        this.active = true;
        this.startPoint = null;
        this.clearPreview();
        this.clearSnapHelpers();
        document.getElementById('command-output').textContent = 'Rectangle : Cliquez pour définir le premier coin (clic droit pour saisir les dimensions)';
        this.app.controls.enabled = false; // Disable orbit controls
        
        // Ajouter les écouteurs d'événements clavier
        document.addEventListener('keydown', this.keyDownHandler);
        document.addEventListener('keyup', this.keyUpHandler);
        
        // Ajouter l'écouteur de clic droit
        this.app.renderer.domElement.addEventListener('contextmenu', this.contextMenuHandler);
        
        // console.log("RectangleTool: Activated");
    }    deactivate() {
        this.active = false;
        this.clearPreview();
        this.clearSnapHelpers();
        this.hideTooltip();
        this.startPoint = null;
        this.app.controls.enabled = true; // Re-enable orbit controls
        
        // Retirer les écouteurs d'événements clavier
        document.removeEventListener('keydown', this.keyDownHandler);
        document.removeEventListener('keyup', this.keyUpHandler);
        
        // Retirer l'écouteur de clic droit
        this.app.renderer.domElement.removeEventListener('contextmenu', this.contextMenuHandler);
        
        // console.log("RectangleTool: Deactivated");
    }handleClick(point) {
        if (!this.active) {
            // console.log("RectangleTool.handleClick: Inactive, returning.");
            return;
        }
        if (!point) {
            // console.error("RectangleTool.handleClick: Received null point!");
            return;
        }

        // Appliquer l'accrochage
        const snappedPoint = this.app.snapManager ? 
            this.app.snapManager.checkSnapping(point, { clientX: 0, clientY: 0 }) : point;

        // console.log(`RectangleTool.handleClick: point=(${snappedPoint.x.toFixed(2)}, ${snappedPoint.y.toFixed(2)})`);

        if (!this.startPoint) {
            // First click: define the starting point
            this.startPoint = snappedPoint.clone();
            document.getElementById('command-output').textContent = 'Cliquez pour définir le coin opposé du rectangle (Shift = carré, clic droit = dimensions)';
            // console.log("RectangleTool: startPoint set to", this.startPoint);
            // Preview will be updated by handleMouseMove
        } else {
            // Second click: finalize the rectangle
            // console.log("RectangleTool: Second click, finalizing rectangle.");
            this.createRectangle(this.startPoint, snappedPoint);
            this.app.toolManager.setTool('select'); // Return to select tool
        }
    }    handleMouseMove(currentPoint, event) {
        // console.log(`RectangleTool.handleMouseMove: active=${this.active}, startPoint=${!!this.startPoint}, currentPoint=(${currentPoint?.x.toFixed(2)}, ${currentPoint?.y.toFixed(2)})`);
        if (!currentPoint) {
            // console.warn("RectangleTool.handleMouseMove: currentPoint is null or undefined.");
            return;
        }
        if (!this.active || !this.startPoint) {
            // console.log("RectangleTool.handleMouseMove: Not active or no startPoint, returning.");
            return;
        }
        
        // Appliquer l'accrochage
        let snappedPoint = this.app.snapManager ? 
            this.app.snapManager.checkSnapping(currentPoint, event || { clientX: 0, clientY: 0 }) : currentPoint;
        
        // Appliquer les contraintes selon les touches pressées
        if (this.shiftPressed) {
            // Contraindre à un carré
            snappedPoint = this.constrainToSquare(this.startPoint, snappedPoint);
        } else if (this.angleSnap) {
            // Appliquer l'accrochage angulaire
            snappedPoint = this.applyAngleSnap(this.startPoint, snappedPoint);
        }
        
        this.updatePreview(this.startPoint, snappedPoint, event);
    }    updatePreview(p1, p2, event) {
        this.clearPreview();
        this.clearSnapHelpers();
        // console.log(`RectangleTool.updatePreview: p1=(${p1?.x.toFixed(2)}, ${p1?.y.toFixed(2)}), p2=(${p2?.x.toFixed(2)}, ${p2?.y.toFixed(2)})`);

        const width = Math.abs(p2.x - p1.x) || 0.01; // Ensure non-zero for geometry
        const height = Math.abs(p2.y - p1.y) || 0.01;
        const centerX = (p1.x + p2.x) / 2;
        const centerY = (p1.y + p2.y) / 2;

        if (isNaN(width) || isNaN(height) || isNaN(centerX) || isNaN(centerY)) {
            // console.error("RectangleTool: NaN values in updatePreview calculations", {width, height, centerX, centerY});
            return;
        }
        
        // Afficher les guides d'accrochage
        this.showSnapGuides(p1, p2);
        
        // console.log(`RectangleTool: Creating preview geometry with w=${width.toFixed(2)}, h=${height.toFixed(2)} at (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`);
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Green preview
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });
        this.previewRect = new THREE.Mesh(geometry, material);
        this.previewRect.position.set(centerX, centerY, 0.05); // Slightly above workplane
        this.previewRect.name = "RECTANGLE_PREVIEW_GHOST"; // For debugging in scene graph
        
        // console.log("RectangleTool: Adding previewRect to scene", this.previewRect);
        this.app.scene.add(this.previewRect);
        
        // Afficher l'info-bulle avec les dimensions
        if (event) {
            this.showTooltip(event, width, height, p1, p2);
        }
    }    createRectangle(p1, p2) {
        this.clearPreview();
        const width = Math.abs(p2.x - p1.x);
        const height = Math.abs(p2.y - p1.y);

        if (width < 0.01 || height < 0.01) { // Prevent zero-size or too small rectangles
            document.getElementById('command-output').textContent = 'Rectangle trop petit, annulé.';
            this.cancel();
            return;
        }

        const centerX = (p1.x + p2.x) / 2;
        const centerY = (p1.y + p2.y) / 2;

        // Créer le matériau - utiliser MeshBasicMaterial pour un blanc pur
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
        });
        const geometry = new THREE.PlaneGeometry(width, height);
        const rectMesh = new THREE.Mesh(geometry, material);        rectMesh.position.set(centerX, centerY, 0.01); // On workplane
        rectMesh.castShadow = true;
        rectMesh.receiveShadow = true;
        rectMesh.userData.type = 'rectangle';
        rectMesh.userData.isSurface = true; // Marquer comme surface pour l'outil hachure

        const edges = new THREE.EdgesGeometry(geometry);
        const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
        rectMesh.add(edgeLines);

        this.app.scene.add(rectMesh);
        this.app.objects.push(rectMesh);
        if (this.app.layers && this.app.layers[this.app.currentLayer]) {
            this.app.layers[this.app.currentLayer].objects.push(rectMesh);
        }
        if (this.app.addToHistory) {
            this.app.addToHistory('create', rectMesh);
        }
        if (this.app.uiManager && this.app.uiManager.updateHistoryPanel) {
            this.app.uiManager.updateHistoryPanel();
        }
        document.getElementById('command-output').textContent = 'Rectangle créé.';
        // console.log("RectangleTool: Rectangle created.");
    }    clearPreview() {
        if (this.previewRect) {
            // console.log("RectangleTool: Clearing previewRect", this.previewRect.uuid);
            this.app.scene.remove(this.previewRect);
            if (this.previewRect.geometry) this.previewRect.geometry.dispose();
            if (this.previewRect.material) this.previewRect.material.dispose();
            this.previewRect = null;
        }
        this.hideTooltip();
    }    cancel() {
        this.hideDimensionsDialog(); // Fermer le panneau de dimensions si ouvert
        this.deactivate(); // This calls clearPreview
        document.getElementById('command-output').textContent = 'Rectangle annulé.';
        // console.log("RectangleTool: Cancelled.");
        if (this.app.toolManager) {
            this.app.toolManager.setTool('select');
        }
    }

    /**
     * Crée l'info-bulle pour afficher les dimensions
     */
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'rectangle-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            pointer-events: none;
            z-index: 1000;
            display: none;
            white-space: nowrap;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(this.tooltip);
    }

    /**
     * Affiche l'info-bulle avec les dimensions
     */
    showTooltip(event, width, height, p1, p2) {
        if (!this.tooltip || !event) return;

        const diagonal = Math.sqrt(width * width + height * height);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const normalizedAngle = ((angle % 360) + 360) % 360;

        let content = `Largeur: ${width.toFixed(2)} cm<br>Hauteur: ${height.toFixed(2)} cm<br>Diagonale: ${diagonal.toFixed(2)} cm`;
        
        if (this.shiftPressed) {
            content += '<br><span style="color: #ffa500;">Mode CARRÉ</span>';
        }
        
        // Vérifier l'alignement sur les axes
        const axisAlignment = this.checkAxisAlignment(p1, p2);
        if (axisAlignment) {
            const axisColors = { X: '#ff0000', Y: '#00ff00' };
            const axisNames = { X: 'Rouge', Y: 'Vert' };
            content += `<br><span style="color: ${axisColors[axisAlignment]};">Aligné sur l'axe ${axisNames[axisAlignment]}</span>`;
        }

        this.tooltip.innerHTML = content;
        this.tooltip.style.left = `${event.clientX + 15}px`;
        this.tooltip.style.top = `${event.clientY - 10}px`;
        this.tooltip.style.display = 'block';
    }

    /**
     * Masque l'info-bulle
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }

    /**
     * Affiche les guides d'accrochage (comme pour les polylignes)
     */
    showSnapGuides(p1, p2) {
        const guideLength = 100;

        // Guides pour les angles principaux (0°, 45°, 90°, etc.)
        for (let angle = 0; angle < 360; angle += 45) {
            const angleRad = angle * Math.PI / 180;
            const guideEnd = new THREE.Vector3(
                p1.x + guideLength * Math.cos(angleRad),
                p1.y + guideLength * Math.sin(angleRad),
                p1.z
            );

            const points = [p1, guideEnd];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            const isHorizontal = angle === 0 || angle === 180;
            const isVertical = angle === 90 || angle === 270;
            const color = isHorizontal ? 0xff0000 : isVertical ? 0x00ff00 : 0xd3d3d3;

            const material = new THREE.LineDashedMaterial({
                color: color,
                linewidth: 1,
                scale: 1,
                dashSize: 0.5,
                gapSize: 0.5,
                opacity: 0.7,
                transparent: true
            });

            const guideLine = new THREE.Line(geometry, material);
            guideLine.computeLineDistances();
            guideLine.renderOrder = 998;

            this.app.scene.add(guideLine);
            this.snapHelpers.push(guideLine);
        }
    }

    /**
     * Efface les guides d'accrochage
     */
    clearSnapHelpers() {
        this.snapHelpers.forEach(helper => {
            this.app.scene.remove(helper);
            if (helper.geometry) helper.geometry.dispose();
            if (helper.material) helper.material.dispose();
        });
        this.snapHelpers = [];
    }

    /**
     * Contraint le rectangle à un carré (mode Shift)
     */
    constrainToSquare(startPoint, currentPoint) {
        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        
        // Utiliser la plus grande dimension pour créer un carré
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        
        return new THREE.Vector3(
            startPoint.x + (dx >= 0 ? size : -size),
            startPoint.y + (dy >= 0 ? size : -size),
            currentPoint.z
        );
    }

    /**
     * Applique l'accrochage angulaire
     */
    applyAngleSnap(startPoint, currentPoint) {
        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 0.1) return currentPoint;
        
        const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const normalizedAngle = ((currentAngle % 360) + 360) % 360;
        
        const snappedAngle = Math.round(normalizedAngle / this.angleSnapIncrement) * this.angleSnapIncrement;
        const snappedAngleRad = snappedAngle * Math.PI / 180;
        
        return new THREE.Vector3(
            startPoint.x + distance * Math.cos(snappedAngleRad),
            startPoint.y + distance * Math.sin(snappedAngleRad),
            currentPoint.z
        );
    }

    /**
     * Vérifie l'alignement sur les axes
     */
    checkAxisAlignment(p1, p2) {
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        const tolerance = 0.5;
        
        if (dy < tolerance && dx > tolerance) {
            return 'X'; // Aligné sur l'axe X (rouge)
        } else if (dx < tolerance && dy > tolerance) {
            return 'Y'; // Aligné sur l'axe Y (vert)
        }
        
        return null;
    }

    /**
     * Gère les événements clavier pour Shift
     */
    handleKeyDown(event) {
        if (event.key === 'Shift') {
            this.shiftPressed = true;
        }
    }    handleKeyUp(event) {
        if (event.key === 'Shift') {
            this.shiftPressed = false;
        }
    }

    /**
     * Gère le clic droit pour afficher le panneau de saisie des dimensions
     */
    handleContextMenu(event) {
        if (!this.active) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        if (this.startPoint) {
            // Si on a déjà un point de départ, proposer de saisir les dimensions
            this.showDimensionsDialog(event);
        } else {
            // Si on n'a pas encore de point de départ, définir le point de départ au clic droit
            const worldPoint = this.app.getWorldPoint(event);
            if (worldPoint) {
                const snappedPoint = this.app.snapManager ? 
                    this.app.snapManager.checkSnapping(worldPoint, event) : worldPoint;
                this.startPoint = snappedPoint.clone();
                document.getElementById('command-output').textContent = 'Point de départ défini - Clic droit pour saisir les dimensions';
                this.showDimensionsDialog(event);
            }
        }
    }

    /**
     * Affiche le panneau de saisie des dimensions
     */
    showDimensionsDialog(event) {
        // Masquer tout panneau existant
        this.hideDimensionsDialog();
        
        const popup = document.createElement('div');
        popup.id = 'rectangle-dimensions-popup';
        popup.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: #2c3e50;
            border: 2px solid #3498db;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 280px;
        `;
        
        popup.innerHTML = `
            <div style="margin-bottom: 15px; font-weight: bold; color: #3498db; border-bottom: 1px solid #34495e; padding-bottom: 8px;">
                📐 Dimensions du Rectangle
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #bdc3c7;">Largeur (cm):</label>
                <input type="number" id="rectangle-width-input" value="100" min="0.1" step="0.1"
                       style="width: 100%; padding: 8px; border: 1px solid #555; border-radius: 4px;
                              background: #34495e; color: white; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #bdc3c7;">Hauteur (cm):</label>
                <input type="number" id="rectangle-height-input" value="100" min="0.1" step="0.1"
                       style="width: 100%; padding: 8px; border: 1px solid #555; border-radius: 4px;
                              background: #34495e; color: white; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; font-size: 12px; color: #bdc3c7;">
                    <input type="checkbox" id="rectangle-square-mode" style="margin-right: 8px;">
                    Forcer un carré (même largeur et hauteur)
                </label>
            </div>
            <div style="text-align: center;">
                <button id="rectangle-confirm-btn" style="background: #27ae60; color: white; border: none; 
                        padding: 10px 20px; margin-right: 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    ✓ Créer
                </button>
                <button id="rectangle-cancel-btn" style="background: #e74c3c; color: white; border: none; 
                        padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    ✗ Annuler
                </button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        const widthInput = document.getElementById('rectangle-width-input');
        const heightInput = document.getElementById('rectangle-height-input');
        const squareMode = document.getElementById('rectangle-square-mode');
        const confirmBtn = document.getElementById('rectangle-confirm-btn');
        const cancelBtn = document.getElementById('rectangle-cancel-btn');
        
        // Focus sur le premier champ
        widthInput.focus();
        widthInput.select();
        
        // Gestion du mode carré
        squareMode.addEventListener('change', () => {
            if (squareMode.checked) {
                heightInput.value = widthInput.value;
                heightInput.disabled = true;
            } else {
                heightInput.disabled = false;
            }
        });
        
        // Synchroniser hauteur avec largeur en mode carré
        widthInput.addEventListener('input', () => {
            if (squareMode.checked) {
                heightInput.value = widthInput.value;
            }
        });
        
        // Gestion des événements
        const confirmAction = () => {
            const width = parseFloat(widthInput.value);
            const height = parseFloat(heightInput.value);
            
            if (width > 0 && height > 0) {
                this.createRectangleFromDimensions(width, height);
                this.hideDimensionsDialog();
            } else {
                alert('Veuillez saisir des dimensions valides supérieures à 0.');
                widthInput.focus();
                widthInput.select();
            }
        };
        
        const cancelAction = () => {
            this.hideDimensionsDialog();
        };
        
        confirmBtn.addEventListener('click', confirmAction);
        cancelBtn.addEventListener('click', cancelAction);
        
        // Validation avec Entrée
        popup.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmAction();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelAction();
            }
        });
        
        // Cacher le popup si on clique ailleurs
        setTimeout(() => {
            document.addEventListener('click', function outsideClickHandler(e) {
                if (!popup.contains(e.target)) {
                    cancelAction();
                    document.removeEventListener('click', outsideClickHandler);
                }
            });
        }, 100);
    }

    /**
     * Masque le panneau de saisie des dimensions
     */
    hideDimensionsDialog() {
        const existing = document.getElementById('rectangle-dimensions-popup');
        if (existing) {
            existing.remove();
        }
    }    /**
     * Crée un rectangle à partir des dimensions saisies
     */
    createRectangleFromDimensions(width, height) {
        if (!this.startPoint) {
            console.error('Pas de point de départ défini');
            return;
        }
        
        // Les dimensions sont gardées en cm car le système fonctionne en cm
        const widthFinal = width;
        const heightFinal = height;
        
        // Calculer le point opposé basé sur les dimensions en cm
        const endPoint = new THREE.Vector3(
            this.startPoint.x + widthFinal,
            this.startPoint.y + heightFinal,
            this.startPoint.z
        );
        
        // Créer le rectangle
        this.createRectangle(this.startPoint, endPoint);
        
        // Retourner à l'outil de sélection
        this.app.toolManager.setTool('select');
        
        document.getElementById('command-output').textContent = 
            `Rectangle créé: ${width.toFixed(1)} × ${height.toFixed(1)} cm`;
    }
}