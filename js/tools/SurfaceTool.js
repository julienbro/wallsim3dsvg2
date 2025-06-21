import * as THREE from 'three';

export class SurfaceTool {
    constructor(app) {
        this.app = app;
        this.active = false;
        this.isCreating = false;
    }
      activate() {
        this.active = true;
        this.isCreating = false;
        document.getElementById('command-output').textContent = 
            'Cliquez à l\'intérieur d\'une zone fermée pour créer une surface';
    }
    
    deactivate() {
        this.active = false;
        this.isCreating = false;
    }
    
    handleClick(point) {
        if (!this.active) return;
        
        // Trouver toutes les lignes proches du point
        const nearbyLines = this.findNearbyLines(point, 50); // Rayon de recherche de 50cm
        
        if (nearbyLines.length < 3) {
            document.getElementById('command-output').textContent = 
                'Pas assez de lignes pour former un contour fermé. (minimum 3 lignes)';
            return;
        }
        
        // Trouver le contour fermé qui entoure le point
        const closedContour = this.findClosedContourAroundPoint(point, nearbyLines);
        
        if (!closedContour) {
            document.getElementById('command-output').textContent = 
                'Aucun contour fermé trouvé autour de ce point. Essayez ailleurs.';
            return;
        }
        
        this.createSurfaceFromContour(closedContour, point);
    }
    
    /**
     * Trouve toutes les lignes dans un rayon donné autour d'un point
     */
    findNearbyLines(point, radius) {
        const nearbyLines = [];
        
        this.app.objects.forEach(obj => {
            if (obj instanceof THREE.Line && obj.geometry.attributes.position) {
                const positions = obj.geometry.attributes.position;
                let isNearby = false;
                const segments = [];
                
                // Pour chaque segment de la ligne
                for (let i = 0; i < positions.count - 1; i++) {
                    const p1 = new THREE.Vector3(
                        positions.getX(i),
                        positions.getY(i),
                        positions.getZ(i)
                    );
                    const p2 = new THREE.Vector3(
                        positions.getX(i + 1),
                        positions.getY(i + 1),
                        positions.getZ(i + 1)
                    );
                    
                    const distanceToSegment = this.distancePointToSegment(point, p1, p2);
                    if (distanceToSegment < radius) {
                        isNearby = true;
                    }
                    
                    // Ajouter tous les segments même s'ils ne sont pas proches
                    // pour permettre de construire un contour complet
                    segments.push({ start: p1, end: p2, line: obj });
                }
                  if (isNearby) {
                    nearbyLines.push(...segments);
                }
            }
        });
        
        return nearbyLines;
    }
    
    /**
     * Calcule la distance d'un point à un segment de ligne
     */
    distancePointToSegment(point, segmentStart, segmentEnd) {
        const A = point.x - segmentStart.x;
        const B = point.y - segmentStart.y;
        const C = segmentEnd.x - segmentStart.x;
        const D = segmentEnd.y - segmentStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
            // Le segment est un point
            return Math.sqrt(A * A + B * B);
        }
        
        let param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = segmentStart.x;
            yy = segmentStart.y;
        } else if (param > 1) {
            xx = segmentEnd.x;
            yy = segmentEnd.y;
        } else {
            xx = segmentStart.x + param * C;
            yy = segmentStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
      /**
     * Trouve un contour fermé qui entoure le point donné
     */
    findClosedContourAroundPoint(point, segments) {
        const tolerance = 1.0; // Tolérance augmentée pour la connexion des segments
        
        // Essayer de construire un contour fermé qui entoure le point
        for (let startSegment of segments) {
            const contour = this.buildContourFromSegment(startSegment, segments, tolerance);
            
            if (contour && contour.length >= 3) {
                // Vérifier si ce contour entoure le point
                if (this.isPointInsideContour(point, contour)) {
                    return contour;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Construit un contour à partir d'un segment de départ
     */
    buildContourFromSegment(startSegment, allSegments, tolerance) {
        const contour = [startSegment.start.clone()];
        const usedSegments = new Set([startSegment]);
        let currentEnd = startSegment.end.clone();
        
        contour.push(currentEnd.clone());
        
        let maxIterations = allSegments.length * 2; // Augmenter les itérations
        let iteration = 0;
        
        while (iteration < maxIterations) {
            iteration++;
            let foundConnection = false;
            let bestConnection = null;
            let bestDistance = tolerance;
            
            // Chercher la meilleure connexion possible
            for (let segment of allSegments) {
                if (usedSegments.has(segment)) continue;
                
                let connectPoint = null;
                let nextPoint = null;
                let distance = Infinity;
                
                // Vérifier les connexions possibles
                const distToStart = currentEnd.distanceTo(segment.start);
                const distToEnd = currentEnd.distanceTo(segment.end);
                
                if (distToStart < tolerance && distToStart < bestDistance) {
                    connectPoint = segment.start;
                    nextPoint = segment.end;
                    distance = distToStart;
                    bestConnection = { segment, connectPoint, nextPoint, distance };
                    bestDistance = distance;
                }
                
                if (distToEnd < tolerance && distToEnd < bestDistance) {
                    connectPoint = segment.end;
                    nextPoint = segment.start;
                    distance = distToEnd;
                    bestConnection = { segment, connectPoint, nextPoint, distance };
                    bestDistance = distance;
                }
            }
              if (bestConnection) {
                // Vérifier si on revient au point de départ (contour fermé)
                const distanceToStart = bestConnection.nextPoint.distanceTo(contour[0]);
                
                if (distanceToStart < tolerance && contour.length >= 3) {
                    return contour;
                }
                
                // Ajouter le point suivant au contour
                contour.push(bestConnection.nextPoint.clone());
                currentEnd = bestConnection.nextPoint.clone();
                usedSegments.add(bestConnection.segment);
                foundConnection = true;
            }
            
            if (!foundConnection) {
                break;
            }
        }
          // Vérifier si on a un contour fermé approximatif
        if (contour.length >= 3) {
            const distanceToStart = currentEnd.distanceTo(contour[0]);
            if (distanceToStart < tolerance * 2) {
                return contour;
            }
        }
        
        return null;
    }
    
    /**
     * Vérifie si un point est à l'intérieur d'un contour (algorithme ray casting)
     */
    isPointInsideContour(point, contour) {
        if (contour.length < 3) return false;
        
        const x = point.x;
        const y = point.y;
        let inside = false;
        
        for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
            const xi = contour[i].x;
            const yi = contour[i].y;
            const xj = contour[j].x;
            const yj = contour[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
      /**
     * Crée une surface à partir d'un contour détecté
     */
    createSurfaceFromContour(contour, clickPoint) {
        try {
            // Utiliser la méthode du DrawingManager pour créer la surface
            const surface = this.app.drawingManager.createSurfaceFromPoints(contour);
            
            if (surface) {
                // Marquer la surface avec des informations sur son origine
                surface.userData.createdBy = 'SurfaceTool';
                surface.userData.sourceType = 'detected_contour';
                surface.userData.clickPoint = clickPoint;
                surface.userData.contourPoints = contour.length;
                
                document.getElementById('command-output').textContent = 
                    `Surface créée à partir d'un contour détecté (${contour.length} points)`;
                
                // Ajouter à l'historique
                this.app.addToHistory('create', surface);
                
                if (this.app.uiManager) {
                    this.app.uiManager.updateHistoryPanel();
                }
                
                // Optionnel: mettre en évidence le contour détecté temporairement
                this.highlightContour(contour);
                
            } else {
                document.getElementById('command-output').textContent = 
                    'Erreur lors de la création de la surface';
            }
            
        } catch (error) {
            console.error('Erreur lors de la création de surface:', error);
            document.getElementById('command-output').textContent = 
                'Erreur lors de la création de la surface';
        }
    }
    
    /**
     * Met en évidence temporairement le contour détecté
     */
    highlightContour(contour) {
        const geometry = new THREE.BufferGeometry().setFromPoints([...contour, contour[0]]);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            linewidth: 4,
            opacity: 0.8,
            transparent: true
        });
        
        const highlight = new THREE.Line(geometry, material);
        highlight.renderOrder = 999;
        this.app.scene.add(highlight);
        
        // Supprimer la mise en évidence après 2 secondes
        setTimeout(() => {
            this.app.scene.remove(highlight);
            if (highlight.geometry) highlight.geometry.dispose();
            if (highlight.material) highlight.material.dispose();
        }, 2000);
    }
    
    cancel() {
        this.deactivate();
        document.getElementById('command-output').textContent = '';
    }
}