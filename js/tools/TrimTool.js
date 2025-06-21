import * as THREE from 'three';

export class TrimTool {
    constructor(app) {
        this.app = app;
        this.cuttingLine = null;
        this.highlightedSegment = null;
    }

    activate() {
        this.cuttingLine = null;
        this.highlightedSegment = null;
        document.getElementById('command-output').textContent = 'Sélectionnez la ligne de coupe';
    }

    deactivate() {
        this.unhighlightAll();
        this.cuttingLine = null;
        this.highlightedSegment = null;
    }

    handleClick(point) {
        if (!this.cuttingLine) {
            // Sélectionner la ligne de coupe
            const intersects = this.getLineIntersections(point);
            if (intersects.length > 0) {
                this.cuttingLine = intersects[0].object;
                this.highlightLine(this.cuttingLine, 0xff0000); // Rouge
                document.getElementById('command-output').textContent = 'Cliquez sur le segment à supprimer';
            } else {
                document.getElementById('command-output').textContent = 'Aucune ligne trouvée - Sélectionnez la ligne de coupe';
            }
        } else {
            // Couper le segment
            const intersects = this.getLineIntersections(point);
            if (intersects.length > 0 && intersects[0].object !== this.cuttingLine) {
                this.trimLine(intersects[0].object, this.cuttingLine);
                this.unhighlightAll();
                this.cuttingLine = null;
                this.highlightedSegment = null;
                document.getElementById('command-output').textContent = 'Ligne découpée - Sélectionnez une nouvelle ligne de coupe';
            } else if (intersects.length > 0 && intersects[0].object === this.cuttingLine) {
                document.getElementById('command-output').textContent = 'Cliquez sur une ligne différente de la ligne de coupe';
            } else {
                document.getElementById('command-output').textContent = 'Aucune ligne trouvée - Cliquez sur le segment à supprimer';
            }
        }
    }

    updatePreview(currentPoint) {
        if (!this.cuttingLine) return;

        // Trouver la ligne survolée
        const intersects = this.getLineIntersections(currentPoint);
        
        // Unhighlight previous
        if (this.highlightedSegment && this.highlightedSegment !== this.cuttingLine) {
            this.unhighlightLine(this.highlightedSegment);
        }

        // Highlight new
        if (intersects.length > 0 && intersects[0].object !== this.cuttingLine) {
            this.highlightedSegment = intersects[0].object;
            this.highlightLine(this.highlightedSegment, 0x00ff00); // Vert
            document.getElementById('command-output').textContent = 'Cliquez pour découper cette ligne';
        } else {
            this.highlightedSegment = null;
            if (this.cuttingLine) {
                document.getElementById('command-output').textContent = 'Cliquez sur le segment à supprimer';
            }
        }
    }

    trimLine(lineToTrim, cuttingLine) {
        const intersection = this.getLineIntersection(lineToTrim, cuttingLine);
        if (!intersection) {
            document.getElementById('command-output').textContent = 'Les lignes ne se croisent pas';
            return;
        }

        // Obtenir les points de la ligne à couper
        const positions = lineToTrim.geometry.attributes.position;
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

        // Créer deux nouvelles lignes
        const lines = [];
        
        // Première partie (p1 -> intersection)
        if (p1.distanceTo(intersection) > 0.1) {
            const geometry1 = new THREE.BufferGeometry().setFromPoints([p1, intersection]);
            const line1 = new THREE.Line(geometry1, lineToTrim.material.clone());
            lines.push(line1);
        }

        // Deuxième partie (intersection -> p2)
        if (p2.distanceTo(intersection) > 0.1) {
            const geometry2 = new THREE.BufferGeometry().setFromPoints([intersection, p2]);
            const line2 = new THREE.Line(geometry2, lineToTrim.material.clone());
            lines.push(line2);
        }

        // Supprimer l'ancienne ligne
        this.app.scene.remove(lineToTrim);
        const index = this.app.objects.indexOf(lineToTrim);
        if (index > -1) this.app.objects.splice(index, 1);

        // Supprimer des calques
        if (this.app.layers) {
            this.app.layers.forEach(layer => {
                const layerIndex = layer.objects.indexOf(lineToTrim);
                if (layerIndex > -1) {
                    layer.objects.splice(layerIndex, 1);
                }
            });
        }

        // Ajouter les nouvelles lignes
        lines.forEach(line => {
            this.app.scene.add(line);
            this.app.objects.push(line);
            if (this.app.layers && this.app.layers[this.app.currentLayer]) {
                this.app.layers[this.app.currentLayer].objects.push(line);
            }
        });

        if (this.app.addToHistory) {
            this.app.addToHistory('trim', lineToTrim);
        }

        if (this.app.uiManager && this.app.uiManager.updateHistoryPanel) {
            this.app.uiManager.updateHistoryPanel();
        }
    }

    getLineIntersection(line1, line2) {
        const p1 = new THREE.Vector3();
        const p2 = new THREE.Vector3();
        const p3 = new THREE.Vector3();
        const p4 = new THREE.Vector3();

        // Extraire les points de la première ligne
        const pos1 = line1.geometry.attributes.position;
        p1.set(pos1.getX(0), pos1.getY(0), pos1.getZ(0));
        p2.set(pos1.getX(1), pos1.getY(1), pos1.getZ(1));

        // Extraire les points de la deuxième ligne
        const pos2 = line2.geometry.attributes.position;
        p3.set(pos2.getX(0), pos2.getY(0), pos2.getZ(0));
        p4.set(pos2.getX(1), pos2.getY(1), pos2.getZ(1));

        // Calcul de l'intersection 2D
        const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        if (Math.abs(denominator) < 0.0001) return null;

        const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
        const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denominator;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return new THREE.Vector3(
                p1.x + t * (p2.x - p1.x),
                p1.y + t * (p2.y - p1.y),
                p1.z + t * (p2.z - p1.z)
            );
        }

        return null;
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
        if (this.cuttingLine) this.unhighlightLine(this.cuttingLine);
        if (this.highlightedSegment) this.unhighlightLine(this.highlightedSegment);
    }

    cancel() {
        this.unhighlightAll();
        this.cuttingLine = null;
        this.highlightedSegment = null;
        document.getElementById('command-output').textContent = 'Opération annulée - Sélectionnez la ligne de coupe';
    }
}
