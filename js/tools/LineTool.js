import * as THREE from 'three';

export class LineTool {
    constructor(app) {
        this.app = app;
        this.isDrawing = false;
        this.startPoint = null;
        this.previewLine = null;
        this.tempLine = null;
    }

    activate() {
        this.isDrawing = false;
        this.startPoint = null;
        this.clearPreview();
        document.getElementById('command-output').textContent = 'Cliquez pour définir le premier point de la ligne';
    }

    deactivate() {
        this.isDrawing = false;
        this.startPoint = null;
        this.clearPreview();
    }

    handleClick(point) {
        if (!this.isDrawing) {
            // Premier clic : définir le point de départ
            this.startPoint = point.clone();
            this.isDrawing = true;
            document.getElementById('command-output').textContent = 'Cliquez pour définir le point final de la ligne';
        } else {
            // Deuxième clic : créer la ligne
            this.createLine(this.startPoint, point);
            this.isDrawing = false;
            this.startPoint = null;
            this.clearPreview();
            document.getElementById('command-output').textContent = 'Ligne créée';
        }
    }

    updatePreview(currentPoint) {
        if (!this.isDrawing || !this.startPoint) return;

        this.clearPreview();

        // Créer la ligne de prévisualisation
        const points = [this.startPoint, currentPoint];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0x00ff00,
            dashSize: 3,
            gapSize: 1,
            linewidth: 2
        });

        this.previewLine = new THREE.Line(geometry, material);
        this.previewLine.computeLineDistances();
        this.app.scene.add(this.previewLine);

        // Afficher la distance
        const distance = this.startPoint.distanceTo(currentPoint);
        const coords = document.getElementById('coordinates');
        if (coords) {
            coords.textContent = `Distance: ${distance.toFixed(2)} cm`;
        }
    }    createLine(start, end) {
        const points = [start, end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x000000, // Couleur noire par défaut
            linewidth: 2
        });

        const line = new THREE.Line(geometry, material);
        line.userData.type = 'line';
        line.renderOrder = 1;
        // Les lignes ne projettent généralement pas d'ombres, mais on peut les faire recevoir des ombres
        line.receiveShadow = true;

        this.app.scene.add(line);
        this.app.objects.push(line);

        // Ajouter au calque actuel
        if (this.app.layers && this.app.layers[this.app.currentLayer]) {
            this.app.layers[this.app.currentLayer].objects.push(line);
        }

        // Ajouter à l'historique
        if (this.app.addToHistory) {
            this.app.addToHistory('create', line);
        }

        // Mettre à jour l'interface
        if (this.app.uiManager && this.app.uiManager.updateHistoryPanel) {
            this.app.uiManager.updateHistoryPanel();
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

    cancel() {
        this.isDrawing = false;
        this.startPoint = null;
        this.clearPreview();
        document.getElementById('command-output').textContent = 'Ligne annulée';
    }
}
