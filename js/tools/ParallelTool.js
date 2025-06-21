import * as THREE from 'three';

export class ParallelTool {
    constructor(app) {
        this.app = app;
        this.selectedLine = null;
        this.previewLine = null;
        this.offset = 10; // Distance par défaut
        this.mode = 'select'; // 'select', 'distance', 'side'
        this.distanceInput = null;
        this.createDistanceInput();
    }

    createDistanceInput() {
        // Créer l'interface pour saisir la distance
        this.distanceInput = document.createElement('div');
        this.distanceInput.className = 'distance-input-panel';
        this.distanceInput.style.cssText = `
            position: fixed;
            top: 50px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border: 2px solid #007bff;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: none;
            z-index: 1000;
            font-family: Arial, sans-serif;
        `;
        
        this.distanceInput.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold;">
                Distance de la parallèle
            </div>
            <div style="margin-bottom: 10px;">
                <input type="number" id="parallel-distance-input" 
                       value="${this.offset}" min="0.1" step="0.1" 
                       style="width: 100px; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
                <span style="margin-left: 5px;">cm</span>
            </div>
            <div style="text-align: center;">
                <button id="parallel-distance-ok" style="
                    background: #007bff; color: white; border: none; 
                    padding: 8px 16px; border-radius: 4px; margin-right: 10px;
                    cursor: pointer;">OK</button>
                <button id="parallel-distance-cancel" style="
                    background: #6c757d; color: white; border: none; 
                    padding: 8px 16px; border-radius: 4px; cursor: pointer;">Annuler</button>
            </div>
        `;
        
        document.body.appendChild(this.distanceInput);
        
        // Événements
        document.getElementById('parallel-distance-ok').addEventListener('click', () => {
            const input = document.getElementById('parallel-distance-input');
            const value = parseFloat(input.value);
            if (value > 0) {
                this.offset = value;
                this.hideDistanceInput();
                this.mode = 'side';
                document.getElementById('command-output').textContent = 
                    `Distance: ${this.offset}cm - Cliquez pour définir le côté de la parallèle`;
            }
        });
        
        document.getElementById('parallel-distance-cancel').addEventListener('click', () => {
            this.hideDistanceInput();
            this.cancel();
        });
        
        // Valider avec Entrée
        document.getElementById('parallel-distance-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('parallel-distance-ok').click();
            } else if (e.key === 'Escape') {
                document.getElementById('parallel-distance-cancel').click();
            }
        });
    }

    showDistanceInput() {
        this.distanceInput.style.display = 'block';
        const input = document.getElementById('parallel-distance-input');
        input.value = this.offset;
        input.focus();
        input.select();
    }

    hideDistanceInput() {
        this.distanceInput.style.display = 'none';
    }

    activate() {
        this.selectedLine = null;
        this.mode = 'select';
        this.clearPreview();
        this.hideDistanceInput();
        document.getElementById('command-output').textContent = 'Sélectionnez une ligne de référence';
    }

    deactivate() {
        this.selectedLine = null;
        this.mode = 'select';
        this.clearPreview();
        this.hideDistanceInput();
    }

    handleClick(point) {
        if (this.mode === 'select') {
            // Sélectionner une ligne
            const intersects = this.getLineIntersections(point);
            if (intersects.length > 0) {
                this.selectedLine = intersects[0].object;
                this.highlightLine(this.selectedLine);
                this.mode = 'distance';
                this.showDistanceInput();
                document.getElementById('command-output').textContent = 'Définissez la distance de la parallèle';
            } else {
                document.getElementById('command-output').textContent = 'Aucune ligne trouvée - Sélectionnez une ligne de référence';
            }
        } else if (this.mode === 'side') {
            // Créer la parallèle
            this.createParallelLine(point);
            this.unhighlightLine(this.selectedLine);
            this.selectedLine = null;
            this.mode = 'select';
            this.clearPreview();
            document.getElementById('command-output').textContent = 'Ligne parallèle créée - Sélectionnez une nouvelle ligne de référence';
        }
    }

    updatePreview(currentPoint) {
        if (this.mode !== 'side' || !this.selectedLine) return;

        this.clearPreview();

        // Calculer la ligne parallèle
        const parallelPoints = this.calculateParallelLine(this.selectedLine, currentPoint);
        if (parallelPoints) {
            const geometry = new THREE.BufferGeometry().setFromPoints(parallelPoints);
            const material = new THREE.LineDashedMaterial({
                color: 0x00ff00,
                dashSize: 3,
                gapSize: 1,
                linewidth: 2
            });

            this.previewLine = new THREE.Line(geometry, material);
            this.previewLine.computeLineDistances();
            this.app.scene.add(this.previewLine);
        }
    }

    calculateParallelLine(line, sidePoint) {
        const positions = line.geometry.attributes.position;
        const p1 = new THREE.Vector3(
            positions.getX(0),
            positions.getY(0),
            positions.getZ(0)
        );
        const p2 = new THREE.Vector3(
            positions.getX(1),
            positions.getY(1),
            positions.getZ(1)
        );

        // Vecteur directeur de la ligne
        const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
        
        // Vecteur perpendiculaire
        const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
        
        // Déterminer de quel côté créer la parallèle
        const toPoint = new THREE.Vector3().subVectors(sidePoint, p1);
        const side = toPoint.dot(perpendicular) > 0 ? 1 : -1;
        
        // Points de la ligne parallèle
        const offset = perpendicular.multiplyScalar(this.offset * side);
        const parallelP1 = p1.clone().add(offset);
        const parallelP2 = p2.clone().add(offset);

        return [parallelP1, parallelP2];
    }

    createParallelLine(sidePoint) {
        const points = this.calculateParallelLine(this.selectedLine, sidePoint);
        if (!points) return;

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x000000,
            linewidth: 2
        });

        const line = new THREE.Line(geometry, material);
        this.app.scene.add(line);
        this.app.objects.push(line);

        if (this.app.layers && this.app.layers[this.app.currentLayer]) {
            this.app.layers[this.app.currentLayer].objects.push(line);
        }

        if (this.app.addToHistory) {
            this.app.addToHistory('create', line);
        }

        if (this.app.uiManager && this.app.uiManager.updateHistoryPanel) {
            this.app.uiManager.updateHistoryPanel();
        }
    }

    getLineIntersections(clickPoint) {
        // Utiliser directement le point 3D reçu pour trouver la ligne la plus proche
        const lines = this.app.objects.filter(obj => obj instanceof THREE.Line);
        const intersections = [];
        
        for (let line of lines) {
            const distance = this.getDistanceToLine(line, clickPoint);
            if (distance < 5) { // Tolérance de 5 unités
                intersections.push({
                    object: line,
                    distance: distance,
                    point: clickPoint
                });
            }
        }
        
        // Trier par distance et retourner le plus proche
        intersections.sort((a, b) => a.distance - b.distance);
        return intersections;
    }
    
    getDistanceToLine(line, point) {
        const positions = line.geometry.attributes.position;
        const p1 = new THREE.Vector3(
            positions.getX(0),
            positions.getY(0),
            positions.getZ(0)
        );
        const p2 = new THREE.Vector3(
            positions.getX(1),
            positions.getY(1),
            positions.getZ(1)
        );
        
        // Calculer la distance du point à la ligne
        const lineVec = new THREE.Vector3().subVectors(p2, p1);
        const pointVec = new THREE.Vector3().subVectors(point, p1);
        
        const lineLength = lineVec.length();
        if (lineLength === 0) return point.distanceTo(p1);
        
        const t = Math.max(0, Math.min(1, pointVec.dot(lineVec) / (lineLength * lineLength)));
        const projection = p1.clone().add(lineVec.multiplyScalar(t));
        
        return point.distanceTo(projection);
    }

    highlightLine(line) {
        line.userData.originalColor = line.material.color.getHex();
        line.material.color.setHex(0x0066ff);
    }

    unhighlightLine(line) {
        if (line.userData.originalColor !== undefined) {
            line.material.color.setHex(line.userData.originalColor);
            delete line.userData.originalColor;
        }
    }

    clearPreview() {
        if (this.previewLine) {
            this.app.scene.remove(this.previewLine);
            if (this.previewLine.geometry) this.previewLine.geometry.dispose();
            if (this.previewLine.material) this.previewLine.material.dispose();
            this.previewLine = null;
        }
    }

    adjustOffset(delta) {
        this.offset = Math.max(0.1, this.offset + delta);
        // Mettre à jour l'input si visible
        const input = document.getElementById('parallel-distance-input');
        if (input && this.distanceInput.style.display !== 'none') {
            input.value = this.offset;
        }
    }

    cancel() {
        if (this.selectedLine) {
            this.unhighlightLine(this.selectedLine);
        }
        this.selectedLine = null;
        this.mode = 'select';
        this.clearPreview();
        this.hideDistanceInput();
        document.getElementById('command-output').textContent = 'Opération annulée - Sélectionnez une ligne de référence';
    }

    // Méthode pour nettoyer lors de la destruction
    destroy() {
        if (this.distanceInput && this.distanceInput.parentNode) {
            this.distanceInput.parentNode.removeChild(this.distanceInput);
        }
    }
}
