import * as THREE from 'three';

export class ExtendTool {
    constructor(app) {
        this.app = app;
        this.boundaryLine = null;
        this.lineToExtend = null;
        this.previewLine = null;
        this.skipBoundary = false;
    }

    activate() {
        this.boundaryLine = null;
        this.lineToExtend = null;
        this.skipBoundary = false;
        this.clearPreview();
        document.getElementById('command-output').textContent = 'Sélectionnez la ligne limite (optionnel, Entrée pour ignorer)';
    }

    deactivate() {
        this.unhighlightAll();
        this.clearPreview();
        this.skipBoundary = false;
    }

    handleClick(point) {
        if (!this.boundaryLine && !this.skipBoundary) {
            // Sélectionner la ligne limite
            const intersects = this.getLineIntersections(point);
            if (intersects.length > 0) {
                this.boundaryLine = intersects[0].object;
                this.highlightLine(this.boundaryLine, 0xff0000); // Rouge
                document.getElementById('command-output').textContent = 'Cliquez sur la ligne à étendre';
            } else {
                document.getElementById('command-output').textContent = 'Aucune ligne trouvée - Sélectionnez la ligne limite (Entrée pour ignorer)';
            }
        } else if (!this.lineToExtend) {
            // Sélectionner la ligne à étendre
            const intersects = this.getLineIntersections(point);
            if (intersects.length > 0 && intersects[0].object !== this.boundaryLine) {
                this.lineToExtend = intersects[0].object;
                this.highlightLine(this.lineToExtend, 0x00ff00); // Vert
                
                // Déterminer quel côté étendre
                const closestEnd = this.getClosestEnd(this.lineToExtend, point);
                this.extendLine(this.lineToExtend, closestEnd, this.boundaryLine);
                
                this.unhighlightAll();
                this.resetTool();
            } else if (intersects.length > 0 && intersects[0].object === this.boundaryLine) {
                document.getElementById('command-output').textContent = 'Cliquez sur une ligne différente de la ligne limite';
            } else {
                document.getElementById('command-output').textContent = 'Aucune ligne trouvée - Cliquez sur la ligne à étendre';
            }
        }
    }

    extendLine(line, endToExtend, boundary) {
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

        let newEndPoint;

        if (boundary) {
            // Étendre jusqu'à la ligne limite
            const extendedLine = this.createExtendedLine(p1, p2, endToExtend, 1000);
            const intersection = this.getLineIntersection(extendedLine, boundary);

            if (intersection) {
                newEndPoint = intersection;
            } else {
                document.getElementById('command-output').textContent = 'La ligne ne peut pas être étendue jusqu\'à la limite';
                return;
            }
        } else {
            // Étendre d'une longueur fixe
            const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
            const extensionLength = 20; // 20 cm par défaut
            
            if (endToExtend === 'start') {
                direction.multiplyScalar(-extensionLength);
                newEndPoint = p1.clone().add(direction);
            } else {
                direction.multiplyScalar(extensionLength);
                newEndPoint = p2.clone().add(direction);
            }
        }

        // Créer la nouvelle ligne étendue
        const newPoints = endToExtend === 'start' ? [newEndPoint, p2] : [p1, newEndPoint];
        const geometry = new THREE.BufferGeometry().setFromPoints(newPoints);
        const newLine = new THREE.Line(geometry, line.material.clone());

        // Remplacer l'ancienne ligne
        this.app.scene.remove(line);
        const index = this.app.objects.indexOf(line);
        if (index > -1) this.app.objects.splice(index, 1);

        // Supprimer des calques
        if (this.app.layers) {
            this.app.layers.forEach(layer => {
                const layerIndex = layer.objects.indexOf(line);
                if (layerIndex > -1) {
                    layer.objects.splice(layerIndex, 1);
                }
            });
        }

        this.app.scene.add(newLine);
        this.app.objects.push(newLine);

        if (this.app.layers && this.app.layers[this.app.currentLayer]) {
            this.app.layers[this.app.currentLayer].objects.push(newLine);
        }

        if (this.app.addToHistory) {
            this.app.addToHistory('extend', line);
        }

        if (this.app.uiManager && this.app.uiManager.updateHistoryPanel) {
            this.app.uiManager.updateHistoryPanel();
        }

        document.getElementById('command-output').textContent = 'Ligne étendue';
    }

    getClosestEnd(line, clickPoint) {
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

        const dist1 = p1.distanceTo(clickPoint);
        const dist2 = p2.distanceTo(clickPoint);

        return dist1 < dist2 ? 'start' : 'end';
    }

    createExtendedLine(p1, p2, endToExtend, length) {
        const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
        
        if (endToExtend === 'start') {
            const extendedStart = p1.clone().add(direction.clone().multiplyScalar(-length));
            return [extendedStart, p2];
        } else {
            const extendedEnd = p2.clone().add(direction.clone().multiplyScalar(length));
            return [p1, extendedEnd];
        }
    }

    resetTool() {
        this.boundaryLine = null;
        this.lineToExtend = null;
        this.skipBoundary = false;
        document.getElementById('command-output').textContent = 'Sélectionnez la ligne limite (optionnel, Entrée pour ignorer)';
    }

    skipBoundarySelection() {
        this.skipBoundary = true;
        document.getElementById('command-output').textContent = 'Cliquez sur la ligne à étendre';
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

    getLineIntersection(extendedLinePoints, boundaryLine) {
        // Extraire les points de la ligne étendue (tableau de Vector3)
        const p1 = extendedLinePoints[0];
        const p2 = extendedLinePoints[1];
        
        // Extraire les points de la ligne limite
        const positions = boundaryLine.geometry.attributes.position;
        const p3 = new THREE.Vector3(
            positions.getX(0),
            positions.getY(0),
            positions.getZ(0)
        );
        const p4 = new THREE.Vector3(
            positions.getX(1),
            positions.getY(1),
            positions.getZ(1)
        );

        // Calcul de l'intersection 2D
        const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        if (Math.abs(denominator) < 0.0001) return null;

        const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;

        return new THREE.Vector3(
            p1.x + t * (p2.x - p1.x),
            p1.y + t * (p2.y - p1.y),
            p1.z + t * (p2.z - p1.z)
        );
    }

    highlightLine(line, color) {
        if (!line.userData.originalColor) {
            line.userData.originalColor = line.material.color.getHex();
        }
        line.material.color.setHex(color);
    }

    unhighlightLine(line) {
        if (line.userData.originalColor !== undefined) {
            line.material.color.setHex(line.userData.originalColor);
            delete line.userData.originalColor;
        }
    }

    unhighlightAll() {
        if (this.boundaryLine) this.unhighlightLine(this.boundaryLine);
        if (this.lineToExtend) this.unhighlightLine(this.lineToExtend);
    }

    clearPreview() {
        if (this.previewLine) {
            this.app.scene.remove(this.previewLine);
            if (this.previewLine.geometry) this.previewLine.geometry.dispose();
            if (this.previewLine.material) this.previewLine.material.dispose();
            this.previewLine = null;
        }
    }

    cancel() {
        this.unhighlightAll();
        this.resetTool();
        document.getElementById('command-output').textContent = 'Opération annulée - Sélectionnez la ligne limite (Entrée pour ignorer)';
    }
}