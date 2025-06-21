import * as THREE from 'three';

export class SnapManager {
    constructor(app) {
        this.app = app;
        this.snapToEndpoints = true;
        this.snapToMidpoints = true;
        this.snapToQuarters = true;
        this.snapToThirds = true;
        this.snapToIntersections = true; // Add intersection snapping
        this.snapDistance = 10;
        this.snapIndicator = null;
        this.tooltip = null;
        this.isSnappedToAxis = null;
        this.currentSnapType = null;
        
        // Propriétés pour l'accrochage aux coins de grille
        this.enableGridSnapping = false;
        this.gridSize = 1; // 1cm par défaut
        this.gridSnapDistance = 15; // Distance en pixels pour l'accrochage aux coins de grille
        
        // Propriétés pour l'accrochage polaire/relatif
        this.enablePolarSnapping = false;
        this.polarStep = 0.001; // Pas de 0.001 pour l'accrochage polaire
          // Propriétés pour l'accrochage distant (comme SketchUp)
        this.enableDistantSnapping = true;
        this.distantSnapDistance = 300; // Distance maximale pour rechercher des accrochages distants
        this.snapToDistantEndpoints = true;
        this.snapToParallels = true;
        this.snapToPerpendiculars = true;
        this.snapToAlignments = true;
        this.snapToIntersectionProjections = true; // Accrochage aux intersections projetées        this.snapToDistantCenters = true; // Accrochage aux centres distants
        this.guideLines = []; // Lignes de guidage en pointillés
        this.guideLineAnimation = null; // Animation des lignes de guidage
        this.guideLinesCleanupTimer = null; // Timer pour retarder le nettoyage des lignes d'aide
        
        this.createSnapIndicator();
        this.createTooltip();
    }
    
    createSnapIndicator() {
        const geometry = new THREE.RingGeometry(0.5, 0.8, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });
        this.snapIndicator = new THREE.Mesh(geometry, material);
        this.snapIndicator.visible = false;
        this.snapIndicator.renderOrder = 1000;
        this.app.scene.add(this.snapIndicator);
        
        // Créer un indicateur plus visible pour les polylignes
        const dotGeometry = new THREE.SphereGeometry(1, 8, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            depthTest: false,
            depthWrite: false
        });
        this.snapDot = new THREE.Mesh(dotGeometry, dotMaterial);
        this.snapDot.visible = false;
        this.snapDot.renderOrder = 1001;
        this.app.scene.add(this.snapDot);
    }
      createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'drawing-tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
    }
      checkSnapping(worldPoint, event) {
        // Priorité 1: Vérifier les accrochages spécifiques (intersections, points, etc.)
        if (this.snapToEndpoints && (this.app.drawingManager.isDrawing || 
            ['line', 'polyline', 'arc', 'rect', 'circle'].includes(this.app.currentTool))) {
            
            const snapPoint = this.checkSnapPoints(worldPoint, event);
            if (snapPoint) {
                this.showSnapIndicator(snapPoint);
                return snapPoint;
            }
        }        // Priorité 2: Accrochage distant avec lignes de guidage (comme SketchUp)
        if (this.enableDistantSnapping && this.app.drawingManager && this.app.drawingManager.isDrawing) {
            console.log('🎯 Tentative d\'accrochage distant...');
            console.log('📊 DrawingManager.isDrawing:', this.app.drawingManager.isDrawing);
            console.log('📊 DrawingManager.drawingMode:', this.app.drawingManager.drawingMode);
            console.log('📊 EnableDistantSnapping:', this.enableDistantSnapping);
            const distantSnapPoint = this.checkDistantSnapping(worldPoint, event);
            if (distantSnapPoint) {
                console.log('✅ Accrochage distant trouvé:', distantSnapPoint);
                this.showSnapIndicator(distantSnapPoint);
                return distantSnapPoint;
            } else {
                console.log('❌ Aucun accrochage distant trouvé');            }
        } else {
            if (!this.enableDistantSnapping) {
                // console.log('❌ Accrochage distant désactivé');
            } else if (!this.app.drawingManager) {
                // console.log('❌ DrawingManager non trouvé');            } else if (!this.app.drawingManager.isDrawing) {
                // Supprimer ce message répétitif - pas besoin de log quand on n'est pas en mode dessin
                // console.log('❌ Pas en mode dessin - isDrawing:', this.app.drawingManager.isDrawing, 'drawingMode:', this.app.drawingManager.drawingMode);
            }
        }
        
        // Priorité 3: Accrochage aux coins de grille en mode 2D
        if (this.enableGridSnapping && this.app.viewManager && this.app.viewManager.gridVisible) {
            const gridSnapPoint = this.checkGridSnapping(worldPoint, event);
            if (gridSnapPoint) {
                this.showSnapIndicator(gridSnapPoint);
                this.currentSnapType = 'Grille';
                return gridSnapPoint;
            }
        }
        
        this.hideSnapIndicator();
        
        // Priorité 3: Accrochage à la grille classique si aucun accrochage spécifique
        if (this.app.snapEnabled) {
            worldPoint.x = Math.round(worldPoint.x / this.app.gridSize) * this.app.gridSize;
            worldPoint.y = Math.round(worldPoint.y / this.app.gridSize) * this.app.gridSize;
        }
        
        return worldPoint;
    }
    
    checkSnapPoints(currentPoint, mouseEvent) {
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        const mouse2D = new THREE.Vector2(
            ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1,
            -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        let nearestPoint = null;
        let minDistance = this.snapDistance;
        let snapType = null;          // Vérifier d'abord les points de la polyligne en cours de création
        var polylinePoints = [];
        if (this.app.drawingManager.isDrawing && this.app.drawingManager.drawingMode === 'polyline') {
            // Essayer de récupérer les points de la polyligne active
            var polylineTool = null;
            
            console.log('🔍 SnapManager: Recherche de la polyligne active...');
            console.log('🔍 SnapManager: drawingManager.activeTool:', !!this.app.drawingManager.activeTool);
            console.log('🔍 SnapManager: drawingManager.polylineTool:', !!this.app.drawingManager.polylineTool);
            console.log('🔍 SnapManager: toolManager.activeTool:', !!this.app.toolManager?.activeTool);
            
            // Méthode 1: Via drawingManager.activeTool
            if (this.app.drawingManager.activeTool && this.app.drawingManager.activeTool.points) {
                polylineTool = this.app.drawingManager.activeTool;
                console.log('🔍 SnapManager: Utilisation de drawingManager.activeTool avec', polylineTool.points.length, 'points');
            }
            // Méthode 2: Via drawingManager.polylineTool
            else if (this.app.drawingManager.polylineTool && this.app.drawingManager.polylineTool.points) {
                polylineTool = this.app.drawingManager.polylineTool;
                console.log('🔍 SnapManager: Utilisation de drawingManager.polylineTool avec', polylineTool.points.length, 'points');
            }
            // Méthode 3: Via toolManager.activeTool
            else if (this.app.toolManager && this.app.toolManager.activeTool && this.app.toolManager.activeTool.points) {
                polylineTool = this.app.toolManager.activeTool;
                console.log('🔍 SnapManager: Utilisation de toolManager.activeTool avec', polylineTool.points.length, 'points');
            }            
            if (polylineTool && polylineTool.points && polylineTool.points.length > 0) {
                // Exclure le dernier point (point de prévisualisation)
                var pointsToCheck = polylineTool.points.slice(0, -1);
                console.log('🎯 SnapManager: Vérification accrochage aux', pointsToCheck.length, 'points précédents de la polyligne');
                console.log('🎯 SnapManager: Points détails:', pointsToCheck.map((p, i) => `[${i}] (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`));
                
                pointsToCheck.forEach(function(point, index) {
                    var result = this.checkPointDistance(point, mouse2D, rect);
                    if (result.distance < minDistance) {
                        minDistance = result.distance;
                        nearestPoint = point.clone();
                        snapType = 'Point ' + (index + 1) + ' de la polyligne';
                        console.log('🎯 SnapManager: Accrochage trouvé sur point', index + 1, 'distance:', result.distance.toFixed(2));
                    }
                }.bind(this));
            } else {
                console.log('🎯 SnapManager: Aucune polyligne active trouvée ou aucun point disponible');
                if (polylineTool) {
                    console.log('🎯 SnapManager: polylineTool trouvé mais points.length =', polylineTool.points ? polylineTool.points.length : 'undefined');
                }
            }
        }
        
        // Check intersection points FIRST (highest priority)
        if (this.snapToIntersections) {
            const intersectionPoints = this.findIntersectionPoints(currentPoint, mouse2D, rect);
            intersectionPoints.forEach(intersection => {
                if (intersection.distance < minDistance) {
                    minDistance = intersection.distance;
                    nearestPoint = intersection.point.clone();
                    if (intersection.type === 'ghost_intersection') {
                        snapType = 'Intersection (ligne fantôme)';
                    } else {
                        snapType = 'Intersection';
                    }
                }
            });
        }
          this.app.objects.forEach(obj => {
            // Ignorer les lignes d'aide pour éviter les interférences
            if (obj.userData && obj.userData.isGuideLine) {
                return;
            }
            
            // Points d'extrémité
            if (this.snapToEndpoints) {
                const endpoints = this.getObjectEndpoints(obj);
                endpoints.forEach(point => {
                    const result = this.checkPointDistance(point, mouse2D, rect);
                    
                    if (result.distance < minDistance) {
                        minDistance = result.distance;
                        nearestPoint = point.clone();
                        snapType = 'Extrémité';
                    }
                });
            }
            
            // Points intermédiaires pour les lignes
            if (obj instanceof THREE.Line && obj.geometry.attributes.position) {
                const positions = obj.geometry.attributes.position;
                
                // Pour chaque segment de ligne
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
                    
                    // Appliquer la transformation de l'objet
                    p1.applyMatrix4(obj.matrixWorld);
                    p2.applyMatrix4(obj.matrixWorld);
                    
                    // Point milieu
                    if (this.snapToMidpoints) {
                        const midPoint = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
                        const result = this.checkPointDistance(midPoint, mouse2D, rect);
                        if (result.distance < minDistance) {
                            minDistance = result.distance;
                            nearestPoint = midPoint.clone();
                            snapType = 'Milieu (1/2)';
                        }
                    }
                    
                    // Points aux quarts
                    if (this.snapToQuarters) {
                        const quarter1 = new THREE.Vector3().lerpVectors(p1, p2, 0.25);
                        const quarter3 = new THREE.Vector3().lerpVectors(p1, p2, 0.75);
                        
                        let result = this.checkPointDistance(quarter1, mouse2D, rect);
                        if (result.distance < minDistance) {
                            minDistance = result.distance;
                            nearestPoint = quarter1.clone();
                            snapType = '1/4';
                        }
                        
                        result = this.checkPointDistance(quarter3, mouse2D, rect);
                        if (result.distance < minDistance) {
                            minDistance = result.distance;
                            nearestPoint = quarter3.clone();
                            snapType = '3/4';
                        }
                    }
                    
                    // Points aux tiers
                    if (this.snapToThirds) {
                        const third1 = new THREE.Vector3().lerpVectors(p1, p2, 0.333);
                        const third2 = new THREE.Vector3().lerpVectors(p1, p2, 0.667);
                        
                        let result = this.checkPointDistance(third1, mouse2D, rect);
                        if (result.distance < minDistance) {
                            minDistance = result.distance;
                            nearestPoint = third1.clone();
                            snapType = '1/3';
                        }
                        
                        result = this.checkPointDistance(third2, mouse2D, rect);
                        if (result.distance < minDistance) {
                            minDistance = result.distance;
                            nearestPoint = third2.clone();
                            snapType = '2/3';
                        }
                    }
                }
            }        });
        
        // Créer des lignes d'aide si un accrochage sur un point précédent de la polyligne est trouvé
        if (nearestPoint && snapType && snapType.includes('de la polyligne')) {
            console.log('🎯 SnapManager: Création de lignes d\'aide pour', snapType);
            
            // Nettoyer seulement si on change de point d'accrochage
            this.clearGuideLines();
            
            // Obtenir le point de départ de la ligne en cours (dernier point défini)
            var polylineTool = null;
            if (this.app.drawingManager.activeTool && this.app.drawingManager.activeTool.points) {
                polylineTool = this.app.drawingManager.activeTool;
            } else if (this.app.drawingManager.polylineTool && this.app.drawingManager.polylineTool.points) {
                polylineTool = this.app.drawingManager.polylineTool;
            }
            
            if (polylineTool && polylineTool.points && polylineTool.points.length >= 2) {
                var currentStartPoint = polylineTool.points[polylineTool.points.length - 2]; // Avant-dernier point (dernier point défini)
                  // Ligne d'aide du point de départ actuel vers le point d'accrochage (gris foncé)
                this.createGuideLine(currentStartPoint, nearestPoint, 0x404040, 0.7, 2);
                
                // Ligne d'aide horizontale et verticale depuis le point d'accrochage (gris plus clair)
                var guideLength = 20; // Longueur des lignes d'aide
                var horizontalStart = new THREE.Vector3(nearestPoint.x - guideLength, nearestPoint.y, nearestPoint.z);
                var horizontalEnd = new THREE.Vector3(nearestPoint.x + guideLength, nearestPoint.y, nearestPoint.z);
                var verticalStart = new THREE.Vector3(nearestPoint.x, nearestPoint.y - guideLength, nearestPoint.z);
                var verticalEnd = new THREE.Vector3(nearestPoint.x, nearestPoint.y + guideLength, nearestPoint.z);
                
                this.createGuideLine(horizontalStart, horizontalEnd, 0x606060, 0.5, 1);
                this.createGuideLine(verticalStart, verticalEnd, 0x606060, 0.5, 1);
                
                console.log('🎯 SnapManager: Lignes d\'aide créées pour accrochage au point précédent');
            }
        } else {
            // Nettoyer les lignes d'aide seulement si aucun accrochage de polyligne n'est trouvé
            // et seulement si on est vraiment éloigné de tout point d'accrochage
            var shouldClear = true;
            
            // Vérifier si on est proche d'un point de polyligne même sans accrochage strict
            if (this.app.drawingManager.isDrawing && this.app.drawingManager.drawingMode === 'polyline') {
                var polylineTool = null;
                if (this.app.drawingManager.activeTool && this.app.drawingManager.activeTool.points) {
                    polylineTool = this.app.drawingManager.activeTool;
                } else if (this.app.drawingManager.polylineTool && this.app.drawingManager.polylineTool.points) {
                    polylineTool = this.app.drawingManager.polylineTool;
                }
                  if (polylineTool && polylineTool.points && polylineTool.points.length > 1) {
                    var pointsToCheck = polylineTool.points.slice(0, -1);
                    var canvasRect = this.app.renderer.domElement.getBoundingClientRect();
                    var mousePos2D = new THREE.Vector2(
                        ((mouseEvent.clientX - canvasRect.left) / canvasRect.width) * 2 - 1,
                        -((mouseEvent.clientY - canvasRect.top) / canvasRect.height) * 2 + 1
                    );
                    
                    // Vérifier avec une distance plus large (tolérance étendue)
                    var toleranceDistance = this.snapDistance * 2; // Double de la distance normale
                    
                    for (var i = 0; i < pointsToCheck.length; i++) {
                        var result = this.checkPointDistance(pointsToCheck[i], mousePos2D, canvasRect);
                        if (result.distance < toleranceDistance) {
                            shouldClear = false; // Ne pas nettoyer si on est encore proche
                            console.log('🎯 SnapManager: Maintien des lignes d\'aide - encore proche du point', (i + 1));
                            break;
                        }
                    }
                }
            }
              if (shouldClear) {
                // Ajouter un délai avant de nettoyer pour éviter le scintillement
                if (this.guideLinesCleanupTimer) {
                    clearTimeout(this.guideLinesCleanupTimer);
                }
                
                this.guideLinesCleanupTimer = setTimeout(() => {
                    this.clearGuideLines();
                    console.log('🎯 SnapManager: Nettoyage différé des lignes d\'aide - éloigné de tous les points');
                    this.guideLinesCleanupTimer = null;
                }, 100); // Délai de 100ms
            } else {
                // Annuler le nettoyage prévu si on revient dans la zone
                if (this.guideLinesCleanupTimer) {
                    clearTimeout(this.guideLinesCleanupTimer);
                    this.guideLinesCleanupTimer = null;
                }
            }
        }
        
        this.currentSnapType = snapType;
        return nearestPoint;
    }
    
    checkPointDistance(point3D, mouse2D, rect) {
        const screenPoint = point3D.clone();
        screenPoint.project(this.app.camera);
        
        const dx = (screenPoint.x - mouse2D.x) * rect.width / 2;
        const dy = (screenPoint.y - mouse2D.y) * rect.height / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return { distance, screenPoint };
    }    findIntersectionPoints(currentPoint, mouse2D, rect) {
        const intersectionPoints = [];        const lines = this.app.objects.filter(obj => 
            obj instanceof THREE.Line && 
            obj.geometry && 
            obj.geometry.attributes.position &&
            obj.visible &&
            !(obj.userData && obj.userData.isGuideLine) // Exclure les lignes d'aide
        );

        // Ajouter l'intersection avec la ligne fantôme de polyligne si elle existe
        if (this.app.drawingManager.isDrawing && 
            this.app.drawingManager.drawingMode === 'polyline' && 
            this.app.drawingManager.drawingPoints.length > 0) {
            
            const lastPoint = this.app.drawingManager.drawingPoints[this.app.drawingManager.drawingPoints.length - 1];
            const ghostLine = { p1: lastPoint, p2: currentPoint };
            
            // Vérifier les intersections de la ligne fantôme avec toutes les autres lignes
            lines.forEach(line => {
                const positions = line.geometry.attributes.position;
                const worldPoints = [];
                
                for (let i = 0; i < positions.count; i++) {
                    const point = new THREE.Vector3().fromBufferAttribute(positions, i);
                    point.applyMatrix4(line.matrixWorld);
                    worldPoints.push(point);
                }

                for (let i = 0; i < worldPoints.length - 1; i++) {
                    const intersectionPoint = this.calculateSegmentIntersection(
                        ghostLine.p1, ghostLine.p2, 
                        worldPoints[i], worldPoints[i + 1]
                    );

                    if (intersectionPoint) {
                        const result = this.checkPointDistance(intersectionPoint, mouse2D, rect);
                        if (result.distance < this.snapDistance) {
                            intersectionPoints.push({
                                point: intersectionPoint,
                                distance: result.distance,
                                type: 'ghost_intersection'
                            });
                        }
                    }
                }
            });
        }

        if (lines.length < 2) return intersectionPoints;

        // Get all line segments
        const allSegments = [];
        lines.forEach(line => {
            const positions = line.geometry.attributes.position;
            const worldPoints = [];
            
            for (let i = 0; i < positions.count; i++) {
                const point = new THREE.Vector3().fromBufferAttribute(positions, i);
                point.applyMatrix4(line.matrixWorld);
                worldPoints.push(point);
            }

            for (let i = 0; i < worldPoints.length - 1; i++) {
                allSegments.push({ 
                    p1: worldPoints[i], 
                    p2: worldPoints[i + 1], 
                    parentLine: line 
                });
            }
        });

        // Find intersections between all segment pairs
        for (let i = 0; i < allSegments.length; i++) {
            for (let j = i + 1; j < allSegments.length; j++) {
                const seg1 = allSegments[i];
                const seg2 = allSegments[j];

                // Skip if segments are from the same line and adjacent
                if (seg1.parentLine === seg2.parentLine) {
                    continue;
                }

                const intersectionPoint = this.calculateSegmentIntersection(
                    seg1.p1, seg1.p2, seg2.p1, seg2.p2
                );

                if (intersectionPoint) {
                    const result = this.checkPointDistance(intersectionPoint, mouse2D, rect);
                    if (result.distance < this.snapDistance) {
                        intersectionPoints.push({
                            point: intersectionPoint,
                            distance: result.distance,
                            type: 'intersection'
                        });
                    }
                }
            }
        }

        return intersectionPoints;
    }

    calculateSegmentIntersection(p1, p2, p3, p4) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;

        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(den) < 1e-6) {
            return null; // Lines are parallel or collinear
        }

        const tNum = (x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4);
        const uNum = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3));

        const t = tNum / den;
        const u = uNum / den;

        // Check if intersection is within both line segments
        const epsilon = 1e-6;
        if (t >= -epsilon && t <= 1 + epsilon && u >= -epsilon && u <= 1 + epsilon) {
            const ix = x1 + t * (x2 - x1);
            const iy = y1 + t * (y2 - y1);
            return new THREE.Vector3(ix, iy, p1.z);
        }

        return null;
    }
    
    getObjectEndpoints(obj) {
        const endpoints = [];
        
        if (obj.geometry) {
            if (obj instanceof THREE.Line || obj instanceof THREE.LineLoop) {
                const positions = obj.geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const point = new THREE.Vector3(
                        positions.getX(i),
                        positions.getY(i),
                        positions.getZ(i)
                    );
                    point.applyMatrix4(obj.matrixWorld);
                    endpoints.push(point);
                }            } else if (obj instanceof THREE.Mesh) {
                // Pour les rectangles, utiliser la géométrie locale et appliquer les transformations
                if (obj.geometry instanceof THREE.PlaneGeometry || obj.geometry instanceof THREE.BoxGeometry) {
                    const box = new THREE.Box3().setFromBufferAttribute(obj.geometry.attributes.position);
                    const corners = [
                        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
                        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
                        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
                        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
                        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
                        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
                        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
                        new THREE.Vector3(box.max.x, box.max.y, box.max.z)
                    ];
                    
                    // Appliquer les transformations de l'objet à chaque coin
                    corners.forEach(corner => {
                        corner.applyMatrix4(obj.matrixWorld);
                        endpoints.push(corner);
                    });
                } else {
                    // Pour les autres géométries, utiliser la boîte englobante (méthode existante)
                    const box = new THREE.Box3().setFromObject(obj);
                    endpoints.push(
                        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
                        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
                        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
                        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
                        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
                        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
                        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
                        new THREE.Vector3(box.max.x, box.max.y, box.max.z)
                    );
                }
                
                if (obj.geometry instanceof THREE.CircleGeometry) {
                    // Pour les cercles, utiliser la position transformée
                    const center = new THREE.Vector3(0, 0, 0);
                    center.applyMatrix4(obj.matrixWorld);
                    endpoints.push(center);
                }
            }
        }
        
        // Ajouter les points de la polyligne en cours de création pour permettre l'accrochage au dernier point
        if (this.app.drawingManager.isDrawing && 
            this.app.drawingManager.drawingMode === 'polyline' && 
            this.app.drawingManager.drawingPoints.length > 0) {
            
            const lastPoint = this.app.drawingManager.drawingPoints[this.app.drawingManager.drawingPoints.length - 1];
            endpoints.push(lastPoint.clone());
        }
        
        return endpoints;
    }
    
    showSnapIndicator(point) {
        this.snapIndicator.position.copy(point);
        this.snapIndicator.position.z += 0.1;
        this.snapIndicator.visible = true;
        this.snapIndicator.lookAt(this.app.camera.position);
        
        // Change color based on snap type
        if (this.currentSnapType === 'Intersection') {
            this.snapIndicator.material.color.setHex(0xff00ff); // Magenta for intersections
        } else {
            this.snapIndicator.material.color.setHex(0x00ff00); // Green for other snaps
        }
        
        // Afficher aussi le point rouge pour les polylignes
        if (this.app.drawingManager.drawingMode === 'polyline') {
            this.snapDot.position.copy(point);
            this.snapDot.position.z += 0.2;
            this.snapDot.visible = true;
            
            // Change dot color for intersections too
            if (this.currentSnapType === 'Intersection') {
                this.snapDot.material.color.setHex(0xff00ff);
            } else {
                this.snapDot.material.color.setHex(0xff0000);
            }
        }
        
        // Afficher le type d'accrochage dans l'info-bulle
        if (this.currentSnapType) {
            this.showSnapTooltip(point, this.currentSnapType);
        }
    }    hideSnapIndicator() {
        this.snapIndicator.visible = false;
        this.snapDot.visible = false;
        this.currentSnapType = null;
        this.hideSnapTooltip();
        // Ne plus nettoyer automatiquement les lignes de guidage ici
        // this.clearGuideLines(); // Commenté pour permettre aux lignes d'aide de persister
    }
    
    showSnapTooltip(point, snapType) {
        if (!this.tooltip) return;
        
        // Projeter le point 3D en coordonnées écran
        const vector = point.clone();
        vector.project(this.app.camera);
        
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        const x = (vector.x + 1) / 2 * rect.width + rect.left;
        const y = -(vector.y - 1) / 2 * rect.height + rect.top;
        
        this.tooltip.innerHTML = `<span style="color: #00ff00;">Accrochage: ${snapType}</span>`;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${x + 20}px`;
        this.tooltip.style.top = `${y - 30}px`;
    }
    
    hideSnapTooltip() {
        if (this.tooltip && this.currentSnapType) {
            this.tooltip.style.display = 'none';
        }
    }
    
    checkAxisAlignment(startPoint, endPoint) {
        const dx = Math.abs(endPoint.x - startPoint.x);
        const dy = Math.abs(endPoint.y - startPoint.y);
        const dz = Math.abs(endPoint.z - startPoint.z);
        const tolerance = 0.5;
        
        if (dy < tolerance && dz < tolerance && dx > tolerance) {
            return 'X';
        } else if (dx < tolerance && dz < tolerance && dy > tolerance) {
            return 'Y';
        } else if (dx < tolerance && dy < tolerance && dz > tolerance) {
            return 'Z';
        }
        
        return null;
    }
    
    updateTooltip(startPoint, endPoint, mouseEvent) {
        if (!this.tooltip || this.app.drawingManager.drawingMode !== 'line') return;
        
        // Si on est accroché à un point spécifique, afficher uniquement cette info
        if (this.currentSnapType && this.snapIndicator.visible) {
            return; // L'info-bulle d'accrochage est déjà affichée
        }
        
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = angleRad * 180 / Math.PI;
        const normalizedAngle = ((angleDeg % 360) + 360) % 360;
        
        const distance = startPoint.distanceTo(endPoint);
        
        let content = `Angle: ${normalizedAngle.toFixed(1)}°<br>Distance: ${distance.toFixed(2)} cm`;
        
        if (this.isSnappedToAxis) {
            let axisColor = '';
            let axisName = '';
            switch(this.isSnappedToAxis) {
                case 'X':
                    axisColor = '#ff0000';
                    axisName = 'Rouge';
                    break;
                case 'Y':
                    axisColor = '#00ff00';
                    axisName = 'Vert';
                    break;
                case 'Z':
                    axisColor = '#0000ff';
                    axisName = 'Bleu';
                    break;
            }
            content += `<br><span style="color: ${axisColor};">Accroché à l'axe ${axisName}</span>`;
        }
        
        const specialAngles = [0, 45, 90, 135, 180, 225, 270, 315];
        const angleThreshold = 2;
        
        for (let specialAngle of specialAngles) {
            if (Math.abs(normalizedAngle - specialAngle) < angleThreshold) {
                content += `<br><span style="color: #ffff00;">Angle spécial: ${specialAngle}°</span>`;
                break;
            }
        }
        
        this.tooltip.innerHTML = content;
        this.tooltip.style.display = 'block';
        
        if (mouseEvent) {
            const offsetX = 15;
            const offsetY = -50;
            this.tooltip.style.left = `${mouseEvent.clientX + offsetX}px`;
            this.tooltip.style.top = `${mouseEvent.clientY + offsetY}px`;
        }
    }
    
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }
    
    handleKeyboard(event) {
        if (event.key === 'Tab') {
            event.preventDefault();
            this.app.drawingManager.angleSnap = !this.app.drawingManager.angleSnap;
            document.getElementById('snap-indicator').textContent = `Accrochage: ${this.app.drawingManager.angleSnap ? 'ON' : 'OFF'}`;
        } else if (event.key === 'e' || event.key === 'E') {
            this.snapToEndpoints = !this.snapToEndpoints;
            document.getElementById('command-output').textContent = 
                `Accrochage aux extrémités: ${this.snapToEndpoints ? 'Activé' : 'Désactivé'}`;
        } else if (event.key === 'm' || event.key === 'M') {
            this.snapToMidpoints = !this.snapToMidpoints;
            document.getElementById('command-output').textContent = 
                `Accrochage au milieu: ${this.snapToMidpoints ? 'Activé' : 'Désactivé'}`;
        } else if (event.key === 'q' || event.key === 'Q') {
            this.snapToQuarters = !this.snapToQuarters;
            document.getElementById('command-output').textContent = 
                `Accrochage aux quarts: ${this.snapToQuarters ? 'Activé' : 'Désactivé'}`;
        } else if (event.key === 't' || event.key === 'T') {
            this.snapToThirds = !this.snapToThirds;
            document.getElementById('command-output').textContent = 
                `Accrochage aux tiers: ${this.snapToThirds ? 'Activé' : 'Désactivé'}`;        } else if (event.key === 'i' || event.key === 'I') {
            this.snapToIntersections = !this.snapToIntersections;
            document.getElementById('command-output').textContent = 
                `Accrochage aux intersections: ${this.snapToIntersections ? 'Activé' : 'Désactivé'}`;
        } else if (event.key === 'a' || event.key === 'A') {
            this.snapToAlignments = !this.snapToAlignments;
            document.getElementById('command-output').textContent = 
                `Accrochage aux alignements: ${this.snapToAlignments ? 'Activé' : 'Désactivé'}`;
        } else if (event.key === 'p' || event.key === 'P') {
            this.snapToParallels = !this.snapToParallels;
            document.getElementById('command-output').textContent = 
                `Accrochage aux parallèles: ${this.snapToParallels ? 'Activé' : 'Désactivé'}`;
        } else if (event.key === 'r' || event.key === 'R') {
            this.snapToPerpendiculars = !this.snapToPerpendiculars;
            document.getElementById('command-output').textContent = 
                `Accrochage aux perpendiculaires: ${this.snapToPerpendiculars ? 'Activé' : 'Désactivé'}`;        } else if (event.key === 'd' || event.key === 'D') {
            this.enableDistantSnapping = !this.enableDistantSnapping;
            document.getElementById('command-output').textContent = 
                `Accrochage distant: ${this.enableDistantSnapping ? 'Activé' : 'Désactivé'}`;
            if (!this.enableDistantSnapping) {
                this.clearGuideLines(); // Nettoyer les lignes de guidage si désactivé
            }
        } else if (event.key === 'j' || event.key === 'J') {
            this.snapToIntersectionProjections = !this.snapToIntersectionProjections;
            document.getElementById('command-output').textContent = 
                `Accrochage aux intersections projetées: ${this.snapToIntersectionProjections ? 'Activé' : 'Désactivé'}`;
        } else if (event.key === 'c' || event.key === 'C') {
            this.snapToDistantCenters = !this.snapToDistantCenters;
            document.getElementById('command-output').textContent = 
                `Accrochage aux centres distants: ${this.snapToDistantCenters ? 'Activé' : 'Désactivé'}`;
        }
    }
    
    findSnapPoints(object, mousePoint, snapDistance) {
        const snapPoints = [];
        
        if (!object.geometry || !object.geometry.attributes.position) {
            return snapPoints;
        }

        const positions = object.geometry.attributes.position;
        
        // Déterminer si c'est un arc (ligne avec beaucoup de segments courbes)
        const isArc = this.isObjectAnArc(object);
        
        // Points de début et fin (toujours disponibles)
        const startPoint = new THREE.Vector3(
            positions.getX(0),
            positions.getY(0),
            positions.getZ(0)
        );
        const endPoint = new THREE.Vector3(
            positions.getX(positions.count - 1),
            positions.getY(positions.count - 1),
            positions.getZ(positions.count - 1)
        );

        // Vérifier les points de début et fin
        if (this.isPointInRange(startPoint, mousePoint, snapDistance)) {
            snapPoints.push({
                point: startPoint,
                type: 'endpoint',
                distance: startPoint.distanceTo(mousePoint),
                label: 'Début'
            });
        }

        if (this.isPointInRange(endPoint, mousePoint, snapDistance)) {
            snapPoints.push({
                point: endPoint,
                type: 'endpoint',
                distance: endPoint.distanceTo(mousePoint),
                label: 'Fin'
            });
        }

        // Pour les arcs, ne pas ajouter les points 1/2 et 2/3
        if (!isArc) {
            // Point central (1/2) pour les lignes droites seulement
            if (positions.count >= 2) {
                const midIndex = Math.floor((positions.count - 1) / 2);
                const midPoint = new THREE.Vector3(
                    positions.getX(midIndex),
                    positions.getY(midIndex),
                    positions.getZ(midIndex)
                );

                if (this.isPointInRange(midPoint, mousePoint, snapDistance)) {
                    snapPoints.push({
                        point: midPoint,
                        type: 'midpoint',
                        distance: midPoint.distanceTo(mousePoint),
                        label: 'Milieu'
                    });
                }
            }

            // Points 1/3 et 2/3 pour les lignes droites seulement
            if (positions.count >= 3) {
                const oneThirdIndex = Math.floor((positions.count - 1) / 3);
                const twoThirdIndex = Math.floor(2 * (positions.count - 1) / 3);

                const oneThirdPoint = new THREE.Vector3(
                    positions.getX(oneThirdIndex),
                    positions.getY(oneThirdIndex),
                    positions.getZ(oneThirdIndex)
                );

                const twoThirdPoint = new THREE.Vector3(
                    positions.getX(twoThirdIndex),
                    positions.getY(twoThirdIndex),
                    positions.getZ(twoThirdIndex)
                );

                if (this.isPointInRange(oneThirdPoint, mousePoint, snapDistance)) {
                    snapPoints.push({
                        point: oneThirdPoint,
                        type: 'thirdpoint',
                        distance: oneThirdPoint.distanceTo(mousePoint),
                        label: '1/3'
                    });
                }

                if (this.isPointInRange(twoThirdPoint, mousePoint, snapDistance)) {
                    snapPoints.push({
                        point: twoThirdPoint,
                        type: 'thirdpoint',
                        distance: twoThirdPoint.distanceTo(mousePoint),
                        label: '2/3'
                    });
                }
            }
        } else {
            // Pour les arcs, ajouter des points spéciaux (centre, quadrants, etc.)
            this.addArcSpecificSnapPoints(object, mousePoint, snapDistance, snapPoints);
        }

        // Points perpendiculaires (traités différemment pour les arcs)
        this.findPerpendicularPoints(object, mousePoint, snapDistance, snapPoints);

        // Trier par distance
        snapPoints.sort((a, b) => a.distance - b.distance);
        
        return snapPoints;
    }    /**
     * Vérifie l'accrochage aux coins de grille
     */
    checkGridSnapping(worldPoint, event) {
        if (!this.enableGridSnapping || !event) return null;
        
        // Convertir la position de la souris en coordonnées d'écran
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        const mouse2D = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        // Calculer les coins de grille proches
        const gridX = Math.round(worldPoint.x / this.gridSize) * this.gridSize;
        const gridY = Math.round(worldPoint.y / this.gridSize) * this.gridSize;
        
        // Vérifier les 4 coins de grille les plus proches
        const gridPoints = [
            new THREE.Vector3(gridX, gridY, worldPoint.z),
            new THREE.Vector3(gridX + this.gridSize, gridY, worldPoint.z),
            new THREE.Vector3(gridX, gridY + this.gridSize, worldPoint.z),
            new THREE.Vector3(gridX + this.gridSize, gridY + this.gridSize, worldPoint.z),
            new THREE.Vector3(gridX - this.gridSize, gridY, worldPoint.z),
            new THREE.Vector3(gridX, gridY - this.gridSize, worldPoint.z),
            new THREE.Vector3(gridX - this.gridSize, gridY - this.gridSize, worldPoint.z),
            new THREE.Vector3(gridX - this.gridSize, gridY + this.gridSize, worldPoint.z),
            new THREE.Vector3(gridX + this.gridSize, gridY - this.gridSize, worldPoint.z)
        ];
        
        let closestGridPoint = null;
        let minDistance = this.gridSnapDistance;
        
        gridPoints.forEach(gridPoint => {
            const result = this.checkPointDistance(gridPoint, mouse2D, rect);
            if (result.distance < minDistance) {
                minDistance = result.distance;
                closestGridPoint = gridPoint;
            }
        });
        
        return closestGridPoint;
    }

    /**
     * Accrochage polaire - accroche par pas de distance par rapport au point précédent
     */
    checkPolarSnapping(currentPoint, lastPoint) {
        if (!this.enablePolarSnapping || !lastPoint) {
            return null;
        }
        
        // Calculer la distance depuis le dernier point
        const distance = lastPoint.distanceTo(currentPoint);
        
        // Arrondir la distance au pas le plus proche
        const snappedDistance = Math.round(distance / this.polarStep) * this.polarStep;
        
        // Si la distance est déjà proche du pas, pas besoin d'ajuster
        if (Math.abs(distance - snappedDistance) < 0.01) {
            return null;
        }
        
        // Calculer la direction du point actuel par rapport au dernier point
        const direction = new THREE.Vector3().subVectors(currentPoint, lastPoint).normalize();
        
        // Créer le nouveau point à la distance accrochée
        const snappedPoint = lastPoint.clone().add(direction.multiplyScalar(snappedDistance));
        
        return snappedPoint;
    }    /**
     * Active l'accrochage polaire
     */
    enablePolarSnap(step = 0.001) {
        this.enablePolarSnapping = true;
        this.polarStep = step;
        console.log(`Accrochage polaire activé avec un pas de ${step}`);
    }
    
    /**
     * Désactive l'accrochage polaire
     */
    disablePolarSnap() {
        this.enablePolarSnapping = false;
        console.log('Accrochage polaire désactivé');
    }

    /**
     * Détermine si un objet est un arc basé sur sa géométrie
     */
    isObjectAnArc(object) {
        if (!object.geometry || !object.geometry.attributes.position) {
            return false;
        }

        const positions = object.geometry.attributes.position;
        
        // Si l'objet a beaucoup de points (typique d'un arc), vérifier s'il forme une courbe
        if (positions.count > 10) {
            // Calculer la variation de l'angle entre segments consécutifs
            let totalAngleChange = 0;
            let segmentCount = 0;
            
            for (let i = 0; i < positions.count - 2; i++) {
                const p1 = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
                const p2 = new THREE.Vector3(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1));
                const p3 = new THREE.Vector3(positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2));
                
                const v1 = p2.clone().sub(p1).normalize();
                const v2 = p3.clone().sub(p2).normalize();
                
                const angle = Math.acos(Math.max(-1, Math.min(1, v1.dot(v2))));
                totalAngleChange += angle;
                segmentCount++;
            }
            
            const avgAngleChange = totalAngleChange / segmentCount;
            
            // Si l'angle moyen entre segments est significatif, c'est probablement un arc
            return avgAngleChange > 0.1; // ~5.7 degrés
        }
        
        return false;
    }

    /**
     * Ajoute des points d'accrochage spécifiques aux arcs
     */
    addArcSpecificSnapPoints(object, mousePoint, snapDistance, snapPoints) {
        const positions = object.geometry.attributes.position;
        
        // Calculer le centre approximatif de l'arc
        const center = this.calculateArcCenter(object);
        if (center && this.isPointInRange(center, mousePoint, snapDistance)) {
            snapPoints.push({
                point: center,
                type: 'center',
                distance: center.distanceTo(mousePoint),
                label: 'Centre'
            });
        }
        
        // Points aux quarts de l'arc (0°, 90°, 180°, 270° relatifs)
        const quarterPoints = this.calculateArcQuarterPoints(object);
        quarterPoints.forEach((point, index) => {
            if (point && this.isPointInRange(point, mousePoint, snapDistance)) {
                const labels = ['25%', '50%', '75%'];
                snapPoints.push({
                    point: point,
                    type: 'quarter',
                    distance: point.distanceTo(mousePoint),
                    label: labels[index]
                });
            }
        });
    }

    /**
     * Calcule le centre approximatif d'un arc
     */
    calculateArcCenter(object) {
        const positions = object.geometry.attributes.position;
        if (positions.count < 3) return null;
        
        try {
            // Prendre 3 points répartis sur l'arc pour calculer le centre
            const p1 = new THREE.Vector3(positions.getX(0), positions.getY(0), positions.getZ(0));
            const midIndex = Math.floor(positions.count / 2);
            const p2 = new THREE.Vector3(positions.getX(midIndex), positions.getY(midIndex), positions.getZ(midIndex));
            const p3 = new THREE.Vector3(positions.getX(positions.count - 1), positions.getY(positions.count - 1), positions.getZ(positions.count - 1));
            
            return this.calculateCircleCenter(p1, p2, p3);
        } catch (error) {
            return null;
        }
    }

    /**
     * Calcule le centre d'un cercle passant par 3 points
     */
    calculateCircleCenter(p1, p2, p3) {
        const ax = p1.x, ay = p1.y;
        const bx = p2.x, by = p2.y;
        const cx = p3.x, cy = p3.y;
        
        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(d) < 0.0001) return null; // Points colinéaires
        
        const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
        const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
        
        return new THREE.Vector3(ux, uy, p1.z);
    }

    /**
     * Calcule les points aux quarts d'un arc
     */
    calculateArcQuarterPoints(object) {
        const positions = object.geometry.attributes.position;
        const quarterPoints = [];
        
        // Pour un arc, calculer les points à 25%, 50% et 75% du parcours
        const indices = [
            Math.floor(positions.count * 0.25),
            Math.floor(positions.count * 0.5),
            Math.floor(positions.count * 0.75)
        ];
        
        indices.forEach(index => {
            if (index < positions.count) {
                quarterPoints.push(new THREE.Vector3(
                    positions.getX(index),
                    positions.getY(index),
                    positions.getZ(index)
                ));
            }
        });
        
        return quarterPoints;
    }

    findPerpendicularPoints(object, mousePoint, snapDistance, snapPoints) {
        if (!object.geometry || !object.geometry.attributes.position) {
            return;
        }

        const positions = object.geometry.attributes.position;
        
        // Vérifier si c'est un arc - si oui, ne pas proposer d'accrochage perpendiculaire aux segments
        const isArc = this.isObjectAnArc(object);
        if (isArc) {
            // Pour les arcs, on peut proposer des points perpendiculaires depuis le centre
            const center = this.calculateArcCenter(object);
            if (center) {
                // Calculer le point sur l'arc le plus proche du centre dans la direction de la souris
                const direction = mousePoint.clone().sub(center).normalize();
                const radius = this.calculateArcRadius(object, center);
                if (radius > 0) {
                    const perpendicularPoint = center.clone().add(direction.multiplyScalar(radius));
                    
                    if (this.isPointInRange(perpendicularPoint, mousePoint, snapDistance)) {
                        snapPoints.push({
                            point: perpendicularPoint,
                            type: 'perpendicular',
                            distance: perpendicularPoint.distanceTo(mousePoint),
                            label: 'Perpendiculaire'
                        });
                    }
                }
            }
            return; // Ne pas traiter les segments individuels pour les arcs
        }

        // Pour les lignes droites, garder le comportement existant
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

            // Calculer le point perpendiculaire sur ce segment
            const segmentVector = p2.clone().sub(p1);
            const segmentLength = segmentVector.length();
            
            if (segmentLength < 0.001) continue; // Éviter les segments trop courts

            const mouseVector = mousePoint.clone().sub(p1);
            const projection = mouseVector.dot(segmentVector) / (segmentLength * segmentLength);

            // Le point doit être sur le segment (entre 0 et 1)
            if (projection >= 0 && projection <= 1) {
                const perpendicularPoint = p1.clone().add(segmentVector.multiplyScalar(projection));
                
                if (this.isPointInRange(perpendicularPoint, mousePoint, snapDistance)) {
                    snapPoints.push({
                        point: perpendicularPoint,
                        type: 'perpendicular',
                        distance: perpendicularPoint.distanceTo(mousePoint),
                        label: 'Perpendiculaire'
                    });
                }
            }
        }
    }

    /**
     * Calcule le rayon approximatif d'un arc
     */
    calculateArcRadius(object, center) {
        if (!center || !object.geometry || !object.geometry.attributes.position) {
            return 0;
        }

        const positions = object.geometry.attributes.position;
        const startPoint = new THREE.Vector3(
            positions.getX(0),
            positions.getY(0),
            positions.getZ(0)
        );

        return center.distanceTo(startPoint);
    }

    findNearestSnapPoint(mousePosition) {
        if (!this.enabled) return null;

        const snapDistance = this.snapDistance;
        let bestSnapPoint = null;
        let minDistance = snapDistance;

        // Convertir la position de la souris en coordonnées 3D
        const mousePoint = this.screenToWorld(mousePosition);
        if (!mousePoint) return null;        this.app.objects.forEach(object => {
            // Ignorer les objets temporaires, les surfaces, et les lignes d'aide
            if (object.userData && (
                object.userData.isTemporary || 
                object.userData.type === 'surface' ||
                object.userData.isGuideLine
            )) {
                return;
            }

            // Vérifier si c'est un arc pour modifier le comportement d'accrochage
            const isArc = this.isObjectAnArc(object);
            
            const snapPoints = this.findSnapPoints(object, mousePoint, snapDistance);
            
            snapPoints.forEach(snapPoint => {
                if (snapPoint.distance < minDistance) {
                    // Pour les arcs, filtrer certains types d'accrochage indésirables
                    if (isArc && this.shouldSkipSnapPointForArc(snapPoint)) {
                        return;
                    }
                    
                    minDistance = snapPoint.distance;
                    bestSnapPoint = snapPoint;
                }
            });
        });

        return bestSnapPoint;
    }    /**
     * Créer une ligne de guidage en pointillés avec style SketchUp
     */    createGuideLine(startPoint, endPoint, color = 0x404040, opacity = 0.7, lineWidth = 2) {
        const points = [startPoint, endPoint];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
          // Matériau en vrais points (dots) avec style amélioré pour les couleurs grises
        const material = new THREE.LineDashedMaterial({
            color: color,
            linewidth: lineWidth,
            scale: 1,
            dashSize: 1,      // Très petits traits pour créer des points
            gapSize: 4,       // Espaces plus larges entre les points
            opacity: opacity,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.renderOrder = 999;
        line.userData.isGuideLine = true;
        line.userData.guideColor = color;
        
        // Animation subtile du matériau
        this.animateGuideLine(line);
        
        this.app.scene.add(line);
        this.guideLines.push(line);
        
        return line;
    }
    
    /**
     * Animation subtile des lignes de guidage
     */
    animateGuideLine(line) {
        if (this.guideLineAnimation) {
            clearInterval(this.guideLineAnimation);
        }
        
        let offset = 0;
        this.guideLineAnimation = setInterval(() => {
            if (line.material && !line.material.disposed) {
                offset += 0.1;
                line.material.dashSize = 8 + Math.sin(offset) * 2;
                line.material.needsUpdate = true;
            }
        }, 100);
    }
      // Nettoyer toutes les lignes de guidage
    clearGuideLines() {
        // Arrêter l'animation
        if (this.guideLineAnimation) {
            clearInterval(this.guideLineAnimation);
            this.guideLineAnimation = null;
        }
        
        this.guideLines.forEach(line => {
            this.app.scene.remove(line);
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
        });
        this.guideLines = [];
    }    // Vérifier l'accrochage distant avec lignes de guidage
    checkDistantSnapping(worldPoint, event) {
        if (!this.enableDistantSnapping || !event) return null;
          console.log('🔍 checkDistantSnapping appelé avec:', worldPoint, 'event:', !!event);
        
        // Debug complet de la structure
        console.log('🔍 Debug structure complète:');
        console.log('  - app.toolManager:', !!this.app.toolManager);
        console.log('  - activeTool:', this.app.toolManager?.activeTool?.constructor?.name);
        console.log('  - drawingManager:', !!this.app.drawingManager);
        console.log('  - drawingManager.polylineTool:', !!this.app.drawingManager?.polylineTool);
        console.log('  - isDrawing:', this.app.drawingManager?.isDrawing);
        console.log('  - drawingMode:', this.app.drawingManager?.drawingMode);
        
        // Vérifier si on a assez de points pour faire un accrochage distant
        if (this.app.drawingManager && this.app.drawingManager.isDrawing && this.app.drawingManager.drawingMode === 'polyline') {
            // Essayer plusieurs sources pour l'outil polyligne
            var polylineTool = this.app.toolManager?.activeTool || 
                              this.app.drawingManager?.polylineTool ||
                              this.app.toolManager?.tools?.polyline;
            
            console.log('🔍 Outil polyligne trouvé:', polylineTool?.constructor?.name);
            console.log('🔍 Points dans l\'outil:', polylineTool?.points?.length);
            
            if (polylineTool && polylineTool.points && polylineTool.points.length >= 1) {
                console.log('✅ Assez de points pour accrochage distant');
            } else {
                console.log('❌ Pas assez de points pour accrochage distant (premier segment)');
                return null;
            }
        } else {
            console.log('❌ Conditions non remplies pour accrochage distant');
            return null;
        }
          this.clearGuideLines();
        
        var bestSnapPoint = null;
        let minDistance = this.snapDistance;
        let snapType = null;        // Obtenir tous les objets de la scène pour l'accrochage distant
        var objects = this.app.objects.filter(function(obj) {
            return obj.geometry && 
            obj.geometry.attributes.position &&
            obj.visible &&
            !obj.userData.isGuideLine &&
            !obj.userData.isTemporary;
        });
        
        console.log('📊 Objets trouvés pour accrochage distant:', objects.length);
        console.log('📊 Total app.objects:', this.app.objects.length);
        var objectTypes = this.app.objects.map(function(obj) {
            return {
                type: obj.type || 'undefined',
                constructor: obj.constructor.name,
                hasGeometry: !!obj.geometry,
                hasPosition: !!(obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position),
                visible: obj.visible,
                isGuideLine: obj.userData?.isGuideLine,
                isTemporary: obj.userData?.isTemporary
            };
        });
        console.log('📊 Types d\'objets détaillés:', objectTypes);        // 1. Accrochage aux extrémités distantes (alignement)
        if (this.snapToDistantEndpoints) {
            console.log('🔍 Test accrochage extrémités distantes...');
            var alignmentResult = this.checkDistantEndpointAlignment(worldPoint, objects, event);
            if (alignmentResult && alignmentResult.distance < minDistance) {
                console.log('✅ Accrochage extrémités trouvé:', alignmentResult);
                bestSnapPoint = alignmentResult.point;
                minDistance = alignmentResult.distance;
                snapType = alignmentResult.type;
            } else {
                console.log('❌ Pas d\'accrochage extrémités');
            }
        }
          // 2. Accrochage aux parallèles
        console.log('🔍 Vérification snapToParallels:', this.snapToParallels);
        if (this.snapToParallels) {
            console.log('🔍 Test accrochage parallèles...');
            var parallelResult = this.checkParallelSnapping(worldPoint, objects, event);
            console.log('🔍 Résultat parallèle:', parallelResult);
            if (parallelResult && parallelResult.distance < minDistance) {
                console.log('✅ Accrochage parallèle trouvé:', parallelResult);
                bestSnapPoint = parallelResult.point;
                minDistance = parallelResult.distance;
                snapType = parallelResult.type;
            }
        } else {
            console.log('❌ snapToParallels désactivé');
        }        // 3. Accrochage aux perpendiculaires
        if (this.snapToPerpendiculars) {
            var perpendicularResult = this.checkPerpendicularSnapping(worldPoint, objects, event);
            if (perpendicularResult && perpendicularResult.distance < minDistance) {
                bestSnapPoint = perpendicularResult.point;
                minDistance = perpendicularResult.distance;
                snapType = perpendicularResult.type;
            }
        }
        
        // 4. Accrochage aux intersections projetées
        if (this.snapToIntersectionProjections) {
            var intersectionResult = this.checkIntersectionProjections(worldPoint, objects, event);
            if (intersectionResult && intersectionResult.distance < minDistance) {
                bestSnapPoint = intersectionResult.point;
                minDistance = intersectionResult.distance;
                snapType = intersectionResult.type;
            }
        }
        
        // 5. Accrochage aux centres distants
        if (this.snapToDistantCenters) {
            var centerResult = this.checkDistantCenterSnapping(worldPoint, objects, event);
            if (centerResult && centerResult.distance < minDistance) {
                bestSnapPoint = centerResult.point;
                minDistance = centerResult.distance;
                snapType = centerResult.type;
            }
        }
          if (bestSnapPoint) {
            this.currentSnapType = snapType;
            return bestSnapPoint;
        }
        
        return null;
    }
      // Vérifier l'alignement avec des extrémités distantes
    checkDistantEndpointAlignment(worldPoint, objects, event) {
        console.log('🔍 checkDistantEndpointAlignment appelé avec', objects.length, 'objets');
        
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        const mouse2D = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        let bestResult = null;
        let minDistance = this.snapDistance;        // Obtenir le point de départ de la ligne en cours (si applicable)
        let currentLineStart = null;
        if (this.app.drawingManager && this.app.drawingManager.isDrawing) {
            if (this.app.drawingManager.drawingMode === 'polyline') {
                // Pour l'outil polyligne, récupérer le dernier point défini
                const polylineTool = this.app.drawingManager.polylineTool;
                console.log('🔍 Polyligne detectée, points.length:', polylineTool?.points?.length);
                console.log('🔍 Points de la polyligne:', polylineTool?.points);
                
                if (polylineTool && polylineTool.points && polylineTool.points.length >= 1) {
                    // Prendre le dernier point confirmé (pas le point de prévisualisation)
                    currentLineStart = polylineTool.points[polylineTool.points.length - 1];
                    console.log('✅ Point de départ récupéré:', currentLineStart);
                }
            } else if (this.app.drawingManager.drawingPoints.length > 0) {
                // Pour les autres outils, utiliser drawingPoints
                currentLineStart = this.app.drawingManager.drawingPoints[this.app.drawingManager.drawingPoints.length - 1];
            }
        }
          if (!currentLineStart) {
            console.log('❌ Pas de currentLineStart trouvé');
            console.log('  - drawingPoints.length:', this.app.drawingManager?.drawingPoints?.length);
            console.log('  - polylineTool.points.length:', this.app.drawingManager?.polylineTool?.points?.length);
            return null;
        }
          console.log('✅ currentLineStart trouvé:', currentLineStart);
        
        objects.forEach((obj, objIndex) => {
            const endpoints = this.getObjectEndpoints(obj);
            console.log(`🔍 Objet ${objIndex} - endpoints trouvés:`, endpoints.length);
            
            endpoints.forEach((endpoint, endIndex) => {
                console.log(`  📍 Endpoint ${endIndex}:`, endpoint);
                console.log(`  📏 Distance Y (horizontal): ${Math.abs(endpoint.y - currentLineStart.y)}`);
                console.log(`  📏 Distance X (vertical): ${Math.abs(endpoint.x - currentLineStart.x)}`);
                
                // Vérifier l'alignement horizontal
                if (Math.abs(endpoint.y - currentLineStart.y) < 0.5) {
                    console.log('✅ Alignement horizontal détecté!');
                    const alignedPoint = new THREE.Vector3(worldPoint.x, endpoint.y, worldPoint.z);
                    const result = this.checkPointDistance(alignedPoint, mouse2D, rect);
                    console.log('  📊 Distance calculée:', result.distance, '/ Seuil:', minDistance);
                      if (result.distance < minDistance) {
                        console.log('✅ Accrochage horizontal accepté!');
                        // Créer une ligne de guidage horizontale (vert clair)
                        const startGuide = new THREE.Vector3(Math.min(endpoint.x, alignedPoint.x) - 50, endpoint.y, 0);
                        const endGuide = new THREE.Vector3(Math.max(endpoint.x, alignedPoint.x) + 50, endpoint.y, 0);
                        this.createGuideLine(startGuide, endGuide, 0x00ff00, 0.9, 2);
                        
                        // Marquer le point de référence
                        this.createGuideLine(
                            new THREE.Vector3(endpoint.x - 1, endpoint.y - 1, 0),
                            new THREE.Vector3(endpoint.x + 1, endpoint.y + 1, 0),
                            0x00ff00, 1.0, 3
                        );
                        
                        bestResult = {
                            point: alignedPoint,
                            distance: result.distance,
                            type: 'Alignement horizontal'
                        };
                        minDistance = result.distance;
                    }
                }
                
                // Vérifier l'alignement vertical
                if (Math.abs(endpoint.x - currentLineStart.x) < 0.5) {
                    console.log('✅ Alignement vertical détecté!');
                    const alignedPoint = new THREE.Vector3(endpoint.x, worldPoint.y, worldPoint.z);
                    const result = this.checkPointDistance(alignedPoint, mouse2D, rect);
                    console.log('  📊 Distance calculée:', result.distance, '/ Seuil:', minDistance);
                      if (result.distance < minDistance) {
                        console.log('✅ Accrochage vertical accepté!');
                        // Créer une ligne de guidage verticale (vert clair)
                        const startGuide = new THREE.Vector3(endpoint.x, Math.min(endpoint.y, alignedPoint.y) - 50, 0);
                        const endGuide = new THREE.Vector3(endpoint.x, Math.max(endpoint.y, alignedPoint.y) + 50, 0);
                        this.createGuideLine(startGuide, endGuide, 0x00ff00, 0.9, 2);
                        
                        // Marquer le point de référence
                        this.createGuideLine(
                            new THREE.Vector3(endpoint.x - 1, endpoint.y - 1, 0),
                            new THREE.Vector3(endpoint.x + 1, endpoint.y + 1, 0),
                            0x00ff00, 1.0, 3
                        );
                        
                        bestResult = {
                            point: alignedPoint,
                            distance: result.distance,
                            type: 'Alignement vertical'
                        };
                        minDistance = result.distance;
                    }
                }
            });
        });
        
        return bestResult;
    }    // Vérifier l'accrochage parallèle
    checkParallelSnapping(worldPoint, objects, event) {
        console.log('🔸 checkParallelSnapping appelé:', {
            worldPoint,
            objectsCount: objects.length,
            hasEvent: !!event
        });
        
        var rect = this.app.renderer.domElement.getBoundingClientRect();
        var mouse2D = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        var bestResult = null;
        var minDistance = this.snapDistance;
        
        // Obtenir le point de départ de la ligne en cours
        var currentLineStart = null;
        if (this.app.drawingManager && this.app.drawingManager.isDrawing) {
            console.log('🔸 DrawingManager.isDrawing =', this.app.drawingManager.isDrawing);
            if (this.app.drawingManager.drawingMode === 'polyline' && this.app.drawingManager.drawingPoints.length > 0) {
                currentLineStart = this.app.drawingManager.drawingPoints[this.app.drawingManager.drawingPoints.length - 1];
                console.log('🔸 Point de départ depuis drawingPoints:', currentLineStart);
            }
        }
        
        // Essayer aussi depuis l'outil actif
        if (!currentLineStart && this.app.toolManager.activeTool && this.app.toolManager.activeTool.points) {
            var polylineTool = this.app.toolManager.activeTool;
            if (polylineTool.points.length > 0) {
                currentLineStart = polylineTool.points[polylineTool.points.length - 1];
                console.log('🔸 Point de départ depuis polylineTool.points:', currentLineStart);
            }
        }
        
        if (!currentLineStart) {
            console.log('🔸 Aucun point de départ trouvé');
            return null;
        }
        
        console.log('🔸 Point de départ final:', currentLineStart);
        
        var self = this;
        objects.forEach(function(obj, index) {
            console.log('🔸 Test objet ' + index + ':', obj.userData?.id || 'no-id');
            
            var positions = obj.geometry.attributes.position;
            if (!positions) {
                console.log('🔸 Pas d\'attribut position');
                return;
            }
            
            console.log('🔸 Points dans la géométrie:', positions.count);
            
            // Analyser chaque segment de l'objet
            for (var i = 0; i < positions.count - 1; i++) {
                var p1 = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
                var p2 = new THREE.Vector3(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1));
                p1.applyMatrix4(obj.matrixWorld);
                p2.applyMatrix4(obj.matrixWorld);
                
                console.log('🔸 Segment ' + i + ':', {
                    p1: { x: p1.x.toFixed(3), y: p1.y.toFixed(3) },
                    p2: { x: p2.x.toFixed(3), y: p2.y.toFixed(3) }
                });
                
                // Calculer la direction du segment existant
                var segmentDir = p2.clone().sub(p1).normalize();
                console.log('🔸 Direction segment:', {
                    x: segmentDir.x.toFixed(3),
                    y: segmentDir.y.toFixed(3)
                });
                
                // Calculer la direction de la ligne courante vers la souris
                var mouseDir = worldPoint.clone().sub(currentLineStart).normalize();
                console.log('🔸 Direction souris:', {
                    x: mouseDir.x.toFixed(3),
                    y: mouseDir.y.toFixed(3)
                });
                
                // Vérifier si les directions sont parallèles (produit vectoriel proche de 0)
                var cross = Math.abs(segmentDir.x * mouseDir.y - segmentDir.y * mouseDir.x);
                console.log('🔸 Produit vectoriel (parallèle):', cross.toFixed(6));
                
                if (cross < 0.1) { // Seuil de parallélisme
                    console.log('✅ Parallèle détecté !');
                    
                    // Calculer le point sur la ligne parallèle
                    var distance = currentLineStart.distanceTo(worldPoint);
                    var parallelPoint = currentLineStart.clone().add(segmentDir.multiplyScalar(distance));
                    
                    console.log('🔸 Point parallèle calculé:', parallelPoint);
                    
                    var result = self.checkPointDistance(parallelPoint, mouse2D, rect);
                    if (result.distance < minDistance) {
                        console.log('✅ Meilleur résultat parallèle trouvé');
                        
                        // Créer une ligne de guidage parallèle (magenta)
                        var guideStart = currentLineStart.clone();
                        var guideEnd = parallelPoint.clone().add(segmentDir.multiplyScalar(50));
                        self.createGuideLine(guideStart, guideEnd, 0xff00ff, 0.9, 2);
                        
                        // Créer aussi une ligne de référence (magenta transparent)
                        var refStart = p1.clone().sub(segmentDir.multiplyScalar(20));
                        var refEnd = p2.clone().add(segmentDir.multiplyScalar(20));
                        self.createGuideLine(refStart, refEnd, 0xff00ff, 0.4, 1);
                        
                        bestResult = {
                            point: parallelPoint,
                            distance: result.distance,
                            type: 'Parallèle'
                        };
                        minDistance = result.distance;
                    }
                } else {
                    console.log('🔸 Pas parallèle (cross =', cross.toFixed(6), ')');
                }
            }
        });
        
        console.log('🔸 Résultat final parallèle:', bestResult);
        return bestResult;
    }
    
    // Vérifier l'accrochage perpendiculaire
    checkPerpendicularSnapping(worldPoint, objects, event) {
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        const mouse2D = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        let bestResult = null;
        let minDistance = this.snapDistance;
        
        // Obtenir le point de départ de la ligne en cours
        let currentLineStart = null;
        if (this.app.drawingManager && this.app.drawingManager.isDrawing) {
            if (this.app.drawingManager.drawingMode === 'polyline' && this.app.drawingManager.drawingPoints.length > 0) {
                currentLineStart = this.app.drawingManager.drawingPoints[this.app.drawingManager.drawingPoints.length - 1];
            }
        }
        
        if (!currentLineStart) return null;
        
        objects.forEach(obj => {
            const positions = obj.geometry.attributes.position;
            
            // Analyser chaque segment de l'objet
            for (let i = 0; i < positions.count - 1; i++) {
                const p1 = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
                const p2 = new THREE.Vector3(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1));
                p1.applyMatrix4(obj.matrixWorld);
                p2.applyMatrix4(obj.matrixWorld);
                
                // Calculer la direction du segment existant
                const segmentDir = p2.clone().sub(p1).normalize();
                
                // Calculer la direction perpendiculaire
                const perpDir = new THREE.Vector3(-segmentDir.y, segmentDir.x, 0);
                
                // Calculer la direction de la ligne courante vers la souris
                const mouseDir = worldPoint.clone().sub(currentLineStart).normalize();
                
                // Vérifier si les directions sont perpendiculaires (produit scalaire proche de 0)
                const dot = Math.abs(segmentDir.dot(mouseDir));
                
                if (dot < 0.1) { // Seuil de perpendicularité
                    // Calculer le point sur la ligne perpendiculaire
                    const distance = currentLineStart.distanceTo(worldPoint);
                    const perpPoint = currentLineStart.clone().add(perpDir.multiplyScalar(distance));
                    
                    const result = this.checkPointDistance(perpPoint, mouse2D, rect);
                      if (result.distance < minDistance) {
                        // Créer une ligne de guidage perpendiculaire (cyan)
                        const guideStart = currentLineStart.clone();
                        const guideEnd = perpPoint.clone().add(perpDir.multiplyScalar(50));
                        this.createGuideLine(guideStart, guideEnd, 0x00ffff, 0.9, 2);
                        
                        // Créer aussi une ligne de référence (cyan transparent)
                        const refStart = p1.clone().sub(segmentDir.multiplyScalar(20));
                        const refEnd = p2.clone().add(segmentDir.multiplyScalar(20));
                        this.createGuideLine(refStart, refEnd, 0x00ffff, 0.4, 1);
                        
                        bestResult = {
                            point: perpPoint,
                            distance: result.distance,
                            type: 'Perpendiculaire'
                        };
                        minDistance = result.distance;
                    }
                }
            }
        });
          return bestResult;
    }
    
    /**
     * Vérifier l'accrochage aux intersections projetées
     */
    checkIntersectionProjections(worldPoint, objects, event) {
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        const mouse2D = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        let bestResult = null;
        let minDistance = this.snapDistance;
        
        // Obtenir le point de départ de la ligne en cours
        let currentLineStart = null;
        if (this.app.drawingManager && this.app.drawingManager.isDrawing) {
            if (this.app.drawingManager.drawingMode === 'polyline' && this.app.drawingManager.drawingPoints.length > 0) {
                currentLineStart = this.app.drawingManager.drawingPoints[this.app.drawingManager.drawingPoints.length - 1];
            }
        }
        
        if (!currentLineStart) return null;
        
        // Analyser toutes les paires de lignes pour trouver des intersections projetées
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                const obj1 = objects[i];
                const obj2 = objects[j];
                
                const segments1 = this.getObjectSegments(obj1);
                const segments2 = this.getObjectSegments(obj2);
                
                segments1.forEach(seg1 => {
                    segments2.forEach(seg2 => {
                        // Calculer l'intersection projetée des deux segments
                        const intersection = this.getLineIntersection(seg1.start, seg1.end, seg2.start, seg2.end);
                        
                        if (intersection) {
                            // Vérifier l'alignement avec le point de départ courant
                            const distanceX = Math.abs(intersection.x - currentLineStart.x);
                            const distanceY = Math.abs(intersection.y - currentLineStart.y);
                            
                            if (distanceX < 0.5 || distanceY < 0.5) {
                                const alignedPoint = distanceX < 0.5 ? 
                                    new THREE.Vector3(intersection.x, worldPoint.y, worldPoint.z) :
                                    new THREE.Vector3(worldPoint.x, intersection.y, worldPoint.z);
                                    
                                const result = this.checkPointDistance(alignedPoint, mouse2D, rect);
                                
                                if (result.distance < minDistance) {
                                    // Créer des lignes de guidage pour montrer l'intersection projetée
                                    if (distanceX < 0.5) {
                                        this.createGuideLine(
                                            new THREE.Vector3(intersection.x, Math.min(intersection.y, alignedPoint.y) - 30, 0),
                                            new THREE.Vector3(intersection.x, Math.max(intersection.y, alignedPoint.y) + 30, 0),
                                            0xffff00, 0.7, 1
                                        );
                                    } else {
                                        this.createGuideLine(
                                            new THREE.Vector3(Math.min(intersection.x, alignedPoint.x) - 30, intersection.y, 0),
                                            new THREE.Vector3(Math.max(intersection.x, alignedPoint.x) + 30, intersection.y, 0),
                                            0xffff00, 0.7, 1
                                        );
                                    }
                                    
                                    // Lignes de référence vers l'intersection
                                    this.createGuideLine(seg1.start, seg1.end, 0xffff00, 0.3, 1);
                                    this.createGuideLine(seg2.start, seg2.end, 0xffff00, 0.3, 1);
                                    
                                    bestResult = {
                                        point: alignedPoint,
                                        distance: result.distance,
                                        type: 'Intersection projetée'
                                    };
                                    minDistance = result.distance;
                                }
                            }
                        }
                    });
                });
            }
        }
        
        return bestResult;
    }
    
    /**
     * Vérifier l'accrochage aux centres distants
     */
    checkDistantCenterSnapping(worldPoint, objects, event) {
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        const mouse2D = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        let bestResult = null;
        let minDistance = this.snapDistance;
        
        // Obtenir le point de départ de la ligne en cours
        let currentLineStart = null;
        if (this.app.drawingManager && this.app.drawingManager.isDrawing) {
            if (this.app.drawingManager.drawingMode === 'polyline' && this.app.drawingManager.drawingPoints.length > 0) {
                currentLineStart = this.app.drawingManager.drawingPoints[this.app.drawingManager.drawingPoints.length - 1];
            }
        }
        
        if (!currentLineStart) return null;
        
        objects.forEach(obj => {
            const segments = this.getObjectSegments(obj);
            
            segments.forEach(segment => {
                // Calculer le centre du segment
                const center = segment.start.clone().add(segment.end).multiplyScalar(0.5);
                
                // Vérifier l'alignement horizontal avec le centre
                if (Math.abs(center.y - currentLineStart.y) < 0.5) {
                    const alignedPoint = new THREE.Vector3(worldPoint.x, center.y, worldPoint.z);
                    const result = this.checkPointDistance(alignedPoint, mouse2D, rect);
                    
                    if (result.distance < minDistance) {
                        // Créer une ligne de guidage horizontale
                        this.createGuideLine(
                            new THREE.Vector3(Math.min(center.x, alignedPoint.x) - 40, center.y, 0),
                            new THREE.Vector3(Math.max(center.x, alignedPoint.x) + 40, center.y, 0),
                            0x00ffff, 0.8, 1.5
                        );
                        
                        // Marquer le centre de référence
                        this.createGuideLine(
                            new THREE.Vector3(center.x - 2, center.y - 2, 0),
                            new THREE.Vector3(center.x + 2, center.y + 2, 0),
                            0x00ffff, 1.0, 2
                        );
                        this.createGuideLine(
                            new THREE.Vector3(center.x - 2, center.y + 2, 0),
                            new THREE.Vector3(center.x + 2, center.y - 2, 0),
                            0x00ffff, 1.0, 2
                        );
                        
                        bestResult = {
                            point: alignedPoint,
                            distance: result.distance,
                            type: 'Centre distant'
                        };
                        minDistance = result.distance;
                    }
                }
                
                // Vérifier l'alignement vertical avec le centre
                if (Math.abs(center.x - currentLineStart.x) < 0.5) {
                    const alignedPoint = new THREE.Vector3(center.x, worldPoint.y, worldPoint.z);
                    const result = this.checkPointDistance(alignedPoint, mouse2D, rect);
                    
                    if (result.distance < minDistance) {
                        // Créer une ligne de guidage verticale
                        this.createGuideLine(
                            new THREE.Vector3(center.x, Math.min(center.y, alignedPoint.y) - 40, 0),
                            new THREE.Vector3(center.x, Math.max(center.y, alignedPoint.y) + 40, 0),
                            0x00ffff, 0.8, 1.5
                        );
                        
                        // Marquer le centre de référence
                        this.createGuideLine(
                            new THREE.Vector3(center.x - 2, center.y - 2, 0),
                            new THREE.Vector3(center.x + 2, center.y + 2, 0),
                            0x00ffff, 1.0, 2
                        );
                        this.createGuideLine(
                            new THREE.Vector3(center.x - 2, center.y + 2, 0),
                            new THREE.Vector3(center.x + 2, center.y - 2, 0),
                            0x00ffff, 1.0, 2
                        );
                        
                        bestResult = {
                            point: alignedPoint,
                            distance: result.distance,
                            type: 'Centre distant'
                        };
                        minDistance = result.distance;
                    }
                }
            });
        });
        
        return bestResult;
    }
    
    /**
     * Obtenir tous les segments d'un objet
     */
    getObjectSegments(obj) {
        const segments = [];
        const positions = obj.geometry.attributes.position;
        
        for (let i = 0; i < positions.count - 1; i++) {
            const start = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
            const end = new THREE.Vector3(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1));
            start.applyMatrix4(obj.matrixWorld);
            end.applyMatrix4(obj.matrixWorld);
            
            segments.push({ start, end });
        }
        
        return segments;
    }
    
    /**
     * Calculer l'intersection de deux lignes infinies
     */
    getLineIntersection(p1, p2, p3, p4) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        if (Math.abs(denom) < 1e-10) {
            return null; // Lignes parallèles
        }
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        
        return new THREE.Vector3(
            x1 + t * (x2 - x1),
            y1 + t * (y2 - y1),
            0
        );
    }
}
