import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ElementManager {
    constructor(app) {
        this.app = app;
        this.elements = [];
    }

    /**
     * Détermine la couleur du matériau selon la catégorie et le nom de l'élément
     * Logique centralisée identique à UIManager.js
     */
    getMaterialColor(elementData) {
        const category = elementData.category || '';
        const name = (elementData.name || '').toLowerCase();

        // Briques -> Rouge
        if (category === 'briques' || name.includes('brique')) {
            return 0xCC0000;
        }
        // Isolants -> Beige/crème
        else if (category === 'isolants' || name.includes('isolant')) {
            return 0xF5F5DC;
        }
        // Blocs béton cellulaire/Stepoc -> Blanc
        else if (name.includes('béton cell') || name.includes('beton cell') || 
                 name.includes('béton cellulaire') || name.includes('beton cellulaire') ||
                 name.includes('stepoc')) {
            return 0xFFFFFF;
        }
        // Terre cuite -> Orange-rouge
        else if (name.includes('terre cuite')) {
            return 0xCC4500;
        }
        // Blocs (autres) -> Gris clair
        else if (category === 'blocs') {
            return 0xD3D3D3;
        }
        // Défaut -> Gris moyen
        else {
            return 0xCCCCCC;
        }
    }

    /**
     * Remplace TOUS les matériaux du mesh GLB par des matériaux sans texture
     * et avec la couleur appropriée selon la catégorie
     */
    configureMaterialsForScene(mesh, elementInstance) {
        const color = this.getMaterialColor(elementInstance);
        
        mesh.traverse(child => {
            if (child.isMesh) {
                // Remplacer COMPLÈTEMENT le matériau pour supprimer toute texture
                child.material = new THREE.MeshLambertMaterial({
                    color: color,
                    transparent: false,
                    opacity: 1.0,
                    side: THREE.DoubleSide,
                    shadowSide: THREE.DoubleSide
                    // AUCUNE propriété map, normalMap, etc. = pas de texture
                });
                
                // Activer les ombres
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.needsUpdate = true;
                
                console.log(`[ElementManager] Applied material to ${elementInstance.name}:`, {
                    color: `#${color.toString(16).padStart(6, '0')}`,
                    category: elementInstance.category,
                    hasTexture: false
                });
            }
        });
    }    /**
     * Corrige l'inversion des dimensions Y et Z pour tous les éléments sauf les planchers
     * Les aperçus sont corrects, seule l'insertion dans la scène nécessite cette correction
     */
    getAdjustedDimensions(elementInstance) {
        // Les planchers gardent leurs dimensions originales
        const isPlancher = elementInstance.category === 'planchers' || 
                          (elementInstance.name && elementInstance.name.toLowerCase().includes('plancher')) ||
                          (elementInstance.name && elementInstance.name.toLowerCase().includes('hourdis'));
        
        if (isPlancher) {
            return elementInstance.dims; // Dimensions originales pour les planchers
        } else {
            // Inverser Y et Z pour tous les autres éléments
            return {
                x: elementInstance.dims.x, // X reste X
                y: elementInstance.dims.z, // Y devient Z
                z: elementInstance.dims.y  // Z devient Y
            };
        }
    }

    async addElement(elementInstance) {
        // Prise en compte de la longueur de coupe (cut) sur l'axe X
        if (elementInstance.cut && typeof elementInstance.cut === 'number' && elementInstance.cut > 0) {
            elementInstance.dims.x = elementInstance.cut;
        } else if (elementInstance.customCut && typeof elementInstance.customCut === 'number' && elementInstance.customCut > 0) {
            elementInstance.dims.x = elementInstance.customCut;
        }
          // Gestion spéciale pour les éléments scalables (comme les hourdis)
        if (elementInstance.isScalable && elementInstance.customLength) {
            console.log('Élément scalable détecté:', elementInstance.name, 'avec longueur:', elementInstance.customLength);
            
            // Pour les hourdis scalables, charger le modèle avec la méthode spéciale
            if (this.app.elementsLibrary) {
                try {
                    const scalableModel = await this.app.elementsLibrary.loadScalableModel(
                        elementInstance.name, 
                        elementInstance.category, 
                        elementInstance.customLength
                    );
                    
                    if (scalableModel) {
                        this.setupMesh(scalableModel, elementInstance);
                        
                        // CORRECTION : Ajouter l'élément au tracking même pour les éléments scalables
                        this.addToTracking(elementInstance);
                        
                        return scalableModel;
                    }
                } catch (error) {
                    console.error('Erreur lors du chargement du modèle scalable:', error);
                }
            }
        }
        
        console.log('Adding element to scene:', elementInstance);
        
        try {
            // Create a mesh for the element
            let mesh;
            
            if (elementInstance.type === 'glb' && elementInstance.path) {
                // Load GLB model directly if type and path are specified
                const loader = new GLTFLoader();
                const modelPath = `assets/models/${elementInstance.path}`;
                console.log('Loading GLB model from:', modelPath);
                
                const gltf = await new Promise((resolve, reject) => {
                    loader.load(
                        modelPath,
                        resolve,
                        (progress) => {
                            console.log(`Loading progress: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
                        },
                        (error) => {
                            console.error('Error loading GLB:', error);
                            reject(error);
                        }
                    );
                });
                
                mesh = gltf.scene;                // Configurer les ombres pour tous les meshes de la scène GLB
                mesh.traverse(child => {
                    if (child.isMesh) {
                        // Activer la projection et la réception d'ombres
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // S'assurer que le matériau est configuré pour les ombres
                        if (child.material) {
                            child.material.shadowSide = THREE.DoubleSide;
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => {
                                    mat.shadowSide = THREE.DoubleSide;
                                    mat.needsUpdate = true;
                                });
                            } else {
                                child.material.needsUpdate = true;
                            }
                        }
                    }
                });

                // Remplacer TOUS les matériaux par des matériaux sans texture et de la couleur appropriée
                this.configureMaterialsForScene(mesh, elementInstance);
                  // Apply correct scaling based on dimensions
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                
                // CORRECTION: Utiliser les dimensions corrigées (Y/Z inversés sauf planchers)
                const adjustedDims = this.getAdjustedDimensions(elementInstance);
                const targetSize = new THREE.Vector3(
                    adjustedDims.x,
                    adjustedDims.y,
                    adjustedDims.z
                );
                
                // Calculate scaling factors for each dimension
                const scaleX = targetSize.x / size.x;
                const scaleY = targetSize.y / size.y;
                const scaleZ = targetSize.z / size.z;
                
                // Use the minimum scale to maintain proportions
                const scale = Math.min(scaleX, scaleY, scaleZ);
                
                // Center the model
                const center = box.getCenter(new THREE.Vector3());
                mesh.position.sub(center);
                  // Apply scaling - CORRECTION: respecter l'ordre des axes (X, Y, Z)
                // Pour les planchers, il est important que l'axe Z (longueur personnalisée) soit correct
                mesh.scale.set(scaleX, scaleY, scaleZ);
                
                // Apply default rotation (-270° on X axis to match app coordinates)
                mesh.rotation.x = -3 * Math.PI / 2;
                
                console.log('GLB model loaded successfully:', {
                    originalSize: size,
                    targetSize: targetSize,
                    scale: scale
                });
                
            } else if (this.app.elementsLibrary) {
                // Try to load model from library for non-GLB elements
                const model = await this.app.elementsLibrary.loadModel(elementInstance.name, elementInstance.category);
                if (model) {
                    mesh = model.clone();
                }
            }
              if (!mesh) {
                // Fallback to basic geometry if no model could be loaded
                mesh = this.createBasicMesh(elementInstance);
            }
              // IMPORTANT: Masquer tous les contours/edges pour que les éléments dans la scène 
            // ne ressemblent pas aux aperçus de la bibliothèque
            // (LineSegments, EdgesGeometry, 'edge', 'contour', 'wire', 'outline')
            mesh.traverse(child => {
                if (
                    child.type === 'LineSegments' ||
                    child.type === 'EdgesGeometry' ||
                    (child.name && (
                        child.name.toLowerCase().includes('edge') ||
                        child.name.toLowerCase().includes('contour') ||
                        child.name.toLowerCase().includes('wire') ||
                        child.name.toLowerCase().includes('outline')
                    ))
                ) {
                    child.visible = false;
                    if (child.material) {
                        child.material.depthWrite = false;
                    }
                }
            });
            
            // Pour les isolants, afficher les contours mais masquer ceux qui sont cachés derrière (depthTest et depthWrite à true)
            if (elementInstance.category === 'isolants' || (elementInstance.name && elementInstance.name.toLowerCase().includes('isolant'))) {
                mesh.traverse(child => {
                    if (
                        child.type === 'LineSegments' ||
                        child.type === 'EdgesGeometry' ||
                        (child.name && (
                            child.name.toLowerCase().includes('edge') ||
                            child.name.toLowerCase().includes('contour') ||
                            child.name.toLowerCase().includes('wire') ||
                            child.name.toLowerCase().includes('outline')
                        ))
                    ) {
                        child.visible = true;
                        child.material = new THREE.MeshBasicMaterial({
                            color: 0x000000,
                            opacity: 1.0,
                            transparent: false,
                            depthTest: true,
                            depthWrite: true
                        });
                    }
                });
            }
            
            this.setupMesh(mesh, elementInstance);
            return mesh;
            
        } catch (error) {
            console.error('Error adding element:', error);
            // Create basic geometry as fallback
            const fallbackMesh = this.createBasicMesh(elementInstance);
            return fallbackMesh;
        }
    }    createBasicMesh(elementInstance) {
        // Create a basic box geometry as fallback
        // CORRECTION: Utiliser les dimensions corrigées (Y/Z inversés sauf planchers)
        const adjustedDims = this.getAdjustedDimensions(elementInstance);
        
        const geometry = new THREE.BoxGeometry(
            adjustedDims.x,  // Largeur (X)
            adjustedDims.y,  // Profondeur (Y corrigé) 
            adjustedDims.z   // Hauteur (Z corrigé)
        );

        // CORRECTION: Déplacer la géométrie pour que l'origine soit au coin inférieur gauche
        // L'origine sera au coin (0, 0, 0) avec l'objet s'étendant en positif
        geometry.translate(
            adjustedDims.x / 2,  // Décaler de la moitié en X
            adjustedDims.y / 2,  // Décaler de la moitié en Y
            adjustedDims.z / 2   // Décaler de la moitié en Z (pour que le bas soit à Z=0)
        );

        // Utiliser la logique centralisée pour déterminer la couleur
        const materialColor = this.getMaterialColor(elementInstance);

        const material = new THREE.MeshLambertMaterial({
            color: materialColor,
            transparent: false,
            opacity: 1.0,
            side: THREE.DoubleSide        });

        const mesh = new THREE.Mesh(geometry, material);
        
        console.log(`[ElementManager] Created basic mesh for ${elementInstance.name}:`, {
            color: `#${materialColor.toString(16).padStart(6, '0')}`,
            category: elementInstance.category
        });

        return mesh;
    }

    setupMesh(mesh, elementInstance) {
        // Apply position (par défaut à l'origine pour les objets simples)
        if (elementInstance.position) {
            mesh.position.copy(elementInstance.position);
        } else {
            // Position par défaut à l'origine pour les objets simples
            mesh.position.set(0, 0, 0);
        }
          // Apply rotation seulement si explicitement spécifiée
        // IMPORTANT: Pas de rotation automatique pour les objets simples
        if (elementInstance.rotation && elementInstance.rotation.x !== undefined && elementInstance.rotation.y !== undefined && elementInstance.rotation.z !== undefined) {
            mesh.rotation.copy(elementInstance.rotation);
        }
        
        // Apply scale si spécifiée
        if (elementInstance.scale) {
            mesh.scale.copy(elementInstance.scale);
        }

        // Add metadata to the mesh
        mesh.userData = {
            ...mesh.userData,
            elementType: elementInstance.name,
            category: elementInstance.category,
            dims: elementInstance.dims,
            isConstructionElement: true,
            isSimpleGeometry: !elementInstance.type || elementInstance.type !== 'glb'
        };

        // Ajout du contour visible (outline) sur chaque mesh enfant
        const addOutlineToMesh = (obj) => {
            if (obj.isMesh && obj.geometry) {
                try {
                    const edges = new THREE.EdgesGeometry(obj.geometry);
                    const outlineMaterial = new THREE.LineBasicMaterial({
                        color: 0x000000, // Noir
                        transparent: false,
                        opacity: 1.0,
                        linewidth: 1,
                        depthTest: true,
                        depthWrite: true
                    });
                    const outline = new THREE.LineSegments(edges, outlineMaterial);
                    outline.name = 'element-outline';
                    outline.renderOrder = 1;
                    obj.add(outline);
                } catch (e) {
                    console.warn('Impossible d’ajouter le contour (EdgesGeometry) :', e);
                }
            }
        };
        if (mesh.isMesh) {
            addOutlineToMesh(mesh);
        } else if (mesh.isGroup || mesh.type === 'Group' || mesh.children) {
            mesh.traverse(child => addOutlineToMesh(child));
        }
        // Add to scene and tracking array
        this.app.scene.add(mesh);
        this.elements.push(mesh);        
        // CORRECTION CRITIQUE : Ajouter à app.objects pour la détection par raycaster
        this.app.objects.push(mesh);

        // Ajouter l'élément au système de tracking
        this.addToTracking(elementInstance);

        const isBrick = (elementInstance.category === 'briques') || 
                        (elementInstance.name && typeof elementInstance.name === 'string' && elementInstance.name.toLowerCase().includes('brique'));

        if (isBrick) {
            setTimeout(() => {
                const sceneObject = this.app.scene.getObjectByProperty('uuid', mesh.uuid);
                if (sceneObject) {
                    console.log(`[ElementManager] CHECK AFTER 100ms for ${elementInstance.name} (UUID: ${mesh.uuid})`);
                    sceneObject.traverse(child => {
                        if (child.isMesh) {
                            console.log(`  [MESH CHILD IN SCENE] ${child.name || 'unnamed'}: transparent=${child.material.transparent}, opacity=${child.material.opacity}, color=#${child.material.color.getHexString()}, depthWrite=${child.material.depthWrite}`);
                        }
                    });
                } else {
                    console.log(`[ElementManager] CHECK AFTER 100ms - Brick ${elementInstance.name} (UUID: ${mesh.uuid}) not found in scene.`);
                }
            }, 100);
        }
        
        // Ajouter au calque actuel si le système de calques existe
        if (this.app.layers && this.app.layers[this.app.currentLayer]) {
            this.app.layers[this.app.currentLayer].objects.push(mesh);
        }
        
        // Update command output
        const commandOutput = document.getElementById('command-output');
        if (commandOutput) {
            commandOutput.textContent = `Élément "${elementInstance.name}" ajouté à la scène`;
        }
    }    removeElement(element) {
        // Retirer de la liste des éléments
        const index = this.elements.indexOf(element);
        if (index > -1) {
            this.elements.splice(index, 1);
        }
        
        // Retirer de app.objects pour le raycaster
        const objectIndex = this.app.objects.indexOf(element);
        if (objectIndex > -1) {
            this.app.objects.splice(objectIndex, 1);
        }
        
        // Retirer des calques
        if (this.app.layers) {
            this.app.layers.forEach(layer => {
                const layerIndex = layer.objects.indexOf(element);
                if (layerIndex > -1) {
                    layer.objects.splice(layerIndex, 1);
                }
            });
        }
        
        // Retirer de la scène
        if (element.parent) {
            element.parent.remove(element);
        }
    }

    getElementsByType(elementType) {
        return this.elements.filter(element => 
            element.userData && element.userData.elementType === elementType
        );
    }

    getElementsByCategory(category) {
        return this.elements.filter(element => 
            element.userData && element.userData.category === category
        );
    }

    /**
     * Ajoute un élément au système de tracking
     * @param {Object} elementInstance - Instance de l'élément à tracker
     */
    addToTracking(elementInstance) {
        // Ensure window.trackedConstructionElements is initialized
        if (typeof window.trackedConstructionElements === 'undefined') {
            window.trackedConstructionElements = [];
        }
        
        // Add a copy of the element instance to the tracked elements
        // This ensures that modifications to the mesh in the scene don't affect the tracked data
        const trackedElement = {
            name: elementInstance.name,
            category: elementInstance.category,
            dims: { ...elementInstance.dims }, // Create a shallow copy of dims
            // Add any other relevant properties you want to track
            // For example, color, if it's part of the initial instance
            color: elementInstance.color 
        };
        window.trackedConstructionElements.push(trackedElement);
        console.log('[ElementManager] Element added to window.trackedConstructionElements:', trackedElement);
        
        // Trigger an update of the used elements display
        if (typeof window.updateUsedElementsDisplay === 'function') {
            window.DEBUG_CALL_ORIGIN = 'ElementManager'; // Set flag
            
            try {
                window.updateUsedElementsDisplay();
            } catch (e) {
                console.error('[ElementManager] Error calling window.updateUsedElementsDisplay():', e);
            } finally {
                delete window.DEBUG_CALL_ORIGIN; // Clean up flag
            }
        }
    }
}
