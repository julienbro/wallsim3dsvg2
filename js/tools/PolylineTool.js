// Importer les classes nécessaires de Three.js
import * as THREE from 'three';

// Outil Polyline
export class PolylineTool {
    constructor(webcad) {
        this.webcad = webcad;
        this.drawing = false;
        this.points = [];
        this.previewLine = null;
        this.originalSnapEnabled = null; // Pour sauvegarder l'état de l'accrochage
        this.angleSnapEnabled = true; // Accrochage angulaire activé par défaut
        this.shiftPressed = false; // État de la touche Shift
        
        // Variables pour le mode arc
        this.arcMode = false; // Mode arc désactivé par défaut
        this.arcPoints = []; // Points pour créer l'arc
          // Variables pour la saisie numérique
        this.isTypingDistance = false;
        this.typedDistance = '';
        this.distanceInputDialog = null;
        this.currentMousePosition = null;
        this.distanceInputIndicator = null; // Indicateur visuel de saisie
        this.dialogOpen = false; // Track si un dialogue est ouvert
        
        // Écouter les événements clavier pour la touche Shift
        this.keyDownHandler = (e) => this.handleKeyDown(e);
        this.keyUpHandler = (e) => this.handleKeyUp(e);
    }    activate() {
        this.webcad.renderer.domElement.style.cursor = 'crosshair';
        
        // Activer le mode dessin
        if (this.webcad.drawingManager) {
            this.webcad.drawingManager.isDrawing = true;
            this.webcad.drawingManager.drawingMode = 'polyline';
            console.log('🔧 PolylineTool: Mode dessin activé via drawingManager - isDrawing =', this.webcad.drawingManager.isDrawing, ', drawingMode =', this.webcad.drawingManager.drawingMode);
        } else if (this.webcad.isDrawing !== undefined) {
            this.webcad.isDrawing = true;
            this.webcad.drawingMode = 'polyline';
            console.log('🔧 PolylineTool: Mode dessin activé via webcad - isDrawing =', this.webcad.isDrawing, ', drawingMode =', this.webcad.drawingMode);
        }
        
        // Vérification finale de l'état
        setTimeout(() => {
            if (this.webcad.drawingManager) {
                console.log('🔍 PolylineTool: Vérification finale - drawingManager.isDrawing =', this.webcad.drawingManager.isDrawing, ', drawingMode =', this.webcad.drawingManager.drawingMode);
            }
        }, 100);
        
        // Sauvegarder l'état de l'accrochage et le désactiver
        this.originalSnapEnabled = this.webcad.snapEnabled;
        this.webcad.snapEnabled = false;
        
        // Désactiver aussi l'accrochage du SnapManager si la méthode existe
        if (this.webcad.snapManager && this.webcad.snapManager.clearSnap) {
            this.webcad.snapManager.clearSnap();
        }        // Ajouter les gestionnaires d'événements clavier
        document.addEventListener('keydown', this.keyDownHandler);
        document.addEventListener('keyup', this.keyUpHandler);
        
        // Synchroniser l'état avec le DrawingManager et mettre à jour le menu contextuel
        if (this.webcad && this.webcad.drawingManager) {
            this.webcad.drawingManager.polylineArcMode = this.arcMode;
            this.updateContextMenuText();
        }
        
        // Créer l'indicateur de mode
        this.createModeIndicator();
        
        console.log('PolylineTool activé avec accrochage polaire (pas de 0.1) et accrochage angulaire (5°)');
    }    deactivate() {
        this.webcad.renderer.domElement.style.cursor = 'auto';
        
        // Désactiver le mode dessin
        if (this.webcad.drawingManager) {
            this.webcad.drawingManager.isDrawing = false;
            this.webcad.drawingManager.drawingMode = null;
            console.log('Mode dessin désactivé: isDrawing =', this.webcad.drawingManager.isDrawing, ', drawingMode =', this.webcad.drawingManager.drawingMode);
        } else if (this.webcad.isDrawing !== undefined) {
            this.webcad.isDrawing = false;
            this.webcad.drawingMode = null;
            console.log('Mode dessin désactivé (webcad): isDrawing =', this.webcad.isDrawing, ', drawingMode =', this.webcad.drawingMode);
        }
        
        // Restaurer l'état de l'accrochage
        this.webcad.snapEnabled = this.originalSnapEnabled;
          // Supprimer les gestionnaires d'événements clavier
        document.removeEventListener('keydown', this.keyDownHandler);
        document.removeEventListener('keyup', this.keyUpHandler);
        
        // Supprimer l'indicateur de mode
        this.removeModeIndicator();
        
        // Fermer le dialogue de saisie s'il est ouvert
        this.cancelDistanceInput();
        this.closeAllDialogs(); // Fermer tous les dialogues ouverts
        
        // Réinitialiser le mode arc
        this.arcMode = false;
        this.arcPoints = [];
        
        // Nettoyer les gestionnaires d'événements du menu contextuel
        this.cleanupContextMenuHandlers();
        
        this.finishPolyline();
        this.hidePolylineTooltip();
        this.hideContextMenu();
        
        console.log('PolylineTool désactivé, accrochage normal restauré');
    }onMouseMove(event) {
        // Sauvegarder la position de la souris pour la saisie numérique
        this.currentMousePosition = event;
        
        if (!this.drawing || this.points.length < 2) return;
        
        // Si on est en train de taper une distance, ne pas mettre à jour normalement
        if (this.isTypingDistance) {
            return;
        }
        
        // Mettre à jour la position du dernier point (point de prévisualisation) avec la position de la souris
        const worldPoint = this.webcad.getWorldPoint(event);
        
        // Pour les polylignes, ne pas utiliser l'accrochage normal, seulement l'accrochage polaire
        let finalPoint = worldPoint.clone();
        
        if (this.points.length >= 2) {
            const lastDefinedPoint = this.points[this.points.length - 2]; // Le point avant le point de prévisualisation            // Si on est en mode arc et qu'on a défini les points de départ et de fin
            if (this.arcMode && this.arcPoints.length === 2) {
                // Mode arc : prévisualisation en temps réel de l'arc
                const startPoint = this.arcPoints[0];
                const endPoint = this.arcPoints[1];
                
                // Calculer le point de contrôle basé sur la position de la souris
                const controlPoint = this.calculateArcMiddlePoint(startPoint, endPoint, worldPoint);
                
                // Créer les points de l'arc en temps réel (avec moins de points pour éviter l'accumulation)
                const arcPoints = this.createArcPoints(startPoint, endPoint, controlPoint, 8);
                
                // Créer une copie temporaire COMPLÈTEMENT SÉPARÉE pour la prévisualisation
                const tempPoints = [];
                
                // Ajouter tous les points définitifs sauf le point de prévisualisation final
                for (let i = 0; i < this.points.length - 1; i++) {
                    tempPoints.push(this.points[i].clone());
                }
                
                // Ajouter les points de l'arc (en excluant le premier pour éviter duplication)
                for (let i = 1; i < arcPoints.length; i++) {
                    tempPoints.push(arcPoints[i].clone());
                }
                
                // Mettre à jour la géométrie de prévisualisation avec les points temporaires
                if (this.previewLine) {
                    // Créer une nouvelle géométrie à chaque fois pour éviter l'accumulation
                    this.previewLine.geometry.dispose();
                    this.previewLine.geometry = new THREE.BufferGeometry();
                    this.previewLine.geometry.setFromPoints(tempPoints);
                }
                
                // Afficher le tooltip pour l'arc
                const arcLength = this.calculateArcLength(startPoint, endPoint, controlPoint);
                this.showTooltip(`Mode Arc - Rayon: ${arcLength.toFixed(1)} - Cliquez pour valider`);
                
                // Ne pas continuer le traitement normal en mode arc
                return;
            } else {
                // Appliquer l'accrochage polaire et angulaire normal
                const snapResult = this.applySnapToPoint(worldPoint, lastDefinedPoint, event);
                finalPoint = snapResult.point;
                
                // Calculer la distance totale de la polyligne
                let totalDistance = 0;
                for (let i = 0; i < this.points.length - 2; i++) {
                    totalDistance += this.points[i].distanceTo(this.points[i + 1]);
                }
                totalDistance += snapResult.distance; // Ajouter le segment en cours
                // S'assurer de la précision de la distance totale
                totalDistance = Math.round(totalDistance * 10) / 10;
                
                // Calculer l'angle relatif par rapport au segment précédent
                let relativeAngle = null;
                if (this.points.length > 2) {
                    const prevDirection = new THREE.Vector3().subVectors(this.points[this.points.length - 2], this.points[this.points.length - 3]).normalize();
                    const prevAngle = Math.atan2(prevDirection.y, prevDirection.x) * 180 / Math.PI;
                    const prevNormalized = prevAngle < 0 ? prevAngle + 360 : prevAngle;
                    relativeAngle = snapResult.angle - prevNormalized;
                    if (relativeAngle > 180) relativeAngle -= 360;
                    if (relativeAngle < -180) relativeAngle += 360;
                }
                
                // Afficher le tooltip avec les informations
                this.showPolylineTooltip(event.clientX, event.clientY, totalDistance, snapResult.distance, snapResult.angle, relativeAngle);
            }
        }
        
        // TOUJOURS mettre à jour le dernier point (point de prévisualisation) et la ligne
        // Ceci garantit que la ligne fantôme suit toujours la souris, même sans accrochage
        this.points[this.points.length - 1].copy(finalPoint);
        
        // Mettre à jour la ligne de prévisualisation à chaque mouvement de souris
        if (this.previewLine) {
            this.previewLine.geometry.setFromPoints(this.points);
        }
    }    onMouseDown(event) {
        if (this.drawing) {
            const worldPoint = this.webcad.getWorldPoint(event);
            let finalPoint = worldPoint.clone();
              // Appliquer l'accrochage polaire si on a assez de points
            if (this.points.length >= 2) {
                const lastDefinedPoint = this.points[this.points.length - 2]; // Le point avant le point de prévisualisation
                const snapResult = this.applySnapToPoint(worldPoint, lastDefinedPoint, event);
                finalPoint = snapResult.point;
            }
              if (this.arcMode) {
                // Gestion du mode arc
                if (this.arcPoints.length === 0) {
                    // Premier clic en mode arc : définir le point de fin de l'arc
                    this.arcPoints.push(this.points[this.points.length - 2]); // Point de départ (dernier point fixé)
                    this.arcPoints.push(finalPoint.clone()); // Point de fin
                    
                    // Remplacer le point de prévisualisation par le point de fin
                    this.points[this.points.length - 1] = finalPoint.clone();
                    
                    this.showTooltip('Point de fin de l\'arc défini - Bougez la souris pour ajuster le rayon, cliquez pour valider');
                    console.log(`Point de fin de l'arc: (${finalPoint.x.toFixed(2)}, ${finalPoint.y.toFixed(2)})`);
                } else if (this.arcPoints.length === 2) {
                    // Deuxième clic : valider l'arc avec le rayon actuel
                    const startPoint = this.arcPoints[0];
                    const endPoint = this.arcPoints[1];                    
                    // Utiliser la position actuelle de la souris convertie en coordonnées world
                    const controlPoint = this.calculateArcMiddlePoint(startPoint, endPoint, worldPoint);
                    
                    // Créer les points de l'arc
                    const arcPoints = this.createArcPoints(startPoint, endPoint, controlPoint, 10);
                    
                    // Remplacer les points existants par l'arc
                    // Enlever le point de prévisualisation
                    this.points.pop();
                    
                    // Enlever le dernier point fixé (on va le remplacer par l'arc)
                    this.points.pop();
                    
                    // Ajouter tous les points de l'arc
                    for (let i = 0; i < arcPoints.length; i++) {
                        this.points.push(arcPoints[i].clone());
                    }
                    
                    // Ajouter un nouveau point de prévisualisation
                    this.points.push(endPoint.clone());
                    
                    // Réinitialiser le mode arc
                    this.arcPoints = [];
                    this.showTooltip('Arc créé - Cliquez pour continuer ou clic droit pour options');
                    
                    // Mettre à jour la géométrie
                    if (this.previewLine) {
                        this.previewLine.geometry.setFromPoints(this.points);
                    }
                    
                    console.log(`Arc validé de (${startPoint.x.toFixed(2)}, ${startPoint.y.toFixed(2)}) à (${endPoint.x.toFixed(2)}, ${endPoint.y.toFixed(2)})`);
                }            } else {
                // Mode ligne normal
                // Remplacer le dernier point (point de prévisualisation) par le point cliqué (avec accrochage)
                this.points[this.points.length - 1] = finalPoint.clone();
                
                // Ajouter un nouveau point de prévisualisation qui suivra la souris
                this.points.push(finalPoint.clone());
                
                // Mettre à jour la géométrie avec tous les points
                if (this.previewLine) {
                    this.previewLine.geometry.setFromPoints(this.points);
                }
                
                console.log(`🔧 PolylineTool: Point ajouté: (${finalPoint.x.toFixed(2)}, ${finalPoint.y.toFixed(2)})`);
                console.log(`🔧 PolylineTool: Nombre de points après ajout: ${this.points.length}`);
                console.log(`🔧 PolylineTool: Points tableau:`, this.points.map((p, i) => `[${i}] (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`));
            }
        } else {
            // Commencer un nouveau polygone
            this.startPolyline(event);
        }
    }

    onDoubleClick(event) {
        // Double-clic pour terminer la polyline
        if (this.drawing) {
            this.finishPolyline();
        }
    }

    finishPolyline() {
        if (!this.drawing || !this.previewLine || this.points.length < 2) {
            // Nettoyer si nécessaire
            if (this.previewLine) {
                this.webcad.scene.remove(this.previewLine);
                if (this.previewLine.geometry) this.previewLine.geometry.dispose();
                if (this.previewLine.material) this.previewLine.material.dispose();
                this.previewLine = null;
            }
            this.drawing = false;
            this.points = [];
            return;
        }

        // Enlever le dernier point (point de prévisualisation)
        this.points.pop();

        if (this.points.length < 2) {
            // Pas assez de points pour créer une ligne
            this.webcad.scene.remove(this.previewLine);
            if (this.previewLine.geometry) this.previewLine.geometry.dispose();
            if (this.previewLine.material) this.previewLine.material.dispose();
            this.previewLine = null;
            this.drawing = false;
            this.points = [];
            return;
        }

        // Créer la géométrie finale avec les points définitifs
        const finalGeometry = new THREE.BufferGeometry();
        finalGeometry.setFromPoints(this.points);

        // Créer le matériau final
        const finalMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2 
        });

        // Créer la ligne finale
        const finalLine = new THREE.Line(finalGeometry, finalMaterial);
        finalLine.userData.type = 'polyline';
        finalLine.userData.points = this.points.map(p => p.clone());
        finalLine.name = 'Polyline';

        // Ajouter à la scène et aux objets sélectionnables
        this.webcad.scene.add(finalLine);
        this.webcad.objects.push(finalLine);

        // Ajouter aux couches si disponible
        if (this.webcad.layers && this.webcad.layers[this.webcad.currentLayer]) {
            this.webcad.layers[this.webcad.currentLayer].objects.push(finalLine);
        }

        // Ajouter à l'historique
        if (this.webcad.addToHistory) {
            this.webcad.addToHistory('create', finalLine);
        }

        // Mettre à jour l'interface
        if (this.webcad.uiManager && this.webcad.uiManager.updateHistoryPanel) {
            this.webcad.uiManager.updateHistoryPanel();
        }

        // Nettoyer la prévisualisation
        this.webcad.scene.remove(this.previewLine);
        if (this.previewLine.geometry) this.previewLine.geometry.dispose();
        if (this.previewLine.material) this.previewLine.material.dispose();
        this.previewLine = null;
          // Réinitialiser l'état
        this.drawing = false;
        this.points = [];
        
        // Supprimer l'indicateur de mode après création de la polyligne
        this.removeModeIndicator();
        
        console.log("PolylineTool: Polyline créée avec", finalLine.userData.points.length, "points");
    }closePolyline() {
        if (!this.drawing || this.points.length < 3) {
            console.warn('closePolyline: Pas assez de points pour fermer la polyligne');
            return;
        }

        console.log('closePolyline: Points avant modification:', this.points.length);
        
        // Créer les points fermés : enlever le point de prévisualisation et ajouter le premier point à la fin
        const closedPoints = [];
        
        // Ajouter tous les points sauf le dernier (point de prévisualisation)
        for (let i = 0; i < this.points.length - 1; i++) {
            closedPoints.push(this.points[i].clone());
        }
        
        // Ajouter le premier point à la fin pour fermer
        closedPoints.push(this.points[0].clone());
        
        console.log('closePolyline: Points fermés créés:', closedPoints.length);
          // Créer directement la ligne fermée finale
        const finalGeometry = new THREE.BufferGeometry();
        finalGeometry.setFromPoints(closedPoints);

        const finalMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2 
        });

        const finalLine = new THREE.Line(finalGeometry, finalMaterial);
        
        // Créer aussi une surface pour la polyligne fermée
        const surfaceMesh = this.createPolygonSurface(closedPoints);
        
        // Créer un groupe pour contenir la ligne et la surface
        const polylineGroup = new THREE.Group();
        polylineGroup.add(surfaceMesh); // Surface d'abord (en arrière-plan)
        polylineGroup.add(finalLine);   // Ligne ensuite (contour visible)
        
        // Appliquer les métadonnées au groupe principal
        polylineGroup.userData.type = 'polyline';
        polylineGroup.userData.points = closedPoints;
        polylineGroup.userData.closed = true; // Marquer comme fermée
        polylineGroup.userData.isSurface = true; // Marquer comme surface pour l'outil hachure
        polylineGroup.name = 'Polyline (fermée)';

        // Ajouter à la scène et aux objets sélectionnables
        this.webcad.scene.add(polylineGroup);        this.webcad.objects.push(polylineGroup);

        // Ajouter aux couches si disponible
        if (this.webcad.layers && this.webcad.layers[this.webcad.currentLayer]) {
            this.webcad.layers[this.webcad.currentLayer].objects.push(polylineGroup);
        }

        // Ajouter à l'historique
        if (this.webcad.addToHistory) {
            this.webcad.addToHistory('create', polylineGroup);
        }

        // Mettre à jour l'interface
        if (this.webcad.uiManager && this.webcad.uiManager.updateHistoryPanel) {
            this.webcad.uiManager.updateHistoryPanel();
        }

        // Nettoyer la prévisualisation
        if (this.previewLine) {
            this.webcad.scene.remove(this.previewLine);
            if (this.previewLine.geometry) this.previewLine.geometry.dispose();
            if (this.previewLine.material) this.previewLine.material.dispose();
            this.previewLine = null;
        }
          // Réinitialiser l'état
        this.drawing = false;
        this.points = [];
        
        // Supprimer l'indicateur de mode après création de la polyligne fermée
        this.removeModeIndicator();
        
        console.log("PolylineTool: Polyligne fermée créée avec", closedPoints.length, "points");
    }toggleArcMode() {
        this.arcMode = !this.arcMode;
        this.arcPoints = []; // Réinitialiser les points d'arc
        
        // Synchroniser avec le DrawingManager
        if (this.webcad && this.webcad.drawingManager) {
            this.webcad.drawingManager.polylineArcMode = this.arcMode;
            
            // Mettre à jour immédiatement le texte du menu contextuel
            this.updateContextMenuText();
        }
        
        if (this.arcMode) {
            console.log('PolylineTool: Mode ARC activé');
            this.showTooltip('Mode ARC activé - Cliquez pour le point de fin de l\'arc');
        } else {
            console.log('PolylineTool: Mode LIGNE activé');
            this.showTooltip('Mode LIGNE activé - Cliquez pour continuer la polyligne');
        }
        
        // Mettre à jour l'indicateur de mode visuel
        this.updateModeIndicator();
    }calculateArcMiddlePoint(startPoint, endPoint, mousePoint) {
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
        
        if (perpLength < 0.001) {
            return midPoint; // Points trop proches, retourner le point milieu
        }
        
        // Normaliser la direction perpendiculaire
        const perpNormX = perpX / perpLength;
        const perpNormY = perpY / perpLength;
        
        // Calculer la distance SIGNÉE de la souris à la ligne start-end
        // Cette distance est positive d'un côté et négative de l'autre
        const signedDistToMouse = (mousePoint.x - startPoint.x) * perpNormX + (mousePoint.y - startPoint.y) * perpNormY;
        
        // Calculer le point de contrôle de l'arc
        // On garde le signe pour préserver la direction/convexité de l'arc
        const maxArcHeight = perpLength / 2; // Limiter la hauteur maximale de l'arc
        const arcHeight = Math.sign(signedDistToMouse) * Math.min(Math.abs(signedDistToMouse), maxArcHeight);
        
        const controlPoint = new THREE.Vector3(
            midPoint.x + perpNormX * arcHeight,
            midPoint.y + perpNormY * arcHeight,
            0
        );
        
        return controlPoint;
    }

    createArcPoints(startPoint, endPoint, controlPoint, segments = 10) {
        // Créer une série de points pour approximer un arc quadratique
        const arcPoints = [];
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = Math.pow(1 - t, 2) * startPoint.x + 2 * (1 - t) * t * controlPoint.x + Math.pow(t, 2) * endPoint.x;
            const y = Math.pow(1 - t, 2) * startPoint.y + 2 * (1 - t) * t * controlPoint.y + Math.pow(t, 2) * endPoint.y;
            arcPoints.push(new THREE.Vector3(x, y, 0));
        }
        
        return arcPoints;    }startPolyline(event) {
        this.drawing = true;
        this.points = [];
        
        // Créer une nouvelle objet de type BufferGeometry pour la ligne
        const geometry = new THREE.BufferGeometry();
        
        // Créer le matériau avec la couleur noire
        const material = new THREE.LineBasicMaterial({ 
            color: 0x000000,  // Noir
            linewidth: 2 
        });
        
        // Créer la ligne avec la géométrie et le matériau
        this.previewLine = new THREE.Line(geometry, material);
        this.webcad.scene.add(this.previewLine);
        
        // Ajouter le premier point
        const worldPoint = this.webcad.getWorldPoint(event);
        this.points.push(worldPoint.clone());
        
        // Ajouter immédiatement un deuxième point de prévisualisation pour suivre la souris
        this.points.push(worldPoint.clone());
        
        // Mettre à jour la géométrie de la ligne avec les points
        this.previewLine.geometry.setFromPoints(this.points);
        
        console.log(`🔧 PolylineTool: Démarrage polyligne au point: (${worldPoint.x.toFixed(4)}, ${worldPoint.y.toFixed(4)}, ${worldPoint.z.toFixed(4)})`);
        console.log(`🔧 PolylineTool: Nombre de points après startPolyline: ${this.points.length}`);
        console.log(`🔧 PolylineTool: Points tableau:`, this.points.map((p, i) => `[${i}] (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`));
    }
      showPolylineTooltip(x, y, totalDistance, segmentDistance, angle, relativeAngle = null) {
        // Utiliser le tooltip du DrawingManager s'il existe
        if (this.webcad.drawingManager && this.webcad.drawingManager.showPolylineTooltip) {
            this.webcad.drawingManager.showPolylineTooltip(x, y, totalDistance, segmentDistance, angle, relativeAngle);
        }
    }
      hidePolylineTooltip() {
        // Utiliser le tooltip du DrawingManager s'il existe
        if (this.webcad.drawingManager && this.webcad.drawingManager.hidePolylineTooltip) {
            this.webcad.drawingManager.hidePolylineTooltip();
        }
    }

    showTooltip(message) {
        // Utiliser le système de sortie de commande pour afficher le message
        if (document.getElementById('command-output')) {
            document.getElementById('command-output').textContent = message;
        }
    }onRightClick(event) {
        // Afficher le menu contextuel avec les options de polyligne
        if (this.drawing && this.points.length >= 2) { // Changé de > 1 à >= 2 pour être cohérent
            event.preventDefault();
            this.showContextMenu(event.clientX, event.clientY);
            return true;
        }
        return false;
    }    showContextMenu(x, y) {
        // Utiliser le menu contextuel du DrawingManager s'il existe
        if (this.webcad.drawingManager && this.webcad.drawingManager.contextMenu) {
            const menu = this.webcad.drawingManager.contextMenu;
            menu.style.left = `${x}px`;
            menu.style.top = `${y}px`;
            menu.style.display = 'block';
            
            // Vérifier que l'élément undo-point existe et ajouter gestionnaires spécifiques
            const undoBtn = document.getElementById('undo-point');
            
            // Ajouter un gestionnaire spécifique pour ce PolylineTool
            if (undoBtn && !undoBtn.polylineToolHandler) {
                undoBtn.polylineToolHandler = true;
                undoBtn.addEventListener('click', (e) => {
                    console.log('PolylineTool: Annulation du point précédent via menu');
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideContextMenu();
                    this.undoLastPoint();
                });
            }
            
            // Ajouter des gestionnaires pour les autres options aussi
            const finishBtn = document.getElementById('finish-polyline');
            if (finishBtn && !finishBtn.polylineToolHandler) {
                finishBtn.polylineToolHandler = true;
                finishBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideContextMenu();
                    this.finishPolyline();
                });
            }
            
            const closeBtn = document.getElementById('close-polyline');
            if (closeBtn && !closeBtn.polylineToolHandler) {
                closeBtn.polylineToolHandler = true;
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideContextMenu();
                    // Fermer la polyligne en reliant au premier point
                    if (this.points && this.points.length > 2) {
                        this.points[this.points.length - 1].copy(this.points[0]);
                        this.finishPolyline();
                    }
                });
            }
            
            const cancelBtn = document.getElementById('cancel-polyline');
            if (cancelBtn && !cancelBtn.polylineToolHandler) {
                cancelBtn.polylineToolHandler = true;
                cancelBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideContextMenu();
                    this.cancelPolyline();
                });
            }
            
            // Ajouter des gestionnaires d'événements pour les options du menu
            this.setupContextMenuHandlers();
        } else {
            console.error('Menu contextuel du DrawingManager non trouvé');
        }
    }
      setupContextMenuHandlers() {
        console.log('PolylineTool.setupContextMenuHandlers appelée');
        
        // Utiliser les gestionnaires existants du DrawingManager
        // Ne pas écraser les gestionnaires, ils sont déjà configurés dans createContextMenu()
        
        // Log pour vérifier que les éléments existent
        const undoBtn = document.getElementById('undo-point');
        const finishBtn = document.getElementById('finish-polyline');
        const closeBtn = document.getElementById('close-polyline');
        const cancelBtn = document.getElementById('cancel-polyline');
        
        console.log('Éléments du menu contextuel trouvés:', {
            undoBtn: !!undoBtn,
            finishBtn: !!finishBtn,
            closeBtn: !!closeBtn,
            cancelBtn: !!cancelBtn
        });
        
        // Les gestionnaires sont déjà attachés dans DrawingManager.createContextMenu()
        // Pas besoin de les redéfinir ici
    }
    
    hideContextMenu() {
        if (this.webcad.drawingManager && this.webcad.drawingManager.contextMenu) {
            this.webcad.drawingManager.contextMenu.style.display = 'none';
        }
    }
    
    cancelPolyline() {
        // Annuler la polyligne en cours
        if (this.previewLine) {
            this.webcad.scene.remove(this.previewLine);
            if (this.previewLine.geometry) this.previewLine.geometry.dispose();
            if (this.previewLine.material) this.previewLine.material.dispose();
            this.previewLine = null;
        }
        
        this.drawing = false;
        this.points = [];
        this.hidePolylineTooltip();
        
        console.log("PolylineTool: Polyligne annulée");
    }    handleKeyDown(event) {
        if (event.key === 'Shift') {
            this.shiftPressed = true;
            return;
        }
        
        // Si un dialogue est ouvert, ne pas intercepter les touches
        // Laisser les événements normaux pour les champs de saisie
        if (this.dialogOpen) {
            return;
        }
        
        // Gestion de l'annulation du point précédent (Backspace) - priorité sur la saisie de distance
        if (event.key === 'Backspace' && !this.isTypingDistance && this.drawing && this.points.length > 2) {
            event.preventDefault();
            this.undoLastPoint();
            return;
        }
        
        // Si on n'est pas en train de dessiner, on ignore les autres touches
        if (!this.drawing) {
            return;
        }
        
        // Si on est en train de dessiner et qu'on tape un chiffre ou un point
        if (this.points.length >= 2) {
            const isDigit = /^\d$/.test(event.key);
            const isDecimalPoint = event.key === '.' || event.key === ',';
            const isBackspace = event.key === 'Backspace';
            const isEnter = event.key === 'Enter';
            const isEscape = event.key === 'Escape';
            
            if (isDigit || (isDecimalPoint && !this.typedDistance.includes('.'))) {
                event.preventDefault();
                
                // Démarrer la saisie si ce n'est pas encore fait
                if (!this.isTypingDistance) {
                    this.startDistanceInput();
                }
                  // Ajouter le caractère tapé
                if (isDecimalPoint) {
                    this.typedDistance += '.';
                } else {
                    this.typedDistance += event.key;
                }
                
                // Mettre à jour l'affichage
                this.updateDistanceDisplay();
                
            } else if (isBackspace && this.isTypingDistance) {
                event.preventDefault();
                
                // Supprimer le dernier caractère
                this.typedDistance = this.typedDistance.slice(0, -1);
                
                if (this.typedDistance === '') {
                    this.cancelDistanceInput();
                } else {
                    this.updateDistanceDisplay();
                }
                
            } else if (isEnter && this.isTypingDistance) {
                event.preventDefault();
                this.confirmDistanceInput();
                
            } else if (isEscape && this.isTypingDistance) {
                event.preventDefault();
                this.cancelDistanceInput();
            }
        }
    }

    handleKeyUp(event) {
        if (event.key === 'Shift') {
            this.shiftPressed = false;
        }
    }    // Méthodes pour la saisie numérique de distance
    startDistanceInput() {
        this.isTypingDistance = true;
        this.typedDistance = '';
        console.log('PolylineTool: Démarrage saisie de distance');
        
        // Créer un indicateur visuel de saisie
        this.createDistanceInputIndicator();
        
        // Changer le curseur pour indiquer la saisie
        this.webcad.renderer.domElement.style.cursor = 'text';
        
        this.showTooltip('Tapez la longueur puis Entrée (Échap pour annuler)');
    }
    
    createDistanceInputIndicator() {
        // Supprimer l'indicateur existant s'il y en a un
        this.removeDistanceInputIndicator();
        
        // Créer un indicateur visuel en bas à droite
        this.distanceInputIndicator = document.createElement('div');
        this.distanceInputIndicator.id = 'distance-input-indicator';
        this.distanceInputIndicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 10000;
            border: 2px solid #4CAF50;
            min-width: 150px;
            text-align: center;
        `;
        
        document.body.appendChild(this.distanceInputIndicator);
        
        // Animation d'apparition
        this.distanceInputIndicator.style.opacity = '0';
        this.distanceInputIndicator.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            this.distanceInputIndicator.style.transition = 'all 0.3s ease';
            this.distanceInputIndicator.style.opacity = '1';
            this.distanceInputIndicator.style.transform = 'translateY(0)';
        }, 10);
        
        this.updateDistanceInputIndicator();
    }
    
    updateDistanceInputIndicator() {
        if (this.distanceInputIndicator) {
            const display = this.typedDistance === '' ? '0' : this.typedDistance;
            this.distanceInputIndicator.innerHTML = `
                <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">DISTANCE</div>
                <div style="font-size: 18px;">${display}<span style="animation: blink 1s infinite;">|</span></div>
                <div style="font-size: 10px; margin-top: 5px; color: #ccc;">Entrée pour confirmer • Échap pour annuler</div>
            `;
        }
    }
    
    removeDistanceInputIndicator() {
        if (this.distanceInputIndicator) {
            this.distanceInputIndicator.remove();
            this.distanceInputIndicator = null;
        }
    }

    updateDistanceDisplay() {
        if (this.isTypingDistance && this.currentMousePosition) {
            const distanceValue = parseFloat(this.typedDistance);
            if (!isNaN(distanceValue) && distanceValue > 0 && this.points.length >= 2) {
                // Calculer la nouvelle position basée sur la distance
                const lastDefinedPoint = this.points[this.points.length - 2];
                const mouseWorldPoint = this.webcad.getWorldPoint(this.currentMousePosition);
                
                // Direction vers la souris
                const direction = new THREE.Vector3().subVectors(mouseWorldPoint, lastDefinedPoint).normalize();
                
                // Nouveau point à la distance spécifiée
                const newPoint = lastDefinedPoint.clone().add(direction.multiplyScalar(distanceValue));
                
                // Mettre à jour le point de prévisualisation
                this.points[this.points.length - 1].copy(newPoint);
                
                // Mettre à jour la géométrie
                if (this.previewLine) {
                    this.previewLine.geometry.setFromPoints(this.points);
                }
                
                this.showTooltip(`Distance: ${this.typedDistance} - Entrée pour confirmer`);
            }
            
            // Mettre à jour l'indicateur visuel
            this.updateDistanceInputIndicator();
        }
    }    confirmDistanceInput() {
        if (this.isTypingDistance && this.typedDistance !== '') {
            const distanceValue = parseFloat(this.typedDistance);
            if (!isNaN(distanceValue) && distanceValue > 0) {
                // La position a déjà été mise à jour dans updateDistanceDisplay
                // Il faut juste ajouter un nouveau point et continuer
                
                const currentPoint = this.points[this.points.length - 1].clone();
                
                // Ajouter un nouveau point de prévisualisation
                this.points.push(currentPoint.clone());
                
                // Mettre à jour la géométrie
                if (this.previewLine) {
                    this.previewLine.geometry.setFromPoints(this.points);
                }
                
                console.log(`Point ajouté par saisie de distance: ${distanceValue}`);
                this.showTooltip(`Point ajouté à ${distanceValue} unités - Continuez ou clic droit pour options`);
            }
        }
        
        this.cancelDistanceInput();
    }cancelDistanceInput() {
        this.isTypingDistance = false;
        this.typedDistance = '';
        
        // Restaurer le curseur normal
        this.webcad.renderer.domElement.style.cursor = 'crosshair';
        
        // Supprimer l'indicateur visuel
        this.removeDistanceInputIndicator();
        
        if (this.distanceInputDialog) {
            this.distanceInputDialog.remove();
            this.distanceInputDialog = null;
        }
    }

    undoLastPoint() {
        if (this.drawing && this.points.length > 2) {
            // Enlever le point de prévisualisation
            this.points.pop();
            // Enlever le dernier point ajouté
            this.points.pop();
            // Ajouter un nouveau point de prévisualisation
            if (this.points.length > 0) {
                this.points.push(this.points[this.points.length - 1].clone());
            }
            
            // Mettre à jour la géométrie
            if (this.previewLine) {
                this.previewLine.geometry.setFromPoints(this.points);
            }
            
            console.log("PolylineTool: Point précédent annulé");
            this.showTooltip('Point précédent annulé');
        }    }

    // Accrochage polaire et angulaire spécifique aux polylignes
    applySnapToPoint(worldPoint, lastPoint, event) {
        let finalPoint = worldPoint.clone();
        
        // PRIORITÉ 1: Accrochage du SnapManager (points existants, intersections, etc.)
        if (this.webcad.snapManager) {
            const snappedPoint = this.webcad.snapManager.checkSnapping(worldPoint, event || { clientX: 0, clientY: 0 });
            if (snappedPoint && snappedPoint !== worldPoint) {
                // Un accrochage spécifique a été trouvé, l'utiliser en priorité
                console.log('✅ Accrochage SnapManager trouvé:', snappedPoint);
                finalPoint = snappedPoint.clone();
                return {
                    point: finalPoint,
                    snapType: 'object',
                    distance: lastPoint.distanceTo(finalPoint),
                    angle: Math.atan2(finalPoint.y - lastPoint.y, finalPoint.x - lastPoint.x) * 180 / Math.PI
                };
            }
        }
        
        // PRIORITÉ 2: Accrochage polaire et angulaire si aucun accrochage spécifique
        // Calculer la distance et l'angle
        const distance = lastPoint.distanceTo(worldPoint);
        let angle = Math.atan2(worldPoint.y - lastPoint.y, worldPoint.x - lastPoint.x) * 180 / Math.PI;
        
        // Normaliser l'angle entre 0 et 360
        if (angle < 0) angle += 360;
        
        // Accrochage angulaire (par défaut tous les 5 degrés, mais on peut désactiver temporairement avec Shift)
        if (this.angleSnapEnabled && !this.shiftPressed) {
            const angleStep = 5; // Degrés
            const snappedAngle = Math.round(angle / angleStep) * angleStep;
            angle = snappedAngle;
        }
        
        // Convertir l'angle en radians
        const angleRad = angle * Math.PI / 180;
        
        // Accrochage polaire (par défaut 0.1 unité, mais on peut désactiver temporairement avec Shift)
        let snappedDistance = distance;
        if (!this.shiftPressed) {
            const distanceStep = 0.1;
            snappedDistance = Math.round(distance / distanceStep) * distanceStep;
        }
        
        // Calculer le nouveau point avec l'accrochage appliqué
        const snappedPoint = new THREE.Vector3(
            lastPoint.x + Math.cos(angleRad) * snappedDistance,
            lastPoint.y + Math.sin(angleRad) * snappedDistance,
            lastPoint.z
        );        
        return {
            point: snappedPoint,
            snapType: 'polar',
            distance: snappedDistance,
            angle: angle
        };
    }

    // Nettoyage des gestionnaires d'événements du menu contextuel
    cleanupContextMenuHandlers() {
        // Marquer les gestionnaires comme supprimés pour éviter les fuites mémoire
        const undoBtn = document.getElementById('undo-point');
        const finishBtn = document.getElementById('finish-polyline');
        const closeBtn = document.getElementById('close-polyline');
        const cancelBtn = document.getElementById('cancel-polyline');
        const lengthBtn = document.getElementById('input-length');
        const arcBtn = document.getElementById('toggle-arc');
        
        if (undoBtn) undoBtn.polylineToolHandler = false;
        if (finishBtn) finishBtn.polylineToolHandler = false;
        if (closeBtn) closeBtn.polylineToolHandler = false;
        if (cancelBtn) cancelBtn.polylineToolHandler = false;
        if (lengthBtn) lengthBtn.polylineToolHandler = false;
        if (arcBtn) arcBtn.polylineToolHandler = false;
    }    // Dialogue de saisie de longueur via le menu contextuel
    showLengthInputDialog() {
        // Fermer le menu contextuel d'abord
        this.hideContextMenu();
        
        // Marquer qu'un dialogue est ouvert
        this.dialogOpen = true;
        
        // Créer le popup
        const popup = document.createElement('div');
        popup.id = 'polyline-length-dialog';
        popup.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; border: 2px solid #333; border-radius: 8px; padding: 20px; 
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; min-width: 300px;">
                <h3 style="margin: 0 0 15px 0; color: #333;">Saisir la longueur</h3>
                <div style="margin-bottom: 15px;">
                    <label for="polyline-length-input" style="display: block; margin-bottom: 5px; font-weight: bold;">Longueur:</label>
                    <input type="number" id="polyline-length-input" step="0.1" min="0.1" 
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" 
                           placeholder="Ex: 5.5">
                </div>
                <div style="margin-bottom: 15px;">
                    <label for="polyline-angle-input" style="display: block; margin-bottom: 5px; font-weight: bold;">Angle (optionnel):</label>
                    <input type="number" id="polyline-angle-input" step="1" min="0" max="360" 
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" 
                           placeholder="Ex: 45 (degrés)">
                </div>
                <div style="text-align: right;">
                    <button id="polyline-length-cancel-btn" style="margin-right: 10px; padding: 8px 16px; 
                            background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Annuler</button>
                    <button id="polyline-length-ok-btn" style="padding: 8px 16px; 
                            background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Focus sur le champ de longueur
        const lengthInput = document.getElementById('polyline-length-input');
        const angleInput = document.getElementById('polyline-angle-input');
        lengthInput.focus();
        lengthInput.select();
        
        const handleOK = () => {
            const length = parseFloat(lengthInput.value);
            const angle = parseFloat(angleInput.value);
            
            if (!isNaN(length) && length > 0) {
                if (this.drawing && this.points.length >= 2) {
                    const lastDefinedPoint = this.points[this.points.length - 2];
                    let finalAngle;
                    
                    if (!isNaN(angle)) {
                        // Utiliser l'angle spécifié
                        finalAngle = angle;
                    } else {
                        // Utiliser la direction actuelle de la souris si pas d'angle spécifié
                        if (this.currentMousePosition) {
                            const mouseWorldPoint = this.webcad.getWorldPoint(this.currentMousePosition);
                            finalAngle = Math.atan2(mouseWorldPoint.y - lastDefinedPoint.y, mouseWorldPoint.x - lastDefinedPoint.x) * 180 / Math.PI;
                            if (finalAngle < 0) finalAngle += 360;
                        } else {
                            finalAngle = 0; // Angle par défaut horizontal
                        }
                    }
                    
                    // Calculer le nouveau point
                    const angleRad = finalAngle * Math.PI / 180;
                    const newPoint = new THREE.Vector3(
                        lastDefinedPoint.x + Math.cos(angleRad) * length,
                        lastDefinedPoint.y + Math.sin(angleRad) * length,
                        lastDefinedPoint.z
                    );
                    
                    // Mettre à jour le point de prévisualisation
                    this.points[this.points.length - 1].copy(newPoint);
                    
                    // Ajouter un nouveau point de prévisualisation
                    this.points.push(newPoint.clone());
                    
                    // Mettre à jour la géométrie
                    if (this.previewLine) {
                        this.previewLine.geometry.setFromPoints(this.points);
                    }
                    
                    console.log(`Point ajouté par dialogue: longueur=${length}, angle=${finalAngle.toFixed(1)}°`);                }
                
                // Marquer que le dialogue est fermé
                this.dialogOpen = false;
                popup.remove();
            } else {
                alert('Veuillez saisir une longueur valide supérieure à 0.');
                lengthInput.focus();
                lengthInput.select();
            }
        };        const handleCancel = () => {
            // Marquer que le dialogue est fermé
            this.dialogOpen = false;
            popup.remove();
        };

        // Gestionnaires d'événements
        document.getElementById('polyline-length-ok-btn').addEventListener('click', handleOK);
        document.getElementById('polyline-length-cancel-btn').addEventListener('click', handleCancel);

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
    }
    
    // Méthode pour calculer approximativement la longueur d'un arc
    calculateArcLength(startPoint, endPoint, controlPoint) {
        // Calculer la distance approximative de l'arc en utilisant la distance du point de contrôle
        const dist1 = startPoint.distanceTo(controlPoint);
        const dist2 = controlPoint.distanceTo(endPoint);
        const directDist = startPoint.distanceTo(endPoint);
        
        // Approximation simple de la longueur d'arc
        return (dist1 + dist2 + directDist) / 2;
    }
    
    // Fermer tous les dialogues ouverts
    closeAllDialogs() {
        // Fermer le dialogue de longueur s'il existe
        const lengthDialog = document.getElementById('polyline-length-dialog');
        if (lengthDialog) {
            lengthDialog.remove();
        }
        
        // Réinitialiser le flag
        this.dialogOpen = false;
    }
    
    // Gestion de l'indicateur visuel de mode (LIGNE/ARC)
    createModeIndicator() {
        // Supprimer l'indicateur existant s'il y en a un
        this.removeModeIndicator();
        
        // Créer l'indicateur de mode
        const indicator = document.createElement('div');
        indicator.id = 'polyline-mode-indicator';        indicator.style.cssText = `
            position: fixed;
            top: 140px;
            left: 140px;
            background: ${this.arcMode ? '#ff4444' : '#4444ff'};
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            border: 2px solid rgba(255,255,255,0.3);
        `;
        
        // Icône et texte selon le mode
        if (this.arcMode) {
            indicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">🌙</span>
                    <span>MODE ARC</span>
                </div>
                <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
                    Cliquez pour créer des segments courbes
                </div>
            `;
        } else {
            indicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">📏</span>
                    <span>MODE LIGNE</span>
                </div>
                <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
                    Cliquez pour créer des segments droits
                </div>
            `;
        }
        
        document.body.appendChild(indicator);
        
        // Animation d'apparition
        setTimeout(() => {
            indicator.style.transform = 'translateX(0)';
        }, 10);
        
        console.log(`✨ Indicateur de mode créé: ${this.arcMode ? 'ARC' : 'LIGNE'}`);
    }
    
    updateModeIndicator() {
        const indicator = document.getElementById('polyline-mode-indicator');
        if (!indicator) {
            this.createModeIndicator();
            return;
        }
        
        // Mettre à jour la couleur et le contenu
        const newColor = this.arcMode ? '#ff4444' : '#4444ff';
        indicator.style.background = newColor;
        
        // Animation de changement
        indicator.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
            // Mettre à jour le contenu
            if (this.arcMode) {
                indicator.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">🌙</span>
                        <span>MODE ARC</span>
                    </div>
                    <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
                        Cliquez pour créer des segments courbes
                    </div>
                `;
            } else {
                indicator.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">📏</span>
                        <span>MODE LIGNE</span>
                    </div>
                    <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
                        Cliquez pour créer des segments droits
                    </div>
                `;
            }
            
            // Retour à la taille normale
            indicator.style.transform = 'scale(1)';
            
            console.log(`🔄 Indicateur de mode mis à jour: ${this.arcMode ? 'ARC' : 'LIGNE'}`);
        }, 150);
    }
    
    removeModeIndicator() {
        const indicator = document.getElementById('polyline-mode-indicator');
        if (indicator) {
            // Animation de disparition
            indicator.style.transform = 'translateX(-100px)';
            indicator.style.opacity = '0';
            
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
            
            console.log('🗑️ Indicateur de mode supprimé');
        }
    }

    // Mettre à jour le texte du menu contextuel arc-mode
    updateContextMenuText() {
        const arcModeItem = document.getElementById('arc-mode');
        if (arcModeItem) {
            if (this.arcMode) {
                arcModeItem.innerHTML = '<i class="fas fa-minus"></i> Mode Ligne';
            } else {
                arcModeItem.innerHTML = '<i class="fas fa-bezier-curve"></i> Mode Arc';
            }
            console.log(`PolylineTool: Menu contextuel mis à jour - ${this.arcMode ? 'Mode Ligne' : 'Mode Arc'}`);
        }
    }
    
    // Créer une surface à partir des points d'une polyligne fermée
    createPolygonSurface(points) {
        try {
            // Convertir les points 3D en points 2D pour la triangulation
            const vertices2D = [];
            for (let i = 0; i < points.length - 1; i++) { // -1 car le dernier point est identique au premier
                vertices2D.push(points[i].x, points[i].y);
            }
            
            // Utiliser earcut pour trianguler le polygone
            const triangles = this.triangulatePolygon(vertices2D);
            if (!triangles || triangles.length === 0) {
                console.warn('Impossible de trianguler la polyligne');
                return this.createFallbackSurface(points);
            }
            
            // Créer les vertices 3D pour le mesh
            const vertices = [];
            const indices = [];
            
            // Ajouter tous les points comme vertices
            for (let i = 0; i < points.length - 1; i++) {
                vertices.push(points[i].x, points[i].y, points[i].z || 0);
            }
            
            // Ajouter les indices des triangles
            for (let i = 0; i < triangles.length; i++) {
                indices.push(triangles[i]);
            }
            
            // Créer la géométrie
            const geometry = new THREE.BufferGeometry();
            geometry.setFromPoints(points.slice(0, -1)); // Enlever le point dupliqué
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            
            // Créer le matériau de surface
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.z = 0.005; // Légèrement au-dessus du plan de travail
            
            return mesh;
            
        } catch (error) {
            console.error('Erreur lors de la création de la surface de polyligne:', error);
            return this.createFallbackSurface(points);
        }
    }
    
    // Algorithme de triangulation simple pour polygones convexes (fallback)
    createFallbackSurface(points) {
        if (points.length < 4) return null; // Pas assez de points
        
        // Créer une surface simple pour polygones convexes
        const shape = new THREE.Shape();
        
        // Définir le contour de la forme
        shape.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            shape.lineTo(points[i].x, points[i].y);
        }
        shape.lineTo(points[0].x, points[0].y); // Fermer la forme
        
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = 0.005;
        
        return mesh;
    }
    
    // Triangulation simple en éventail pour polygones convexes
    triangulatePolygon(vertices2D) {
        const n = vertices2D.length / 2;
        if (n < 3) return [];
        
        const triangles = [];
        
        // Triangulation en éventail depuis le premier vertex
        for (let i = 1; i < n - 1; i++) {
            triangles.push(0, i, i + 1);
        }
        
        return triangles;
    }
}