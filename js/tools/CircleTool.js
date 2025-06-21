import * as THREE from 'three';

// Classe pour l'outil Cercle
export class CircleTool {
    constructor(app) {
        this.app = app;
        this.active = false;
        this.centerPoint = null;
        this.previewCircle = null;
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
        this.centerPoint = null;
        this.clearPreview();
        this.clearSnapHelpers();
        document.getElementById('command-output').textContent = 'Cercle : Cliquez pour définir le centre (clic droit pour saisir le rayon exact)';
        this.app.controls.enabled = false; // Désactiver les contrôles d'orbite
        
        // Ajouter les écouteurs d'événements clavier
        document.addEventListener('keydown', this.keyDownHandler);
        document.addEventListener('keyup', this.keyUpHandler);
        
        // Ajouter l'écouteur de clic droit
        this.app.renderer.domElement.addEventListener('contextmenu', this.contextMenuHandler);
    }

    deactivate() {
        this.active = false;
        this.clearPreview();
        this.clearSnapHelpers();
        this.hideTooltip();
        this.centerPoint = null;
        this.app.controls.enabled = true; // Réactiver les contrôles d'orbite
        
        // Retirer les écouteurs d'événements clavier
        document.removeEventListener('keydown', this.keyDownHandler);
        document.removeEventListener('keyup', this.keyUpHandler);
        
        // Retirer l'écouteur de clic droit
        this.app.renderer.domElement.removeEventListener('contextmenu', this.contextMenuHandler);
    }    handleClick(point, event) {
        if (!this.active) return;

        if (!this.centerPoint) {
            // Premier clic : définir le point central avec accrochage
            const snappedPoint = (this.app.snapManager && event) ? 
                this.app.snapManager.checkSnapping(point, event) : point;
            this.centerPoint = snappedPoint.clone();
            document.getElementById('command-output').textContent = 'Cliquez pour définir le rayon du cercle (Shift = contraintes, clic droit = saisie exacte)';
            // L'aperçu sera mis à jour par handleMouseMove
        } else {
            // Deuxième clic : finaliser le cercle avec accrochage
            const snappedPoint = (this.app.snapManager && event) ? 
                this.app.snapManager.checkSnapping(point, event) : point;
            
            let finalPoint = snappedPoint.clone();
            
            // Appliquer les contraintes si nécessaire
            if (this.angleSnap) {
                finalPoint = this.applyAngleSnap(this.centerPoint, finalPoint);
            }
            
            const radius = this.centerPoint.distanceTo(finalPoint);
            this.createCircle(this.centerPoint, radius);
            this.app.toolManager.setTool('select'); // Retour à l'outil de sélection
        }
    }    handleMouseMove(currentPoint, event) {
        if (!this.active) return;
        
        if (!this.centerPoint) {
            // Avant de définir le centre, montrer l'accrochage
            if (this.app.snapManager && event) {
                const snappedPoint = this.app.snapManager.checkSnapping(currentPoint, event);
                this.showSnapGuides(currentPoint, snappedPoint);
            }
        } else {
            // Après avoir défini le centre, mise à jour de l'aperçu
            const snappedPoint = (this.app.snapManager && event) ? 
                this.app.snapManager.checkSnapping(currentPoint, event) : currentPoint;
            
            let finalPoint = snappedPoint.clone();
            
            // Appliquer les contraintes si nécessaire
            if (this.angleSnap) {
                finalPoint = this.applyAngleSnap(this.centerPoint, finalPoint);
            }
            
            this.updatePreview(this.centerPoint, finalPoint);
            this.showSnapGuides(this.centerPoint, finalPoint);
            this.showTooltip(this.centerPoint, finalPoint, event);
        }
    }

    updatePreview(center, edgePoint) {
        this.clearPreview();
        const radius = center.distanceTo(edgePoint) || 0.01; // Assurer une valeur non nulle pour la géométrie

        const geometry = new THREE.CircleGeometry(radius, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Aperçu en vert
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });
        this.previewCircle = new THREE.Mesh(geometry, material);
        this.previewCircle.position.copy(center);
        this.previewCircle.position.z = 0.05; // Légèrement au-dessus du plan de travail
        this.app.scene.add(this.previewCircle);
    }

    createCircle(center, radius) {
        this.clearPreview();

        if (radius < 0.01) { // Empêcher les cercles de taille nulle ou trop petite
            document.getElementById('command-output').textContent = 'Cercle trop petit, annulé.';
            this.cancel();
            return;
        }

        // Créer la géométrie du cercle
        const geometry = new THREE.CircleGeometry(radius, 32);
        
        // Créer le matériau du cercle rempli - blanc pur
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
        });
        const circleMesh = new THREE.Mesh(geometry, material);        circleMesh.position.copy(center);
        circleMesh.position.z = 0.01; // Sur le plan de travail
        circleMesh.castShadow = true;
        circleMesh.receiveShadow = true;
        circleMesh.userData.type = 'circle';
        circleMesh.userData.isSurface = true; // Marquer comme surface pour l'outil hachure

        // Créer le contour avec des lignes noires
        const edgeMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000,  // Noir
            linewidth: 2 
        });
        const edges = new THREE.EdgesGeometry(geometry);
        const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
        circleMesh.add(edgeLines);

        this.app.scene.add(circleMesh);
        this.app.objects.push(circleMesh);
        if (this.app.layers && this.app.layers[this.app.currentLayer]) {
            this.app.layers[this.app.currentLayer].objects.push(circleMesh);
        }
        if (this.app.addToHistory) {
            this.app.addToHistory('create', circleMesh);
        }
        if (this.app.uiManager && this.app.uiManager.updateHistoryPanel) {
            this.app.uiManager.updateHistoryPanel();
        }
        document.getElementById('command-output').textContent = 'Cercle créé.';
    }    clearPreview() {
        if (this.previewCircle) {
            this.app.scene.remove(this.previewCircle);
            if (this.previewCircle.geometry) this.previewCircle.geometry.dispose();
            if (this.previewCircle.material) this.previewCircle.material.dispose();
            this.previewCircle = null;
        }
        this.hideTooltip();
    }    cancel() {
        this.deactivate();
        document.getElementById('command-output').textContent = 'Cercle annulé.';
        if (this.app.toolManager) {
            this.app.toolManager.setTool('select');
        }
    }

    /**
     * Gestion des événements clavier
     */
    handleKeyDown(event) {
        if (event.key === 'Shift') {
            this.shiftPressed = true;
        }
    }

    handleKeyUp(event) {
        if (event.key === 'Shift') {
            this.shiftPressed = false;
        }
    }

    /**
     * Créer l'info-bulle
     */
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'circle-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            background: rgba(44, 62, 80, 0.95);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            pointer-events: none;
            z-index: 10001;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 1px solid #3498db;
            display: none;
            max-width: 200px;
            line-height: 1.4;
        `;
        document.body.appendChild(this.tooltip);
    }

    /**
     * Afficher l'info-bulle avec les informations du cercle
     */
    showTooltip(center, edgePoint, event) {
        if (!this.tooltip || !event) return;

        const radius = center.distanceTo(edgePoint);
        const diameter = radius * 2;
        const area = Math.PI * radius * radius;
        const circumference = 2 * Math.PI * radius;

        // Calculer l'angle depuis le centre
        const dx = edgePoint.x - center.x;
        const dy = edgePoint.y - center.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        // Vérifier l'alignement sur les axes
        const isAxisAligned = this.checkAxisAlignment(center, edgePoint);

        let content = `
            📏 Rayon: ${radius.toFixed(1)} cm<br>
            📐 Diamètre: ${diameter.toFixed(1)} cm<br>
            📊 Aire: ${area.toFixed(1)} cm²<br>
            🔄 Circonférence: ${circumference.toFixed(1)} cm<br>
            📐 Angle: ${angle.toFixed(1)}°
        `;

        if (isAxisAligned.x) {
            content += '<br>🔴 Axe X';
        }
        if (isAxisAligned.y) {
            content += '<br>🟢 Axe Y';
        }

        this.tooltip.innerHTML = content;
        this.tooltip.style.left = (event.clientX + 15) + 'px';
        this.tooltip.style.top = (event.clientY - 10) + 'px';
        this.tooltip.style.display = 'block';
    }

    /**
     * Masquer l'info-bulle
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }

    /**
     * Afficher les guides d'accrochage
     */
    showSnapGuides(center, edgePoint) {
        this.clearSnapHelpers();
        
        if (!center || !edgePoint) return;

        // Guide pour l'axe X (rouge)
        if (Math.abs(edgePoint.y - center.y) < 5) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(center.x - 50, center.y, 0.02),
                new THREE.Vector3(center.x + 50, center.y, 0.02)
            ]);
            const material = new THREE.LineDashedMaterial({
                color: 0xff0000,
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

        // Guide pour l'axe Y (vert)
        if (Math.abs(edgePoint.x - center.x) < 5) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(center.x, center.y - 50, 0.02),
                new THREE.Vector3(center.x, center.y + 50, 0.02)
            ]);
            const material = new THREE.LineDashedMaterial({
                color: 0x00ff00,
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

        // Guides d'angle à 45° et multiples
        const radius = center.distanceTo(edgePoint);
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        
        angles.forEach(angle => {
            const rad = angle * Math.PI / 180;
            const endX = center.x + Math.cos(rad) * radius * 1.2;
            const endY = center.y + Math.sin(rad) * radius * 1.2;
            
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(center.x, center.y, 0.02),
                new THREE.Vector3(endX, endY, 0.02)
            ]);
            const material = new THREE.LineDashedMaterial({
                color: 0x888888,
                dashSize: 0.3,
                gapSize: 0.3,
                opacity: 0.4,
                transparent: true
            });
            const guideLine = new THREE.Line(geometry, material);
            guideLine.computeLineDistances();
            guideLine.renderOrder = 997;
            this.app.scene.add(guideLine);
            this.snapHelpers.push(guideLine);
        });
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
     * Applique l'accrochage angulaire
     */
    applyAngleSnap(center, edgePoint) {
        const dx = edgePoint.x - center.x;
        const dy = edgePoint.y - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return edgePoint;
        
        // Calculer l'angle actuel
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        
        // Trouver l'angle le plus proche selon l'incrément
        const snappedAngle = Math.round(angle / this.angleSnapIncrement) * this.angleSnapIncrement;
        const snappedRad = snappedAngle * Math.PI / 180;
        
        // Calculer la nouvelle position
        return new THREE.Vector3(
            center.x + Math.cos(snappedRad) * distance,
            center.y + Math.sin(snappedRad) * distance,
            edgePoint.z
        );
    }

    /**
     * Vérifie l'alignement sur les axes
     */
    checkAxisAlignment(center, edgePoint) {
        const tolerance = 2; // pixels
        return {
            x: Math.abs(edgePoint.y - center.y) < tolerance,
            y: Math.abs(edgePoint.x - center.x) < tolerance
        };
    }

    /**
     * Gestion du clic droit (menu contextuel)
     */
    handleContextMenu(event) {
        if (!this.active) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        if (this.centerPoint) {
            // Si on a déjà un centre, proposer de saisir le rayon
            this.showRadiusDialog(event);
        } else {
            // Si on n'a pas encore de centre, définir le centre au clic droit
            const worldPoint = this.app.getWorldPoint(event);
            if (worldPoint) {
                const snappedPoint = this.app.snapManager ? 
                    this.app.snapManager.checkSnapping(worldPoint, event) : worldPoint;
                this.centerPoint = snappedPoint.clone();
                document.getElementById('command-output').textContent = 'Centre défini - Clic droit pour saisir le rayon exact';
                this.showRadiusDialog(event);
            }
        }
    }

    /**
     * Affiche le panneau de saisie du rayon
     */
    showRadiusDialog(event) {
        // Masquer tout panneau existant
        this.hideRadiusDialog();
        
        const popup = document.createElement('div');
        popup.id = 'circle-radius-popup';
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
                🔵 Rayon du Cercle
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #bdc3c7;">Rayon (cm):</label>
                <input type="number" id="circle-radius-input" value="50" min="0.1" step="0.1"
                       style="width: 100%; padding: 8px; border: 1px solid #555; border-radius: 4px;
                              background: #34495e; color: white; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #bdc3c7;">Diamètre (cm):</label>
                <input type="number" id="circle-diameter-input" value="100" min="0.1" step="0.1"
                       style="width: 100%; padding: 8px; border: 1px solid #555; border-radius: 4px;
                              background: #34495e; color: white; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="text-align: center;">
                <button id="circle-confirm-btn" style="background: #27ae60; color: white; border: none; 
                        padding: 10px 20px; margin-right: 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    ✓ Créer
                </button>
                <button id="circle-cancel-btn" style="background: #e74c3c; color: white; border: none; 
                        padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    ✗ Annuler
                </button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        const radiusInput = document.getElementById('circle-radius-input');
        const diameterInput = document.getElementById('circle-diameter-input');
        const confirmBtn = document.getElementById('circle-confirm-btn');
        const cancelBtn = document.getElementById('circle-cancel-btn');
        
        // Focus sur le premier champ
        radiusInput.focus();
        radiusInput.select();
        
        // Synchroniser rayon et diamètre
        radiusInput.addEventListener('input', () => {
            const radius = parseFloat(radiusInput.value);
            if (!isNaN(radius)) {
                diameterInput.value = (radius * 2).toFixed(1);
            }
        });
        
        diameterInput.addEventListener('input', () => {
            const diameter = parseFloat(diameterInput.value);
            if (!isNaN(diameter)) {
                radiusInput.value = (diameter / 2).toFixed(1);
            }
        });
        
        // Gestion des événements
        const confirmAction = () => {
            const radius = parseFloat(radiusInput.value);
            
            if (radius > 0) {
                this.createCircleFromRadius(radius);
                this.hideRadiusDialog();
            } else {
                alert('Veuillez saisir un rayon valide supérieur à 0.');
                radiusInput.focus();
                radiusInput.select();
            }
        };
        
        const cancelAction = () => {
            this.hideRadiusDialog();
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
     * Masque le panneau de saisie du rayon
     */
    hideRadiusDialog() {
        const existing = document.getElementById('circle-radius-popup');
        if (existing) {
            existing.remove();
        }
    }

    /**
     * Crée un cercle à partir du rayon saisi
     */
    createCircleFromRadius(radius) {
        if (!this.centerPoint) {
            console.error('Pas de centre défini');
            return;
        }
        
        // Créer le cercle
        this.createCircle(this.centerPoint, radius);
        
        // Retourner à l'outil de sélection
        this.app.toolManager.setTool('select');
        
        document.getElementById('command-output').textContent = 
            `Cercle créé: rayon ${radius.toFixed(1)} cm, diamètre ${(radius * 2).toFixed(1)} cm`;
    }
}