import * as THREE from 'three';

export class ExtrusionManager {    constructor(app) {
        this.app = app;
        this.isExtruding = false;
        this.extrudeStartPoint = null;
        this.extrudeObject = null;
        this.extrudePreview = null;
        this.currentHeight = 0;
        this.mouseFollower = null;
        this.heightStep = 0.1; // Pas de 0,1 cm pour un contrôle fin
        this.heightLockedManually = false; // Flag pour indiquer si la hauteur est verrouillée manuellement
        this.lastMousePosition = { x: 0, y: 0 }; // Pour détecter les mouvements de souris significatifs
        
        // Optimisations pour réduire la latence
        this.lastUpdateTime = 0;
        this.updateThrottle = 16; // Limiter à ~60 FPS
        this.baseShape = null; // Sauvegarder la forme de base
        this.originalExtrudeSettings = null;
        
        this.createMouseFollower();
        this.setupEventListeners();
    }
    
    createMouseFollower() {
        // Créer la fenêtre qui suit la souris
        this.mouseFollower = document.createElement('div');
        this.mouseFollower.id = 'extrusion-height-display';
        this.mouseFollower.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            pointer-events: none;
            z-index: 10000;
            display: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 1px solid #444;
        `;
        document.body.appendChild(this.mouseFollower);
    }
      setupEventListeners() {
        // Gérer le clic droit pendant l'extrusion
        document.addEventListener('contextmenu', (event) => {
            if (this.isExtruding) {
                event.preventDefault();
                this.showHeightInput(event);
            }
        });
        
        // Gérer les touches pendant l'extrusion
        document.addEventListener('keydown', (event) => {
            if (this.isExtruding) {
                if (event.key === 'Escape') {
                    this.cancelExtrusion();
                } else if (event.key === 'Enter') {
                    this.finishExtrusion(event);                } else if (event.key === 'u' || event.key === 'U') {
                    // Touche 'U' pour déverrouiller (Unlock)
                    if (this.heightLockedManually) {
                        this.heightLockedManually = false;
                        document.getElementById('command-output').textContent = 
                            'Hauteur déverrouillée - Déplacez la souris pour ajuster (Clic droit: saisir hauteur, Échap: annuler)';
                    }
                }
            }
        });
    }    
    showHeightInput(event) {
        // Créer un dialogue pour saisir la hauteur précise
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            left: ${event.clientX + 10}px;
            top: ${event.clientY - 50}px;
            background: #2c3e50;
            border: 2px solid #3498db;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10001;
            font-family: Arial, sans-serif;
            color: white;
            min-width: 280px;
        `;
        
        dialog.innerHTML = `
            <div style="margin-bottom: 15px; font-weight: bold; color: #3498db; border-bottom: 1px solid #34495e; padding-bottom: 8px;">
                📏 Hauteur d'extrusion (cm)
            </div>
            <input type="number" id="height-input" 
                   value="${this.currentHeight.toFixed(1)}" 
                   step="0.1" min="0.1" max="1000"
                   style="width: 100%; padding: 8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px; margin-bottom: 15px;">            <div style="text-align: center;">
                <button id="apply-height" style="background: #27ae60; color: white; border: none; 
                        padding: 10px 20px; margin-right: 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    ✓ Appliquer
                </button>
                <button id="cancel-height" style="background: #e74c3c; color: white; border: none; 
                        padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    ✗ Annuler
                </button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        const input = dialog.querySelector('#height-input');
        const applyBtn = dialog.querySelector('#apply-height');
        const cancelBtn = dialog.querySelector('#cancel-height');
        
        // Focus sur l'input et sélection du texte
        input.focus();
        input.select();
        
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };
          applyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Empêcher la propagation vers le canvas
            const height = Math.max(0.1, parseFloat(input.value) || 0.1);
            this.setExtrusionHeight(height);
            closeDialog();
        });
        
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Empêcher la propagation vers le canvas
            closeDialog();
        });
        
        // Valider avec Entrée
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyBtn.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog();
            }
        });
        
        // Fermer si on clique ailleurs
        setTimeout(() => {
            document.addEventListener('click', function closeOnOutsideClick(e) {
                if (!dialog.contains(e.target)) {
                    document.removeEventListener('click', closeOnOutsideClick);
                    if (document.body.contains(dialog)) {
                        closeDialog();
                    }
                }
            });
        }, 100);
    }    setExtrusionHeight(height) {
        if (!this.isExtruding || !this.extrudePreview) return;
        
        this.currentHeight = height;
        this.updateExtrusionPreviewWithHeight(height);
        
        // Terminer l'extrusion automatiquement avec la hauteur spécifiée
        this.finishExtrusion(null);
    }
    
    updateMouseFollower(height, mouseX, mouseY) {
        if (!this.mouseFollower) return;
        
        if (this.isExtruding) {
            this.mouseFollower.style.display = 'block';
            this.mouseFollower.textContent = `Hauteur: ${height.toFixed(1)} cm`;
            
            if (mouseX !== undefined && mouseY !== undefined) {
                this.mouseFollower.style.left = (mouseX + 15) + 'px';
                this.mouseFollower.style.top = (mouseY - 30) + 'px';
            }
        } else {
            this.mouseFollower.style.display = 'none';
        }
    }      handleExtrusion(event) {
        if (!this.isExtruding) {
            const intersects = this.app.raycaster.intersectObjects(this.app.objects);
            if (intersects.length > 0) {
                const object = intersects[0].object;
                
                if (this.canExtrude(object)) {
                    this.startExtrusion(object, intersects[0].point);
                } else {
                    document.getElementById('command-output').textContent = 'Cet objet ne peut pas être extrudé';
                }
            }
        } else {
            this.finishExtrusion(event);
        }
    }
    
    canExtrude(object) {
        return object.geometry && 
               object instanceof THREE.Mesh &&
               (object.geometry instanceof THREE.PlaneGeometry || 
                object.geometry instanceof THREE.CircleGeometry ||
                object.geometry instanceof THREE.ShapeGeometry ||
                (object.userData && object.userData.type === 'surface'));    }
    
    startExtrusion(object, startPoint) {
        this.isExtruding = true;
        this.extrudeObject = object;
        this.extrudeStartPoint = startPoint.clone();
        this.currentHeight = 1.0; // Hauteur initiale de 1 cm
        this.heightLockedManually = false; // Réinitialiser le verrouillage manuel
        this.lastMousePosition = { x: 0, y: 0 }; // Réinitialiser la position de la souris
        
        // Réinitialiser les variables d'optimisation
        this.lastUpdateTime = 0;
        this.startMouseY = null; // Sera initialisé au premier mouvement de souris
        this.baseShape = null; // Sera créé au premier appel
        
        this.app.controls.enabled = false;
        this.createExtrusionPreview(object);
        
        // Afficher la fenêtre qui suit la souris
        this.updateMouseFollower(this.currentHeight);
        
        document.getElementById('command-output').textContent = 
            'Déplacez la souris vers le haut pour définir la hauteur (Clic droit: saisir hauteur précise, Échap: annuler)';
    }
    
    createExtrusionPreview(object) {
        let shape;
        
        if (object.geometry instanceof THREE.PlaneGeometry) {
            const width = object.geometry.parameters.width;
            const height = object.geometry.parameters.height;
            shape = new THREE.Shape();
            shape.moveTo(-width/2, -height/2);
            shape.lineTo(width/2, -height/2);
            shape.lineTo(width/2, height/2);
            shape.lineTo(-width/2, height/2);
            shape.lineTo(-width/2, -height/2);
        } else if (object.geometry instanceof THREE.CircleGeometry) {
            const radius = object.geometry.parameters.radius;
            shape = new THREE.Shape();
            shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
        } else if (object.geometry instanceof THREE.ShapeGeometry || 
                   (object.userData && object.userData.type === 'surface')) {
            // Pour les surfaces créées automatiquement, extraire la forme depuis la géométrie
            shape = this.extractShapeFromGeometry(object.geometry, object.position);
        }
        
        if (shape) {
            const extrudeSettings = {
                depth: 0.1,
                bevelEnabled: false
            };
              const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);            
            // Générer des coordonnées UV pour l'aperçu aussi
            this.generateProperUVs(geometry);
            
            // Utiliser MeshPhongMaterial COMPATIBLE avec les textures
            const material = new THREE.MeshPhongMaterial({
                color: 0xffffff,        // Blanc pour les textures
                // SUPPRIMÉ: emissive qui interfère avec les textures
                shininess: 30,          // Brillance modérée
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.95
            });
            
            this.extrudePreview = new THREE.Mesh(geometry, material);
            this.extrudePreview.position.copy(object.position);
            this.extrudePreview.castShadow = true;
            this.extrudePreview.receiveShadow = true;
            
            const edges = new THREE.EdgesGeometry(geometry);
            const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
                color: 0x000000,
                linewidth: 2,
                opacity: 1,
                transparent: false
            }));
            this.extrudePreview.add(lines);
            
            this.app.scene.add(this.extrudePreview);
            object.visible = false;
        }
    }
    
    extractShapeFromGeometry(geometry, position) {
        try {
            // Extraire les points de la géométrie
            const vertices = geometry.attributes.position.array;
            const shape = new THREE.Shape();
            
            if (vertices.length >= 6) { // Au moins 3 points (x,y,z pour chaque)
                // Déplacer au premier point (relatif à la position de l'objet)
                shape.moveTo(vertices[0] - position.x, vertices[1] - position.y);
                
                // Tracer les lignes vers les autres points
                for (let i = 3; i < vertices.length; i += 3) {
                    shape.lineTo(vertices[i] - position.x, vertices[i + 1] - position.y);
                }
                
                // Fermer la forme
                shape.closePath();
            }
            
            return shape;
        } catch (error) {
            console.warn('Erreur lors de l\'extraction de la forme:', error);
            return null;
        }    }    updateExtrusionPreview(event) {
        if (!this.extrudePreview || !this.isExtruding) return;
        
        // Throttling pour améliorer les performances
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateThrottle) {
            return;
        }
        this.lastUpdateTime = now;
        
        // Si la hauteur est verrouillée manuellement, ne pas mettre à jour
        if (this.heightLockedManually) {
            this.updateMouseFollower(this.currentHeight, event.clientX, event.clientY);
            return;
        }
        
        // Calculer la hauteur basée sur le mouvement vertical de la souris depuis le point de départ
        const currentMouseY = event.clientY;
        
        // Déterminer si on utilise le point de départ ou une référence
        if (!this.startMouseY) {
            this.startMouseY = currentMouseY;
            console.log('🎯 Extrusion: Point de départ souris initialisé:', this.startMouseY);
        }
        
        // Calculer la différence en pixels et la convertir en hauteur
        const deltaY = this.startMouseY - currentMouseY; // Mouvement vers le haut = positif
        let height = Math.max(0.1, Math.abs(deltaY) * 0.05); // Facteur d'échelle plus naturel
        height = Math.round(height / this.heightStep) * this.heightStep; // Arrondir au pas de 0,1
        
        // Mise à jour seulement si la hauteur a changé significativement
        if (Math.abs(height - this.currentHeight) >= this.heightStep) {
            const updateStart = performance.now();
            this.currentHeight = height;
            this.updateExtrusionPreviewWithHeight(height);
            const updateTime = performance.now() - updateStart;
              if (updateTime > 5) {
                // Performance monitoring without console log
            }
        }
        
        // Mettre à jour la fenêtre qui suit la souris
        this.updateMouseFollower(height, event.clientX, event.clientY);
    }updateExtrusionPreviewWithHeight(height) {
        if (!this.extrudePreview || !this.isExtruding) return;
        
        // Utiliser la forme de base mise en cache si disponible
        if (!this.baseShape) {
            this.baseShape = this.getShapeFromObject(this.extrudeObject);
        }
        
        if (this.baseShape) {
            const extrudeSettings = {
                depth: height,
                bevelEnabled: false
            };
              // Optimisation : réutiliser la géométrie si possible
            const newGeometry = new THREE.ExtrudeGeometry(this.baseShape, extrudeSettings);
            
            // Générer des coordonnées UV pour la mise à jour de l'aperçu
            this.generateProperUVs(newGeometry);
            
            // Disposer l'ancienne géométrie de manière sécurisée
            if (this.extrudePreview.geometry) {
                this.extrudePreview.geometry.dispose();
            }
            
            this.extrudePreview.geometry = newGeometry;
            
            // Optimisation : mettre à jour les arêtes plus efficacement
            this.updatePreviewEdges(newGeometry);
            
            // Mettre à jour le message dans la barre de commande
            document.getElementById('command-output').textContent = 
                `Hauteur: ${height.toFixed(1)} cm (Clic gauche: valider, Clic droit: saisir hauteur précise, Échap: annuler)`;
        }
    }
    
    updatePreviewEdges(geometry) {
        // Supprimer les anciennes arêtes de manière plus efficace
        const childrenToRemove = [];
        this.extrudePreview.children.forEach(child => {
            if (child instanceof THREE.LineSegments) {
                childrenToRemove.push(child);
            }
        });
        
        childrenToRemove.forEach(child => {
            this.extrudePreview.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        
        // Ajouter les nouvelles arêtes
        const edges = new THREE.EdgesGeometry(geometry);
        const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2,
            opacity: 1,
            transparent: false
        }));
        this.extrudePreview.add(lines);
    }
    
    getShapeFromObject(object) {
        let shape;
        
        if (object.geometry instanceof THREE.PlaneGeometry) {
            const width = object.geometry.parameters.width;
            const height = object.geometry.parameters.height;
            shape = new THREE.Shape();
            shape.moveTo(-width/2, -height/2);
            shape.lineTo(width/2, -height/2);
            shape.lineTo(width/2, height/2);
            shape.lineTo(-width/2, height/2);
            shape.lineTo(-width/2, -height/2);
        } else if (object.geometry instanceof THREE.CircleGeometry) {
            const radius = object.geometry.parameters.radius;
            shape = new THREE.Shape();
            shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
        } else if (object.geometry instanceof THREE.ShapeGeometry || 
                   (object.userData && object.userData.type === 'surface')) {
            // Pour les surfaces créées automatiquement
            shape = this.extractShapeFromGeometry(object.geometry, object.position);
        }
        
        return shape;
    }      finishExtrusion(event) {
        if (!this.extrudePreview) return;
        
        // Stocker la hauteur actuelle pour le message final
        const finalHeight = this.currentHeight;
        
        // Masquer la fenêtre qui suit la souris
        this.updateMouseFollower(0);
        
        const index = this.app.objects.indexOf(this.extrudeObject);
        if (index > -1) {
            this.app.scene.remove(this.extrudeObject);
            this.app.objects.splice(index, 1);        }        // Utiliser MeshPhongMaterial COMPATIBLE avec les textures
        const material = new THREE.MeshPhongMaterial({
            color: this.extrudeObject.material.color.getHex(),
            // SUPPRIMÉ: emissive qui masque les textures
            shininess: 30,       // Brillance modérée
            side: THREE.DoubleSide
        });        this.extrudePreview.material = material;
        
        // Définir les userData pour que l'objet extrudé soit sélectionnable
        this.extrudePreview.userData = {
            type: 'extrusion',
            selectable: true,
            originalType: this.extrudeObject.userData.type || 'unknown',
            height: this.currentHeight,
            extruded: true
        };
        
        const edges = new THREE.EdgesGeometry(this.extrudePreview.geometry);
        const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2
        }));
        this.extrudePreview.add(lines);
        
        // Activer les ombres sur l'objet extrudé
        this.extrudePreview.castShadow = true;
        this.extrudePreview.receiveShadow = true;
        
        // S'assurer que tous les enfants peuvent aussi projeter/recevoir des ombres
        this.extrudePreview.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        this.app.objects.push(this.extrudePreview);
        
        // Vérifier que les layers existent avant d'y accéder
        if (this.app.layers && this.app.layers.length > 0) {
            const layerIndex = this.app.currentLayer || 0;
            if (this.app.layers[layerIndex] && this.app.layers[layerIndex].objects) {
                this.app.layers[layerIndex].objects.push(this.extrudePreview);
            }
        }
        
        this.app.addToHistory('extrude', this.extrudePreview);
        
        if (this.app.uiManager) {
            this.app.uiManager.updateHistoryPanel();
        }        this.extrudePreview = null;
        this.extrudeObject = null;
        this.isExtruding = false;
        this.currentHeight = 0;
        this.heightLockedManually = false; // Réinitialiser le verrouillage
        
        // Nettoyer les variables d'optimisation
        this.lastUpdateTime = 0;
        this.startMouseY = null;
        this.baseShape = null;
        
        this.app.controls.enabled = true;
        
        document.getElementById('command-output').textContent = 
            `Extrusion terminée (hauteur: ${finalHeight.toFixed(1)} cm)`;
    }    cancelExtrusion() {
        if (this.isExtruding) {
            // Masquer la fenêtre qui suit la souris
            this.updateMouseFollower(0);
            
            if (this.extrudePreview) {
                this.app.scene.remove(this.extrudePreview);
                this.extrudePreview.geometry.dispose();
                this.extrudePreview.material.dispose();
                this.extrudePreview = null;
            }
            
            if (this.extrudeObject) {
                this.extrudeObject.visible = true;
            }
            
            this.isExtruding = false;
            this.extrudeObject = null;
            this.currentHeight = 0;
            this.heightLockedManually = false; // Réinitialiser le verrouillage
            
            // Nettoyer les variables d'optimisation
            this.lastUpdateTime = 0;
            this.startMouseY = null;
            this.baseShape = null;
            
            this.app.controls.enabled = true;
            
            document.getElementById('command-output').textContent = 'Extrusion annulée';
        }
    }      createExtrudedGeometry(shape, depth) {        // Utiliser MeshStandardMaterial COMPATIBLE avec les textures
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,      // Blanc pour que les textures apparaissent correctement
            roughness: 0.7,       // Rugosité naturelle pour un rendu réaliste
            metalness: 0.0,       // Pas métallique pour les matériaux de construction
            // SUPPRIMÉ: emissive et emissiveIntensity qui masquaient les textures
            side: THREE.DoubleSide,
            // Propriétés importantes pour les textures
            transparent: false,
            opacity: 1.0
        });
          // Créer la géométrie d'extrusion
        const extrudeSettings = {
            depth: depth,
            bevelEnabled: false
        };
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // IMPORTANT: Générer des coordonnées UV appropriées pour les textures
        this.generateProperUVs(geometry);
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true; // S'assurer que l'élément projette des ombres
        mesh.receiveShadow = true; // Peut aussi recevoir des ombres d'autres objets
        
        return mesh;
    }

    /**
     * Génère des coordonnées UV appropriées pour les géométries extrudées
     * pour assurer l'affichage correct des textures     */
    generateProperUVs(geometry) {
        // Utiliser l'utilitaire Three.js pour calculer les UV automatiquement
        // Cette méthode est spécialement conçue pour les géométries extrudées
        try {
            // Méthode 1: Utiliser computeBoundingBox et générer des UV basées sur les faces
            geometry.computeBoundingBox();
            geometry.computeVertexNormals();
            
            // Utiliser l'outil de génération UV de Three.js
            const uvGenerator = {
                generateTopUV: function(geometry, vertices, indexA, indexB, indexC) {
                    const a_x = vertices[indexA * 3];
                    const a_y = vertices[indexA * 3 + 1];
                    const b_x = vertices[indexB * 3];
                    const b_y = vertices[indexB * 3 + 1];
                    const c_x = vertices[indexC * 3];
                    const c_y = vertices[indexC * 3 + 1];
                    
                    return [
                        new THREE.Vector2(a_x, a_y),
                        new THREE.Vector2(b_x, b_y),
                        new THREE.Vector2(c_x, c_y)
                    ];
                },
                
                generateSideWallUV: function(geometry, vertices, indexA, indexB, indexC, indexD) {
                    const a_x = vertices[indexA * 3];
                    const a_y = vertices[indexA * 3 + 1];
                    const a_z = vertices[indexA * 3 + 2];
                    const b_x = vertices[indexB * 3];
                    const b_y = vertices[indexB * 3 + 1];
                    const b_z = vertices[indexB * 3 + 2];
                    const c_x = vertices[indexC * 3];
                    const c_y = vertices[indexC * 3 + 1];
                    const c_z = vertices[indexC * 3 + 2];
                    const d_x = vertices[indexD * 3];
                    const d_y = vertices[indexD * 3 + 1];
                    const d_z = vertices[indexD * 3 + 2];
                    
                    if (Math.abs(a_y - b_y) < Math.abs(a_x - b_x)) {
                        return [
                            new THREE.Vector2(a_x, 1 - a_z),
                            new THREE.Vector2(b_x, 1 - b_z),
                            new THREE.Vector2(c_x, 1 - c_z),
                            new THREE.Vector2(d_x, 1 - d_z)
                        ];
                    } else {
                        return [
                            new THREE.Vector2(a_y, 1 - a_z),
                            new THREE.Vector2(b_y, 1 - b_z),
                            new THREE.Vector2(c_y, 1 - c_z),
                            new THREE.Vector2(d_y, 1 - d_z)
                        ];
                    }
                }
            };
            
            // Alternative plus simple: générer des UV planaires basées sur les normales
            this.generatePlanarUVs(geometry);
            
            console.log(`[ExtrusionManager] Successfully generated proper UV coordinates`);
              } catch (error) {
            this.generateFallbackUVs(geometry);
        }
        
        return geometry;
    }
      generatePlanarUVs(geometry) {
        const position = geometry.attributes.position;
        const normal = geometry.attributes.normal;
        const uv = [];

        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const sizeX = bbox.max.x - bbox.min.x;
        const sizeY = bbox.max.y - bbox.min.y;        const sizeZ = bbox.max.z - bbox.min.z;

        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i);
            const y = position.getY(i);
            const z = position.getZ(i);
            
            let u, v;
            
            if (normal) {
                const nx = normal.getX(i);
                const ny = normal.getY(i);
                const nz = normal.getZ(i);
                
                // Choisir la projection basée sur la normale dominante
                if (Math.abs(ny) > Math.abs(nx) && Math.abs(ny) > Math.abs(nz)) {
                    // Face horizontale (normale Y dominante) - projection XZ
                    u = sizeX > 0 ? (x - bbox.min.x) / sizeX : 0;
                    v = sizeZ > 0 ? (z - bbox.min.z) / sizeZ : 0;
                } else if (Math.abs(nx) > Math.abs(nz)) {
                    // Face latérale (normale X dominante) - projection ZY
                    u = sizeZ > 0 ? (z - bbox.min.z) / sizeZ : 0;
                    v = sizeY > 0 ? (y - bbox.min.y) / sizeY : 0;
                } else {
                    // Face latérale (normale Z dominante) - projection XY
                    u = sizeX > 0 ? (x - bbox.min.x) / sizeX : 0;
                    v = sizeY > 0 ? (y - bbox.min.y) / sizeY : 0;
                }
            } else {
                // Fallback sans normales - projection XZ
                u = sizeX > 0 ? (x - bbox.min.x) / sizeX : 0;
                v = sizeZ > 0 ? (z - bbox.min.z) / sizeZ : 0;
            }
            
            // S'assurer que les coordonnées UV sont dans la plage [0, 1]
            u = Math.max(0, Math.min(1, u));
            v = Math.max(0, Math.min(1, v));
              uv.push(u, v);
        }
        
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }    
    generateFallbackUVs(geometry) {
        // Méthode de secours simple
        const position = geometry.attributes.position;
        const uv = [];
        
        for (let i = 0; i < position.count; i++) {
            uv.push(0.5, 0.5); // Centre de la texture
        }
        
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
}
