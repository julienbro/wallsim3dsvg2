import * as THREE from 'three';
import { LineTool } from '../tools/LineTool.js';
import { ParallelTool } from '../tools/ParallelTool.js';
import { TrimTool } from '../tools/TrimTool.js';
import { ExtendTool } from '../tools/ExtendTool.js';
import { HatchTool } from '../tools/HatchTool.js';
import { RectangleTool } from '../tools/RectangleTool.js';
import { CircleTool } from '../tools/CircleTool.js';
import { SurfaceTool } from '../tools/SurfaceTool.js';
import { DimensionTool } from '../tools/DimensionTool.js';
import { PolylineTool } from '../tools/PolylineTool.js';

export class DrawingManager {
    constructor(app) {
        this.app = app;
        console.log('[DrawingManager Constructor] DrawingManager instance created. App:', this.app);
        // Verify that methods are indeed part of the prototype or instance
        console.log('[DrawingManager Constructor] typeof this.handleKeyboard:', typeof this.handleKeyboard);
        
        this.isDrawing = false;
        this.drawingPoints = [];
        this.tempObject = null;
        this.drawingMode = null;
        this.snapHelpers = [];
        this.angleSnap = true;
        this.angleSnapIncrement = 5;
        this.showSnapGuides = true;
        this.shiftPressed = false;
        this.contextMenu = null;
        this.polylineTooltip = null;
        this.polylineArcMode = false;
        this.temporaryPolylineSegments = [];
        
        // Créer les outils
        this.lineTool = new LineTool(app);
        this.parallelTool = new ParallelTool(app);
        this.trimTool = new TrimTool(app);
        this.extendTool = new ExtendTool(app);
        this.hatchTool = new HatchTool(app);
        this.rectangleTool = new RectangleTool(app);
        this.circleTool = new CircleTool(app);
        this.surfaceTool = new SurfaceTool(app);
        this.dimensionTool = new DimensionTool(app);
        this.polylineTool = new PolylineTool(app);
        
        if (!app.dimensionTool) {
            app.dimensionTool = this.dimensionTool;
        }
        
        app.drawingManager = this;
        
        this.createContextMenu();
        this.createPolylineTooltip();        this.app.renderer.domElement.addEventListener('contextmenu', (e) => {
            if (this.isDrawing && this.drawingMode === 'polyline') {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY);
            } else if (this.app.currentTool === 'rect' && this.rectangleTool.active) {
                // Le RectangleTool gère son propre menu contextuel
                // Pas besoin d'empêcher l'événement ici, le RectangleTool s'en charge
            }
        });
    }
    
    createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'polyline-context-menu';
        this.contextMenu.style.display = 'none';
        this.contextMenu.innerHTML = `
            <div class="context-menu-item" id="undo-point">
                <i class="fas fa-undo"></i> Annuler le point précédent
            </div>
            <div class="context-menu-item" id="enter-length">
                <i class="fas fa-ruler"></i> Saisir la longueur
            </div>
            <div class="context-menu-item" id="arc-mode">
                <i class="fas fa-bezier-curve"></i> Mode Arc
            </div>
            <div class="context-menu-item" id="close-polyline">
                <i class="fas fa-check-circle"></i> Fermer la polyligne
            </div>
            <div class="context-menu-item" id="finish-polyline">
                <i class="fas fa-stop"></i> Fin
            </div>
            <div class="context-menu-item" id="cancel-polyline">
                <i class="fas fa-times"></i> Annuler
            </div>
        `;
        document.body.appendChild(this.contextMenu);        // Gestionnaires d'événements
        document.getElementById('undo-point').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideContextMenu();
            
            // Si on utilise le nouveau PolylineTool, déléguer
            if (this.activeTool && this.activeTool.constructor.name === 'PolylineTool') {
                console.log('[DrawingManager] Délégation undo-point vers PolylineTool');
                this.activeTool.undoLastPoint();
            } else {
                this.undoLastPoint();
            }
        });        document.getElementById('enter-length').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideContextMenu();
            
            // Si on utilise le nouveau PolylineTool, déléguer
            if (this.activeTool && this.activeTool.constructor.name === 'PolylineTool') {
                if (typeof this.activeTool.showLengthInputDialog === 'function') {
                    this.activeTool.showLengthInputDialog();
                } else {
                    console.warn('PolylineTool.showLengthInputDialog non trouvée');
                }
            } else {
                this.showLengthInputDialog();
            }
        });
          document.getElementById('arc-mode').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideContextMenu();
            
            // Si on utilise le nouveau PolylineTool, déléguer
            if (this.activeTool && this.activeTool.constructor.name === 'PolylineTool') {
                console.log('[DrawingManager] Délégation arc-mode vers PolylineTool');
                if (typeof this.activeTool.toggleArcMode === 'function') {
                    this.activeTool.toggleArcMode();
                } else {
                    console.warn('PolylineTool.toggleArcMode non trouvée');
                }
            } else {
                this.togglePolylineArcMode();
            }
        });document.getElementById('close-polyline').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideContextMenu();
            
            // Si on utilise le nouveau PolylineTool, déléguer
            if (this.activeTool && this.activeTool.constructor.name === 'PolylineTool') {
                console.log('[DrawingManager] Délégation close-polyline vers PolylineTool');
                if (typeof this.activeTool.closePolyline === 'function') {
                    this.activeTool.closePolyline();
                } else {
                    console.warn('PolylineTool.closePolyline non trouvée');
                }
            } else {
                this.closePolyline();
                this.exitPolylineMode();
            }
        });
          document.getElementById('finish-polyline').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideContextMenu();
            
            // Si on utilise le nouveau PolylineTool, déléguer
            if (this.activeTool && this.activeTool.constructor.name === 'PolylineTool') {
                console.log('[DrawingManager] Délégation finish-polyline vers PolylineTool');
                this.activeTool.finishPolyline();
            } else {
                this.finishPolyline();
                this.exitPolylineMode();
            }
        });
        
        document.getElementById('cancel-polyline').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideContextMenu();
            
            // Si on utilise le nouveau PolylineTool, déléguer
            if (this.activeTool && this.activeTool.constructor.name === 'PolylineTool') {
                console.log('[DrawingManager] Délégation cancel-polyline vers PolylineTool');
                this.activeTool.cancelPolyline();
            } else {
                this.cancelDrawing();
                this.exitPolylineMode();
            }
        });
        
        // Cacher le menu en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    }
    
    createPolylineTooltip() {
        this.polylineTooltip = document.createElement('div');
        this.polylineTooltip.id = 'polyline-tooltip';
        this.polylineTooltip.style.cssText = `
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
        document.body.appendChild(this.polylineTooltip);
    }
    
    exitPolylineMode() {
        // Retourner à l'outil de sélection
        this.app.toolManager.setTool('select');
        document.getElementById('command-output').textContent = 'Polyligne terminée';
    }
    
    showContextMenu(x, y) {
        if (this.isDrawing && this.drawingMode === 'polyline' && this.drawingPoints.length >= 1) {
            // Replace the invalid method with logic to calculate the world position
            const canvasRect = this.app.renderer.domElement.getBoundingClientRect();
            const normalizedX = ((x - canvasRect.left) / canvasRect.width) * 2 - 1;
            const normalizedY = -((y - canvasRect.top) / canvasRect.height) * 2 + 1;
            const mouseVector = new THREE.Vector3(normalizedX, normalizedY, 0.5);
            mouseVector.unproject(this.app.camera);
            this.rightClickPosition = mouseVector;
            this.rightClickPosition.z = 0; // Ensure the position is on the XY plane for angle calculation

            // Store the angle at the time of right-click
            if (this.drawingPoints.length > 0) {
                const lastPoint = this.drawingPoints[this.drawingPoints.length - 1];
                // Assuming lastPoint.z is already 0 from previous operations
                const dx = this.rightClickPosition.x - lastPoint.x;
                const dy = this.rightClickPosition.y - lastPoint.y;
                this.rightClickAngle = Math.atan2(dy, dx); // Stored in radians
            } else {
                this.rightClickAngle = 0; // Default if no previous point
            }

            // Activer/désactiver l'option "Annuler le point précédent" selon le nombre de points
            const undoPointItem = document.getElementById('undo-point');
            if (this.drawingPoints.length <= 1) {
                undoPointItem.style.opacity = '0.5';
                undoPointItem.style.pointerEvents = 'none';
            } else {
                undoPointItem.style.opacity = '1';
                undoPointItem.style.pointerEvents = 'auto';
            }
            
            // Activer/désactiver l'option "Saisir la longueur" selon le nombre de points
            const enterLengthItem = document.getElementById('enter-length');
            if (this.drawingPoints.length < 1) {
                enterLengthItem.style.opacity = '0.5';
                enterLengthItem.style.pointerEvents = 'none';
            } else {
                enterLengthItem.style.opacity = '1';
                enterLengthItem.style.pointerEvents = 'auto';
            }
            
            // Activer/désactiver l'option "Fermer la polyligne" selon le nombre de points
            const closePolylineItem = document.getElementById('close-polyline');
            if (this.drawingPoints.length < 3) {
                closePolylineItem.style.opacity = '0.5';
                closePolylineItem.style.pointerEvents = 'none';
            } else {
                closePolylineItem.style.opacity = '1';
                closePolylineItem.style.pointerEvents = 'auto';
            }
            
            // Mettre à jour le texte du mode arc
            const arcModeItem = document.getElementById('arc-mode');
            if (this.polylineArcMode) {
                arcModeItem.innerHTML = '<i class="fas fa-minus"></i> Mode Ligne';
            } else {
                arcModeItem.innerHTML = '<i class="fas fa-bezier-curve"></i> Mode Arc';
            }
            
            this.contextMenu.style.left = `${x}px`;
            this.contextMenu.style.top = `${y}px`;
            this.contextMenu.style.display = 'block';
        }
    }
    
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
        }
    }      undoLastPoint() {
        // Si on utilise le nouveau PolylineTool, déléguer à l'outil
        if (this.app && this.app.currentToolInstance && this.app.currentToolInstance.constructor.name === 'PolylineTool') {
            if (typeof this.app.currentToolInstance.undoLastPoint === 'function') {
                this.app.currentToolInstance.undoLastPoint();
                return;
            }
        }
        
        // Sinon, utiliser l'ancienne logique pour les autres modes
        if (this.isDrawing && this.drawingMode === 'polyline' && this.drawingPoints.length > 1) {
            // Nettoyer d'abord les objets temporaires de preview
            if (this.tempObject) {
                this.app.scene.remove(this.tempObject);
                if (this.tempObject.geometry) this.tempObject.geometry.dispose();
                if (this.tempObject.material) this.tempObject.material.dispose();
                this.tempObject = null;
            }
            
            // Vérifier si on doit annuler un arc entier
            let pointsToRemove = 1;
            let segmentsToRemove = 1;
            
            // Vérifier si le dernier segment ajouté était un arc
            // On peut le détecter en vérifiant si plusieurs segments consécutifs ont été ajoutés d'un coup
            if (this.lastArcSegmentCount && this.lastArcSegmentCount > 1) {
                // C'était un arc, on doit retirer tous les points de l'arc
                pointsToRemove = this.lastArcSegmentCount;
                segmentsToRemove = this.lastArcSegmentCount - 1; // Un arc de N points a N-1 segments
            }
            
            // Supprimer les segments de ligne correspondants
            const segmentsRemoved = this.removeLastPolylineSegments(segmentsToRemove);
            
            // Ajuster le nombre de points à retirer si nécessaire
            if (segmentsRemoved < segmentsToRemove && this.lastArcSegmentCount) {
                // Si on n'a pas pu supprimer tous les segments attendus, ajuster
                pointsToRemove = segmentsRemoved + 1;
            }
            
            // Retirer les points correspondants
            for (let i = 0; i < pointsToRemove; i++) {
                if (this.drawingPoints.length > 1) {
                    this.drawingPoints.pop();
                }
            }
            
            // Réinitialiser le compteur d'arc
            this.lastArcSegmentCount = null;
            
            // Nettoyer les guides d'accrochage
            this.clearSnapHelpers();
            
            // Forcer un rendu pour s'assurer que tous les changements sont visibles
            this.app.renderer.render(this.app.scene, this.app.camera);
            
            // Mettre à jour l'affichage pour continuer le dessin
            const totalDistance = this.calculatePolylineDistance(this.drawingPoints);
            const cmdOutput = document.getElementById('command-output');
            if (this.drawingPoints.length === 1) {
                cmdOutput.textContent = 'Cliquez pour le point suivant (clic droit pour options)';
            } else {
                cmdOutput.textContent = `Distance totale: ${totalDistance.toFixed(2)} cm - Cliquez pour le point suivant (clic droit pour options)`;
            }
            
            console.log(`Points annulés: ${pointsToRemove}. Points restants: ${this.drawingPoints.length}. Continuation du dessin.`);
        }
    }

    removeLastPolylineSegments(count) {
        let removed = 0;
        
        // Supprimer d'abord des segments temporaires
        while (removed < count && this.temporaryPolylineSegments.length > 0) {
            const segment = this.temporaryPolylineSegments.pop();
            this.app.scene.remove(segment);
            if (segment.geometry) segment.geometry.dispose();
            if (segment.material) segment.material.dispose();
            removed++;
        }
        
        // Si on n'a pas supprimé assez de segments temporaires, chercher dans les objets principaux
        if (removed < count) {
            const pointsToCheck = Math.min(count + 1, this.drawingPoints.length);
            const segmentsToRemove = [];
            
            for (let i = this.app.objects.length - 1; i >= 0 && removed < count; i--) {
                const obj = this.app.objects[i];
                if (obj instanceof THREE.Line && 
                    obj.geometry && 
                    obj.geometry.attributes.position &&
                    obj.geometry.attributes.position.count === 2 &&
                    obj.material instanceof THREE.LineBasicMaterial &&
                    obj !== this.tempObject) {
                    
                    const positions = obj.geometry.attributes.position;
                    const segmentStart = new THREE.Vector3(
                        positions.getX(0),
                        positions.getY(0),
                        positions.getZ(0)
                    );
                    const segmentEnd = new THREE.Vector3(
                        positions.getX(1),
                        positions.getY(1),
                        positions.getZ(1)
                    );
                    
                    // Vérifier si ce segment fait partie des derniers segments de la polyligne
                    for (let j = this.drawingPoints.length - 1; j >= Math.max(0, this.drawingPoints.length - pointsToCheck); j--) {
                        if (j > 0) {
                            const point1 = this.drawingPoints[j - 1];
                            const point2 = this.drawingPoints[j];
                            
                            if ((segmentStart.distanceTo(point1) < 0.01 && segmentEnd.distanceTo(point2) < 0.01) ||
                                (segmentStart.distanceTo(point2) < 0.01 && segmentEnd.distanceTo(point1) < 0.01)) {
                                segmentsToRemove.push({index: i, object: obj});
                                removed++;
                                break;
                            }
                        }
                    }
                }
            }
            
            // Supprimer les segments trouvés
            segmentsToRemove.sort((a, b) => b.index - a.index);
            
            for (const segment of segmentsToRemove) {
                this.app.scene.remove(segment.object);
                this.app.objects.splice(segment.index, 1);
                
                const layerObjects = this.app.layers[this.app.currentLayer].objects;
                const layerIndex = layerObjects.indexOf(segment.object);
                if (layerIndex !== -1) {
                    layerObjects.splice(layerIndex, 1);
                }
                
                this.app.addToHistory('delete', segment.object);
                
                if (segment.object.geometry) segment.object.geometry.dispose();
                if (segment.object.material) segment.object.material.dispose();
            }
        }
        
        return removed;
    }
    
    findLastPolylineSegment() {
        // Chercher le dernier segment de polyligne créé (ligne solide, pas en pointillés)
        // Il faut chercher spécifiquement le segment qui se termine par le dernier point de la polyligne
        if (this.drawingPoints.length < 2) return -1;
        
        const currentLastPoint = this.drawingPoints[this.drawingPoints.length - 1];
        const currentSecondLastPoint = this.drawingPoints[this.drawingPoints.length - 2];
        
        for (let i = this.app.objects.length - 1; i >= 0; i--) {
            const obj = this.app.objects[i];
            if (obj instanceof THREE.Line && 
                obj.geometry && 
                obj.geometry.attributes.position &&
                obj.geometry.attributes.position.count === 2 &&
                obj.material instanceof THREE.LineBasicMaterial && // Ligne solide, pas en pointillés
                obj !== this.tempObject) { // S'assurer que ce n'est pas l'objet temporaire
                
                const positions = obj.geometry.attributes.position;
                const segmentStart = new THREE.Vector3(
                    positions.getX(0),
                    positions.getY(0),
                    positions.getZ(0)
                );
                const segmentEnd = new THREE.Vector3(
                    positions.getX(1),
                    positions.getY(1),
                    positions.getZ(1)
                );
                
                // Vérifier si ce segment correspond exactement au dernier segment de la polyligne
                // (du avant-dernier point vers le dernier point)
                if ((segmentStart.distanceTo(currentSecondLastPoint) < 0.01 && 
                     segmentEnd.distanceTo(currentLastPoint) < 0.01) ||
                    (segmentStart.distanceTo(currentLastPoint) < 0.01 && 
                     segmentEnd.distanceTo(currentSecondLastPoint) < 0.01)) {
                    return i;
                }
            }
        }
        return -1;
    }
    
    closePolyline() {
        if (this.isDrawing && this.drawingMode === 'polyline' && this.drawingPoints.length >= 3) {
            // Ajouter le premier point à la fin pour fermer la polyligne
            this.drawingPoints.push(this.drawingPoints[0].clone());
            
            // Créer directement une surface fermée
            this.createSurfaceFromPoints(this.drawingPoints);
            
            // Créer aussi la polyligne fermée
            this.finishPolyline();
        }
    }
    
    showPolylineTooltip(x, y, distance, segmentDistance = null, angle = null, relativeAngle = null, radius = null) {
        if (!this.polylineTooltip) return;
        
        let content = `Distance totale: ${distance.toFixed(2)} cm`;
        if (segmentDistance !== null) {
            content += `<br>Segment: ${segmentDistance.toFixed(2)} cm`;
        }
        if (angle !== null) {
            content += `<br>Angle: ${angle.toFixed(1)}°`;
        }
        if (relativeAngle !== null) {
            content += `<br>Angle relatif: ${relativeAngle.toFixed(1)}°`;
        }
        if (radius !== null) {
            content += `<br>Rayon: ${radius.toFixed(2)} cm`;
        }
        
        this.polylineTooltip.innerHTML = content;
        this.polylineTooltip.style.left = `${x + 15}px`;
        this.polylineTooltip.style.top = `${y - 10}px`;
        this.polylineTooltip.style.display = 'block';
    }
    
    hidePolylineTooltip() {
        if (this.polylineTooltip) {
            this.polylineTooltip.style.display = 'none';
        }
    }
      togglePolylineArcMode() {
        this.polylineArcMode = !this.polylineArcMode;
        
        // Synchroniser avec l'outil Polyligne actuel
        if (this.webcad && this.webcad.toolManager && this.webcad.toolManager.currentTool) {
            const currentTool = this.webcad.toolManager.currentTool;
            if (currentTool.constructor.name === 'PolylineTool') {
                currentTool.arcMode = this.polylineArcMode;
                currentTool.arcPoints = [];
                
                // Mettre à jour l'indicateur de mode si il existe
                if (currentTool.updateModeIndicator) {
                    currentTool.updateModeIndicator();
                }
            }
        }
        
        if (this.polylineArcMode) {
            this.polylineArcPoints = [];
            document.getElementById('command-output').textContent = 'Mode ARC activé - Cliquez pour le point de départ de l\'arc';
        } else {
            this.polylineArcPoints = [];
            document.getElementById('command-output').textContent = 'Mode LIGNE activé - Cliquez pour continuer la polyligne';
        }
    }
    
    calculateArcMiddlePoint(startPoint, endPoint, mousePoint) {
        // Calculer le point milieu de l'arc basé sur la position de la souris
        const midPoint = new THREE.Vector3(
            (startPoint.x + endPoint.x) / 2,
            (startPoint.y + endPoint.y) / 2,
            0
        );
        
        // Calculer la direction perpendiculaire à la ligne start-end
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const perpX = -dy;
        const perpY = dx;
        const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
        
        if (perpLength < 0.001) return midPoint;
        
        // Normaliser la direction perpendiculaire
        const perpNormX = perpX / perpLength;
        const perpNormY = perpY / perpLength;
        
        // Calculer la distance de la souris à la ligne start-end
        const mouseToMidX = mousePoint.x - midPoint.x;
        const mouseToMidY = mousePoint.y - midPoint.y;
        
        // Projeter cette distance sur la direction perpendiculaire
        const projection = mouseToMidX * perpNormX + mouseToMidY * perpNormY;
        
        // Limiter la courbure
        const maxCurvature = Math.min(100, Math.sqrt(dx * dx + dy * dy) / 2);
        const limitedProjection = Math.max(-maxCurvature, Math.min(maxCurvature, projection));
        
        return new THREE.Vector3(
            midPoint.x + perpNormX * limitedProjection,
            midPoint.y + perpNormY * limitedProjection,
            0
        );
    }
    
    createArcGeometry(startPoint, middlePoint, endPoint) {
        try {
            const center = this.calculateCircleCenter(startPoint, middlePoint, endPoint);
            if (!center) return null;
            
            const radius = center.distanceTo(startPoint);
            if (radius < 0.001) return null;
            
            // Calculer les angles
            const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
            const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
            const middleAngle = Math.atan2(middlePoint.y - center.y, middlePoint.x - center.x);
            
            // Déterminer la direction de l'arc (horaire ou anti-horaire)
            let deltaStart = this.normalizeAngle(middleAngle - startAngle);
            let deltaEnd = this.normalizeAngle(endAngle - middleAngle);
            
            let actualStartAngle = startAngle;
            let actualEndAngle = endAngle;
            
            // Ajuster les angles pour un arc continu
            if (deltaStart > 0 && deltaEnd > 0) {
                // Arc anti-horaire
                if (endAngle < startAngle) {
                    actualEndAngle = endAngle + 2 * Math.PI;
                }
            } else if (deltaStart < 0 && deltaEnd < 0) {
                // Arc horaire
                if (endAngle > startAngle) {
                    actualEndAngle = endAngle - 2 * Math.PI;
                }
            }
            
            // Créer les points de l'arc
            const segments = Math.max(8, Math.floor(Math.abs(actualEndAngle - actualStartAngle) * 32 / (2 * Math.PI)));
            const points = [];
            
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const angle = actualStartAngle + (actualEndAngle - actualStartAngle) * t;
                const x = center.x + radius * Math.cos(angle);
                const y = center.y + radius * Math.sin(angle);
                points.push(new THREE.Vector3(x, y, 0));
            }
            
            return new THREE.BufferGeometry().setFromPoints(points);
        } catch (error) {
            console.warn('Erreur lors de la création de l\'arc:', error);
            return null;
        }
    }
    
    calculateCircleCenter(p1, p2, p3) {
        const ax = p1.x, ay = p1.y;
        const bx = p2.x, by = p2.y;
        const cx = p3.x, cy = p3.y;
        
        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(d) < 0.0001) return null;
        
        const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
        const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
        
        return new THREE.Vector3(ux, uy, 0);
    }
    
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
    
    createSurfaceFromPoints(points) {
        if (points.length < 3) return;
        
        try {
            // Créer une forme fermée
            const shape = new THREE.Shape();
            shape.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length; i++) {
                shape.lineTo(points[i].x, points[i].y);
            }
            
            // Créer la géométrie de la surface
            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshPhongMaterial({
                color: 0xcccccc,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });
            
            const surface = new THREE.Mesh(geometry, material);
            surface.position.z = 0.001;
            surface.renderOrder = 5;
            
            this.app.scene.add(surface);
            this.app.objects.push(surface);
            this.app.layers[this.app.currentLayer].objects.push(surface);
            this.app.addToHistory('create', surface);
            
            console.log('Surface créée à partir de la polyligne fermée');
        } catch (error) {
            console.warn('Erreur lors de la création de la surface:', error);
        }
    }
    
    cancelDrawing() {
        if (this.app.currentTool === 'line' && this.lineTool.active) {
            this.lineTool.cancel();
        } else if (this.app.currentTool === 'rect' && this.rectangleTool.active) {
            this.rectangleTool.cancel();
        } else if (this.app.currentTool === 'circle' && this.circleTool.active) {
            this.circleTool.cancel();
        } else if (this.app.currentTool === 'parallel' && this.parallelTool.active) {
            this.parallelTool.cancel();
        } else if (this.app.currentTool === 'trim' && this.trimTool.active) {
            this.trimTool.cancel();
        } else if (this.app.currentTool === 'extend' && this.extendTool.active) {
            this.extendTool.cancel();
        } else if (this.app.currentTool === 'hatch' && this.hatchTool.active) {
            this.hatchTool.cancel();
        } else if (this.app.currentTool === 'surface' && this.surfaceTool.active) {
            this.surfaceTool.cancel();
        } else if (this.app.currentTool === 'dimension' && this.dimensionTool.active) {
            this.dimensionTool.cancel();
        } else if (this.isDrawing) {
            if (this.drawingMode === 'polyline' && this.drawingPoints.length >= 0) {
                this.hideContextMenu();
                
                // Nettoyer spécifiquement tous les segments temporaires de polyligne
                if (this.temporaryPolylineSegments && this.temporaryPolylineSegments.length > 0) {
                    this.temporaryPolylineSegments.forEach(seg => {
                        this.app.scene.remove(seg);
                        if (seg.geometry) seg.geometry.dispose();
                        if (seg.material) seg.material.dispose();
                    });
                    this.temporaryPolylineSegments = [];
                }
            }
            // Réinitialiser le mode arc si nécessaire
            if (this.drawingMode === 'polyline') {
                this.polylineArcMode = false;
                this.polylineArcPoints = [];
            }
            
            // Nettoyer tous les objets temporaires
            this.clearAllTemporaryObjects();
            
            // Forcer un rendu pour s'assurer que tout est nettoyé
            if (this.app.renderer && this.app.scene && this.app.camera) {
                this.app.renderer.render(this.app.scene, this.app.camera);
            }
            
            this.endDrawing();
        }
         
        if (this.app.toolManager && this.app.currentTool !== 'select' &&
            !['line', 'rect', 'circle', 'parallel', 'trim', 'extend', 'hatch'].includes(this.app.currentTool)) {
            this.app.toolManager.setTool('select');
        } else if (!this.lineTool.active && !this.rectangleTool.active && !this.circleTool.active &&
                   !this.parallelTool.active && !this.trimTool.active && !this.extendTool.active && !this.hatchTool.active &&
                   !this.isDrawing) {
             if (this.app.toolManager && this.app.currentTool !== 'select') {
                this.app.toolManager.setTool('select');
             }
        }
    }

    handleKeyboard(event) {
        console.log(`[DrawingManager handleKeyboard] Method called. Key: '${event.key}'. Current tool instance:`, this.app ? this.app.currentToolInstance : 'N/A');
        if (this.app && this.app.currentToolInstance && typeof this.app.currentToolInstance.handleKeyboard === 'function') {
            try {
                this.app.currentToolInstance.handleKeyboard(event);
                console.log('[DrawingManager handleKeyboard] Passed event to currentToolInstance.');
            } catch (e) {
                console.error('[DrawingManager handleKeyboard] Error calling handleKeyboard on currentToolInstance:', e);
            }
        } else {
            console.warn('[DrawingManager handleKeyboard] No current tool instance or its handleKeyboard is not a function.');
        }
    }

    calculatePolylineDistance(points, includePreviewPoint = null) {
        if (points.length < 2) return 0;
        
        let totalDistance = 0;
        const allPoints = includePreviewPoint ? [...points, includePreviewPoint] : points;
        
        for (let i = 0; i < allPoints.length - 1; i++) {
            totalDistance += allPoints[i].distanceTo(allPoints[i + 1]);
        }
        
        return totalDistance;
    }
      handleDrawing(point, event) {
        const cmdOutput = document.getElementById('command-output');
        let adjustedPoint = point;

        // Guard against invalid point input
        if (!adjustedPoint || typeof adjustedPoint.x === 'undefined' || typeof adjustedPoint.y === 'undefined' || typeof adjustedPoint.z === 'undefined') {
            console.warn('DrawingManager.handleDrawing: Received invalid point.', adjustedPoint);
            return;
        }
          switch(this.app.currentTool) {
            case 'line':
                this.lineTool.handleClick(adjustedPoint, event);
                break;
            case 'polyline':
                this.polylineTool.onMouseDown(event);
                break;
            case 'rect':
                this.rectangleTool.handleClick(adjustedPoint, event);
                break;            case 'circle':
                this.circleTool.handleClick(adjustedPoint, event);
                break;
            case 'parallel':
                this.parallelTool.handleClick(adjustedPoint, event);
                break;
            case 'trim':
                this.trimTool.handleClick(adjustedPoint);
                break;
            case 'extend':
                this.extendTool.handleClick(adjustedPoint);
                break;            case 'hatch':
                this.hatchTool.handleClick(adjustedPoint, event);
                break;
            case 'surface':
                this.surfaceTool.handleClick(adjustedPoint);
                break;            case 'dimension':
                this.dimensionTool.handleClick(adjustedPoint);
                break;
                
            case 'box':
            case 'sphere':
            case 'cylinder':
                this.createObject(adjustedPoint);
                break;
        }
    }    startDrawing(mode) {
        this.lineTool.deactivate();
        this.parallelTool.deactivate();
        this.trimTool.deactivate();
        this.extendTool.deactivate();
        this.hatchTool.deactivate();
        this.rectangleTool.deactivate();
        this.circleTool.deactivate();
        this.surfaceTool.deactivate();
        this.dimensionTool.deactivate();
        this.polylineTool.deactivate();

        // Réinitialiser l'état de base
        this.drawingMode = mode;
        this.drawingPoints = [];
        this.activeTool = null;
        
        // Déterminer si on doit être en mode dessin selon l'outil
        const drawingModes = ['line', 'polyline', 'rect', 'circle', 'arc', 'parallel'];
        this.isDrawing = drawingModes.includes(mode);
        
        if (this.tempObject) {
            this.app.scene.remove(this.tempObject);
            this.tempObject = null;
        }

        if (mode === 'line') {
            this.lineTool.activate();
            this.activeTool = this.lineTool;
        } else if (mode === 'polyline') {
            this.polylineTool.activate();
            this.activeTool = this.polylineTool;
            this.app.controls.enabled = false;
            console.log('🔧 DrawingManager: Mode polyline activé, isDrawing =', this.isDrawing, ', drawingMode =', this.drawingMode);
        } else if (mode === 'parallel') {
            this.parallelTool.activate();
            this.activeTool = this.parallelTool;
        } else if (mode === 'trim') {
            this.trimTool.activate();
            this.activeTool = this.trimTool;
        } else if (mode === 'extend') {
            this.extendTool.activate();
            this.activeTool = this.extendTool;
        } else if (mode === 'hatch') {
            this.hatchTool.activate();
            this.activeTool = this.hatchTool;
        } else if (mode === 'rect') {
            this.rectangleTool.activate();
            this.activeTool = this.rectangleTool;
        } else if (mode === 'circle') {
            this.circleTool.activate();
            this.activeTool = this.circleTool;
        } else if (mode === 'surface') {
            this.surfaceTool.activate();
            this.activeTool = this.surfaceTool;
        } else if (mode === 'dimension') {
            this.dimensionTool.activate();
            this.activeTool = this.dimensionTool;
        } else {
            this.isDrawing = true;
            this.app.controls.enabled = false;
        }
    }    updateDrawingPreview(currentPoint, event) {
        if (this.contextMenu && this.contextMenu.style.display === 'block') {
            return;
        }
        if (document.getElementById('length-input-popup')) {
            return;
        }
          if (this.app.currentTool === 'line' && this.lineTool.active && this.lineTool.isDrawing) {
            this.lineTool.updatePreview(currentPoint);
            return;        } else if (this.app.currentTool === 'polyline' && this.polylineTool.drawing) {
            this.polylineTool.onMouseMove(event);
            return;
        } else if (this.app.currentTool === 'rect' && this.rectangleTool.active) {
            this.rectangleTool.handleMouseMove(currentPoint, event);
            return;        } else if (this.app.currentTool === 'circle' && this.circleTool.active) {
            this.circleTool.handleMouseMove(currentPoint, event);
            return;
        } else if (this.app.currentTool === 'parallel' && this.parallelTool.active) {
            this.parallelTool.updatePreview(currentPoint);
            return;
        } else if (this.app.currentTool === 'trim' && this.trimTool.active) {
            this.trimTool.updatePreview(currentPoint);
            return;
        } else if (this.app.currentTool === 'dimension' && this.dimensionTool.active) {
            this.dimensionTool.updatePreview(currentPoint);
            return;
        }
        
        if (!this.isDrawing || (this.drawingMode !== 'polyline' && this.drawingPoints.length === 0)) {
            return;
        }
        
        if (this.tempObject) {
            this.app.scene.remove(this.tempObject);
            if (this.tempObject.geometry) this.tempObject.geometry.dispose();
            if (this.tempObject.material) this.tempObject.material.dispose();
            this.tempObject = null;
        }
        
        this.clearSnapHelpers();

        let previewPoint = currentPoint;

        if (this.drawingMode === 'polyline' && this.isDrawing && this.drawingPoints.length > 0) {
            const startPoint = this.drawingPoints[this.drawingPoints.length - 1];
            const snapToCloseDistance = 0.5;

            const isHighPrioritySnap = this.app.snapManager.currentSnapType === 'Intersection' || 
                                     this.app.snapManager.currentSnapType?.includes('Point') ||
                                     this.app.snapManager.currentSnapType === 'Extrémité';

            if (this.drawingPoints.length >= 2 && currentPoint.distanceTo(this.drawingPoints[0]) < snapToCloseDistance) {
                previewPoint = this.drawingPoints[0].clone();
            } else if (isHighPrioritySnap) {
                previewPoint = currentPoint;
            } else if (this.angleSnap && !this.shiftPressed) {
                previewPoint = this.snapToAngleIncrement(startPoint, currentPoint, this.angleSnapIncrement);
            }

            this.showLineSnapGuides(startPoint, previewPoint);

            const totalDistance = this.calculatePolylineDistance(this.drawingPoints, previewPoint);
            const segmentDistance = this.drawingPoints.length > 0
                ? this.drawingPoints[this.drawingPoints.length - 1].distanceTo(previewPoint)
                : 0;

            const dx = previewPoint.x - startPoint.x;
            const dy = previewPoint.y - startPoint.y;
            const angleFromRedAxis = Math.atan2(dy, dx) * (180 / Math.PI);
            const normalizedAngle = ((angleFromRedAxis % 360) + 360) % 360;

            let relativeAngle = null;
            if (this.drawingPoints.length > 1) {
                const previousPoint = this.drawingPoints[this.drawingPoints.length - 2];
                const prevDx = startPoint.x - previousPoint.x;
                const prevDy = startPoint.y - previousPoint.y;
                const prevAngle = Math.atan2(prevDy, prevDx) * (180 / Math.PI);
                const prevNormalizedAngle = ((prevAngle % 360) + 360) % 360;
                
                relativeAngle = normalizedAngle - prevNormalizedAngle;
                
                if (relativeAngle > 180) relativeAngle -= 360;
                if (relativeAngle < -180) relativeAngle += 360;
            }

            if (event) {
                this.showPolylineTooltip(event.clientX, event.clientY, totalDistance, segmentDistance, normalizedAngle, relativeAngle);
            }
        }
        
        switch (this.drawingMode) {
            case 'polyline':
                if (this.polylineArcMode && this.polylineArcPoints && this.polylineArcPoints.length > 0) {
                    if (this.polylineArcPoints.length === 1) {
                        const points = [this.polylineArcPoints[0], currentPoint];
                        const geometry = new THREE.BufferGeometry().setFromPoints(points);
                        const material = new THREE.LineDashedMaterial({ 
                            color: 0xff0000,
                            linewidth: 2,
                            scale: 1,
                            dashSize: 0.3,
                            gapSize: 0.3,
                            opacity: 0.7,
                            transparent: true
                        });
                        this.tempObject = new THREE.Line(geometry, material);
                        this.tempObject.computeLineDistances();
                        this.tempObject.renderOrder = 999;
                        this.app.scene.add(this.tempObject);
                    } else if (this.polylineArcPoints.length === 2) {
                        const startPoint = this.polylineArcPoints[0];
                        const endPoint = this.polylineArcPoints[1];
                        const middlePoint = this.calculateArcMiddlePoint(startPoint, endPoint, currentPoint);
                        
                        const arcGeometry = this.createArcGeometry(startPoint, middlePoint, endPoint);
                        if (arcGeometry) {
                            const material = new THREE.LineDashedMaterial({ 
                                color: 0xff0000,
                                linewidth: 3,
                                scale: 1,
                                dashSize: 0.3,
                                gapSize: 0.3,
                                opacity: 0.7,
                                transparent: true
                            });
                            this.tempObject = new THREE.Line(arcGeometry, material);
                            this.tempObject.computeLineDistances();
                            this.tempObject.renderOrder = 999;
                            this.app.scene.add(this.tempObject);
                            
                            if (event) {
                                const center = this.calculateCircleCenter(startPoint, middlePoint, endPoint);
                                if (center) {
                                    const radius = center.distanceTo(startPoint);
                                    this.showPolylineTooltip(
                                        event.clientX, 
                                        event.clientY, 
                                        this.calculatePolylineDistance(this.drawingPoints),
                                        null,
                                        null,
                                        null,
                                        radius
                                    );
                                }
                            }
                        }
                    }
                } else {
                    if (this.drawingPoints.length > 0) {
                        const lastPoint = this.drawingPoints[this.drawingPoints.length - 1];
                        const points = [lastPoint, previewPoint];
                        const geometry = new THREE.BufferGeometry().setFromPoints(points);
                        const material = new THREE.LineDashedMaterial({ 
                            color: 0x666666,
                            linewidth: 2,
                            scale: 1,
                            dashSize: 0.3,
                            gapSize: 0.3,
                            opacity: 0.7,
                            transparent: true
                        });
                        this.tempObject = new THREE.Line(geometry, material);
                        this.tempObject.computeLineDistances();
                        this.tempObject.renderOrder = 999;
                        this.app.scene.add(this.tempObject);
                    }
                }
                break;
        }
    }    finishLine() {
        if (this.drawingPoints.length >= 2) {
            const geometry = new THREE.BufferGeometry().setFromPoints(this.drawingPoints);
            const material = new THREE.LineBasicMaterial({ 
                color: 0x000000, // Couleur noire par défaut
                linewidth: 2,
                opacity: 1,
                transparent: false,
                depthTest: true,
                depthWrite: true
            });
            const line = new THREE.Line(geometry, material);
            line.renderOrder = 10;
            line.updateMatrix();
            line.matrixAutoUpdate = true;
            
            this.app.scene.add(line);
            this.app.objects.push(line);
            this.app.layers[this.app.currentLayer].objects.push(line);
            
            this.app.addToHistory('create', line);
            
            if (this.app.uiManager) {
                this.app.uiManager.updateHistoryPanel();
            }
            
            this.checkForClosedShape(line);
        }
        
        this.endDrawing();
    }
    
    finishRectangle() {
        if (this.drawingPoints.length >= 2) {
            const p1 = this.drawingPoints[0];
            const p2 = this.drawingPoints[1];
            const width = Math.abs(p2.x - p1.x) || 0.1;
            const height = Math.abs(p2.y - p1.y) || 0.1;
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            
            const geometry = new THREE.PlaneGeometry(width, height);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9,
                depthTest: true,
                depthWrite: true
            });
            const rect = new THREE.Mesh(geometry, material);
            rect.position.set(centerX, centerY, 0.001);
            rect.renderOrder = 10;
            rect.castShadow = true;
            rect.receiveShadow = true;
            
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
                color: 0x000000,
                linewidth: 2
            }));
            edgeLines.renderOrder = 11;
            rect.add(edgeLines);
            
            rect.userData = {
                type: 'rectangle',
                width: width,
                height: height
            };
            
            this.app.scene.add(rect);
            this.app.objects.push(rect);
            
            if (this.app.layers && this.app.layers.length > 0) {
                const layerIndex = this.app.currentLayer || 0;
                if (this.app.layers[layerIndex]) {
                    this.app.layers[layerIndex].objects.push(rect);
                }
            }
            
            this.app.addToHistory('create', rect);
            
            if (this.app.uiManager) {
                this.app.uiManager.updateHistoryPanel();
            }
        }
        
        this.endDrawing();
    }
    
    finishCircle() {
        if (this.drawingPoints.length >= 2) {
            const center = this.drawingPoints[0];
            const radius = center.distanceTo(this.drawingPoints[1]) || 0.1;
            
            const geometry = new THREE.CircleGeometry(radius, 32);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9,
                depthTest: true,
                depthWrite: true
            });
            const circle = new THREE.Mesh(geometry, material);
            circle.position.copy(center);
            circle.position.z = 0.001;
            circle.renderOrder = 10;
            circle.castShadow = true;
            circle.receiveShadow = true;
            
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
                color: 0x000000,
                linewidth: 2
            }));
            edgeLines.renderOrder = 11;
            circle.add(edgeLines);
            
            this.app.scene.add(circle);
            this.app.objects.push(circle);
            
            if (this.app.layers && this.app.layers.length > 0) {
                const layerIndex = this.app.currentLayer || 0;
                if (this.app.layers[layerIndex]) {
                    this.app.layers[layerIndex].objects.push(circle);
                }
            }
            
            this.app.addToHistory('create', circle);
            
            if (this.app.uiManager) {
                this.app.uiManager.updateHistoryPanel();
            }
        }
        
        this.endDrawing();
    }      finishPolyline() {
        if (this.drawingPoints.length >= 2) {
            this.clearAllTemporaryObjects();            const geometry = new THREE.BufferGeometry().setFromPoints(this.drawingPoints);
            const originalColor = 0x000000; // Couleur noire par défaut
            const material = new THREE.LineBasicMaterial({ 
                color: originalColor,
                linewidth: 5,
                opacity: 1,
                transparent: false
            });
            const polyline = new THREE.Line(geometry, material);
            
            // AJOUT DES PROPRIÉTÉS USERDATA POUR LA SÉLECTION
            polyline.userData.type = 'polyline';
            polyline.userData.points = this.drawingPoints.map(p => p.clone());
            polyline.userData.originalColor = originalColor; // Stocker la couleur originale
            polyline.name = 'Polyline';
            
            polyline.renderOrder = 10;
            polyline.updateMatrix();
            polyline.matrixAutoUpdate = true;
            this.app.scene.add(polyline);
            this.app.objects.push(polyline);
            this.app.layers[this.app.currentLayer].objects.push(polyline);
            this.app.addToHistory('create', polyline);

            this.temporaryPolylineSegments.forEach(seg => {
                this.app.scene.remove(seg);
                if (seg.geometry) seg.geometry.dispose();
                if (seg.material) seg.material.dispose();
            });
            this.temporaryPolylineSegments = [];

            if (this.app.uiManager) {
                this.app.uiManager.updateHistoryPanel();
            }
            const totalDistance = this.calculatePolylineDistance(this.drawingPoints);
            document.getElementById('command-output').textContent = 
                `Polyligne créée - Distance totale: ${totalDistance.toFixed(2)} cm`;
            this.checkForClosedShape(polyline);
        }
        
        this.endDrawing();
        this.hideContextMenu();
    }

    checkForClosedShape(polyline) {
        // Check if the polyline forms a closed shape and create surface if needed
        if (this.drawingPoints.length >= 3) {
            const firstPoint = this.drawingPoints[0];
            const lastPoint = this.drawingPoints[this.drawingPoints.length - 1];
            const tolerance = 0.5;
            
            if (firstPoint.distanceTo(lastPoint) < tolerance) {
                console.log('Closed shape detected, creating surface');
                this.createSurfaceFromPoints(this.drawingPoints);
            }
        }
    }
    
    createObject(position) {
        let geometry, material, mesh;
        
        switch(this.app.currentTool) {
            case 'box':
                geometry = new THREE.BoxGeometry(10, 10, 10);
                material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(position);
                mesh.position.z = 5;
                mesh.renderOrder = 10;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                const boxEdges = new THREE.EdgesGeometry(geometry);
                const boxLines = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ 
                    color: 0x000000,
                    linewidth: 2
                }));
                boxLines.renderOrder = 11;
                mesh.add(boxLines);
                break;
                
            case 'sphere':
                geometry = new THREE.SphereGeometry(5, 32, 16);
                material = new THREE.MeshPhongMaterial({ color: 0x0000ff });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(position);
                mesh.position.z = 5;
                mesh.renderOrder = 10;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                const sphereEdges = new THREE.EdgesGeometry(geometry);
                const sphereLines = new THREE.LineSegments(sphereEdges, new THREE.LineBasicMaterial({ 
                    color: 0x000000,
                    linewidth: 2
                }));
                sphereLines.renderOrder = 11;
                mesh.add(sphereLines);
                break;
                
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(5, 5, 10, 32);
                material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(position);
                mesh.position.z = 5;
                mesh.renderOrder = 10;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                const cylinderEdges = new THREE.EdgesGeometry(geometry);
                const cylinderLines = new THREE.LineSegments(cylinderEdges, new THREE.LineBasicMaterial({ 
                    color: 0x000000,
                    linewidth: 2
                }));
                cylinderLines.renderOrder = 11;
                mesh.add(cylinderLines);
                break;
        }
        
        if (mesh) {
            this.app.scene.add(mesh);
            this.app.objects.push(mesh);
            this.app.layers[this.app.currentLayer].objects.push(mesh);
            this.app.addToHistory('create', mesh);
            this.app.uiManager.updateHistoryPanel();
        }
    }
    
    applyAngleSnap(startPoint, currentPoint) {
        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const currentAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        const snappedAngle = Math.round(currentAngle / this.angleSnapIncrement) * this.angleSnapIncrement;
        const snappedAngleRad = snappedAngle * Math.PI / 180;
        
        const snappedPoint = new THREE.Vector3(
            startPoint.x + distance * Math.cos(snappedAngleRad),
            startPoint.y + distance * Math.sin(snappedAngleRad),
            currentPoint.z
        );
        
        return snappedPoint;
    }
    
    snapToAngleIncrement(startPoint, currentPoint, angleIncrement) {
        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.1) return currentPoint;

        const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const normalizedAngle = ((currentAngle % 360) + 360) % 360;

        const snappedAngle = Math.round(normalizedAngle / angleIncrement) * angleIncrement;
        const snappedAngleRad = snappedAngle * Math.PI / 180;

        return new THREE.Vector3(
            startPoint.x + distance * Math.cos(snappedAngleRad),
            startPoint.y + distance * Math.sin(snappedAngleRad),
            currentPoint.z
        );
    }

    showLineSnapGuides(startPoint, endPoint) {
        const angleIncrement = 45;
        const guideLength = 100;

        for (let angle = 0; angle < 360; angle += angleIncrement) {
            const angleRad = angle * Math.PI / 180;
            const guideEnd = new THREE.Vector3(
                startPoint.x + guideLength * Math.cos(angleRad),
                startPoint.y + guideLength * Math.sin(angleRad),
                startPoint.z
            );

            const points = [startPoint, guideEnd];
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

    showAngleTooltip(point3D, angle) {
        if (!this.polylineTooltip) return;

        const vector = point3D.clone();
        vector.project(this.app.camera);

        const rect = this.app.renderer.domElement.getBoundingClientRect();
        const x = (vector.x + 1) / 2 * rect.width + rect.left;
        const y = -(vector.y - 1) / 2 * rect.height + rect.top;

        this.polylineTooltip.innerHTML = `Angle relatif: ${angle.toFixed(1)}°`;
        this.polylineTooltip.style.left = `${x + 15}px`;
        this.polylineTooltip.style.top = `${y - 10}px`;
        this.polylineTooltip.style.display = 'block';
    }
    
    updateLineInfo(startPoint, endPoint) {
        const distance = startPoint.distanceTo(endPoint);
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const normalizedAngle = ((angle % 360) + 360) % 360;
        
        const coordsElement = document.getElementById('coordinates');
        coordsElement.innerHTML = 
            `<span style="color: #ff0000;">Rouge: ${endPoint.x.toFixed(2)} cm</span>, ` +
            `<span style="color: #00ff00;">Vert: ${endPoint.y.toFixed(2)} cm</span>, ` +
            `<span style="color: #0000ff;">Bleu: ${endPoint.z.toFixed(2)} cm</span> | ` +
            `Dist: ${distance.toFixed(2)} cm | Angle: ${normalizedAngle.toFixed(1)}°`;
    }
    
    clearAllTemporaryObjects() {
        if (this.tempObject) {
            this.app.scene.remove(this.tempObject);
            if (this.tempObject.geometry) this.tempObject.geometry.dispose();
            if (this.tempObject.material) this.tempObject.material.dispose();
            this.tempObject = null;
        }
        
        this.clearSnapHelpers();
        
        if (this.app.snapManager) {
            this.app.snapManager.hideSnapIndicator();
        }
        
        this.hidePolylineTooltip();
    }

    clearSnapHelpers() {
        this.snapHelpers.forEach(helper => {
            this.app.scene.remove(helper);
            if (helper.geometry) helper.geometry.dispose();
            if (helper.material) helper.material.dispose();
        });
        this.snapHelpers = [];
    }
    
    endDrawing() {
        this.isDrawing = false;
        this.drawingPoints = [];
        
        if (this.temporaryPolylineSegments && this.temporaryPolylineSegments.length > 0) {
            this.temporaryPolylineSegments.forEach(seg => {
                this.app.scene.remove(seg);
                if (seg.geometry) seg.geometry.dispose();
                if (seg.material) seg.material.dispose();
            });
            this.temporaryPolylineSegments = [];
        }
        
        this.clearAllTemporaryObjects();
        
        if (this.app.renderer && this.app.scene && this.app.camera) {
            this.app.renderer.render(this.app.scene, this.app.camera);
        }
        
        this.app.controls.enabled = true;
        this.hideContextMenu();
        
        document.getElementById('command-output').textContent = '';
    }

    clearTemporaryPolylineSegments() {
        const segmentsToRemove = [];
        
        this.app.scene.traverse((object) => {
            if (object instanceof THREE.Line && 
                (object.renderOrder === 999 || object.renderOrder === 998)) {
                segmentsToRemove.push(object);
            }
            else if (object instanceof THREE.LineSegments && 
                     object.renderOrder === 998) {
                segmentsToRemove.push(object);
            }
        });
        
        segmentsToRemove.forEach(segment => {
            this.app.scene.remove(segment);
            if (segment.geometry) segment.geometry.dispose();
            if (segment.material) segment.material.dispose();
        });
        
        if (segmentsToRemove.length > 0) {
            console.log(`Nettoyé ${segmentsToRemove.length} segments temporaires`);
        }
    }

    showLengthInputDialog() {
        if (!this.isDrawing || this.drawingMode !== 'polyline' || this.drawingPoints.length === 0) {
            console.warn('showLengthInputDialog: Invalid state for entering length.');
            return;
        }

        const lastPoint = this.drawingPoints[this.drawingPoints.length - 1];
        const defaultAngleDegrees = "90.0";

        const popup = document.createElement('div');
        popup.id = 'length-input-popup';        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2c3e50;
            color: white;
            border: 2px solid #3498db;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            min-width: 320px;
            font-family: Arial, sans-serif;
        `;

        const anglePresetButtonsHtml = [0, 45, 90, 135, 180, 225, 270, 315].map(angle => 
            `<button class="angle-preset-btn" data-angle="${angle}" style="
                background: #555; color: white; border: 1px solid #777; padding: 5px 10px;
                border-radius: 4px; cursor: pointer; font-size: 11px; margin: 2px;
            ">${angle}°</button>`
        ).join('');

        popup.innerHTML = `            <div style="margin-bottom: 15px; font-weight: bold; color: #3498db; border-bottom: 1px solid #34495e; padding-bottom: 8px;">
                📏 Saisir Longueur et Angle
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px;">Longueur (cm):</label>
                <input type="number" id="length-input" value="100" min="0.1" step="0.1"
                       style="width: 100%; padding: 8px; border: 1px solid #555; border-radius: 4px;
                              background: #444; color: white; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px;">Angle (degrés, 0° vers la Droite):</label>
                <input type="number" id="angle-input" value="${defaultAngleDegrees}" step="0.1"
                       style="width: 100%; padding: 8px; border: 1px solid #555; border-radius: 4px;
                              background: #444; color: white; font-size: 14px; box-sizing: border-box;">
            </div>
            <div id="angle-preset-buttons" style="margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 5px; justify-content: center;">
                ${anglePresetButtonsHtml}
            </div>
            <div style="text-align: right;">
                <button id="length-ok-btn" style="
                    background: #0078d4; color: white; border: none; padding: 8px 16px;
                    border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 8px;
                ">OK</button>
                <button id="length-cancel-btn" style="
                    background: #666; color: white; border: none; padding: 8px 16px;
                    border-radius: 4px; cursor: pointer; font-size: 12px;
                ">Annuler</button>
            </div>
        `;

        document.body.appendChild(popup);

        const lengthInput = document.getElementById('length-input');
        const angleInput = document.getElementById('angle-input');
        lengthInput.focus();
        lengthInput.select();

        document.querySelectorAll('.angle-preset-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                angleInput.value = button.dataset.angle;
                lengthInput.focus();
                lengthInput.select();
            });
        });

        const handleOK = () => {
            const length = parseFloat(lengthInput.value);
            let angleDegreesInput = parseFloat(angleInput.value);
            
            let finalAngleRadians;

            if (isNaN(angleDegreesInput)) {
                finalAngleRadians = this.rightClickAngle;
                if (typeof finalAngleRadians !== 'number' || isNaN(finalAngleRadians)) {
                    finalAngleRadians = 0;
                }
            } else {
                finalAngleRadians = angleDegreesInput * Math.PI / 180;
            }
            
            finalAngleRadians = (finalAngleRadians % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI);

            if (length && length > 0) {
                if (this.tempObject) {
                    this.app.scene.remove(this.tempObject);
                    if (this.tempObject.geometry) this.tempObject.geometry.dispose();
                    if (this.tempObject.material) this.tempObject.material.dispose();
                    this.tempObject = null;
                }
                this.clearSnapHelpers();

                const newPoint = new THREE.Vector3(
                    lastPoint.x + Math.cos(finalAngleRadians) * length,
                    lastPoint.y + Math.sin(finalAngleRadians) * length,
                    0
                );
                
                const geometry = new THREE.BufferGeometry().setFromPoints([lastPoint, newPoint]);
                const material = new THREE.LineBasicMaterial({
                    color: 0x000000,
                    linewidth: 3,
                    transparent: false
                });
                const lineSegment = new THREE.Line(geometry, material);
                lineSegment.renderOrder = 10;
                this.app.scene.add(lineSegment);
                this.temporaryPolylineSegments.push(lineSegment);
                
                this.drawingPoints.push(newPoint);
                
                const totalDistance = this.calculatePolylineDistance(this.drawingPoints);
                document.getElementById('command-output').textContent = 
                    `Distance totale: ${totalDistance.toFixed(2)} cm - Cliquez pour le point suivant (clic droit pour options)`;
                
                popup.remove();
            } else {
                alert('Veuillez saisir une longueur valide supérieure à 0.');
                lengthInput.focus();
                lengthInput.select();
            }
        };

        const handleCancel = () => {
            popup.remove();
        };

        document.getElementById('length-ok-btn').addEventListener('click', handleOK);
        document.getElementById('length-cancel-btn').addEventListener('click', handleCancel);

        lengthInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOK();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        });

        angleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOK();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        });
    }    addPolylinePoint(point) {
        if (!this.isDrawing || this.drawingMode !== 'polyline') {
            console.warn('addPolylinePoint: Invalid state for adding a point.');
            return;
        }

        const lastPoint = this.drawingPoints[this.drawingPoints.length - 1];
        this.drawingPoints.push(point);

        const geometry = new THREE.BufferGeometry().setFromPoints([lastPoint, point]);
        const material = new THREE.LineBasicMaterial({
            color: 0x000000, // Couleur noire par défaut
            linewidth: 3,
            transparent: false
        });
        const lineSegment = new THREE.Line(geometry, material);
        lineSegment.renderOrder = 10;
        this.app.scene.add(lineSegment);
        this.temporaryPolylineSegments.push(lineSegment);

        const totalDistance = this.calculatePolylineDistance(this.drawingPoints);
        document.getElementById('command-output').textContent = 
            `Distance totale: ${totalDistance.toFixed(2)} cm - Cliquez pour le point suivant (clic droit pour options)`;
    }    // Gestion du double-clic pour terminer les polylines
    handleDoubleClick(event) {
        // Nouveau système PolylineTool
        if (this.app.currentTool === 'polyline' && this.polylineTool.drawing) {
            console.log('DrawingManager: Double-clic détecté, finalisation de la polyline via PolylineTool');
            this.polylineTool.onDoubleClick(event);
            return true; // Indique que l'événement a été géré
        }
        
        // Ancien système polyline (pour compatibilité)
        if (this.isDrawing && this.drawingMode === 'polyline') {
            console.log('DrawingManager: Double-clic détecté, finalisation de la polyline');
            this.finishPolyline();
            this.exitPolylineMode();
            return true; // Indique que l'événement a été géré
        }
        return false; // Laisser d'autres gestionnaires traiter l'événement
    }
}