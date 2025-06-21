import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Fonction utilitaire pour ajouter les méthodes de suppression de rectangle à une instance WebCAD
export function addRectangleDeleteMethods(webCADInstance) {
    // Sauvegarder la méthode deleteSelected originale
    const originalDeleteSelected = webCADInstance.deleteSelected.bind(webCADInstance);
    
    // Remplacer la méthode deleteSelected
    webCADInstance.deleteSelected = function() {
        if (this.selectedObject) {
            // Vérifier si c'est un rectangle (PlaneGeometry)
            if (
                this.selectedObject instanceof THREE.Mesh &&
                this.selectedObject.geometry instanceof THREE.PlaneGeometry
            ) {
                // Supprimer seulement la surface, garder les contours
                this.removeRectangleSurfaceKeepEdges();
                return;
            }

            // Appeler la méthode originale pour les autres objets (lignes, etc.)
            originalDeleteSelected();        }
    };
    
    // Ajouter la méthode removeRectangleSurfaceKeepEdges
    webCADInstance.removeRectangleSurfaceKeepEdges = function() {
        if (!this.selectedObject) return;

        const rectMesh = this.selectedObject;
        
        // Récupérer les infos du rectangle
        const width = rectMesh.geometry.parameters.width * rectMesh.scale.x;
        const height = rectMesh.geometry.parameters.height * rectMesh.scale.y;
        const position = rectMesh.position.clone();
        const rotation = rectMesh.rotation.clone();

        // Calculer les coins dans le repère local
        const corners = [
            new THREE.Vector3(-width/2, -height/2, 0),
            new THREE.Vector3(width/2, -height/2, 0),
            new THREE.Vector3(width/2, height/2, 0),
            new THREE.Vector3(-width/2, height/2, 0)
        ];

        // Appliquer la rotation et la position
        corners.forEach(corner => {
            corner.applyEuler(rotation);
            corner.add(position);
        });

        // Créer les 4 arêtes
        for (let i = 0; i < 4; i++) {
            const start = corners[i];
            const end = corners[(i + 1) % 4];
            const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
            const material = new THREE.LineBasicMaterial({ 
                color: 0x000000, 
                linewidth: 2 
            });
            const edge = new THREE.Line(geometry, material);
            
            // Ajouter les arêtes à la scène et aux listes
            this.scene.add(edge);
            this.objects.push(edge);
            if (this.layers && this.layers[this.currentLayer]) {
                this.layers[this.currentLayer].objects.push(edge);
            }
        }

        // Ajouter à l'historique
        if (this.addToHistory) {
            this.addToHistory('removeSurface', rectMesh);
        }

        // Supprimer la surface du rectangle
        this.scene.remove(rectMesh);
        this.objects = this.objects.filter(obj => obj.uuid !== rectMesh.uuid);
        if (this.layers) {
            this.layers.forEach(layer => {
                layer.objects = layer.objects.filter(obj => obj.uuid !== rectMesh.uuid);
            });
        }        // Nettoyer la sélection
        this.transformControls.detach();
        this.selectedObject = null;
        if (this.uiManager) {
            this.uiManager.updatePropertiesPanel(null);
        }

        document.getElementById('command-output').textContent = 'Surface supprimée, contours conservés';
    };
}

export class UIManager {    constructor(app) {        this.app = app;
        
        // Gestionnaire pour les événements de clic extérieur
        this.currentClickOutsideHandler = null;
        
        // Systèmes de preview GLB avec gestion de chargement/déchargement
        this.glbPreviews = new Map(); // Stockage des renderers GLB
        this.previewCanvas = new Map(); // Stockage des canvas de preview
        this.activeRenderers = new Set(); // Suivi des renderers actifs
        this.maxActiveRenderers = 10; // Limite du nombre de renderers simultanés
        this.loadingQueue = new Set(); // Queue des aperçus en attente de chargement
        this.intersectionObserver = null; // Observer pour la visibilité des aperçus
        this.isPreviewSystemInitialized = false;
        
        this.initPreviewSystem();
        
        this.setupPanelToggles();
        this.setupEventListeners();
        this.setupDpad();
        this.setupTextureLibrary();
        this.setupSunlightControls();
        this.setupElementsLibrary();
    }

    initPreviewSystem() {
        console.log('Initializing preview system...');
        
        // Initialiser l'IntersectionObserver pour surveiller la visibilité des aperçus
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const previewDiv = entry.target;
                const elementId = previewDiv.dataset.elementId;
                
                if (entry.isIntersecting) {
                    // L'aperçu devient visible, le charger si pas déjà fait
                    this.loadPreviewOnDemand(elementId, previewDiv);
                } else {
                    // L'aperçu n'est plus visible, le marquer pour déchargement éventuel
                    this.schedulePreviewUnload(elementId, previewDiv);
                }
            });
        }, {
            root: null,
            rootMargin: '50px', // Charger un peu avant que l'élément soit visible
            threshold: 0.1
        });
        
        this.isPreviewSystemInitialized = true;
        console.log('Preview system initialized');
    }

    cleanupPreviews() {
        console.log('Cleaning up all previews...');
        
        // Nettoyer tous les renderers actifs
        this.glbPreviews.forEach((renderer, elementId) => {
            if (renderer && renderer.dispose) {
                renderer.dispose();
            }
        });
        
        // Nettoyer tous les canvas
        this.previewCanvas.forEach((canvas, elementId) => {
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        });
        
        // Réinitialiser les collections
        this.glbPreviews.clear();
        this.previewCanvas.clear();
        this.activeRenderers.clear();
        this.loadingQueue.clear();
        
        // Déconnecter l'observer si il existe
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        console.log('All previews cleaned up');
    }

    async loadPreviewOnDemand(elementId, previewDiv) {
        // Éviter les chargements multiples
        if (this.loadingQueue.has(elementId) || this.glbPreviews.has(elementId)) {
            return;
        }
        
        // Vérifier la limite de renderers actifs
        if (this.activeRenderers.size >= this.maxActiveRenderers) {
            // Décharger le plus ancien renderer pour faire de la place
            const oldestRenderer = this.activeRenderers.values().next().value;
            this.unloadPreview(oldestRenderer);
        }
        
        this.loadingQueue.add(elementId);
        
        try {
            console.log(`Loading preview for element: ${elementId}`);
            
            // Récupérer les données de l'élément
            const elementData = this.getElementDataById(elementId);
            if (!elementData) {
                console.warn(`Element data not found for: ${elementId}`);
                return;
            }
              // Créer le canvas pour cet aperçu avec une taille plus grande
            const canvas = document.createElement('canvas');
            canvas.width = 180;  // Augmenté de 120 à 180
            canvas.height = 180; // Augmenté de 120 à 180
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            
            // Créer le renderer WebGL
            const renderer = new THREE.WebGLRenderer({ 
                canvas: canvas, 
                antialias: true, 
                alpha: true 
            });
            renderer.setSize(180, 180); // Ajuster la taille du renderer            renderer.setSize(180, 180); // Ajuster la taille du renderer
            renderer.setClearColor(0x000000, 0);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
            // Créer la scène pour l'aperçu
            const scene = new THREE.Scene();
            
            // Ajouter l'éclairage
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(5, 5, 5);
            directionalLight.castShadow = true;
            scene.add(directionalLight);            // Créer la caméra avec un angle de vue plus large pour mieux voir l'objet
            const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
            
            // Charger le modèle 3D
            const model = await this.loadElementModel(scene, elementData);
            
            // Positionner la caméra plus près pour que l'objet apparaisse plus grand
            const maxDimension = Math.max(elementData.dims.x, elementData.dims.y, elementData.dims.z) / 100;
            const distance = Math.max(maxDimension * 1.5, 0.4); // Distance réduite avec minimum
            
            camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
            camera.lookAt(0, 0, 0);
            
            console.log(`Camera positioned for ${elementData.name}: distance=${distance.toFixed(2)}, maxDim=${maxDimension.toFixed(2)}`);
            
            // Rendu initial
            renderer.render(scene, camera);
              // Variables pour l'animation au survol
            let isAnimating = false;
            let animationFrameId = null;            // Créer une fonction d'animation pour faire tourner l'objet
            const animate = () => {
                if (!isAnimating) return;
                
                // Faire tourner le groupe entier (modèle + arêtes) autour de l'origine
                // Maintenant l'objet tourne autour de son centre géométrique
                if (model) {
                    model.rotation.y += 0.015; // Rotation plus lente et fluide
                }
                
                renderer.render(scene, camera);
                
                // Continuer l'animation si elle est active et l'aperçu existe encore
                if (isAnimating && this.glbPreviews.has(elementId)) {
                    animationFrameId = requestAnimationFrame(animate);
                }
            };
            
            // Ajouter les gestionnaires d'événements de survol
            previewDiv.addEventListener('mouseenter', () => {
                console.log(`Starting rotation for: ${elementId}`);
                if (!isAnimating) {
                    isAnimating = true;
                    animate();
                }
            });
            
            previewDiv.addEventListener('mouseleave', () => {
                console.log(`Stopping rotation for: ${elementId}`);
                isAnimating = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            });
            
            // Stocker le renderer et le canvas
            this.glbPreviews.set(elementId, { renderer, scene, camera, model });
            this.previewCanvas.set(elementId, canvas);
            this.activeRenderers.add(elementId);
            
            // Remplacer le contenu du div d'aperçu
            previewDiv.innerHTML = '';
            previewDiv.appendChild(canvas);
            
            console.log(`Preview loaded successfully for: ${elementId}`);
            
        } catch (error) {
            console.error(`Error loading preview for ${elementId}:`, error);
            
            // Afficher un message d'erreur dans l'aperçu
            previewDiv.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 12px;">
                    Erreur de chargement
                </div>
            `;
        } finally {
            this.loadingQueue.delete(elementId);
        }
    }

    schedulePreviewUnload(elementId, previewDiv) {
        // Programmer le déchargement après un délai pour éviter les rechargements fréquents
        setTimeout(() => {
            // Vérifier si l'élément est encore invisible
            const rect = previewDiv.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            
            if (!isVisible && this.activeRenderers.size > 5) { // Garder au moins 5 aperçus en mémoire
                this.unloadPreview(elementId);
            }
        }, 2000); // Attendre 2 secondes avant de décharger
    }    unloadPreview(elementId) {
        const previewData = this.glbPreviews.get(elementId);
        if (previewData && previewData.renderer) {
            console.log(`Unloading preview for: ${elementId}`);
            
            // Annuler l'animation en cours
            if (previewData.animationId) {
                cancelAnimationFrame(previewData.animationId);
            }
            
            // Nettoyer le renderer
            previewData.renderer.dispose();
            
            // Nettoyer la scène
            if (previewData.scene) {
                previewData.scene.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
            
            // Supprimer des collections
            this.glbPreviews.delete(elementId);
            this.activeRenderers.delete(elementId);
            
            // Remplacer par un placeholder
            const canvas = this.previewCanvas.get(elementId);
            if (canvas && canvas.parentNode) {
                const placeholder = document.createElement('div');
                placeholder.style.cssText = `
                    width: 100%; 
                    height: 100%; 
                    background: #f0f0f0; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    color: #666; 
                    font-size: 12px;
                `;
                placeholder.textContent = 'Aperçu déchargé';
                
                canvas.parentNode.replaceChild(placeholder, canvas);
                this.previewCanvas.delete(elementId);
            }
        }
    }

    getElementDataById(elementId) {
        // Parcourir toutes les catégories pour trouver l'élément
        for (const category in this.elementsData) {
            const elements = this.elementsData[category];
            const element = elements.find(el => this.generateElementId(el) === elementId);
            if (element) {
                return element;
            }
        }
        return null;
    }

    generateElementId(element) {
        // Générer un ID unique pour l'élément basé sur son nom et ses dimensions
        return `${element.name.replace(/\s+/g, '-').toLowerCase()}-${element.dims.x}x${element.dims.y}x${element.dims.z}`;
    }    async loadElementModel(scene, elementData) {
        if (elementData.type === 'glb' && (elementData.path || elementData.modelPath)) {
            // Charger un modèle GLB
            const loader = new GLTFLoader();
            return new Promise((resolve, reject) => {
                // Utiliser modelPath si disponible, sinon path avec le préfixe assets/models/
                const modelPath = elementData.modelPath || `assets/models/${elementData.path}`;
                console.log('Chargement du modèle depuis:', modelPath);
                
                loader.load(
                    modelPath,(gltf) => {
                        const originalModel = gltf.scene;
                        
                        // Calculer la boîte englobante du modèle d'origine
                        const originalBox = new THREE.Box3().setFromObject(originalModel);
                        const originalSize = originalBox.getSize(new THREE.Vector3());
                        
                        // Calculer l'échelle pour correspondre aux dimensions spécifiées
                        const targetSize = new THREE.Vector3(
                            elementData.dims.x / 100,  // largeur
                            elementData.dims.z / 100,  // hauteur
                            elementData.dims.y / 100   // profondeur
                        );
                        
                        const scaleX = targetSize.x / originalSize.x;
                        const scaleY = targetSize.y / originalSize.y;
                        const scaleZ = targetSize.z / originalSize.z;
                        
                        // Appliquer l'échelle d'abord
                        originalModel.scale.set(scaleX, scaleY, scaleZ);
                        
                        // Recalculer la boîte englobante après l'échelle
                        const scaledBox = new THREE.Box3().setFromObject(originalModel);
                        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
                        
                        // Centrer le modèle mis à l'échelle à l'origine
                        originalModel.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
                        
                        // Créer un groupe parent pour la rotation
                        const model = new THREE.Group();
                        model.add(originalModel);
                        
                        // Stocker une référence vers le modèle original pour l'animation des arêtes
                        model.userData.originalModel = originalModel;
                        
                        console.log(`Model loaded and centered for ${elementData.name}: 
                            Original size: ${originalSize.x.toFixed(2)}x${originalSize.y.toFixed(2)}x${originalSize.z.toFixed(2)}
                            Target size: ${targetSize.x.toFixed(2)}x${targetSize.y.toFixed(2)}x${targetSize.z.toFixed(2)}
                            Scale factors: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}x${scaleZ.toFixed(2)}
                            Center offset: ${scaledCenter.x.toFixed(2)}, ${scaledCenter.y.toFixed(2)}, ${scaledCenter.z.toFixed(2)}`);
                        
                        // Configurer le matériau selon le type d'élément
                        this.configureMaterialForPreview(originalModel, elementData);
                        
                        // Ajouter le groupe à la scène
                        scene.add(model);
                        
                        // Puis ajouter les arêtes des contours APRÈS toutes les transformations
                        this.addEdgesToModel(model, scene);
                        
                        resolve(model);
                    },
                    undefined,
                    reject
                );
            });
        } else {
            // Créer une géométrie de cube pour les éléments sans modèle GLB
            const geometry = new THREE.BoxGeometry(
                elementData.dims.x / 100, 
                elementData.dims.z / 100, 
                elementData.dims.y / 100
            );
              // Créer le matériau selon le type d'élément
            const color = this.getMaterialColor(elementData);
            let emissive = 0x000000;
            
            // Ajouter une légère émissivité selon la couleur
            if (color === 0xB22222) { // Rouge brique
                emissive = 0x200808;
            } else if (color === 0xCC4500) { // Orange terre cuite
                emissive = 0x220800;
            } else if (color === 0xFFFFFF) { // Blanc béton cellulaire
                emissive = 0x111111;
            } else { // Gris (blocs creux, linteaux)
                emissive = 0x0A0A0A;
            }
            
            const material = new THREE.MeshLambertMaterial({
                color: color,
                emissive: emissive,
                transparent: false,
                opacity: 1.0,
                side: THREE.DoubleSide
            });
              const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Ajouter les arêtes des contours pour le cube
            const edges = new THREE.EdgesGeometry(geometry);
            const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
            const wireframe = new THREE.LineSegments(edges, edgesMaterial);
            mesh.add(wireframe);
            
            scene.add(mesh);            return mesh;
        }
    }
    
    // Fonction centralisée pour déterminer la couleur des matériaux
    getMaterialColor(elementData) {
        const category = elementData.category;
        const name = elementData.name ? elementData.name.toLowerCase() : '';
        
        if (category === 'briques' || name.includes('brique')) {
            return 0xB22222; // Rouge brique
        } else if (category === 'blocs' || name.includes('bloc')) {
            if (name.includes('creux') || name.includes('b9') || name.includes('b14') || 
                name.includes('b19') || name.includes('b29') || name.includes('argex')) {
                return 0x999999; // Gris pour blocs béton creux
            } else if (name.includes('cell') || name.includes('assise')) {
                return 0xFFFFFF; // Blanc pour béton cellulaire et assises
            } else if (name.includes('terre cuite')) {
                return 0xCC4500; // Orange-rouge pour terre cuite
            } else {
                return 0x999999; // Gris par défaut pour autres blocs
            }
        } else if (category === 'linteaux' || name.includes('linteau')) {
            return 0x999999; // Gris pour linteaux
        } else if (category === 'isolants' || name.includes('isolant')) {
            return 0xF5F5DC; // Beige pour isolants        } else if (category === 'outils') {
            // Pour les outils, utiliser la couleur définie dans la config ou une couleur par défaut
            if (name.includes('bétonnière')) {
                return 0xFF6B35; // Orange pour la bétonnière
            } else if (name.includes('brouette')) {
                return 0x2E8B57; // Vert pour la brouette
            } else if (name.includes('profil')) {
                return 0x444444; // Gris foncé pour le profil
            } else {
                return 0x666666; // Gris foncé pour autres outils
            }
        } else {
            return 0x999999; // Gris par défaut
        }
    }
    
    configureMaterialForPreview(model, elementData) {
        // Vérifier la configuration de l'élément pour preserveMaterials
        const config = this.app.elementsLibrary?.elementsConfig[elementData.category]?.[elementData.name];
        console.log('Configuration pour aperçu:', config);
        
        // Si preserveMaterials est true, ne pas modifier les matériaux GLB
        if (config && config.preserveMaterials) {
            console.log('Préservation des matériaux GLB activée pour:', elementData.name);
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            return;
        }
        
        model.traverse((child) => {
            if (child.isMesh) {
                // Utiliser la fonction centralisée pour déterminer la couleur
                const color = this.getMaterialColor(elementData);
                let emissive = 0x000000;
                
                // Ajouter une légère émissivité selon la couleur
                if (color === 0xB22222) { // Rouge brique
                    emissive = 0x200808;
                } else if (color === 0xCC4500) { // Orange terre cuite
                    emissive = 0x220800;
                } else if (color === 0xFFFFFF) { // Blanc béton cellulaire
                    emissive = 0x111111;
                } else { // Gris (blocs creux, linteaux)
                    emissive = 0x0A0A0A;
                }
                
                // Créer un nouveau matériau SANS texture pour éviter les superpositions
                const newMaterial = new THREE.MeshLambertMaterial({
                    color: color,
                    emissive: emissive,
                    transparent: false,
                    opacity: 1.0,
                    side: THREE.DoubleSide
                });
                  // Remplacer complètement le matériau existant
                child.material = newMaterial;                
                child.castShadow = true;
                child.receiveShadow = true;            }
        });
    }

    setupPanelToggles() {
        // Configuration des panneaux dépliables/repliables
        const toggleButtons = document.querySelectorAll('[data-toggle-panel]');
        
        toggleButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = button.getAttribute('data-toggle-panel');
                const targetPanel = document.getElementById(targetId);
                
                if (targetPanel) {
                    const isVisible = targetPanel.style.display !== 'none';
                    targetPanel.style.display = isVisible ? 'none' : 'block';
                    
                    // Mettre à jour l'icône ou le texte du bouton
                    const icon = button.querySelector('i');
                    if (icon) {
                        if (isVisible) {
                            icon.className = icon.className.replace('fa-chevron-up', 'fa-chevron-down');
                        } else {
                            icon.className = icon.className.replace('fa-chevron-down', 'fa-chevron-up');
                        }
                    }
                }
            });
        });
    }

    setupEventListeners() {
        // Gestionnaires de fichiers existants
        document.getElementById('new-project')?.addEventListener('click', () => {
            this.app.fileManager.newProject();
        });

        document.getElementById('open-project')?.addEventListener('click', () => {
            // TODO: Implémenter l'ouverture de projet
            document.getElementById('command-output').textContent = 'Fonctionnalité d\'ouverture à implémenter';
        });

        // Nouveau gestionnaire pour l'import COLLADA
        document.getElementById('import-collada')?.addEventListener('click', async () => {
            try {
                await this.app.fileManager.importColladaFile();
            } catch (error) {
                console.error('Erreur lors de l\'importation COLLADA:', error);
                document.getElementById('command-output').textContent = 'Erreur lors de l\'importation du fichier COLLADA';
            }
        });

        document.getElementById('save-project')?.addEventListener('click', () => {
            this.app.fileManager.saveProject();
        });

        document.getElementById('export-project')?.addEventListener('click', () => {
            this.app.fileManager.exportProject();
        });

        // Gestionnaires de la barre d'outils
        document.getElementById('toolbar-new')?.addEventListener('click', () => {
            this.app.fileManager.newProject();
        });

        document.getElementById('toolbar-open')?.addEventListener('click', () => {
            // TODO: Implémenter l'ouverture de projet
            document.getElementById('command-output').textContent = 'Fonctionnalité d\'ouverture à implémenter';
        });

        // Nouveau gestionnaire pour le bouton d'importation COLLADA
        document.getElementById('toolbar-import-collada')?.addEventListener('click', async () => {
            try {
                await this.app.fileManager.importColladaFile();
            } catch (error) {
                console.error('Erreur lors de l\'importation COLLADA:', error);
                document.getElementById('command-output').textContent = 'Erreur lors de l\'importation du fichier COLLADA';
            }
        });

        document.getElementById('toolbar-save')?.addEventListener('click', () => {
            this.app.fileManager.saveProject();
        });

        document.getElementById('toolbar-export')?.addEventListener('click', () => {
            this.app.fileManager.exportProject();
        });

        document.getElementById('toolbar-export-view-pdf')?.addEventListener('click', async () => {
            try {
                await this.app.fileManager.exportViewToPDF();
            } catch (error) {
                console.error('Erreur lors de l\'export PDF:', error);
                document.getElementById('command-output').textContent = 'Erreur lors de l\'export PDF';
            }
        });

        // Menu
        document.getElementById('new-project').addEventListener('click', () => this.app.fileManager.newProject());
        document.getElementById('save-project').addEventListener('click', () => this.app.fileManager.saveProject());
        document.getElementById('export-project').addEventListener('click', () => this.app.fileManager.exportProject());
        document.getElementById('import-collada')?.addEventListener('click', async () => {
            try {
                await this.app.fileManager.importColladaFile();
            } catch (error) {
                console.error('Erreur lors de l\'importation via menu:', error);
            }
        });
        
        document.getElementById('undo').addEventListener('click', () => this.app.undo());
        document.getElementById('redo').addEventListener('click', () => this.app.redo());
        
        // Boutons copier/coller/couper
        const copyBtn = document.getElementById('copy');
        const cutBtn = document.getElementById('cut');
        const pasteBtn = document.getElementById('paste');
        
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.app.copySelected());
        }
        if (cutBtn) {
            cutBtn.addEventListener('click', () => this.app.cutSelected());
        }
        if (pasteBtn) {
            pasteBtn.addEventListener('click', () => this.app.pasteFromClipboard());
        }
        
        document.getElementById('delete').addEventListener('click', () => this.app.deleteSelected());
        
        // Ajouter les boutons copier/coller
        const editMenu = document.querySelector('.menu-section:nth-child(2)');
        if (editMenu) {
            const copyBtn = document.createElement('button');
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.title = 'Copier (Ctrl+C)';
            copyBtn.addEventListener('click', () => this.app.copySelected());
            editMenu.appendChild(copyBtn);
            
            const cutBtn = document.createElement('button');
            cutBtn.innerHTML = '<i class="fas fa-cut"></i>';
            cutBtn.title = 'Couper (Ctrl+X)';
            cutBtn.addEventListener('click', () => this.app.cutSelected());
            editMenu.appendChild(cutBtn);
            
            const pasteBtn = document.createElement('button');
            pasteBtn.innerHTML = '<i class="fas fa-paste"></i>';
            pasteBtn.title = 'Coller (Ctrl+V)';
            pasteBtn.addEventListener('click', () => this.app.pasteFromClipboard());
            editMenu.appendChild(pasteBtn);
        }
        
        document.getElementById('view-top').addEventListener('click', () => this.app.viewManager.setView('top'));
        document.getElementById('view-front').addEventListener('click', () => this.app.viewManager.setView('front'));
        document.getElementById('view-right').addEventListener('click', () => this.app.viewManager.setView('right'));
        document.getElementById('view-iso').addEventListener('click', () => this.app.viewManager.setView('iso'));
        document.getElementById('toggle-grid').addEventListener('click', () => this.app.viewManager.toggleGrid());
          // Mode 2D/3D
        document.getElementById('toggle-2d3d').addEventListener('click', () => this.app.viewManager.toggle2D3D());
        
        // Toggle des axes
        document.getElementById('toggle-axes').addEventListener('click', () => this.toggleAxes());
          // Calques
        document.getElementById('add-layer')?.addEventListener('click', () => this.addLayer());
        
        this.updateAxisHelper();
        
        // Configuration des outils de dessin
        this.setupDrawingTools();
        
        // Configuration des boutons de la toolbar
        this.setupToolbarButtons();
        
        // Configuration de la barre latérale droite
        this.setupRightSidebar();
        
        // Configuration des contrôles du soleil
        this.setupSunlightControls();
        
        // Initialiser l'affichage des calques
        this.updateLayersPanel();
    }
      setupDrawingTools() {
        // Configuration des outils de la sidebar
        document.getElementById('sidebar-select').addEventListener('click', () => this.handleToolSelect('select'));
        document.getElementById('sidebar-polyline').addEventListener('click', () => this.handleToolSelect('polyline'));
        document.getElementById('sidebar-rect').addEventListener('click', () => this.handleToolSelect('rect'));
        document.getElementById('sidebar-circle').addEventListener('click', () => this.handleToolSelect('circle'));
        document.getElementById('sidebar-parallel').addEventListener('click', () => this.handleToolSelect('parallel'));
        document.getElementById('sidebar-trim').addEventListener('click', () => this.handleToolSelect('trim'));
        document.getElementById('sidebar-extend').addEventListener('click', () => this.handleToolSelect('extend'));
        document.getElementById('sidebar-hatch').addEventListener('click', () => this.handleToolSelect('hatch'));
        
        // Vérifier si le bouton surface existe avant d'ajouter l'event listener
        const surfaceBtn = document.getElementById('sidebar-surface');
        if (surfaceBtn) {
            surfaceBtn.addEventListener('click', () => this.handleToolSelect('surface'));
        }
        
        document.getElementById('sidebar-extrude').addEventListener('click', () => this.handleToolSelect('extrude'));
          // Ajouter l'event listener pour le bouton dimension
        const dimensionBtn = document.getElementById('sidebar-dimension');
        if (dimensionBtn) {
            dimensionBtn.addEventListener('click', () => this.handleToolSelect('dimension'));
        }
    }
      /**
     * Gère la sélection d'un outil
     */
    handleToolSelect(toolName) {        
        // Mettre à jour l'état visuel des boutons
        this.updateToolButtons(toolName);
        
        // Déléguer au ToolManager si disponible
        if (this.app.toolManager) {
            this.app.toolManager.setTool(toolName);
        } else {
            // Fallback pour la compatibilité
            this.app.currentTool = toolName;
            if (this.app.drawingManager) {
                this.app.drawingManager.startDrawing(toolName);
            }
        }
    }
    
    /**
     * Met à jour l'état visuel des boutons d'outils
     */
    updateToolButtons(activeTool) {
        // Retirer la classe active de tous les boutons d'outils
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Ajouter la classe active au bouton sélectionné
        const activeButton = document.getElementById(`sidebar-${activeTool}`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    setupRightSidebar() {
        const sidebar = document.getElementById('right-sidebar');
        const viewport = document.getElementById('viewport');
        
        // Gestion des onglets
        const tabs = document.querySelectorAll('.sidebar-tab');
        const panels = document.querySelectorAll('.sidebar-panel');
        
        console.log('DEBUG: setupRightSidebar - Onglets trouvés:', tabs.length);
        console.log('DEBUG: setupRightSidebar - Panneaux trouvés:', panels.length);
        
        // Debug: lister tous les panneaux trouvés
        panels.forEach(panel => {
            console.log('DEBUG: Panneau trouvé:', panel.id, 'Display:', panel.style.display);
        });
          tabs.forEach(tab => {
            const targetPanel = tab.getAttribute('data-panel');
            console.log('DEBUG: Onglet:', targetPanel, 'Panel ID attendu:', `${targetPanel}-panel`);
            
            tab.addEventListener('click', () => {
                console.log('DEBUG: Clic sur onglet:', targetPanel);
                
                // Mettre à jour les onglets actifs
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Afficher le bon panneau
                panels.forEach(panel => {
                    if (panel.id === `${targetPanel}-panel`) {
                        console.log('DEBUG: Affichage du panneau:', panel.id);
                        panel.classList.add('active');
                        panel.style.display = 'flex';
                    } else {
                        panel.classList.remove('active');
                        panel.style.display = 'none';
                    }
                });
            });
        });
        
        // Gestion de la réduction/expansion
        const toggleButtons = document.querySelectorAll('.panel-toggle');
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                viewport.classList.toggle('sidebar-collapsed');
                
                // Redimensionner le renderer
                setTimeout(() => {
                    this.app.onWindowResize();
                }, 300);
            });
        });
    }
    
    setupSunlightControls() {
        const azimuthSlider = document.getElementById('sun-azimuth');
        const elevationSlider = document.getElementById('sun-elevation');
        const azimuthValue = document.getElementById('azimuth-value');
        const elevationValue = document.getElementById('elevation-value');
        
        // Contrôles pour mois et heure
        const sunMonthElement = document.getElementById('sun-month');
        const sunHourElement = document.getElementById('sun-hour');
        const hourDisplayElement = document.getElementById('hour-display');
        const showSunHelperElement = document.getElementById('show-sun-helper');
        const enableShadowsElement = document.getElementById('enable-shadows');
        
        if (azimuthSlider && elevationSlider) {
            const updateSunlight = () => {
                const azimuth = parseFloat(azimuthSlider.value);
                const elevation = parseFloat(elevationSlider.value);
                
                if (azimuthValue) azimuthValue.textContent = azimuth.toFixed(1) + '°';
                if (elevationValue) elevationValue.textContent = elevation.toFixed(1) + '°';
                
                // Vérifier que sunlightManager existe avant d'appeler updateSunPosition
                if (this.app.sunlightManager && typeof this.app.sunlightManager.updateSunPosition === 'function') {
                    this.app.sunlightManager.updateSunPosition(azimuth, elevation);
                }
            };
            
            azimuthSlider.addEventListener('input', updateSunlight);
            elevationSlider.addEventListener('input', updateSunlight);
            
            // Attendre un peu avant d'appliquer les valeurs initiales
            setTimeout(() => {
                updateSunlight();
            }, 200);
        }

        if (sunMonthElement) {
            sunMonthElement.addEventListener('change', (e) => {
                if (this.app.sunlightManager) {
                    this.app.sunlightManager.month = parseInt(e.target.value);
                    this.app.sunlightManager.updateSunPosition();
                }
            });
        }
        
        if (sunHourElement && hourDisplayElement) {
            sunHourElement.addEventListener('input', (e) => {
                const hour = parseFloat(e.target.value);
                if (this.app.sunlightManager) {
                    this.app.sunlightManager.hour = hour;
                    const hours = Math.floor(hour);
                    const minutes = Math.round((hour - hours) * 60);
                    hourDisplayElement.textContent = 
                        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    this.app.sunlightManager.updateSunPosition();
                }
            });
        }
        
        if (showSunHelperElement) {
            showSunHelperElement.addEventListener('change', (e) => {
                if (this.app.sunlightManager && this.app.sunlightManager.sunHelper) {
                    this.app.sunlightManager.sunHelper.visible = e.target.checked;
                }
            });
        }
        
        // Activer/désactiver les ombres
        if (enableShadowsElement) {
            enableShadowsElement.addEventListener('change', (e) => {
                if (this.app.sunlightManager) {
                    this.app.sunlightManager.enableShadows(e.target.checked);
                    
                    // Forcer un rendu après le changement
                    if (this.app.renderer && this.app.scene && this.app.camera) {
                        this.app.renderer.render(this.app.scene, this.app.camera);
                    }
                }
            });
              // S'assurer que les ombres sont activées au démarrage
            if (enableShadowsElement.checked && this.app.sunlightManager) {
                this.app.sunlightManager.enableShadows(true);
            }
        }
        
        // Gestion de l'indicateur Nord
        const showNorthIndicatorElement = document.getElementById('show-north-indicator');
        const northAngleElement = document.getElementById('north-angle');
        const northAngleDisplayElement = document.getElementById('north-angle-display');
        const northAngleInputElement = document.getElementById('north-angle-input');
        
        if (showNorthIndicatorElement) {
            showNorthIndicatorElement.addEventListener('change', (e) => {
                if (this.app.northIndicator) {
                    this.app.northIndicator.setVisible(e.target.checked);
                    console.log('North indicator visibility:', e.target.checked);
                }
            });
        }
        
        if (northAngleElement && northAngleDisplayElement) {
            const updateNorthAngle = () => {
                const angle = parseFloat(northAngleElement.value);
                if (northAngleDisplayElement) {
                    northAngleDisplayElement.textContent = `${angle}°`;
                }
                if (northAngleInputElement) {
                    northAngleInputElement.value = angle;
                }
                if (this.app.northIndicator) {
                    this.app.northIndicator.setAngle(angle);
                }
            };
            
            northAngleElement.addEventListener('input', updateNorthAngle);
        }
        
        if (northAngleInputElement) {
            northAngleInputElement.addEventListener('change', (e) => {
                const angle = parseFloat(e.target.value);
                if (northAngleElement) {
                    northAngleElement.value = angle;
                }
                if (northAngleDisplayElement) {
                    northAngleDisplayElement.textContent = `${angle}°`;
                }
                if (this.app.northIndicator) {
                    this.app.northIndicator.setAngle(angle);
                }
            });
        }
        
        // Gestion des boutons de directions prédéfinies
        const directionButtons = document.querySelectorAll('.direction-btn');
        directionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const angle = parseFloat(e.target.getAttribute('data-angle'));
                if (northAngleElement) {
                    northAngleElement.value = angle;
                }
                if (northAngleDisplayElement) {
                    northAngleDisplayElement.textContent = `${angle}°`;
                }
                if (northAngleInputElement) {
                    northAngleInputElement.value = angle;
                }
                if (this.app.northIndicator) {
                    this.app.northIndicator.setAngle(angle);
                }
            });
        });
    }
    
    createShadowControls() {
        // Cette fonction n'est plus nécessaire car les contrôles sont maintenant dans la sidebar
    }
    
    updateCoordinates(worldPoint) {
        document.getElementById('coordinates').innerHTML = 
            `<span style="color: #ff0000;">Rouge: ${worldPoint.x.toFixed(2)} cm</span>, ` +
            `<span style="color: #00ff00;">Vert: ${worldPoint.y.toFixed(2)} cm</span>, ` +
            `<span style="color: #0000ff;">Bleu: ${worldPoint.z.toFixed(2)} cm</span>`;
    }
    
    updateAxisHelper() {
        const canvas = document.getElementById('axis-helper');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 100, 100);
        
        ctx.font = '12px Arial';
        ctx.fillStyle = '#000000';
        
        // X - Rouge (horizontal droite)
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(90, 50);
        ctx.stroke();
        ctx.fillStyle = '#ff0000';
        ctx.fillText('X', 92, 53);
        
        // Y - Vert (diagonal vers le bas)
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(70, 70);
        ctx.stroke();
        ctx.fillStyle = '#00ff00';
        ctx.fillText('Y', 72, 75);
        
        // Z - Bleu (vertical vers le haut)
        ctx.strokeStyle = '#0000ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(50, 10);
        ctx.stroke();        ctx.fillStyle = '#0000ff';
        ctx.fillText('Z', 47, 8);
    }    /**
     * Toggle la visibilité des axes dans la scène
     */
    toggleAxes() {
        if (!this.app.scene) {
            console.error('Aucune scène trouvée');
            return;
        }
        
        // Initialiser le state des axes s'il n'existe pas
        if (this.axesVisible === undefined) {
            this.axesVisible = true; // Par défaut, les axes sont visibles
        }
        
        // Inverser l'état
        this.axesVisible = !this.axesVisible;
        
        let axesFound = 0;
        
        // Parcourir tous les objets de la scène pour trouver les axes
        this.app.scene.traverse((object) => {
            // Détecter les axes principaux créés par WebCAD
            if (object.type === 'Line' && object.name === 'AXIS') {
                object.visible = this.axesVisible;
                axesFound++;
            }
            // Détecter les AxesHelper de Three.js
            else if (object.type === 'AxesHelper' || 
                     object.name === 'AxesHelper' || 
                     object.userData?.isAxisIndicator) {
                object.visible = this.axesVisible;
                axesFound++;
            }
            // Détecter les axes par leurs propriétés spécifiques (fallback)
            else if (object.type === 'Line' && 
                     object.material && 
                     object.material.linewidth === 2 && 
                     object.material.opacity === 0.8 && 
                     object.material.transparent === true) {
                object.visible = this.axesVisible;
                axesFound++;
            }
        });
        
        // Mettre à jour le texte du bouton
        const axesButton = document.getElementById('toggle-axes');
        if (axesButton) {
            axesButton.textContent = this.axesVisible ? 'Axes' : 'Axes ✕';
            axesButton.title = this.axesVisible ? 'Masquer les axes' : 'Afficher les axes';
            axesButton.style.opacity = this.axesVisible ? '1' : '0.6';
        }
        
        console.log(`Axes ${this.axesVisible ? 'affichés' : 'masqués'} (${axesFound} trouvés)`);
    }
      addLayer() {
        const layerName = `Calque ${this.app.layers.length}`;
        this.app.layers.push({ name: layerName, visible: true, objects: [] });
        this.updateLayersPanel();
        
        // Mettre à jour le panneau des propriétés si un objet est sélectionné
        // pour que le nouveau calque apparaisse dans le sélecteur déroulant
        if (this.app.selectedObject) {
            this.updatePropertiesPanel(this.app.selectedObject);
        }
    }
    
    updateLayersPanel() {
        const layersList = document.getElementById('layers-list');
        layersList.innerHTML = '';
        
        this.app.layers.forEach((layer, index) => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            if (index === this.app.currentLayer) {
                layerItem.classList.add('active');
            }
              layerItem.innerHTML = `
                <input type="checkbox" ${layer.visible ? 'checked' : ''} data-layer="${index}">
                <input type="text" 
                       class="layer-name-input" 
                       value="${layer.name}" 
                       data-layer="${index}"
                       style="background: transparent; border: none; color: inherit; flex: 1; padding: 2px 4px; margin: 0 4px;"
                       ${index === 0 ? 'disabled title="Le nom du calque 0 ne peut pas être modifié"' : ''}>
                <button class="delete-layer" data-layer="${index}" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-trash"></i>
                </button>
            `;
            
            // Gestionnaire pour sélectionner le calque
            layerItem.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox' && 
                    !e.target.closest('.delete-layer') && 
                    !e.target.classList.contains('layer-name-input')) {
                    this.app.currentLayer = index;
                    this.updateLayersPanel();
                }
            });
            
            // Gestionnaire pour l'édition du nom de calque
            const nameInput = layerItem.querySelector('.layer-name-input');
            if (nameInput && index !== 0) {
                nameInput.addEventListener('blur', (e) => {
                    const newName = e.target.value.trim();
                    if (newName && newName !== layer.name) {
                        layer.name = newName;
                        document.getElementById('command-output').textContent = `Nom du calque ${index} changé en "${newName}"`;
                        
                        // Mettre à jour le panneau des propriétés si un objet est sélectionné
                        if (this.app.selectedObject) {
                            this.updatePropertiesPanel(this.app.selectedObject);
                        }
                    } else if (!newName) {
                        // Si le nom est vide, remettre l'ancien nom
                        e.target.value = layer.name;
                    }
                });
                
                nameInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.target.blur(); // Déclenche l'événement blur
                    }
                });
                
                nameInput.addEventListener('click', (e) => {
                    e.stopPropagation(); // Empêcher la sélection du calque
                });
            }
            
            // Gestionnaire pour la visibilité
            const checkbox = layerItem.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                layer.visible = e.target.checked;
                this.app.updateLayerVisibility(index);
            });
            
            // Gestionnaire pour supprimer
            const deleteBtn = layerItem.querySelector('.delete-layer');
            if (index !== 0) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.app.deleteLayer(index);
                    this.updateLayersPanel();
                });
            }
            
            layersList.appendChild(layerItem);
        });
    }      setupDpad() {
        const dpadContainer = document.getElementById('dpad-container');
        if (!dpadContainer) {
            return;
        }

        const stepSizeInput = document.getElementById('dpad-step-size');
        const getStepSize = () => parseFloat(stepSizeInput.value) || 1;
        const commandOutput = document.getElementById('command-output');        const setupButton = (id, action) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', action);
            }
        };

        const handleMove = (dx, dy, dz) => {
            if (!this.app.selectedObject) {
                commandOutput.textContent = 'Aucun objet sélectionné à déplacer.';
                return;
            }
            this.moveSelectedObject(dx * getStepSize(), dy * getStepSize(), dz * getStepSize());
        };

        // Configuration des boutons du dpad
        setupButton('dpad-up', () => handleMove(0, 1, 0));    // Y+
        setupButton('dpad-down', () => handleMove(0, -1, 0));  // Y-
        setupButton('dpad-left', () => handleMove(-1, 0, 0));  // X-
        setupButton('dpad-right', () => handleMove(1, 0, 0));   // X+
        setupButton('dpad-z-up', () => handleMove(0, 0, 1));    // Z+
        setupButton('dpad-z-down', () => handleMove(0, 0, -1));  // Z-

        // Gestion des événements clavier pour le dpad
        document.addEventListener('keydown', (event) => {
            // Ignorer si l'utilisateur tape dans un champ de saisie
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            switch(event.key) {
                case 'ArrowUp':
                    event.preventDefault();
                    handleMove(0, 1, 0); // Y+
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    handleMove(0, -1, 0); // Y-
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    handleMove(-1, 0, 0); // X-
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    handleMove(1, 0, 0); // X+
                    break;
                case '+':
                case '=':
                    event.preventDefault();
                    handleMove(0, 0, 1); // Z+
                    break;
                case '-':
                case '_':
                    event.preventDefault();
                    handleMove(0, 0, -1); // Z-
                    break;
            }
        });

        setupButton('dpad-center', () => {
            if (this.app.selectedObject) {
                this.app.selectedObject.position.set(0, 0, 0);
                // Assurez-vous que updatePropertiesPanel existe et est appelée correctement
                if (typeof this.updatePropertiesPanel === 'function') {
                    this.updatePropertiesPanel(this.app.selectedObject);
                } else {
                    console.error('this.updatePropertiesPanel n\'est pas une fonction dans setupDpad');
                }
                if (this.app.transformControls && this.app.transformControls.object === this.app.selectedObject) {
                    this.app.transformControls.updateMatrixWorld();
                }
                commandOutput.textContent = 'Objet replacé à l\'origine (0,0,0).';            } else {
                commandOutput.textContent = 'Aucun objet sélectionné à réinitialiser.';
            }
        });
    }

    moveSelectedObject(dx, dy, dz) {
        if (!this.app.selectedObject) return;

        this.app.selectedObject.position.x += dx;
        this.app.selectedObject.position.y += dy;
        this.app.selectedObject.position.z += dz;

        if (this.app.transformControls && this.app.transformControls.object === this.app.selectedObject) {
            this.app.transformControls.updateMatrixWorld(); 
        }

        // Assurez-vous que updatePropertiesPanel existe et est appelée correctement
        if (typeof this.updatePropertiesPanel === 'function') {
            this.updatePropertiesPanel(this.app.selectedObject);
        } else {
            console.error('this.updatePropertiesPanel n\'est pas une fonction dans moveSelectedObject');
        }

        const pos = this.app.selectedObject.position;
        document.getElementById('command-output').textContent = 
            `Déplacé. Position: X=${pos.x.toFixed(2)}, Y=${pos.y.toFixed(2)}, Z=${pos.z.toFixed(2)} cm`;
    }

    setupToolbarButtons() {
        // Boutons Fichier
        const newBtn = document.getElementById('toolbar-new');
        const saveBtn = document.getElementById('toolbar-save');
        const exportBtn = document.getElementById('toolbar-export');
        const openBtn = document.getElementById('toolbar-open');
        
        if (newBtn) newBtn.addEventListener('click', () => this.app.fileManager.newProject());
        if (saveBtn) saveBtn.addEventListener('click', () => this.app.fileManager.saveProject());
        if (exportBtn) exportBtn.addEventListener('click', () => this.app.fileManager.exportProject());
        
        // Bouton Ouvrir
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.app.fileManager.loadProject(file);
                    }
                };
                input.click();
            });
        }
        
        // Boutons Édition
        const undoBtn = document.getElementById('toolbar-undo');
        const redoBtn = document.getElementById('toolbar-redo');
        const copyBtn = document.getElementById('toolbar-copy');
        const cutBtn = document.getElementById('toolbar-cut');
        const pasteBtn = document.getElementById('toolbar-paste');
        const deleteBtn = document.getElementById('toolbar-delete');
        
        if (undoBtn) undoBtn.addEventListener('click', () => this.app.undo());
        if (redoBtn) redoBtn.addEventListener('click', () => this.app.redo());
        if (copyBtn) copyBtn.addEventListener('click', () => this.app.copySelected());
        if (cutBtn) cutBtn.addEventListener('click', () => this.app.cutSelected());
        if (pasteBtn) pasteBtn.addEventListener('click', () => this.app.pasteFromClipboard());
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.app.deleteSelected());
        
        // Nouveaux boutons Outils de dessin
        const lineBtn = document.getElementById('toolbar-line');
        const rectBtn = document.getElementById('toolbar-rect');
        const circleBtn = document.getElementById('toolbar-circle');
        const polylineBtn = document.getElementById('toolbar-polyline');
        const selectBtn = document.getElementById('toolbar-select');
        const extrudeBtn = document.getElementById('toolbar-extrude');
        
        if (lineBtn) lineBtn.addEventListener('click', () => this.app.toolManager.setTool('line'));
        if (rectBtn) rectBtn.addEventListener('click', () => this.app.toolManager.setTool('rect'));
        if (circleBtn) circleBtn.addEventListener('click', () => this.app.toolManager.setTool('circle'));
        if (polylineBtn) polylineBtn.addEventListener('click', () => this.app.toolManager.setTool('polyline'));
        if (selectBtn) selectBtn.addEventListener('click', () => this.app.toolManager.setTool('select'));
        if (extrudeBtn) extrudeBtn.addEventListener('click', () => this.app.toolManager.setTool('extrude'));
        
        // Boutons Vue
        const zoomInBtn = document.getElementById('toolbar-zoom-in');
        const zoomOutBtn = document.getElementById('toolbar-zoom-out');
        const zoomExtentsBtn = document.getElementById('toolbar-zoom-extents');
        const orbitBtn = document.getElementById('toolbar-orbit');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.app.camera.zoom *= 1.2;
                this.app.camera.updateProjectionMatrix();
                document.getElementById('command-output').textContent = 'Zoom avant';
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.app.camera.zoom /= 1.2;
                this.app.camera.updateProjectionMatrix();
                document.getElementById('command-output').textContent = 'Zoom arrière';
            });
        }
        
        if (zoomExtentsBtn) zoomExtentsBtn.addEventListener('click', () => this.app.viewManager.zoomExtents());
        if (orbitBtn) orbitBtn.addEventListener('click', () => this.app.activateOrbitMode());
        
        // Boutons Vues prédéfinies
        const viewTopBtn = document.getElementById('toolbar-view-top');
        const viewIsoBtn = document.getElementById('toolbar-view-iso');
        const viewFrontBtn = document.getElementById('toolbar-view-front');
        const viewBackBtn = document.getElementById('toolbar-view-back');
        const viewRightBtn = document.getElementById('toolbar-view-right');
        const viewLeftBtn = document.getElementById('toolbar-view-left');
        const snapBtn = document.getElementById('toolbar-snap');
        
        if (viewTopBtn) viewTopBtn.addEventListener('click', () => this.app.viewManager.setView('top'));
        if (viewIsoBtn) viewIsoBtn.addEventListener('click', () => this.app.viewManager.setView('iso'));
        if (viewFrontBtn) viewFrontBtn.addEventListener('click', () => this.app.viewManager.setView('front'));
        if (viewBackBtn) viewBackBtn.addEventListener('click', () => this.app.viewManager.setView('back'));
        if (viewRightBtn) viewRightBtn.addEventListener('click', () => this.app.viewManager.setView('right'));
        if (viewLeftBtn) viewLeftBtn.addEventListener('click', () => this.app.viewManager.setView('left'));

        if (snapBtn) {
            snapBtn.addEventListener('click', () => {
                // Basculer l'état d'accrochage
                this.app.snapEnabled = !this.app.snapEnabled;
                
                // Mettre à jour l'état visuel du bouton
                snapBtn.classList.toggle('active', this.app.snapEnabled);
                
                // Mettre à jour le message de commande
                document.getElementById('command-output').textContent = 
                    this.app.snapEnabled ? 'Accrochage activé' : 'Accrochage désactivé';
                
                // Mettre à jour l'indicateur dans la barre d'état
                const snapIndicator = document.getElementById('snap-indicator');
                if (snapIndicator) {
                    snapIndicator.textContent = this.app.snapEnabled ? 'Accrochage: ON' : 'Accrochage: OFF';
                }
                
                // Si l'accrochage est désactivé, cacher l'indicateur de snap
                if (!this.app.snapEnabled && this.app.snapManager) {
                    this.app.snapManager.hideSnapIndicator();
                }
            });
            
            // Initialiser l'état du bouton selon l'état par défaut de l'application
            snapBtn.classList.toggle('active', this.app.snapEnabled);
        }        // Ajouter le gestionnaire pour le nouveau bouton "Exporter Vue en PDF"
        document.getElementById('toolbar-export-view-pdf')?.addEventListener('click', () => {
            if (this.app.fileManager && typeof this.app.fileManager.exportViewToPDF === 'function') {
                this.app.fileManager.exportViewToPDF();
            } else {
                console.error('Méthode exportViewToPDF non disponible dans FileManager');
                alert('La fonctionnalité d\'export de la vue en PDF n\'est pas disponible.');
            }
        });
        
        // Nouveau gestionnaire pour le bouton d'importation GLB
        document.getElementById('toolbar-import-glb')?.addEventListener('click', async () => {
            try {
                await this.app.fileManager.importGLBFile();
            } catch (error) {
                console.error('Erreur lors de l\'importation GLB:', error);
                document.getElementById('command-output').textContent = 'Erreur lors de l\'importation du fichier GLB';
            }
        });
    }
    
    setupTextureLibrary() {
        // Attendre que les éléments DOM soient disponibles
        setTimeout(() => {
            // Configuration des textures
            this.setupTextures();
            
            // Configuration des couleurs
            this.setupColorPalette();
            
            // Configuration des onglets
            this.setupTextureTabs();
              // Gestionnaire pour annuler le mode texture avec Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.app.textureApplyMode) {
                    this.cancelTextureMode();
                }
            });
        }, 100);
    }
      setupTextures() {
        const textures = [
            { name: 'Brique Brune', url: 'https://julienbro.github.io/MurSimulateur3d/textures/brique_brune_1.png' },
            { name: 'Brique Rouge', url: 'https://julienbro.github.io/MurSimulateur3d/textures/brique_rouge_1.png' },
            { name: 'Brique Claire', url: 'https://julienbro.github.io/MurSimulateur3d/textures/brique_claire_1.png' },
            { name: 'Brique Beige', url: 'https://julienbro.github.io/MurSimulateur3d/textures/brique_beige_1.png' },
            { name: 'Brique Grise', url: 'https://julienbro.github.io/MurSimulateur3d/textures/brique_grise_1.png' },
            { name: 'Brique Grise 2', url: 'https://julienbro.github.io/MurSimulateur3d/textures/brique_grise_2.png' },
            { name: 'Béton', url: 'https://julienbro.github.io/MurSimulateur3d/textures/beton_1.png' },
            { name: 'Bois Pin', url: 'https://julienbro.github.io/MurSimulateur3d/textures/bois_pin_1.png' }
        ];
          const textureLibrary = document.getElementById('texture-library');
        if (!textureLibrary) {
            return;
        }
        
        // Nettoyer la palette existante
        textureLibrary.innerHTML = '';
        
        textures.forEach((texture, index) => {
            const textureItem = document.createElement('div');
            textureItem.className = 'texture-item';
            textureItem.style.backgroundImage = `url(${texture.url})`;
            textureItem.style.backgroundSize = 'cover';
            textureItem.style.backgroundPosition = 'center';
            textureItem.title = texture.name;
            
            // Ajouter le label de la texture
            const textureLabel = document.createElement('div');
            textureLabel.className = 'texture-label';
            textureLabel.textContent = texture.name;
            textureItem.appendChild(textureLabel);
            
            textureItem.addEventListener('click', () => {
                this.selectTexture(textureItem, texture, 'texture');
            });
            
            textureLibrary.appendChild(textureItem);
        });
    }    updatePropertiesPanel(object) {
        const propertiesContent = document.getElementById('properties-content');
        if (!propertiesContent) {
            return;
        }

        // Si aucun objet n'est sélectionné, afficher un message
        if (!object) {
            propertiesContent.innerHTML = '<p>Sélectionnez un objet pour voir ses propriétés</p>';
            return;        }        // Calculer les dimensions de l'objet avec support pour GLB
        let dimensions = { x: 0, y: 0, z: 0 };
        let dimensionsInCm = { x: 0, y: 0, z: 0 };        // Vérifier si c'est un élément de construction de la bibliothèque
        if (object.userData && object.userData.isConstructionElement && object.userData.dims) {
            // Pour les éléments de la bibliothèque, utiliser les dimensions stockées (déjà en cm)
            console.log('Élément de bibliothèque détecté');
            dimensionsInCm = {
                x: object.userData.dims.x,
                y: object.userData.dims.y, 
                z: object.userData.dims.z
            };
            // Convertir en mètres pour l'affichage de debug si nécessaire
            dimensions = {
                x: dimensionsInCm.x / 100,
                y: dimensionsInCm.y / 100,
                z: dimensionsInCm.z / 100
            };        } else {
            // Pour les objets créés par les outils de dessin (rectangles, extrusions, etc.)
            // Calculer depuis la géométrie
            try {
                // Méthode 1: Utiliser Box3.setFromObject (fonctionne pour tous les types d'objets)
                const box = new THREE.Box3().setFromObject(object);
                if (box.min.x !== Infinity && box.max.x !== -Infinity) {
                    const size = box.getSize(new THREE.Vector3());
                    dimensions = {
                        x: size.x,
                        y: size.y,
                        z: size.z
                    };
                    
                    // Détection intelligente : si les dimensions sont > 1, elles sont déjà en cm
                    if (dimensions.x > 1 || dimensions.y > 1 || dimensions.z > 1) {
                        // Dimensions déjà en cm, pas de conversion
                        dimensionsInCm = {
                            x: dimensions.x,
                            y: dimensions.y,
                            z: dimensions.z
                        };
                    } else {
                        // Dimensions en mètres, conversion en cm
                        dimensionsInCm = {
                            x: dimensions.x * 100,
                            y: dimensions.y * 100,
                            z: dimensions.z * 100
                        };
                    }                } else {
                    // Méthode 2: Pour les objets GLB/GLTF, parcourir les enfants
                    if (object.children && object.children.length > 0) {
                        const groupBox = new THREE.Box3();
                        
                        object.traverse((child) => {
                            if (child.geometry) {
                                child.geometry.computeBoundingBox();
                                if (child.geometry.boundingBox) {
                                    const childBox = child.geometry.boundingBox.clone();
                                    childBox.applyMatrix4(child.matrixWorld);
                                    groupBox.expandByBox(childBox);
                                }
                            }
                        });
                        
                        if (!groupBox.isEmpty()) {
                            const size = groupBox.getSize(new THREE.Vector3());
                            dimensions = {
                                x: size.x,
                                y: size.y,
                                z: size.z
                            };
                            dimensionsInCm = {
                                x: dimensions.x * 100,
                                y: dimensions.y * 100,
                                z: dimensions.z * 100
                            };
                        }
                    }
                    
                    // Méthode 3: Fallback pour les objets avec geometry directe
                    if (dimensions.x === 0 && dimensions.y === 0 && dimensions.z === 0 && object.geometry) {
                        object.geometry.computeBoundingBox();
                        if (object.geometry.boundingBox) {
                            const size = object.geometry.boundingBox.getSize(new THREE.Vector3());
                            dimensions = {
                                x: size.x,
                                y: size.y,
                                z: size.z
                            };
                            dimensionsInCm = {
                                x: dimensions.x * 100,
                                y: dimensions.y * 100,
                                z: dimensions.z * 100
                            };
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error calculating dimensions:', error);
            }
        }
          // Déterminer le type d'objet avec support GLB amélioré
        let objectType = 'Objet';
        
        // Vérifier d'abord s'il y a un type personnalisé défini (ex: hachures)
        if (object.userData && object.userData.displayType) {
            objectType = object.userData.displayType;
        }
        // Vérifier si c'est un objet GLB/GLTF
        else if (object.userData && object.userData.gltfExtensions) {
            objectType = 'Modèle GLB/GLTF';
        } else if (object.type === 'Group' && object.children.length > 0) {
            // Vérifier si le groupe contient des meshs (typique des GLB)
            const hasMeshes = object.children.some(child => child.type === 'Mesh' || child.type === 'SkinnedMesh');
            if (hasMeshes) {
                objectType = 'Modèle 3D (Groupe)';
            } else {
                objectType = 'Groupe';
            }
        } else if (object.geometry) {
            if (object.geometry.type === 'PlaneGeometry') objectType = 'Rectangle';
            else if (object.geometry.type === 'CircleGeometry') objectType = 'Cercle';
            else if (object.geometry.type === 'CylinderGeometry') objectType = 'Cylindre';
            else if (object.geometry.type === 'BoxGeometry') objectType = 'Cube';
            else if (object.geometry.type === 'BufferGeometry') objectType = 'Modèle 3D';
            else objectType = object.geometry.type.replace('Geometry', '');        } else if (object.type) {
            objectType = object.type;
        }
        
        // Trouver le calque de l'objet et l'index du calque actuel
        let layerName = 'Calque 0';
        let currentLayerIndex = 0;
        this.app.layers.forEach((layer, index) => {
            if (layer.objects.includes(object)) {
                layerName = layer.name || `Calque ${index}`;
                currentLayerIndex = index;
            }
        });

        // Générer les options pour le sélecteur de calque
        let layerOptions = '';
        this.app.layers.forEach((layer, index) => {
            const selected = index === currentLayerIndex ? 'selected' : '';
            layerOptions += `<option value="${index}" ${selected}>${layer.name || `Calque ${index}`}</option>`;
        });

        // Générer l'interface HTML complète
        propertiesContent.innerHTML = `
            <div class="prop-row">
                <span class="prop-label">Nom:</span>
                <div class="prop-value">
                    <input type="text" id="prop-name" value="${object.name || 'Sans nom'}" />
                </div>
            </div>
            
            <div class="prop-row">
                <span class="prop-label">Type:</span>
                <div class="prop-value">${objectType}</div>
            </div>
            
            <div class="prop-row">
                <span class="prop-label">Calque:</span>
                <div class="prop-value">
                    <select id="prop-layer">
                        ${layerOptions}
                    </select>
                </div>
            </div>
            
            <div style="margin: 12px 0; font-weight: bold; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
                Position (cm)
            </div>
            
            <div class="prop-row">
                <span class="prop-label">X:</span>
                <div class="prop-value">
                    <input type="number" id="prop-pos-x" value="${object.position.x.toFixed(2)}" step="0.1" />
                </div>
            </div>
            
            <div class="prop-row">
                <span class="prop-label">Y:</span>
                <div class="prop-value">
                    <input type="number" id="prop-pos-y" value="${object.position.y.toFixed(2)}" step="0.1" />
                </div>
            </div>
            
            <div class="prop-row">
                <span class="prop-label">Z:</span>
                <div class="prop-value">
                    <input type="number" id="prop-pos-z" value="${object.position.z.toFixed(2)}" step="0.1" />
                </div>
            </div>
            
            <div style="margin: 12px 0; font-weight: bold; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
                Rotation (°)
            </div>              <div class="prop-row">
                <span class="prop-label">X:</span>
                <div class="prop-value">
                    <input type="number" id="prop-rot-x" value="${this.getDisplayRotation(object, 'x').toFixed(2)}" step="1" />
                </div>
            </div>
            
            <div class="prop-row">
                <span class="prop-label">Y:</span>
                <div class="prop-value">
                    <input type="number" id="prop-rot-y" value="${this.getDisplayRotation(object, 'y').toFixed(2)}" step="1" />
                </div>
            </div>
            
            <div class="prop-row">
                <span class="prop-label">Z:</span>
                <div class="prop-value">
                    <input type="number" id="prop-rot-z" value="${this.getDisplayRotation(object, 'z').toFixed(2)}" step="1" />
                </div>
            </div>
  ${this.generateDimensionsSection(object, dimensions, dimensionsInCm)}
        `;        // Ajouter les écouteurs d'événements pour l'édition en temps réel
        this.setupPropertyEventListeners(object);
    }    /**
     * Génère la section des dimensions selon le type d'objet
     * @param {THREE.Object3D} object - L'objet sélectionné
     * @param {Object} dimensions - Les dimensions calculées de l'objet en mètres
     * @param {Object} dimensionsInCm - Les dimensions en centimètres
     * @returns {string} HTML de la section dimensions
     */
    generateDimensionsSection(object, dimensions, dimensionsInCm) {        // Vérifier si c'est un cercle
        if (object.geometry && object.geometry.type === 'CircleGeometry') {
            const radius = object.geometry.parameters?.radius || dimensions.x / 2;
            const diameter = radius * 2;
            
            // Détection intelligente des unités pour le rayon
            let radiusDisplay, diameterDisplay;
            if (radius > 1) {
                // Le rayon est déjà en cm
                radiusDisplay = radius;
                diameterDisplay = diameter;
            } else {
                // Le rayon est en mètres, convertir en cm
                radiusDisplay = radius * 100;
                diameterDisplay = diameter * 100;
            }
            
            // Calculer les propriétés géométriques du cercle
            let circleProperties = '';
            if (this.app.elementsLibrary && radiusDisplay > 0) {
                const circumference = 2 * Math.PI * radiusDisplay;
                const area = Math.PI * radiusDisplay * radiusDisplay;
                
                // Formater en m² pour l'aire (comme les rectangles)
                const areaM2 = area / 10000; // cm² vers m²
                
                circleProperties = `
                    <!-- Propriétés géométriques du cercle -->
                    <div style="margin: 12px 0; font-weight: bold; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
                        Propriétés calculées
                    </div>
                    
                    <div class="prop-row">
                        <span class="prop-label">Circonférence:</span>
                        <div class="prop-value" style="color: #3498db; font-weight: bold;">
                            ${(circumference / 100).toFixed(4)} m
                        </div>
                    </div>
                    
                    <div class="prop-row">
                        <span class="prop-label">Aire:</span>
                        <div class="prop-value" style="color: #2ecc71; font-weight: bold;">
                            ${areaM2.toFixed(6)} m²
                        </div>
                    </div>
                `;
            }
            
            return `
                <div style="margin: 12px 0; font-weight: bold; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
                    Propriétés du cercle (cm)
                </div>
                
                <div class="prop-row">
                    <span class="prop-label">Rayon:</span>
                    <div class="prop-value">
                        <input type="number" id="prop-circle-radius" value="${radiusDisplay.toFixed(2)}" step="0.1" min="0.1" />
                    </div>
                </div>
                
                <div class="prop-row">
                    <span class="prop-label">Diamètre:</span>
                    <div class="prop-value">
                        <input type="number" id="prop-circle-diameter" value="${diameterDisplay.toFixed(2)}" step="0.1" min="0.2" />
                    </div>
                </div>
                
                ${circleProperties}
            `;
        }        // Vérifier si c'est une ligne ou polyligne
        if (object instanceof THREE.Line || object.isLine || 
            (object.type && object.type === 'Line') ||
            (object.userData && (object.userData.type === 'line' || object.userData.type === 'polyline'))) {
            let totalLength = 0;
            const currentLinewidth = object.material?.linewidth || 1;
            // Toujours utiliser la couleur originale stockée dans userData pour l'affichage dans le panneau
            const originalColor = object.userData.originalColor !== undefined ? 
                object.userData.originalColor : 
                (object.material?.color?.getHex() || 0x000000);
            const currentColor = originalColor.toString(16).padStart(6, '0');
              // Calculer la longueur totale de la ligne
            if (object.geometry && object.geometry.attributes && object.geometry.attributes.position) {
                const positions = object.geometry.attributes.position.array;
                for (let i = 0; i < positions.length - 3; i += 3) {
                    const x1 = positions[i], y1 = positions[i + 1], z1 = positions[i + 2];
                    const x2 = positions[i + 3], y2 = positions[i + 4], z2 = positions[i + 5];
                    const segmentLength = Math.sqrt(
                        Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
                    );
                    totalLength += segmentLength;
                }
            }
              // Déterminer le style de ligne actuel
            let currentLineStyle = 'solid';
            if (object.material instanceof THREE.LineDashedMaterial) {
                const dashSize = object.material.dashSize || 3;
                const gapSize = object.material.gapSize || 1;                // Identifier le style basé sur les paramètres dash/gap
                if (dashSize === 0.3 && gapSize === 0.3) {
                    currentLineStyle = 'dotted';
                } else if (dashSize === 2 && gapSize === 2) {
                    currentLineStyle = 'hidden';
                } else if (dashSize === 3 && gapSize === 0.5) {
                    currentLineStyle = 'dashdot';
                } else if (dashSize === 2.5 && gapSize === 0.8) {
                    currentLineStyle = 'axis';
                } else {
                    currentLineStyle = 'dashed';
                }
            }
            
            return `
                <div style="margin: 12px 0; font-weight: bold; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
                    Propriétés de la ligne
                </div>
                
                <div class="prop-row">
                    <span class="prop-label">Longueur totale (cm):</span>
                    <div class="prop-value">
                        <span style="color: #3498db; font-weight: bold;">${totalLength.toFixed(2)}</span>
                    </div>
                </div>
                  <div class="prop-row">
                    <span class="prop-label">Style:</span>
                    <div class="prop-value">
                        <div id="line-style-selector" style="position: relative;">
                            <select id="prop-line-style" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; color: #fff; padding: 2px 4px; font-size: 11px; width: 100px;">                                <option value="solid" ${currentLineStyle === 'solid' ? 'selected' : ''}>━━━━━ Solide</option>
                                <option value="dashed" ${currentLineStyle === 'dashed' ? 'selected' : ''}>┉┉┉┉┉ Tirets</option>
                                <option value="dotted" ${currentLineStyle === 'dotted' ? 'selected' : ''}>∙∙∙∙∙ Points</option>
                                <option value="dashdot" ${currentLineStyle === 'dashdot' ? 'selected' : ''}>┉∙┉∙┉ Tiret-Point</option>
                                <option value="axis" ${currentLineStyle === 'axis' ? 'selected' : ''}>━∙━∙━ Axe</option>
                                <option value="hidden" ${currentLineStyle === 'hidden' ? 'selected' : ''}>┅┅┅┅┅ Caché</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="prop-row">
                    <span class="prop-label">Épaisseur:</span>
                    <div class="prop-value">
                        <input type="number" id="prop-line-width" value="${currentLinewidth}" step="1" min="1" max="10" />
                    </div>
                </div>
                
                <div class="prop-row">
                    <span class="prop-label">Couleur:</span>
                    <div class="prop-value">
                        <input type="color" id="prop-line-color" value="#${currentColor}" />
                    </div>
                </div>
            `;
        }
          // Pour tous les autres objets, afficher les dimensions rectangulaires        // Calculer les propriétés géométriques (surface et volume) pour TOUS les objets
        let geometricProperties = '';
        console.log('🔍 Calcul propriétés géométriques:', {
            hasElementsLibrary: !!this.app.elementsLibrary,
            dimensionsInCm: dimensionsInCm,
            conditionCheck: this.app.elementsLibrary && dimensionsInCm.x > 0 && dimensionsInCm.y > 0 && dimensionsInCm.z > 0
        });
        
        if (this.app.elementsLibrary && dimensionsInCm.x > 0 && dimensionsInCm.y > 0) {
            console.log('✅ Conditions remplies, calcul des propriétés...');
            // Utiliser directement dimensionsInCm (déjà en centimètres)
            const volume = this.app.elementsLibrary.calculateVolume(dimensionsInCm);
            const surfaces = this.app.elementsLibrary.calculateSurfaces(dimensionsInCm);
            
            // Déterminer le type d'objet
            let objectTypeForCalc = 'rectangle';
            let elementName = 'Rectangle';
            
            if (object.userData && object.userData.isConstructionElement) {
                // Élément de bibliothèque
                elementName = object.userData.elementType || object.name || 'Élément de bibliothèque';
                objectTypeForCalc = object.userData.category || 'bibliothèque';
            } else if (object.userData && object.userData.type) {
                // Objet créé par outil
                objectTypeForCalc = object.userData.type;
                if (object.userData.type === 'rectangle') {
                    elementName = 'Rectangle';
                } else if (object.userData.type === 'extrusion') {
                    elementName = 'Volume extrudé';
                } else if (object.userData.type === 'circle') {
                    elementName = 'Cercle';
                } else {
                    elementName = object.userData.type.charAt(0).toUpperCase() + object.userData.type.slice(1);
                }
            }
            
            // Calcul spécial pour les rectangles (surface = largeur × hauteur)
            let surfaceSpeciale = '';
            if (objectTypeForCalc === 'rectangle') {
                const surfaceRectangle = (dimensionsInCm.x * dimensionsInCm.y) / 10000; // Conversion cm² vers m²
                surfaceSpeciale = `
                    <div class="prop-row">
                        <span class="prop-label">Surface:</span>
                        <div class="prop-value" style="color: #2ecc71; font-weight: bold;">
                            ${surfaceRectangle.toFixed(6)} m²
                        </div>
                    </div>
                `;
            }
              geometricProperties = `
                <!-- Propriétés géométriques calculées -->
                <div style="margin: 12px 0; font-weight: bold; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
                    Propriétés calculées
                </div>
                
                ${surfaceSpeciale}
                
                <div class="prop-row">
                    <span class="prop-label">Volume:</span>
                    <div class="prop-value" style="color: #3498db; font-weight: bold;">
                        ${volume.formatted}
                    </div>
                </div>
            `;
            
            // Ajouter les détails pour les éléments de bibliothèque
            if (object.userData && object.userData.isConstructionElement) {
                // Déterminer la catégorie basée sur les userData ou le nom de l'objet
                let category = 'autres';
                
                if (object.userData && object.userData.category) {
                    category = object.userData.category;
                } else if (object.userData && object.userData.elementCategory) {
                    category = object.userData.elementCategory;
                } else if (object.name) {
                    const name = object.name.toLowerCase();
                    if (name.includes('brique')) category = 'briques';
                    else if (name.includes('bloc')) category = 'blocs';
                    else if (name.includes('hourdis') || name.includes('plancher')) category = 'planchers';
                    else if (name.includes('isolant')) category = 'isolants';
                    else if (name.includes('linteau')) category = 'linteaux';
                }
                
                const utilisationTypique = this.app.elementsLibrary.getTypicalUsage(category, dimensionsInCm);
                  geometricProperties += `
                    <div class="prop-row">
                        <span class="prop-label">Catégorie:</span>
                        <div class="prop-value" style="color: #9b59b6;">
                            ${category.charAt(0).toUpperCase() + category.slice(1)}
                        </div>
                    </div>
                    
                    <!-- Usage typique -->
                    <div style="margin: 8px 0; font-size: 11px; color: #27ae60; padding: 6px; background: rgba(39, 174, 96, 0.1); border-left: 3px solid #27ae60; border-radius: 3px;">
                        <strong>Usage:</strong> ${utilisationTypique}
                    </div>
                    
                    <!-- Détail des surfaces -->
                    <div style="margin: 8px 0; font-size: 11px; color: #999; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 3px;">
                        <div style="margin-bottom: 2px;"><strong>Détail des surfaces:</strong></div>
                        <div>• Faces avant/arrière: ${surfaces.faces.xy.toFixed(1)} cm²</div>
                        <div>• Faces dessus/dessous: ${surfaces.faces.xz.toFixed(1)} cm²</div>
                        <div>• Faces gauche/droite: ${surfaces.faces.yz.toFixed(1)} cm²</div>
                    </div>
                `;
            }
        }
          return `
            <div style="margin: 12px 0; font-weight: bold; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
                Dimensions (cm)
            </div>
                <div class="prop-row">
                <span class="prop-label">Largeur:</span>
                <div class="prop-value">
                    <input type="number" id="prop-dim-x" value="${dimensionsInCm.x.toFixed(2)}" step="0.1" min="0.1" />
                </div>
            </div>
            
            <div class="prop-row">
                <span class="prop-label">Hauteur:</span>
                <div class="prop-value">
                    <input type="number" id="prop-dim-y" value="${dimensionsInCm.y.toFixed(2)}" step="0.1" min="0.1" />
                </div>
            </div>
            
            <div class="prop-row">
                <span class="prop-label">Profondeur:</span>
                <div class="prop-value">
                    <input type="number" id="prop-dim-z" value="${dimensionsInCm.z.toFixed(2)}" step="0.1" min="0.1" />
                </div>
            </div>
            
            ${geometricProperties}
        `;
    }

    /**
     * Normalise un angle en degrés pour qu'il soit dans la plage 0-359°
     */
    normalizeAngle(degrees) {
        // Convertir l'angle pour qu'il soit toujours positif entre 0 et 359°        let normalized = degrees % 360;
        if (normalized < 0) {
            normalized += 360;
        }
        return normalized;
    }

    /**
     * Obtient la rotation d'un objet en degrés pour l'affichage
     * @param {THREE.Object3D} object - L'objet 3D
     * @param {string} axis - L'axe de rotation ('x', 'y', ou 'z')
     * @returns {number} La rotation en degrés
     */
    getDisplayRotation(object, axis) {
        if (!object || !object.rotation) {
            return 0;
        }
        
        const radians = object.rotation[axis] || 0;
        return (radians * 180) / Math.PI; // Conversion radians -> degrés
    }

    setupPropertyEventListeners(object) {
        // Écouteur pour le nom de l'objet
        const nameInput = document.getElementById('prop-name');
        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                object.name = e.target.value;
                this.app.addToHistory('modify', object);
            });
        }

        // Écouteur pour le changement de calque
        const layerSelect = document.getElementById('prop-layer');
        if (layerSelect) {
            layerSelect.addEventListener('change', (e) => {
                const targetLayerIndex = parseInt(e.target.value);
                if (this.app.moveObjectToLayer(object, targetLayerIndex)) {
                    // Mettre à jour l'affichage des calques si nécessaire
                    if (this.updateLayersPanel) {
                        this.updateLayersPanel();
                    }
                    
                    // Afficher un message de confirmation
                    const targetLayerName = this.app.layers[targetLayerIndex].name || `Calque ${targetLayerIndex}`;
                    document.getElementById('command-output').textContent = 
                        `Objet déplacé vers ${targetLayerName}`;
                }
            });
        }

        // Écouteurs pour la position
        ['x', 'y', 'z'].forEach(axis => {
            const input = document.getElementById(`prop-pos-${axis}`);
            if (input) {
                input.addEventListener('change', (e) => {
                    const value = parseFloat(e.target.value) || 0;
                    object.position[axis] = value;
                    
                    // Mettre à jour les contrôles de transformation
                   
                   
                    if (this.app.transformControls && this.app.transformControls.object === object) {
                        this.app.transformControls.updateMatrixWorld();
                    }
                    
                    this.app.addToHistory('modify', object);
                    
                    // Mettre à jour l'affichage des coordonnées
                    document.getElementById('command-output').textContent = 
                        `Position mise à jour: X=${object.position.x.toFixed(2)}, Y=${object.position.y.toFixed(2)}, Z=${object.position.z.toFixed(2)} cm`;
                });
            }
        });        // Écouteurs pour la rotation
        ['x', 'y', 'z'].forEach(axis => {
            const input = document.getElementById(`prop-rot-${axis}`);
            if (input) {                input.addEventListener('change', (e) => {
                    let displayDegrees = parseFloat(e.target.value) || 0;
                    
                    // Normaliser l'angle saisi par l'utilisateur
                    displayDegrees = this.normalizeAngle(displayDegrees);
                    
                    // Convertir en rotation réelle à appliquer
                    const radians = this.getActualRotation(object, axis, displayDegrees);
                    object.rotation[axis] = radians;
                    
                    // Mettre à jour l'affichage avec la valeur normalisée
                    e.target.value = this.getDisplayRotation(object, axis).toFixed(2);
                    
                    this.app.addToHistory('modify', object);
                    
                    document.getElementById('command-output').textContent = 
                        `Rotation mise à jour: ${axis.toUpperCase()}=${degrees.toFixed(2)}°`;
                });
            }
        });

        // Cercles - Gestion du rayon et du diamètre
        const radiusInput = document.getElementById('prop-circle-radius');
        const diameterInput = document.getElementById('prop-circle-diameter');
          if (radiusInput && object.geometry && object.geometry.type === 'CircleGeometry') {
            radiusInput.addEventListener('change', (e) => {
                const newRadiusCm = Math.max(0.1, parseFloat(e.target.value) || 1);
                const newRadiusM = newRadiusCm / 100; // Convertir cm en mètres
                this.updateCircleGeometry(object, newRadiusM);
                
                // Mettre à jour le diamètre dans l'interface (en cm)
                if (diameterInput) {
                    diameterInput.value = (newRadiusCm * 2).toFixed(2);
                }
                
                document.getElementById('command-output').textContent = 
                    `Rayon mis à jour: ${newRadiusCm.toFixed(2)} cm`;
            });
        }
        
        if (diameterInput && object.geometry && object.geometry.type === 'CircleGeometry') {
            diameterInput.addEventListener('change', (e) => {
                const newDiameterCm = Math.max(0.2, parseFloat(e.target.value) || 2);
                const newRadiusCm = newDiameterCm / 2;
                const newRadiusM = newRadiusCm / 100; // Convertir cm en mètres
                this.updateCircleGeometry(object, newRadiusM);
                
                // Mettre à jour le rayon dans l'interface (en cm)
                if (radiusInput) {
                    radiusInput.value = newRadiusCm.toFixed(2);
                }
                
                document.getElementById('command-output').textContent = 
                    `Diamètre mis à jour: ${newDiameterCm.toFixed(2)} cm`;
            });
        }

        // Dimensions - Modifier la géométrie de l'objet
        ['x', 'y', 'z'].forEach(axis => {            const input = document.getElementById(`prop-dim-${axis}`);
            if (input) {
                input.addEventListener('change', (e) => {
                    const newValueCm = Math.max(0.1, parseFloat(e.target.value) || 1);
                    const newValueM = newValueCm / 100; // Convertir cm en mètres pour Three.js
                    
                    // Pour les rectangles (PlaneGeometry), on modifie la géométrie
                    if (object.geometry && object.geometry.type === 'PlaneGeometry') {
                        const currentGeometry = object.geometry;
                        let newWidth = axis === 'x' ? newValueM : (currentGeometry.parameters?.width || newValueM);
                        let newHeight = axis === 'y' ? newValueM : (currentGeometry.parameters?.height || newValueM);
                        
                        // Créer une nouvelle géométrie avec les nouvelles dimensions (en mètres)
                        const newGeometry = new THREE.PlaneGeometry(newWidth, newHeight);
                        
                        // Remplacer l'ancienne géométrie
                        object.geometry.dispose();
                        object.geometry = newGeometry;
                        
                        // Mettre à jour les userData si elles existent (en mètres)
                        if (object.userData) {
                            if (axis === 'x') object.userData.width = newValueM;
                            if (axis === 'y') object.userData.height = newValueM;
                        }
                        
                        // Recréer les edges si elles existent
                        const edgeObject = object.children.find(child => child.type === 'LineSegments');
                        if (edgeObject) {
                            const edges = new THREE.EdgesGeometry(newGeometry);
                            edgeObject.geometry.dispose();
                            edgeObject.geometry = edges;
                        }
                        
                        document.getElementById('command-output').textContent = 
                            `Dimension mise à jour: ${axis.toUpperCase()}=${newValueCm.toFixed(2)} cm`;
                    } else {
                        // Pour les autres types d'objets, utiliser l'échelle
                        const currentDimensions = this.calculateObjectDimensions(object);
                        const currentValueM = currentDimensions[axis]; // Déjà en mètres
                        const scaleFactor = newValueM / currentValueM;
                        object.scale[axis] = object.scale[axis] * scaleFactor;
                        
                        document.getElementById('command-output').textContent = 
                            `Dimension mise à jour via échelle: ${axis.toUpperCase()}=${newValueCm.toFixed(2)} cm`;
                    }
                    
                    this.app.addToHistory('modify', object);
                    
                    // Recalculer et afficher les nouvelles dimensions
                    this.updatePropertiesPanel(object);                });
            }
        });
        
        // Écouteurs pour les propriétés des lignes
        const lineWidthInput = document.getElementById('prop-line-width');
        if (lineWidthInput) {
            lineWidthInput.addEventListener('change', (e) => {
                const newWidth = Math.max(1, parseInt(e.target.value) || 1);
                if (object.material && object.material.linewidth !== undefined) {
                    object.material.linewidth = newWidth;
                    object.material.needsUpdate = true;
                    
                    this.app.addToHistory('modify', object);
                    
                    document.getElementById('command-output').textContent = 
                        `Épaisseur de ligne mise à jour: ${newWidth}px`;
                }
            });
        }        const lineColorInput = document.getElementById('prop-line-color');
        if (lineColorInput) {
            lineColorInput.addEventListener('change', (e) => {
                const newColor = e.target.value;
                const newColorHex = parseInt(newColor.replace('#', ''), 16);
                
                if (object.material && object.material.color) {
                    // Mettre à jour la couleur originale stockée dans userData AVANT de changer la couleur du matériau
                    object.userData.originalColor = newColorHex;
                    
                    // Mettre à jour la couleur du matériau
                    object.material.color.setHex(newColorHex);
                    object.material.needsUpdate = true;
                    
                    this.app.addToHistory('modify', object);
                    
                    document.getElementById('command-output').textContent = 
                        `Couleur de ligne mise à jour: ${newColor}`;
                }
            });
        }
        
        const lineStyleInput = document.getElementById('prop-line-style');
        if (lineStyleInput) {
            lineStyleInput.addEventListener('change', (e) => {
                const newStyle = e.target.value;
                if (object.material) {
                    this.updateLineStyle(object, newStyle);
                    
                    this.app.addToHistory('modify', object);
                    
                    document.getElementById('command-output').textContent = 
                        `Style de ligne mis à jour: ${newStyle}`;
                }
            });
        }
    }    /**
     * Met à jour le style d'une ligne (solide, tirets, pointillés)
     * @param {THREE.Line} lineObject - L'objet ligne à modifier
     * @param {string} style - Le nouveau style ('solid', 'dashed', 'dotted')
     */
    updateLineStyle(lineObject, style) {
        if (!lineObject.material) {
            console.warn('L\'objet n\'a pas de matériau valide');
            return;
        }
        
        const currentMaterial = lineObject.material;
        const currentColor = currentMaterial.color.getHex();
        const currentLinewidth = currentMaterial.linewidth || 1;
        
        let newMaterial;
          switch (style) {
            case 'solid':
                newMaterial = new THREE.LineBasicMaterial({
                    color: currentColor,
                    linewidth: currentLinewidth,
                    transparent: currentMaterial.transparent,
                    opacity: currentMaterial.opacity
                });
                break;
                
            case 'dashed':
                newMaterial = new THREE.LineDashedMaterial({
                    color: currentColor,
                    linewidth: currentLinewidth,
                    transparent: currentMaterial.transparent,
                    opacity: currentMaterial.opacity,
                    dashSize: 3,
                    gapSize: 1,
                    scale: 1
                });
                break;
                
            case 'dotted':
                newMaterial = new THREE.LineDashedMaterial({
                    color: currentColor,
                    linewidth: currentLinewidth,
                    transparent: currentMaterial.transparent,
                    opacity: currentMaterial.opacity,
                    dashSize: 0.3,
                    gapSize: 0.3,
                    scale: 1
                });
                break;
                
            case 'dashdot':
                newMaterial = new THREE.LineDashedMaterial({
                    color: currentColor,
                    linewidth: currentLinewidth,
                    transparent: currentMaterial.transparent,
                    opacity: currentMaterial.opacity,
                    dashSize: 3,
                    gapSize: 0.5,
                    scale: 1
                });
                break;            case 'axis':
                newMaterial = new THREE.LineDashedMaterial({
                    color: currentColor,
                    linewidth: currentLinewidth,
                    transparent: currentMaterial.transparent,
                    opacity: currentMaterial.opacity,
                    dashSize: 2.5,
                    gapSize: 0.8,
                    scale: 1
                });
                break;
                
            case 'hidden':
                newMaterial = new THREE.LineDashedMaterial({
                    color: currentColor,
                    linewidth: currentLinewidth,
                    transparent: true,
                    opacity: 0.4,
                    dashSize: 2,
                    gapSize: 2,
                    scale: 1
                });
                break;
                
            default:
                console.warn('Style de ligne non reconnu:', style);
                return;
        }
        
        // Remplacer le matériau
        currentMaterial.dispose();
        lineObject.material = newMaterial;
        
        // Pour les matériaux en tirets/pointillés, recalculer les distances
        if (newMaterial instanceof THREE.LineDashedMaterial) {
            lineObject.computeLineDistances();
        }
        
        // Marquer le matériau comme nécessitant une mise à jour
        newMaterial.needsUpdate = true;
    }

    /**
     * Met à jour la géométrie d'un cercle avec un nouveau rayon
     * @param {THREE.Mesh} circleObject - L'objet cercle à modifier
     * @param {number} newRadius - Le nouveau rayon
     */
    updateCircleGeometry(circleObject, newRadius) {
        if (!circleObject.geometry || circleObject.geometry.type !== 'CircleGeometry') {
            console.warn('L\'objet n\'est pas un cercle valide');
            return;
        }
        
        // Créer une nouvelle géométrie avec le nouveau rayon
        const newGeometry = new THREE.CircleGeometry(newRadius, 32);
        
        // Remplacer l'ancienne géométrie
        circleObject.geometry.dispose();
        circleObject.geometry = newGeometry;
        
        // Mettre à jour les userData si elles existent
        if (circleObject.userData) {
            circleObject.userData.radius = newRadius;
        }
        
        // Recréer les edges si elles existent
        const edgeObject = circleObject.children.find(child => child.type === 'LineSegments');
        if (edgeObject) {
            const edges = new THREE.EdgesGeometry(newGeometry);
            edgeObject.geometry.dispose();
            edgeObject.geometry = edges;
        }
        
        // Ajouter à l'historique
        this.app.addToHistory('modify', circleObject);
    }    setupColorPalette() {
        const colors = [
            { name: 'Rouge foncé', hex: '#CC0000' },
            { name: 'Brun clair', hex: '#D2B48C' },
            { name: 'Brun', hex: '#8B4513' },
            { name: 'Gris ardoise foncé', hex: '#2F4F4F' },
            { name: 'Noir', hex: '#000000' },
            { name: 'Gris clair', hex: '#D3D3D3' },
            { name: 'Gris foncé', hex: '#A9A9A9' },
            { name: 'Gris terne', hex: '#696969' },
            { name: 'Beige', hex: '#F5F5DC' },
            { name: 'Jaune clair', hex: '#FFFFE0' },            { name: 'Vert clair', hex: '#90EE90' },
            { name: 'Blanc', hex: '#FFFFFF' }
        ];

        const colorPalette = document.getElementById('color-palette');
        if (!colorPalette) {
            console.warn('Élément color-palette non trouvé');
            return;
        }
        
        console.log('Configuration de la palette de couleurs, élément trouvé:', colorPalette);
        
        // Nettoyer la palette existante
        colorPalette.innerHTML = '';
        
        colors.forEach((color, index) => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            colorItem.style.backgroundColor = color.hex;
            colorItem.title = color.name;
            
            colorItem.addEventListener('click', () => {
                this.selectTexture(colorItem, color, 'color');
            });
            
            colorPalette.appendChild(colorItem);
            console.log(`Couleur ajoutée [${index}]:`, color.name, color.hex);
        });
        
        // Configuration de la couleur personnalisée
        const customColorPicker = document.getElementById('custom-color-picker');




        const applyCustomBtn = document.getElementById('apply-custom-color');
        
        if (applyCustomBtn && customColorPicker) {
            applyCustomBtn.addEventListener('click', () => {
                const customColor = {
                    name: 'Couleur personnalisée',
                    hex: customColorPicker.value
                };
                this.selectTexture(null, customColor, 'color');
            });
        }
        
        console.log('Palette de couleurs configurée');
    }
    
    selectTexture(element, material, type) {
        // Désélectionner les autres éléments
        document.querySelectorAll('.texture-item, .color-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Sélectionner l'élément actuel
        if (element) {
            element.classList.add('selected');
        }
        
        this.app.selectedTexture = material;
        this.app.selectedTextureType = type;
        this.app.textureApplyMode = true;
        
        // Changer le curseur et les instructions
        document.body.classList.add('texture-apply-mode');
        const instruction = document.getElementById('texture-instruction');
        if (instruction) {
            instruction.textContent = `${type === 'texture' ? 'Texture' : 'Couleur'} "${material.name}" sélectionnée. Cliquez sur un objet pour l'appliquer.`;
            instruction.classList.add('texture-instruction');
        }
        
        console.log(`${type} sélectionné(e): ${material.name}`);
    }
      setupTextureTabs() {
        const tabs = document.querySelectorAll('.texture-tab');
        const panels = document.querySelectorAll('.tab-panel');
        
        console.log('Configuration des onglets texture, nombre trouvés:', tabs.length);
        
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = tab.getAttribute('data-tab');
                console.log('Onglet cliqué:', targetTab);
                
                // Mettre à jour les onglets actifs
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Afficher le bon panneau
                const texturesPanel = document.getElementById('textures-tab');
                const colorsPanel = document.getElementById('colors-tab');
                
                if (targetTab === 'textures') {
                    texturesPanel.style.display = 'block';
                    colorsPanel.style.display = 'none';
                    texturesPanel.classList.add('active');
                    colorsPanel.classList.remove('active');
                } else if (targetTab === 'colors') {
                    texturesPanel.style.display = 'none';
                    colorsPanel.style.display = 'block';
                    texturesPanel.classList.remove('active');
                    colorsPanel.classList.add('active');
                }
                
                // Annuler le mode texture si actif
                if (this.cancelTextureMode) {
                    this.cancelTextureMode();
                }
            });
        });
        
        console.log('Onglets texture configurés');
    }
    
    cancelTextureMode() {
        if (this.app) {
            this.app.selectedTexture = null;
            this.app.textureApplyMode = false;
            this.app.selectedTextureType = null;
        }
        
        document.body.classList.remove('texture-apply-mode');
        document.querySelectorAll('.texture-item, .color-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const instruction = document.getElementById('texture-instruction');
        if (instruction) {
            instruction.textContent = 'Sélectionnez une texture/couleur puis cliquez sur un objet pour l\'appliquer';
            instruction.classList.remove('texture-instruction');
        }
        
        console.log('Mode texture/couleur annulé');
    }      setupElementsLibrary() {
        console.log('Setting up elements library...');
        
        // Charger les éléments depuis ElementsLibrary
        if (this.app.elementsLibrary) {
            console.log('ElementsLibrary found, converting data...');
            console.log('ElementsLibrary config:', this.app.elementsLibrary.elementsConfig);
            
            this.elementsData = this.convertElementsLibraryToUIData(this.app.elementsLibrary);
            console.log('Converted elements data:', this.elementsData);
        } else {
            console.warn('ElementsLibrary not available, using fallback data');
            // Données de secours uniquement pour la brique M50
            this.elementsData = {
                briques: [
                    {
                        name: 'Brique M50',
                        dims: { x: 19, y: 9, z: 5 },
                        color: '#B87333',
                        type: 'glb',
                        path: '1_1_1.glb',
                        category: 'briques',
                        cuts: [
                            { label: '1/1', value: 19 },
                            { label: '3/4', value: 14 },
                            { label: '1/2', value: 9 },
                            { label: '1/4', value: 4 },
                            { label: 'personnalisée', value: null }
                        ],
                        currentCut: 19
                    }
                ]
            };
        }        this.selectedElement = null;
        this.currentCategory = 'briques';
        this.previewRenderer = null;
        this.previewScenes = new Map();
        this.animationId = null;
        
        // Afficher directement la première catégorie d'éléments
        this.showCategory('briques');
        
        // Configurer les onglets de catégorie
        const categoryTabs = document.querySelectorAll('.category-tab');
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.getAttribute('data-category');
                this.showCategory(category);
            });
        });
        
        const addElementBtn = document.getElementById('add-element-to-scene');
        if (addElementBtn) {
            addElementBtn.addEventListener('click', () => this.addSelectedElementToScene());
        }
          console.log('Bibliothèque d\'éléments configurée avec', Object.keys(this.elementsData).length, 'catégories');
    }

    /**
     * Convertit les données de ElementsLibrary au format attendu par l'UI
     */    convertElementsLibraryToUIData(elementsLibrary) {
        const uiData = {};
        
        for (const [category, elements] of Object.entries(elementsLibrary.elementsConfig)) {
            console.log(`🔍 Traitement de la catégorie: ${category}`);
            uiData[category] = [];
            // Fonction récursive pour parcourir sous-catégories
            const parseElements = (obj, subCategory = null) => {
                for (const [name, config] of Object.entries(obj)) {
                    if (config && typeof config === 'object' && config.dims) {                        const element = {
                            name: name,
                            dims: config.dims,
                            color: this.hexColorFromNumber(config.color),
                            type: config.type || 'css', // Utiliser le type spécifié ou 'css' par défaut
                            path: config.path,
                            modelPath: config.modelPath, // Ajouter modelPath pour les outils
                            preserveMaterials: config.preserveMaterials, // Ajouter preserveMaterials
                            category: category,
                            subCategory: subCategory,
                            transparent: config.transparent || false,
                            opacity: config.opacity || 1.0,
                            preview: config.preview || null
                        };
                        if (config.cuts) {
                            element.cuts = this.convertCutsToUIFormat(config.cuts, config.dims);
                            element.currentCut = config.dims.x;
                        }
                        if (config.customCut) {
                            element.customCut = true;
                        }
                        uiData[category].push(element);
                    } else if (config && typeof config === 'object') {
                        // Sous-catégorie
                        parseElements(config, name);
                    }
                }
            };
            parseElements(elements);        }
        
        console.log(`📊 Données UI converties:`, Object.keys(uiData));
        return uiData;
    }    /**
     * Convertit un nombre de couleur en chaîne hexadécimale
     */
    hexColorFromNumber(colorNumber) {
        if (typeof colorNumber === 'string') {
            return colorNumber.startsWith('#') ? colorNumber : '#' + colorNumber;
        }
        return '#' + colorNumber.toString(16).padStart(6, '0').toUpperCase();
    }

    /**
     * Convertit les coupes de la configuration en format UI
     */
    convertCutsToUIFormat(cuts, dims) {
        const uiCuts = [];
        
        for (const cut of cuts) {
            if (typeof cut === 'number') {
                // Coupes prédéfinies (1, 0.75, 0.5, 0.25)
                const value = Math.round(dims.x * cut);
                let label;
                if (cut === 1) label = '1/1';
                else if (cut === 0.75) label = '3/4';
                else if (cut === 0.5) label = '1/2';
                else if (cut === 0.25) label = '1/4';
                else label = cut.toString();
                
                uiCuts.push({ label, value });
            } else if (cut === 'custom') {
                uiCuts.push({ label: 'personnalisée', value: null });
            } else if (cut === 'width_custom') {
                uiCuts.push({ label: 'largeur personnalisée', value: null });
            } else if (cut === 'height_custom') {
                uiCuts.push({ label: 'hauteur personnalisée', value: null });
            }
        }
        
        return uiCuts;
    }
    
    // Method to force refresh elements library - useful for debugging
    refreshElementsLibrary() {
        console.log('Forcing elements library refresh...');
        this.setupElementsLibrary();
        if (this.currentCategory) {
            this.showCategory(this.currentCategory);
        }
    }
    
    /**
     * Affiche les éléments d'une catégorie donnée dans la grille
     * @param {string} category - La catégorie à afficher (briques, blocs, etc.)
     */    showCategory(category, subCategoryFilter = null) {
        console.log(`Affichage de la catégorie ${category}`);
        
        // Réinitialiser l'état de sélection lors du changement d'onglet
        this.selectedElement = null;
        this.currentCategory = category;
        
        // Cacher le panneau d'options globalement
        const globalOptionsPanel = document.getElementById('element-options');
        if (globalOptionsPanel) {
            globalOptionsPanel.style.display = 'none';
        }
        
        // Mettre à jour les onglets actifs
        document.querySelectorAll('.category-tab').forEach(tab => {
            if (tab.getAttribute('data-category') === category) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        // Sous-onglets dynamiques
        const subcatContainer = document.getElementById('element-subcategories');
        if (subcatContainer) {
            subcatContainer.innerHTML = '';
            const elements = this.elementsData[category] || [];
            // Extraire la liste unique des sous-catégories
            const subcats = [...new Set(elements.map(e => e.subCategory).filter(Boolean))];
            if (subcats.length > 0) {
                subcats.forEach((sub, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'subcategory-tab' + (subCategoryFilter === sub || (!subCategoryFilter && idx === 0) ? ' active' : '');
                    btn.textContent = sub;
                    btn.style.cssText = 'background:#e6eaf2;border:none;border-radius:4px;padding:6px 16px;font-size:13px;cursor:pointer;transition:background 0.2s;';
                    btn.onclick = () => {
                        document.querySelectorAll('.subcategory-tab').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        this.showCategory(category, sub);
                    };
                    subcatContainer.appendChild(btn);
                });
            }
        }
        // Récupérer la grille
        const grid = document.getElementById('elements-grid');
        if (!grid) {
            console.error('Grid container not found');
            return;
        }
        this.cleanupPreviews();
        grid.innerHTML = '';
        if (!this.elementsData) {
            const message = document.createElement('div');
            message.className = 'empty-category-message';
            message.textContent = 'Chargement des données...';
            grid.appendChild(message);
            return;
        }
        const elements = this.elementsData[category] || [];
        // Filtrer par sous-catégorie si besoin
        let filtered = elements;
        if (subCategoryFilter) {
            filtered = elements.filter(e => e.subCategory === subCategoryFilter);
        } else {
            // Si sous-catégories existent, afficher la première par défaut
            const subcats = [...new Set(elements.map(e => e.subCategory).filter(Boolean))];
            if (subcats.length > 0) {
                filtered = elements.filter(e => e.subCategory === subcats[0]);
            }
        }
        if (filtered.length === 0) {
            const message = document.createElement('div');
            message.className = 'empty-category-message';
            message.textContent = 'Aucun élément dans cette sous-catégorie';
            grid.appendChild(message);
            return;        }        
        console.log(`Nombre d'éléments filtrés à afficher: ${filtered.length}`);
        filtered.forEach(element => {
            console.log(`Création de l'élément: ${element.name}`);
            const elementDiv = document.createElement('div');
            elementDiv.className = 'element-item';
            
            const previewDiv = document.createElement('div');
            previewDiv.className = 'element-preview';
            previewDiv.dataset.elementId = this.generateElementId(element);
              if (element.type === 'glb' && (element.path || element.modelPath)) {
                console.log(`Création placeholder pour élément GLB: ${element.name}, path: ${element.path}, modelPath: ${element.modelPath}`);
                // Créer un placeholder au lieu de charger immédiatement
                this.createPreviewPlaceholder(element, previewDiv);
                
                // Observer cet élément pour le chargement à la demande
                if (this.intersectionObserver) {
                    this.intersectionObserver.observe(previewDiv);
                }
            } else {
                console.log(`Création aperçu CSS pour élément: ${element.name}, type: ${element.type}`);
                // Pour les aperçus CSS, charger immédiatement (pas lourd)
                this.createCSSPreview(element, previewDiv);
            }
            elementDiv.appendChild(previewDiv);
            const infoDiv = document.createElement('div');
            infoDiv.className = 'element-info';
            const isOBJ = element.type === 'obj';
            const typeIndicator = isOBJ ? ' <span style="color: #007acc; font-size: 10px;">(3D)</span>' : '';
            infoDiv.innerHTML = `
                <div class="element-name">${element.name}${typeIndicator}</div>
                <div class="element-description" style="font-size: 10px; color: #666; text-align: center;">${element.description || ''}</div>
                <div class="element-dims">${element.dims.x}×${element.dims.y}×${element.dims.z} cm</div>
            `;
            elementDiv.appendChild(infoDiv);            elementDiv.addEventListener('click', () => {
                // Désélectionner tous les éléments de la grille
                grid.querySelectorAll('.element-item').forEach(item => {
                    item.classList.remove('selected');
                    item.style.borderColor = '#ddd';
                    item.style.boxShadow = 'none';
                });
                
                // Sélectionner l'élément cliqué
                elementDiv.classList.add('selected');
                elementDiv.style.borderColor = '#007acc';
                elementDiv.style.boxShadow = '0 2px 8px rgba(0,122,204,0.3)';
                
                // Sauvegarder l'élément sélectionné
                this.selectedElement = {
                    ...element,
                    key: element.name.toLowerCase(),
                    category: category
                };                // Afficher le panneau d'options
                this.showElementOptions(element);
            });
            elementDiv.style.cssText = `
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 10px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
                background: #404040;
                min-height: 100px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            `;
            elementDiv.addEventListener('mouseenter', () => {
                if (!elementDiv.classList.contains('selected')) {
                    elementDiv.style.borderColor = '#007acc';
                    elementDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                }
            });
            elementDiv.addEventListener('mouseleave', () => {
                if (!elementDiv.classList.contains('selected')) {
                    elementDiv.style.borderColor = '#ddd';
                    elementDiv.style.boxShadow = 'none';
                }
            });
            grid.appendChild(elementDiv);
        });
        return;
    }
    
    /**
     * Crée un placeholder pour l'aperçu en attendant le chargement
     * @param {Object} element - Données de l'élément
     * @param {HTMLElement} previewDiv - Conteneur de l'aperçu
     */    createPreviewPlaceholder(element, previewDiv) {
        // Créer un placeholder simple pour les aperçus GLB
        const placeholder = document.createElement('div');
        placeholder.style.cssText = `
            width: 100%;
            height: 100%;
            background: rgb(64, 64, 64);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ccc;
            font-size: 11px;
            text-align: center;
            border-radius: 4px;
            position: relative;
        `;
        
        // Ajouter une icône de chargement
        placeholder.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 18px; margin-bottom: 4px;">📦</div>
                <div>Aperçu 3D</div>
            </div>
        `;
        
        previewDiv.appendChild(placeholder);
    }    createCSSPreview(element, previewDiv) {
        // Créer un aperçu CSS simple pour les éléments sans modèle GLB
        const cssPreview = document.createElement('div');
        cssPreview.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            background: rgb(64, 64, 64);
            border-radius: 4px;
        `;
        
        // Créer une représentation 3D simple avec CSS
        const cube = document.createElement('div');
        const aspectRatio = Math.max(element.dims.x, element.dims.y, element.dims.z);
        const scaleX = (element.dims.x / aspectRatio) * 40;
        const scaleY = (element.dims.z / aspectRatio) * 40;
        const scaleZ = (element.dims.y / aspectRatio) * 40;
        
        // Déterminer la couleur selon le type d'élément
        let color = '#ffffff';
        if (element.category === 'blocs') {
            if (element.name.toLowerCase().includes('terre cuite')) {
                color = '#CC4500'; // orange-rouge pour terre cuite
            } else {
                color = '#ffffff'; // blanc pour béton cellulaire
            }
        }
        
        cube.style.cssText = `
            width: ${scaleX}px;
            height: ${scaleY}px;
            background: ${color};
            border: 1px solid #ccc;
            border-radius: 2px;
            box-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            position: relative;
        `;
        
        // Ajouter un effet de profondeur
        const depth = document.createElement('div');
        depth.style.cssText = `
            position: absolute;
            top: -3px;
            left: 3px;
            width: 100%;
            height: 100%;
            background: ${color};
            border: 1px solid #aaa;
            border-radius: 2px;
            z-index: -1;
            filter: brightness(0.8);
        `;
        cube.appendChild(depth);
        
        cssPreview.appendChild(cube);
        previewDiv.appendChild(cssPreview);
    }

    /**
     * Crée un aperçu 3D pour un élément (appelé par le système de chargement à la demande)
     * @param {Object} element - Données de l'élément
     * @param {HTMLElement} previewDiv - Conteneur de l'aperçu
     */
    async createElementPreview(element, previewDiv) {
        if (element.type === 'glb' && element.path) {
            await this.createGLBPreview(element, previewDiv);
        } else {
            this.createCSSPreview(element, previewDiv);
        }
    }    addEdgesToModel(model, scene) {
        // Récupérer le modèle original depuis le groupe
        const originalModel = model.userData.originalModel;
        if (!originalModel) {
            console.warn('Original model not found in group');
            return;
        }
        
        // Forcer la mise à jour des matrices de transformation
        originalModel.updateMatrixWorld(true);
        
        // Créer un groupe pour les arêtes qui sera ajouté au groupe parent
        const edgesGroup = new THREE.Group();
        edgesGroup.name = 'edges';
        
        // Parcourir tous les mesh du modèle GLB et ajouter les arêtes
        originalModel.traverse((child) => {
            if (child.isMesh && child.geometry) {
                try {
                    // Créer les arêtes à partir de la géométrie du mesh
                    const edges = new THREE.EdgesGeometry(child.geometry, 30);
                    const edgesMaterial = new THREE.LineBasicMaterial({ 
                        color: 0x000000, 
                        linewidth: 2,
                        transparent: true,
                        opacity: 0.8
                    });
                    const wireframe = new THREE.LineSegments(edges, edgesMaterial);
                    
                    // Appliquer les mêmes transformations locales que le mesh
                    wireframe.position.copy(child.position);
                    wireframe.rotation.copy(child.rotation);
                    wireframe.scale.copy(child.scale);
                    
                    // Ajouter au groupe d'arêtes
                    edgesGroup.add(wireframe);
                    
                    console.log(`Added edges to mesh: ${child.name || 'unnamed'}`);
                } catch (error) {
                    console.warn(`Could not add edges to mesh:`, error);
                }
            }
        });
        
        // Appliquer les mêmes transformations que le modèle original
        edgesGroup.position.copy(originalModel.position);
        edgesGroup.rotation.copy(originalModel.rotation);
        edgesGroup.scale.copy(originalModel.scale);
        
        // Ajouter le groupe d'arêtes au groupe parent (pas à la scène)
        model.add(edgesGroup);
        
        // Stocker une référence vers le groupe d'arêtes
        model.userData.edgesGroup = edgesGroup;
    }    showElementOptions(element) {
        console.log('=== OUVERTURE DU MENU D\'OPTIONS ===');
        console.log('Élément sélectionné:', element.name);
        console.log('Dimensions:', element.dims);        // Fonction pour déterminer les options de coupe selon l'élément
        const getCutOptions = (element) => {
            const category = element.category;
            const name = element.name ? element.name.toLowerCase() : '';
            const dims = element.dims;
            
            // Vérifier la configuration de l'élément pour les propriétés spéciales
            const config = this.app.elementsLibrary?.elementsConfig[category]?.[element.name];
            
            // Gestion spéciale pour les poutres avec sélecteur de profil
            if (category === 'poutres' && config && config.profiles && config.profilePaths) {
                return {
                    type: 'profile-selector',
                    profiles: config.profiles,
                    profilePaths: config.profilePaths,
                    currentProfile: config.profiles[0], // Profil par défaut
                    scalable: true,
                    defaultLength: config.baseLength || dims.y,
                    minLength: config.minLength || 50,
                    maxLength: config.maxLength || 1200,
                    stepLength: config.stepLength || 10,
                    scaleAxis: config.scaleAxis || 'y',
                    unit: 'cm',
                    predefined: [
                        { length: 100, label: '100cm' },
                        { length: 200, label: '200cm' },
                        { length: 300, label: '300cm' },
                        { length: 400, label: '400cm' },
                        { length: 600, label: '600cm' },
                        { length: 800, label: '800cm' }
                    ]
                };
            }
            
            // Gestion spéciale pour le profil configurable
            if (config && config.configurableLength && name.includes('profil')) {
                return {
                    type: 'configurable-profile',
                    configurableLength: true,
                    defaultLength: config.defaultLength || dims.z,
                    minLength: config.minLength || 10,
                    maxLength: config.maxLength || 500,
                    stepLength: 5,
                    unit: 'cm',
                    axis: 'z', // La longueur se configure sur l'axe Z
                    predefined: [
                        { length: 50, label: '50cm' },
                        { length: 100, label: '100cm' },
                        { length: 200, label: '200cm' },
                        { length: 300, label: '300cm' },
                        { length: 400, label: '400cm' }
                    ]
                };
            }
            
            // Gestion spéciale pour les hourdis (planchers)
            if (category === 'planchers' || name.includes('hourdis')) {
                return {
                    type: 'scalable',
                    scalable: true,
                    defaultLength: dims.x,
                    minLength: 10,
                    maxLength: 800,
                    stepLength: 5,
                    unit: 'cm',
                    predefined: [
                        { length: 40, label: '40cm' },
                        { length: 60, label: '60cm' },
                        { length: 120, label: '120cm' },
                        { length: 240, label: '240cm' },
                        { length: 480, label: '480cm' }
                    ]
                };
            }
              // Pas de coupe pour linteaux, isolants (mais profils sont maintenant configurables dans outils)
            if (category === 'linteaux' || category === 'isolants' || 
                name.includes('linteau') || name.includes('isolant')) {
                return null; // Pas d'options de coupe
            }
            
            // Briques avec longueurs spécifiques
            if (category === 'briques' || name.includes('brique')) {
                if (dims.x === 19) {
                    // Briques 19cm : 1/1=19cm, 3/4=14cm, 1/2=9cm, 1/4=4cm
                    return {
                        predefined: [
                            { ratio: 1, length: 19, label: '1/1' },
                            { ratio: 14/19, length: 14, label: '3/4' },
                            { ratio: 9/19, length: 9, label: '1/2' },
                            { ratio: 4/19, length: 4, label: '1/4' }
                        ],
                        custom: true
                    };
                } else if (dims.x === 21) {
                    // Briques 21cm : 1/1=21cm, 3/4=16.5cm, 1/2=10cm, 1/4=4.5cm
                    return {
                        predefined: [
                            { ratio: 1, length: 21, label: '1/1' },
                            { ratio: 16.5/21, length: 16.5, label: '3/4' },
                            { ratio: 10/21, length: 10, label: '1/2' },
                            { ratio: 4.5/21, length: 4.5, label: '1/4' }
                        ],
                        custom: true
                    };
                }
            }
            
            // Blocs béton creux 39cm
            if ((category === 'blocs' || name.includes('bloc')) && dims.x === 39) {
                if (name.includes('creux') || name.includes('b9') || name.includes('b14') || 
                    name.includes('b19') || name.includes('b29') || name.includes('argex')) {
                    // Blocs béton creux : 1/1=39cm, 3/4=29cm, 1/2=19cm, 1/4=9cm
                    return {
                        predefined: [
                            { ratio: 1, length: 39, label: '1/1' },
                            { ratio: 29/39, length: 29, label: '3/4' },
                            { ratio: 19/39, length: 19, label: '1/2' },
                            { ratio: 9/39, length: 9, label: '1/4' }
                        ],
                        custom: true
                    };
                }
            }
            
            // Blocs béton cellulaire, terre cuite assises : garder le système actuel (ratios)
            if ((category === 'blocs' || name.includes('bloc')) && 
                (name.includes('cell') || name.includes('assise') || name.includes('terre cuite'))) {
                return {
                    predefined: [
                        { ratio: 1, length: dims.x, label: '1/1' },
                        { ratio: 0.75, length: dims.x * 0.75, label: '3/4' },
                        { ratio: 0.5, length: dims.x * 0.5, label: '1/2' },
                        { ratio: 0.25, length: dims.x * 0.25, label: '1/4' }
                    ],
                    custom: true
                };
            }
            
            // Défaut : pas d'options de coupe
            return null;
        };
          const cutOptions = getCutOptions(element);
        
        // Calculer les propriétés géométriques de l'élément
        let elementProperties = null;
        if (this.app.elementsLibrary) {
            elementProperties = this.app.elementsLibrary.calculateElementProperties(
                element.name, 
                element.category, 
                element.dims
            );
        }
        
        // Variables pour les options de coupe
        let selectedCutLength = element.dims.x; // Par défaut longueur complète
        
        // Supprimer d'abord tout gestionnaire clickOutside existant
        if (this.currentClickOutsideHandler) {
            document.removeEventListener('click', this.currentClickOutsideHandler);
            this.currentClickOutsideHandler = null;
        }
        
        // Créer ou récupérer le panneau d'options
        let optionsPanel = document.getElementById('element-options-panel');
        if (!optionsPanel) {
            optionsPanel = document.createElement('div');
            optionsPanel.id = 'element-options-panel';
            optionsPanel.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2d2d2d;
                border: 1px solid #555;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                z-index: 1000;
                color: #e0e0e0;
                min-width: 300px;
                max-width: 400px;
            `;
            document.body.appendChild(optionsPanel);
        }        // Contenu du panneau
        optionsPanel.innerHTML = `            <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px;">
                ${element.name}
            </h3>
            
            <!-- Propriétés géométriques -->
            <div style="margin-bottom: 20px; padding: 10px; background: #333; border-radius: 4px; font-size: 12px; color: #ccc;">
                <div style="margin-bottom: 8px;">
                    <strong style="color: #fff;">Dimensions:</strong> ${element.dims.x}×${element.dims.y}×${element.dims.z} cm
                </div>                ${elementProperties ? `
                <div style="margin-bottom: 5px;" data-property="volume">
                    <strong style="color: #fff;">Volume:</strong> ${elementProperties.volume.formatted}
                </div>
                <div style="color: #999; font-size: 11px; font-style: italic;" class="usage-description">
                    ${elementProperties.utilisationTypique}
                </div>
                ` : ''}
            </div>
            
            <!-- Aperçu dynamique de l'élément -->
            <div style="margin-bottom: 20px; text-align: center;">
                <label style="display: block; margin-bottom: 8px; color: #fff; font-size: 14px; font-weight: bold;">
                    Aperçu de l'élément :
                </label>                <div id="element-preview-container" style="
                    width: 300px;
                    height: 300px;
                    background: rgb(64,64,64);
                    border: 1px solid #555;
                    border-radius: 4px;
                    margin: 0 auto;
                    position: relative;
                    overflow: hidden;
                ">
                    <canvas id="element-preview-canvas" width="300" height="300" style="
                        width: 100%;
                        height: 100%;
                        display: block;
                    "></canvas>
                </div>
                </div>
            </div>            <!-- Options de coupe ou de longueur -->
            ${cutOptions ? `
            <div style="margin-bottom: 20px;">
                ${cutOptions.type === 'profile-selector' ? `
                <!-- Interface pour poutres avec sélecteur de profil -->
                <label style="display: block; margin-bottom: 8px; color: #fff; font-size: 14px; font-weight: bold;">
                    Type de profil :
                </label>
                <select id="profile-selector" style="
                    width: 100%;
                    padding: 8px;
                    background: #333;
                    color: white;
                    border: 1px solid #666;
                    border-radius: 4px;
                    font-size: 12px;
                    margin-bottom: 15px;
                ">
                    ${cutOptions.profiles.map(profile => `
                        <option value="${profile}" ${profile === cutOptions.currentProfile ? 'selected' : ''}>
                            ${profile}
                        </option>
                    `).join('')}
                </select>
                
                <label style="display: block; margin-bottom: 8px; color: #fff; font-size: 14px; font-weight: bold;">
                    Longueur de la poutre :
                </label>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px;">
                    ${cutOptions.predefined.map(preset => `
                        <button class="profile-length-option" data-length="${preset.length}" style="
                            padding: 8px 4px;
                            background: #444;
                            color: white;
                            border: 1px solid #666;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            transition: all 0.2s;
                        ">${preset.label}</button>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
                    <span style="color: #ccc; font-size: 12px; flex-shrink: 0;">Longueur personnalisée:</span>
                    <input type="number" id="custom-profile-length-input" 
                           placeholder="${cutOptions.defaultLength}" 
                           min="${cutOptions.minLength}" 
                           max="${cutOptions.maxLength}" 
                           step="${cutOptions.stepLength}" 
                           value="${cutOptions.defaultLength}" style="
                        flex: 1;
                        padding: 6px 8px;
                        background: #333;
                        color: white;
                        border: 1px solid #666;
                        border-radius: 4px;
                        font-size: 12px;
                    ">
                    <span style="color: #ccc; font-size: 12px;">${cutOptions.unit}</span>
                </div>
                <div style="font-size: 11px; color: #999; margin-bottom: 10px;">
                    Longueur: ${cutOptions.minLength}-${cutOptions.maxLength}${cutOptions.unit}, par pas de ${cutOptions.stepLength}${cutOptions.unit}
                </div>
                <div id="profile-info-preview" style="
                    padding: 8px;
                    background: #333;
                    border-radius: 4px;
                    font-size: 11px;
                    color: #ccc;
                    margin-bottom: 10px;
                ">
                    Profil sélectionné: ${cutOptions.currentProfile}<br>
                    Longueur: ${cutOptions.defaultLength}${cutOptions.unit}
                </div>
                ` : cutOptions.type === 'configurable-profile' ? `
                <!-- Interface pour profil avec longueur configurable -->
                <label style="display: block; margin-bottom: 8px; color: #fff; font-size: 14px; font-weight: bold;">
                    Longueur du profil :
                </label>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px;">
                    ${cutOptions.predefined.map(preset => `
                        <button class="profile-length-option" data-length="${preset.length}" style="
                            padding: 8px 4px;
                            background: #444;
                            color: white;
                            border: 1px solid #666;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            transition: all 0.2s;
                        ">${preset.label}</button>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
                    <span style="color: #ccc; font-size: 12px; flex-shrink: 0;">Longueur personnalisée:</span>
                    <input type="number" id="custom-profile-length-input" 
                           placeholder="${cutOptions.defaultLength}" 
                           min="${cutOptions.minLength}" 
                           max="${cutOptions.maxLength}" 
                           step="${cutOptions.stepLength}" 
                           value="${cutOptions.defaultLength}" style="
                        flex: 1;
                        padding: 6px 8px;
                        background: #333;
                        color: white;
                        border: 1px solid #666;
                        border-radius: 4px;
                        font-size: 12px;
                    ">
                    <span style="color: #ccc; font-size: 12px;">${cutOptions.unit}</span>
                </div>
                <div style="font-size: 11px; color: #999; margin-bottom: 10px;">
                    Longueur: ${cutOptions.minLength}-${cutOptions.maxLength}${cutOptions.unit}, par pas de ${cutOptions.stepLength}${cutOptions.unit}
                </div>
                <div id="profile-length-preview" style="
                    padding: 8px;
                    background: #333;
                    border-radius: 4px;
                    font-size: 11px;
                    color: #ccc;
                ">
                    Longueur sélectionnée: ${cutOptions.defaultLength}${cutOptions.unit}
                </div>
                ` : cutOptions.type === 'scalable' ? `
                <!-- Interface pour hourdis avec longueur ajustable -->
                <label style="display: block; margin-bottom: 8px; color: #fff; font-size: 14px; font-weight: bold;">
                    Longueur du hourdis :
                </label>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px;">
                    ${cutOptions.predefined.map(preset => `
                        <button class="length-option" data-length="${preset.length}" style="
                            padding: 8px 4px;
                            background: #444;
                            color: white;
                            border: 1px solid #666;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            transition: all 0.2s;
                        ">${preset.label}</button>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
                    <span style="color: #ccc; font-size: 12px; flex-shrink: 0;">Longueur personnalisée:</span>
                    <input type="number" id="custom-length-input" 
                           placeholder="${cutOptions.defaultLength}" 
                           min="${cutOptions.minLength}" 
                           max="${cutOptions.maxLength}" 
                           step="${cutOptions.stepLength}" 
                           value="${cutOptions.defaultLength}" style="
                        flex: 1;
                        padding: 6px 8px;
                        background: #333;
                        color: white;
                        border: 1px solid #666;
                        border-radius: 4px;
                        font-size: 12px;
                    ">
                    <span style="color: #ccc; font-size: 12px;">${cutOptions.unit}</span>
                </div>
                <div style="font-size: 11px; color: #999; margin-bottom: 10px;">
                    Longueur: ${cutOptions.minLength}-${cutOptions.maxLength}${cutOptions.unit}, par pas de ${cutOptions.stepLength}${cutOptions.unit}
                </div>
                <div id="length-preview" style="
                    padding: 8px;
                    background: #333;
                    border-radius: 4px;
                    font-size: 11px;
                    color: #ccc;
                ">
                    Longueur sélectionnée: ${cutOptions.defaultLength}${cutOptions.unit}
                </div>
                ` : `
                <!-- Interface classique pour coupes -->
                <label style="display: block; margin-bottom: 8px; color: #fff; font-size: 14px; font-weight: bold;">
                    Options de coupe :
                </label>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">
                    ${cutOptions.predefined.map(cut => `
                        <button class="cut-option" data-cut="${cut.ratio}" data-length="${cut.length}" style="
                            padding: 8px 4px;
                            background: #444;
                            color: white;
                            border: 1px solid #666;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            transition: all 0.2s;
                        ">${cut.label}</button>
                    `).join('')}
                </div>
                ${cutOptions.custom ? `
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="custom-cut-btn" style="
                        padding: 8px 12px;
                        background: #444;
                        color: white;
                        border: 1px solid #666;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        transition: all 0.2s;
                        flex-shrink: 0;
                    ">Personnalisé</button>
                    <input type="number" id="custom-cut-input" placeholder="${element.dims.x} cm" min="0.1" max="${element.dims.x}" step="0.1" value="${element.dims.x}" style="
                        flex: 1;
                        padding: 6px 8px;
                        background: #333;
                        color: white;
                        border: 1px solid #666;
                        border-radius: 4px;
                        font-size: 12px;
                        display: none;
                    ">
                    <span id="custom-unit" style="
                        color: #ccc;
                        font-size: 12px;
                        display: none;
                    ">cm</span>
                </div>
                ` : ''}
                <div id="cut-preview" style="
                    margin-top: 10px;
                    padding: 8px;
                    background: #333;
                    border-radius: 4px;
                    font-size: 11px;
                    color: #ccc;
                ">
                    Coupe sélectionnée: 1/1 (dimensions complètes)
                </div>
                `}
            </div>
            ` : ''}
            
            <div style="display: flex; gap: 10px; justify-content: space-between;">
                <button id="place-element-btn" style="
                    flex: 1;
                    padding: 10px;
                    background: #007acc;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">
                    Placer l'élément
                </button>
                <button id="close-options-btn" style="
                    padding: 10px 15px;
                    background: #666;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">
                    Fermer
                </button>
            </div>
        `;          // Afficher le panneau
        optionsPanel.style.display = 'block';
        
        // Variables pour l'aperçu dynamique
        let previewRenderer = null;
        let previewScene = null;
        let previewCamera = null;
        let previewModel = null;
        let previewAnimationId = null;
          // Fonction pour créer l'aperçu 3D
        const createPreview = () => {
            console.log('Création de l\'aperçu 3D...');
            const canvas = document.getElementById('element-preview-canvas');
            if (!canvas) {
                console.error('Canvas element-preview-canvas non trouvé !');
                return;
            }
            console.log('Canvas trouvé:', canvas);
            
            // Nettoyer l'ancien aperçu si existant
            if (previewRenderer) {
                previewRenderer.dispose();
                if (previewAnimationId) {
                    cancelAnimationFrame(previewAnimationId);
                }
            }
            
            try {
                // Créer le renderer
                previewRenderer = new THREE.WebGLRenderer({ 
                    canvas: canvas, 
                    antialias: true,
                    alpha: false
                });
                previewRenderer.setSize(300, 300);
                previewRenderer.setPixelRatio(window.devicePixelRatio || 1);
                previewRenderer.setClearColor(0x404040, 1); // Fond gris foncé
                previewRenderer.shadowMap.enabled = true;
                previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
                console.log('Renderer créé avec succès');
                
                // Créer la scène
                previewScene = new THREE.Scene();
                console.log('Scène créée');
                  // Créer la caméra (même configuration que dans la bibliothèque)
                previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
                
                // Calculer la position de la caméra selon les dimensions (comme dans la bibliothèque)
                const maxDimension = Math.max(element.dims.x, element.dims.y, element.dims.z) / 100;
                const distance = Math.max(maxDimension * 1.5, 0.4); // Distance réduite avec minimum
                
                previewCamera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
                previewCamera.lookAt(0, 0, 0);
                console.log('Caméra créée et positionnée avec distance:', distance);
                
                // Éclairage
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
                previewScene.add(ambientLight);
                
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(5, 5, 5);
                directionalLight.castShadow = true;
                previewScene.add(directionalLight);
                console.log('Éclairage ajouté');
                  // Effectuer un premier rendu pour tester
                previewRenderer.render(previewScene, previewCamera);
                console.log('Premier rendu effectué');
                
                // Charger le modèle GLB avec la longueur complète par défaut
                console.log('Chargement initial du modèle avec longueur complète');
                loadPreviewModel(1.0); // Toujours commencer avec le modèle complet
                
            } catch (error) {
                console.error('Erreur lors de la création de l\'aperçu:', error);
                // Fallback: afficher un message d'erreur dans le canvas
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#404040';
                    ctx.fillRect(0, 0, 300, 300);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Erreur d\'aperçu', 150, 150);
                }
            }
        };        // Fonction pour charger le modèle avec les dimensions de coupe
        const loadPreviewModel = (cutRatio) => {
            console.log('Chargement du modèle avec coupe:', cutRatio);
            
            // Pour les hourdis scalables, utiliser directement loadPreviewModelScalable
            const config = this.app.elementsLibrary?.elementsConfig[element.category]?.[element.name];
            if (config && config.scalable) {
                console.log('Élément scalable détecté, utilisation du modèle spécifique');
                const defaultLength = config.dims.z; // Utiliser la profondeur par défaut
                loadPreviewModelScalable(defaultLength);
                return;
            }
              // Utiliser le modèle spécifique depuis la configuration ou le modèle générique
            const modelPath = config?.modelPath || 'assets/models/1_1_1.glb';
            console.log('Utilisation du modèle:', modelPath, 'avec config:', config);
            
            const loader = new GLTFLoader();
            console.log('Chargement du modèle GLB:', modelPath);
            
            loader.load(
                modelPath, 
                (gltf) => {
                    console.log('Modèle GLB chargé avec succès');
                    
                    // Supprimer l'ancien modèle
                    if (previewModel) {
                        previewScene.remove(previewModel);
                    }
                    
                    const originalModel = gltf.scene.clone();
                    
                    // Calculer les dimensions avec la coupe (même logique que dans la bibliothèque)
                    const cutDims = {
                        x: element.dims.x * cutRatio, // Longueur coupée
                        y: element.dims.y,            // Largeur normale
                        z: element.dims.z             // Hauteur normale
                    };
                    
                    console.log('Dimensions originales:', element.dims);
                    console.log('Dimensions avec coupe:', cutDims);
                    
                    // Calculer la boîte englobante du modèle d'origine
                    const originalBox = new THREE.Box3().setFromObject(originalModel);
                    const originalSize = originalBox.getSize(new THREE.Vector3());
                    
                    // Calculer l'échelle pour correspondre aux dimensions spécifiées (avec coupe)
                    const targetSize = new THREE.Vector3(
                        cutDims.x / 100,  // largeur (avec coupe)
                        cutDims.z / 100,  // hauteur
                        cutDims.y / 100   // profondeur
                    );
                    
                    const scaleX = targetSize.x / originalSize.x;
                    const scaleY = targetSize.y / originalSize.y;
                    const scaleZ = targetSize.z / originalSize.z;
                    
                    console.log('Facteurs d\'échelle:', scaleX, scaleY, scaleZ);
                    
                    // Appliquer l'échelle d'abord
                    originalModel.scale.set(scaleX, scaleY, scaleZ);
                    
                    // Recalculer la boîte englobante après l'échelle
                    const scaledBox = new THREE.Box3().setFromObject(originalModel);
                    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
                    
                    // Centrer le modèle mis à l'échelle à l'origine
                    originalModel.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
                    
                    // Créer un groupe parent pour la rotation
                    const modelGroup = new THREE.Group();
                    modelGroup.add(originalModel);
                    
                    // Stocker une référence vers le modèle original
                    modelGroup.userData.originalModel = originalModel;
                    
                    // Configurer le matériau selon le type d'élément (même que dans la bibliothèque)
                    this.configureMaterialForPreview(originalModel, element);
                    
                    // Ajouter les arêtes (contours) comme dans la bibliothèque
                    this.addEdgesToModel(modelGroup, previewScene);
                    
                    previewModel = modelGroup;
                    previewScene.add(previewModel);
                    
                    console.log('Modèle ajouté à la scène avec les bonnes dimensions');
                    
                    // Démarrer l'animation de rotation
                    animatePreview();
                },
                (progress) => {
                    console.log('Chargement en cours:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Erreur de chargement du modèle GLB:', error);
                    // Créer un cube de test à la place
                    createTestCube(cutRatio);
                }
            );
        };
          // Fonction pour créer un cube de test en cas d'erreur
        const createTestCube = (cutRatio) => {
            console.log('Création d\'un cube de test avec coupe:', cutRatio);
            
            // Supprimer l'ancien modèle
            if (previewModel) {
                previewScene.remove(previewModel);
            }
            
            // Calculer les dimensions avec la coupe selon les vraies dimensions de l'élément
            const cutDims = {
                x: element.dims.x * cutRatio,
                y: element.dims.y,
                z: element.dims.z
            };
              // Créer un cube de test avec les bonnes proportions (en mètres pour Three.js)
            const geometry = new THREE.BoxGeometry(
                cutDims.x / 100,  // largeur avec coupe
                cutDims.z / 100,  // hauteur
                cutDims.y / 100   // profondeur
            );
              // Déterminer la couleur selon la catégorie de l'élément
            const color = this.getMaterialColor(element);
            
            const material = new THREE.MeshLambertMaterial({
                color: color, 
                wireframe: false,
                transparent: true,
                opacity: 0.8
            });
            const cube = new THREE.Mesh(geometry, material);
            
            // Créer les arêtes
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
            const edgesMesh = new THREE.LineSegments(edges, edgeMaterial);
            
            // Créer un groupe
            const testGroup = new THREE.Group();
            testGroup.add(cube);
            testGroup.add(edgesMesh);
            
            previewModel = testGroup;
            previewScene.add(previewModel);
            
            console.log('Cube de test créé et ajouté');
            
            // Démarrer l'animation
            animatePreview();
        };          // Fonction d'animation de l'aperçu
        const animatePreview = () => {
            if (!previewRenderer || !previewScene || !previewCamera) {
                console.warn('Aperçu non initialisé pour l\'animation');
                return;
            }
            
            // Vérifier si le panneau est encore visible
            if (!optionsPanel || optionsPanel.style.display === 'none') {
                console.log('Arrêt de l\'animation - panneau fermé');
                return;
            }
            
            // Rotation lente
            if (previewModel) {
                previewModel.rotation.y += 0.01;
            }
            
            try {
                previewRenderer.render(previewScene, previewCamera);
            } catch (error) {
                console.error('Erreur de rendu:', error);
                return;
            }
            
            previewAnimationId = requestAnimationFrame(animatePreview);        };// Fonction pour mettre à jour l'aperçu des dimensions de coupe
        const updateCutPreview = (cutLength) => {
            const cutPreview = document.getElementById('cut-preview');
            if (!cutPreview) return;
            
            // Seule la longueur (axe X) est affectée par la coupe
            const newDims = {
                x: Math.round(cutLength * 10) / 10,
                y: element.dims.y, // Inchangée
                z: element.dims.z  // Inchangée
            };
            
            // Trouver le label correspondant dans les options prédéfinies
            let ratioText = `${Math.round((cutLength / element.dims.x) * 100)}% (${cutLength} cm)`;
            
            if (cutOptions && cutOptions.predefined) {
                for (const cut of cutOptions.predefined) {
                    if (Math.abs(cutLength - cut.length) < 0.1) {
                        ratioText = `${cut.label} (${cut.length} cm)`;
                        break;
                    }
                }
            }            cutPreview.innerHTML = `
                Coupe sélectionnée: ${ratioText}<br>
                Nouvelles dimensions: ${newDims.x}×${newDims.y}×${newDims.z} cm<br>
                <small style="color: #999;">Seule la profondeur (axe Z - bleu) est modifiée</small>
            `;
            
            // Mettre à jour l'aperçu 3D avec la nouvelle coupe
            if (previewRenderer && previewScene) {
                const cutRatio = cutLength / element.dims.x;
                loadPreviewModel(cutRatio);
            }
        };        // Fonction pour mettre à jour l'aperçu de longueur pour les hourdis scalables
        const updateLengthPreview = (length) => {
            const lengthPreview = document.getElementById('length-preview');
            if (!lengthPreview) return;
            
            // Calculer les nouvelles propriétés avec la longueur personnalisée
            let propertiesHTML = `Longueur sélectionnée: ${length}${cutOptions.unit}`;
            
            if (this.app.elementsLibrary) {
                // Dimensions personnalisées pour les hourdis scalables
                const customDims = {
                    x: element.dims.x,  // Largeur inchangée
                    y: element.dims.y,  // Hauteur inchangée
                    z: length           // Profondeur personnalisée
                };
                
                const customProperties = this.app.elementsLibrary.calculateElementProperties(
                    element.name, 
                    element.category, 
                    customDims
                );
                  if (customProperties) {
                    propertiesHTML += `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #555; font-size: 11px;">
                            <div>Dimensions: ${customDims.x}×${customDims.y}×${customDims.z} cm</div>
                            <div>Volume: ${customProperties.volume.formatted}</div>
                            <div>Surface: ${customProperties.surfaces.formatted}</div>
                        </div>
                    `;
                }
            }
            
            lengthPreview.innerHTML = propertiesHTML;
              // Mettre à jour l'aperçu 3D avec la nouvelle longueur (pour les hourdis scalables)
            if (previewRenderer && previewScene && cutOptions && cutOptions.type === 'scalable') {
                // Pour les hourdis scalables, on utilise directement la longueur sans ratio
                loadPreviewModelScalable(length);
            }        };

        // Fonction pour mettre à jour l'aperçu de longueur pour les profils configurables
        const updateProfileLengthPreview = (length) => {
            const lengthPreview = document.getElementById('profile-length-preview');
            if (!lengthPreview) return;
            
            // Calculer les nouvelles propriétés avec la longueur personnalisée
            let propertiesHTML = `Longueur sélectionnée: ${length}cm`;
              if (this.app.elementsLibrary) {
                // Dimensions personnalisées pour les profils configurables (longueur sur dims.z = hauteur)
                const customDims = {
                    x: element.dims.x,  // Largeur inchangée
                    y: element.dims.y,  // Profondeur inchangée
                    z: length           // Longueur personnalisée sur la hauteur (dims.z)
                };
                
                const customProperties = this.app.elementsLibrary.calculateElementProperties(
                    element.name, 
                    element.category, 
                    customDims
                );
                
                if (customProperties) {
                    propertiesHTML += `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #555; font-size: 11px;">
                            <div>Dimensions: ${customDims.x}×${customDims.y}×${customDims.z} cm</div>
                            <div>Volume: ${customProperties.volume.formatted}</div>
                        </div>
                    `;
                }
            }
            
            lengthPreview.innerHTML = propertiesHTML;
            
            // Mettre à jour l'aperçu 3D avec la nouvelle longueur (pour les profils configurables)
            if (previewRenderer && previewScene && cutOptions && cutOptions.type === 'configurable-profile') {
                // Pour les profils configurables, on utilise directement la longueur
                loadPreviewModelProfile(length);
            }
        };

        // Fonction pour charger le modèle scalable avec une longueur spécifique
        const loadPreviewModelScalable = (customLength) => {
            console.log('Chargement du modèle scalable avec longueur:', customLength);
            
            // Utiliser le chemin du modèle configuré dans la bibliothèque
            const config = this.app.elementsLibrary?.elementsConfig[element.category]?.[element.name];
            if (!config) {
                console.error('Configuration non trouvée pour l\'élément scalable');
                createTestCubeScalable(customLength);
                return;
            }
            
            const modelPath = config.path ? `assets/models/${config.path}` : 'assets/models/1_1_1.glb';
            console.log('Chemin du modèle scalable:', modelPath);
            const loader = new GLTFLoader();
              loader.load(
                modelPath,
                (gltf) => {
                    console.log('Modèle scalable chargé avec succès');
                    
                    // Supprimer l'ancien modèle
                    if (previewModel) {
                        previewScene.remove(previewModel);
                    }
                      const model = gltf.scene.clone();
                    
                    // Calculer les dimensions cibles selon le mapping de la bibliothèque
                    // Dans la bibliothèque: targetSize.x=largeur, targetSize.y=hauteur, targetSize.z=profondeur
                    const targetSize = new THREE.Vector3(
                        element.dims.x / 100,        // largeur (axe X)
                        element.dims.z / 100,        // hauteur (axe Y = dims.z)  
                        customLength / 100           // profondeur personnalisée (axe Z = dims.y)
                    );
                    
                    // Calculer la boîte englobante du modèle d'origine
                    const originalBox = new THREE.Box3().setFromObject(model);
                    const originalSize = originalBox.getSize(new THREE.Vector3());
                    
                    // Calculer l'échelle pour correspondre aux dimensions spécifiées (comme dans la bibliothèque)
                    const scaleX = targetSize.x / originalSize.x;
                    const scaleY = targetSize.y / originalSize.y;
                    const scaleZ = targetSize.z / originalSize.z;
                    
                    console.log(`Échelle calculée: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}x${scaleZ.toFixed(3)} pour longueur ${customLength}cm`);
                    
                    // Appliquer l'échelle (comme dans la bibliothèque)
                    model.scale.set(scaleX, scaleY, scaleZ);
                    
                    // Recalculer la boîte englobante après l'échelle
                    const scaledBox = new THREE.Box3().setFromObject(model);
                    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
                    
                    // Centrer le modèle mis à l'échelle à l'origine (comme dans la bibliothèque)
                    model.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
                      // Créer un groupe parent
                    const modelGroup = new THREE.Group();
                    modelGroup.add(model);
                    
                    // Stocker une référence vers le modèle original pour les arêtes
                    modelGroup.userData.originalModel = model;
                    
                    // Configurer le matériau
                    this.configureMaterialForPreview(model, element);
                    
                    // Ajouter les arêtes
                    this.addEdgesToModel(modelGroup, previewScene);
                    
                    previewModel = modelGroup;
                    previewScene.add(previewModel);
                    
                    console.log('Modèle scalable ajouté avec longueur:', customLength);
                    
                    // Démarrer l'animation
                    animatePreview();
                },
                (progress) => {
                    console.log('Chargement scalable en cours:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Erreur de chargement du modèle scalable:', error);
                    // Créer un cube de test redimensionné
                    createTestCubeScalable(customLength);
                }
            );
        };

        // Fonction pour créer un cube de test scalable
        const createTestCubeScalable = (customLength) => {
            console.log('Création d\'un cube de test scalable avec longueur:', customLength);
            
            // Supprimer l'ancien modèle
            if (previewModel) {
                previewScene.remove(previewModel);
            }
              // Créer un cube avec les dimensions selon le mapping de la bibliothèque
            const geometry = new THREE.BoxGeometry(
                element.dims.x / 100,         // largeur (axe X)
                element.dims.z / 100,         // hauteur (axe Y = dims.z)
                customLength / 100            // profondeur personnalisée (axe Z = dims.y)
            );
            
            const color = this.getMaterialColor(element);
            const material = new THREE.MeshLambertMaterial({
                color: color,
                wireframe: false,
                transparent: true,
                opacity: 0.8
            });
            const cube = new THREE.Mesh(geometry, material);
            
            // Créer les arêtes
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
            const edgesMesh = new THREE.LineSegments(edges, edgeMaterial);
            
            // Créer un groupe
            const testGroup = new THREE.Group();
            testGroup.add(cube);
            testGroup.add(edgesMesh);
            
            previewModel = testGroup;
            previewScene.add(previewModel);
            
            console.log('Cube de test scalable créé avec longueur:', customLength);
              // Démarrer l'animation
            animatePreview();
        };

        // Fonction pour charger le modèle de profil avec une longueur spécifique
        const loadPreviewModelProfile = (customLength) => {
            console.log('Chargement du modèle de profil avec longueur:', customLength);
            
            // Utiliser le chemin du modèle configuré dans la bibliothèque
            const config = this.app.elementsLibrary?.elementsConfig[element.category]?.[element.name];
            if (!config) {
                console.error('Configuration non trouvée pour le profil configurable');
                createTestCubeProfile(customLength);
                return;
            }
            
            const modelPath = config.path ? `assets/models/${config.path}` : 'assets/models/1_1_1.glb';
            console.log('Chemin du modèle de profil:', modelPath);
            const loader = new GLTFLoader();
            
            loader.load(
                modelPath,
                (gltf) => {
                    console.log('Modèle de profil chargé avec succès');
                    
                    // Supprimer l'ancien modèle
                    if (previewModel) {
                        previewScene.remove(previewModel);
                    }
                    
                    const model = gltf.scene.clone();                    // Calculer les dimensions cibles pour le profil (longueur personnalisée sur axe Z = hauteur)
                    // La longueur personnalisée doit être sur l'axe Y de Three.js (qui correspond à dims.z = hauteur)
                    const targetSize = new THREE.Vector3(
                        element.dims.x / 100,        // largeur (axe X de Three.js)
                        customLength / 100,          // longueur personnalisée (axe Y de Three.js = dims.z = hauteur)
                        element.dims.y / 100         // profondeur (axe Z de Three.js = dims.y)
                    );
                    
                    // Calculer la boîte englobante du modèle d'origine
                    const originalBox = new THREE.Box3().setFromObject(model);
                    const originalSize = originalBox.getSize(new THREE.Vector3());
                    
                    // Calculer l'échelle pour correspondre aux dimensions spécifiées
                    const scaleX = targetSize.x / originalSize.x;
                    const scaleY = targetSize.y / originalSize.y;
                    const scaleZ = targetSize.z / originalSize.z;
                    
                    console.log(`Échelle calculée pour profil: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}x${scaleZ.toFixed(3)} pour longueur ${customLength}cm`);
                    
                    // Appliquer l'échelle
                    model.scale.set(scaleX, scaleY, scaleZ);
                    
                    // Recalculer la boîte englobante après l'échelle
                    const scaledBox = new THREE.Box3().setFromObject(model);
                    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
                    
                    // Centrer le modèle mis à l'échelle à l'origine
                    model.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
                    
                    // Créer un groupe parent
                    const modelGroup = new THREE.Group();
                    modelGroup.add(model);
                    
                    // Stocker une référence vers le modèle original pour les arêtes
                    modelGroup.userData.originalModel = model;
                    
                    // Configurer le matériau
                    this.configureMaterialForPreview(model, element);
                    
                    // Ajouter les arêtes
                    this.addEdgesToModel(modelGroup, previewScene);
                    
                    previewModel = modelGroup;
                    previewScene.add(previewModel);
                    
                    console.log('Modèle de profil ajouté avec longueur:', customLength);
                    
                    // Démarrer l'animation
                    animatePreview();
                },
                (progress) => {
                    console.log('Chargement profil en cours:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Erreur de chargement du modèle de profil:', error);
                    // Créer un cube de test redimensionné
                    createTestCubeProfile(customLength);
                }
            );
        };

        // Fonction pour créer un cube de test pour le profil
        const createTestCubeProfile = (customLength) => {
            console.log('Création d\'un cube de test pour profil avec longueur:', customLength);
            
            // Supprimer l'ancien modèle
            if (previewModel) {
                previewScene.remove(previewModel);
            }            // Créer un cube avec les dimensions pour le profil (longueur personnalisée sur hauteur)
            const geometry = new THREE.BoxGeometry(
                element.dims.x / 100,         // largeur (axe X de Three.js)
                customLength / 100,           // longueur personnalisée (axe Y de Three.js = dims.z = hauteur)
                element.dims.y / 100          // profondeur (axe Z de Three.js = dims.y)
            );
            
            const color = this.getMaterialColor(element);
            const material = new THREE.MeshLambertMaterial({
                color: color,
                wireframe: false,
                transparent: true,
                opacity: 0.8
            });
            const cube = new THREE.Mesh(geometry, material);
            
            // Créer les arêtes
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
            const edgesMesh = new THREE.LineSegments(edges, edgeMaterial);
            
            // Créer un groupe
            const testGroup = new THREE.Group();
            testGroup.add(cube);
            testGroup.add(edgesMesh);
            
            previewModel = testGroup;
            previewScene.add(previewModel);
            
            console.log('Cube de test pour profil créé avec longueur:', customLength);
            
            // Démarrer l'animation
            animatePreview();        };

        // Fonction pour charger le modèle de poutre selon le profil et la longueur
        const loadPreviewModelBeam = (selectedProfile, customLength) => {
            console.log('Chargement du modèle de poutre:', selectedProfile, 'avec longueur:', customLength);
            
            // Récupérer la configuration de la poutre
            const config = this.app.elementsLibrary?.elementsConfig[element.category]?.[element.name];
            if (!config || !config.profilePaths || !config.profilePaths[selectedProfile]) {
                console.error('Configuration ou chemin du profil non trouvé:', selectedProfile);
                createTestCubeBeam(selectedProfile, customLength);
                return;
            }
            
            const modelPath = `assets/models/${config.profilePaths[selectedProfile]}`;
            console.log('Chemin du modèle de poutre:', modelPath);
            const loader = new GLTFLoader();
            
            loader.load(
                modelPath,
                (gltf) => {
                    console.log('Modèle de poutre chargé avec succès:', selectedProfile);
                    
                    // Supprimer l'ancien modèle
                    if (previewModel) {
                        previewScene.remove(previewModel);
                    }
                    
                    const model = gltf.scene.clone();
                    
                    // Pour les poutres, la longueur personnalisée est sur l'axe Y (selon config.scaleAxis)
                    const scaleAxis = config.scaleAxis || 'y';
                    
                    // Calculer les dimensions cibles
                    const targetDims = { ...element.dims };
                    targetDims[scaleAxis] = customLength;
                    
                    const targetSize = new THREE.Vector3(
                        targetDims.x / 100,  // largeur
                        targetDims.z / 100,  // hauteur (Three.js Y = dims.z)
                        targetDims.y / 100   // profondeur (Three.js Z = dims.y)
                    );
                    
                    // Calculer la boîte englobante du modèle d'origine
                    const originalBox = new THREE.Box3().setFromObject(model);
                    const originalSize = originalBox.getSize(new THREE.Vector3());
                    
                    // Calculer l'échelle pour correspondre aux dimensions spécifiées
                    const scaleX = targetSize.x / originalSize.x;
                    const scaleY = targetSize.y / originalSize.y;
                    const scaleZ = targetSize.z / originalSize.z;
                    
                    console.log(`Échelle calculée pour poutre ${selectedProfile}: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}x${scaleZ.toFixed(3)} pour longueur ${customLength}cm`);
                    
                    // Appliquer l'échelle
                    model.scale.set(scaleX, scaleY, scaleZ);
                    
                    // Recalculer la boîte englobante après l'échelle
                    const scaledBox = new THREE.Box3().setFromObject(model);
                    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
                    
                    // Centrer le modèle mis à l'échelle à l'origine
                    model.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
                    
                    // Créer un groupe parent
                    const modelGroup = new THREE.Group();
                    modelGroup.add(model);
                    
                    // Stocker une référence vers le modèle original
                    modelGroup.userData.originalModel = model;
                    modelGroup.userData.selectedProfile = selectedProfile;
                    modelGroup.userData.customLength = customLength;
                    
                    // Configurer le matériau
                    this.configureMaterialForPreview(model, element);
                    
                    // Ajouter les arêtes
                    this.addEdgesToModel(modelGroup, previewScene);
                    
                    previewModel = modelGroup;
                    previewScene.add(previewModel);
                    
                    console.log('Modèle de poutre ajouté:', selectedProfile, 'longueur:', customLength);
                    
                    // Démarrer l'animation
                    animatePreview();
                },
                (progress) => {
                    console.log('Chargement poutre en cours:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Erreur de chargement du modèle de poutre:', error);
                    // Créer un cube de test
                    createTestCubeBeam(selectedProfile, customLength);
                }
            );
        };

        // Fonction pour créer un cube de test pour la poutre
        const createTestCubeBeam = (selectedProfile, customLength) => {
            console.log('Création d\'un cube de test pour poutre:', selectedProfile, 'longueur:', customLength);
            
            // Supprimer l'ancien modèle
            if (previewModel) {
                previewScene.remove(previewModel);
            }
            
            // Récupérer la configuration pour l'axe de mise à l'échelle
            const config = this.app.elementsLibrary?.elementsConfig[element.category]?.[element.name];
            const scaleAxis = config?.scaleAxis || 'y';
            
            // Calculer les dimensions avec la longueur personnalisée
            const finalDims = { ...element.dims };
            finalDims[scaleAxis] = customLength;
            
            // Créer un cube avec les dimensions calculées
            const geometry = new THREE.BoxGeometry(
                finalDims.x / 100,  // largeur
                finalDims.z / 100,  // hauteur (Three.js Y = dims.z)
                finalDims.y / 100   // profondeur (Three.js Z = dims.y)
            );
            
            const color = this.getMaterialColor(element);
            const material = new THREE.MeshLambertMaterial({
                color: color,
                wireframe: false,
                transparent: true,
                opacity: 0.8
            });
            const cube = new THREE.Mesh(geometry, material);
            
            // Créer les arêtes
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
            const edgesMesh = new THREE.LineSegments(edges, edgeMaterial);
            
            // Créer un groupe
            const testGroup = new THREE.Group();
            testGroup.add(cube);
            testGroup.add(edgesMesh);
            
            previewModel = testGroup;
            previewScene.add(previewModel);
            
            console.log('Cube de test pour poutre créé:', selectedProfile, 'longueur:', customLength);
            
            // Démarrer l'animation
            animatePreview();
        };

        // Fonction pour sélectionner une option de coupe
        const selectCutOption = (cutLength, button) => {
            // Désélectionner tous les boutons
            optionsPanel.querySelectorAll('.cut-option, #custom-cut-btn').forEach(btn => {
                btn.style.background = '#444';
                btn.style.borderColor = '#666';
            });
            
            // Sélectionner le bouton cliqué
            if (button) {
                button.style.background = '#007acc';
                button.style.borderColor = '#007acc';
            }
              // Cacher l'input personnalisé si on sélectionne une option prédéfinie
            if (button && button.id !== 'custom-cut-btn') {
                const customInput = document.getElementById('custom-cut-input');
                const customUnit = document.getElementById('custom-unit');
                if (customInput) customInput.style.display = 'none';
                if (customUnit) customUnit.style.display = 'none';
            }
            
            selectedCutLength = cutLength;
            updateCutPreview(cutLength);
        };
          // Fonction pour fermer le panneau et nettoyer les événements
        const closePanel = () => {
            // Nettoyer l'aperçu 3D
            if (previewAnimationId) {
                cancelAnimationFrame(previewAnimationId);
                previewAnimationId = null;
            }
            if (previewRenderer) {
                previewRenderer.dispose();
                previewRenderer = null;
            }
            previewScene = null;
            previewCamera = null;
            previewModel = null;
            
            // Fermer le panneau
            optionsPanel.style.display = 'none';
            if (this.currentClickOutsideHandler) {
                document.removeEventListener('click', this.currentClickOutsideHandler);
                this.currentClickOutsideHandler = null;
            }
        };        // Gestionnaires pour les options de coupe prédéfinies
        if (cutOptions) {
            optionsPanel.querySelectorAll('.cut-option').forEach(button => {
                button.addEventListener('click', () => {
                    const cutLength = parseFloat(button.getAttribute('data-length'));
                    selectCutOption(cutLength, button);
                });
            });
        }

        // Gestionnaires pour les hourdis scalables (longueur personnalisée)
        if (cutOptions && cutOptions.type === 'scalable') {
            // Gestionnaires pour les boutons de longueurs prédéfinies
            optionsPanel.querySelectorAll('.length-option').forEach(button => {
                button.addEventListener('click', () => {
                    const length = parseFloat(button.getAttribute('data-length'));
                    
                    // Désélectionner tous les boutons de longueur
                    optionsPanel.querySelectorAll('.length-option').forEach(btn => {
                        btn.style.background = '#444';
                        btn.style.borderColor = '#666';
                    });
                    
                    // Sélectionner le bouton cliqué
                    button.style.background = '#007acc';
                    button.style.borderColor = '#007acc';
                    
                    // Mettre à jour l'input personnalisé
                    const customInput = document.getElementById('custom-length-input');
                    if (customInput) {
                        customInput.value = length;
                    }
                    
                    // Mettre à jour l'aperçu de longueur
                    updateLengthPreview(length);
                    
                    selectedCutLength = length;
                });
            });
            
            // Gestionnaire pour l'input de longueur personnalisée
            const customLengthInput = document.getElementById('custom-length-input');
            if (customLengthInput) {
                customLengthInput.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value);
                    if (value && value >= cutOptions.minLength && value <= cutOptions.maxLength) {
                        // Désélectionner tous les boutons prédéfinis
                        optionsPanel.querySelectorAll('.length-option').forEach(btn => {
                            btn.style.background = '#444';
                            btn.style.borderColor = '#666';
                        });
                        
                        updateLengthPreview(value);
                        selectedCutLength = value;
                    }                });
            }
        }

        // Gestionnaires pour les profils configurables (longueur personnalisée)
        if (cutOptions && cutOptions.type === 'configurable-profile') {
            // Gestionnaires pour les boutons de longueurs prédéfinies
            optionsPanel.querySelectorAll('.profile-length-option').forEach(button => {
                button.addEventListener('click', () => {
                    const length = parseFloat(button.getAttribute('data-length'));
                    
                    // Désélectionner tous les boutons de longueur
                    optionsPanel.querySelectorAll('.profile-length-option').forEach(btn => {
                        btn.style.background = '#444';
                        btn.style.borderColor = '#666';
                    });
                    
                    // Sélectionner le bouton cliqué
                    button.style.background = '#007acc';
                    button.style.borderColor = '#007acc';
                    
                    // Mettre à jour l'input personnalisé
                    const customInput = document.getElementById('custom-profile-length-input');
                    if (customInput) {
                        customInput.value = length;
                    }
                    
                    // Mettre à jour l'aperçu de longueur pour le profil
                    updateProfileLengthPreview(length);
                    
                    selectedCutLength = length;
                });
            });
            
            // Gestionnaire pour l'input de longueur personnalisée
            const customProfileLengthInput = document.getElementById('custom-profile-length-input');
            if (customProfileLengthInput) {
                customProfileLengthInput.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value);
                    if (value && value >= cutOptions.minLength && value <= cutOptions.maxLength) {
                        // Désélectionner tous les boutons prédéfinis
                        optionsPanel.querySelectorAll('.profile-length-option').forEach(btn => {
                            btn.style.background = '#444';
                            btn.style.borderColor = '#666';
                        });
                        
                        updateProfileLengthPreview(value);
                        selectedCutLength = value;
                    }
                });
            }        }

        // Gestionnaires pour les poutres avec sélecteur de profil
        if (cutOptions && cutOptions.type === 'profile-selector') {
            let selectedProfile = cutOptions.currentProfile;
            let selectedLength = cutOptions.defaultLength;
              // Gestionnaire pour le sélecteur de profil
            const profileSelector = document.getElementById('profile-selector');
            if (profileSelector) {
                profileSelector.addEventListener('change', (e) => {
                    selectedProfile = e.target.value;
                    updateProfileInfoPreview(selectedProfile, selectedLength);
                    // Recharger le modèle 3D avec le nouveau profil
                    loadPreviewModelBeam(selectedProfile, selectedLength);
                });
            }
            
            // Gestionnaires pour les boutons de longueurs prédéfinies
            optionsPanel.querySelectorAll('.profile-length-option').forEach(button => {
                button.addEventListener('click', () => {
                    const length = parseFloat(button.getAttribute('data-length'));
                    
                    // Désélectionner tous les boutons de longueur
                    optionsPanel.querySelectorAll('.profile-length-option').forEach(btn => {
                        btn.style.background = '#444';
                        btn.style.borderColor = '#666';
                    });
                    
                    // Sélectionner le bouton cliqué
                    button.style.background = '#007acc';
                    button.style.borderColor = '#007acc';
                    
                    // Mettre à jour l'input personnalisé
                    const customInput = document.getElementById('custom-profile-length-input');
                    if (customInput) {
                        customInput.value = length;
                    }
                      selectedLength = length;
                    updateProfileInfoPreview(selectedProfile, selectedLength);
                    // Recharger le modèle 3D avec la nouvelle longueur
                    loadPreviewModelBeam(selectedProfile, selectedLength);
                });
            });
            
            // Gestionnaire pour l'input de longueur personnalisée
            const customProfileLengthInput = document.getElementById('custom-profile-length-input');
            if (customProfileLengthInput) {
                customProfileLengthInput.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value);
                    if (value && value >= cutOptions.minLength && value <= cutOptions.maxLength) {
                        // Désélectionner tous les boutons prédéfinis
                        optionsPanel.querySelectorAll('.profile-length-option').forEach(btn => {
                            btn.style.background = '#444';
                            btn.style.borderColor = '#666';
                        });
                          selectedLength = value;
                        updateProfileInfoPreview(selectedProfile, selectedLength);
                        // Recharger le modèle 3D avec la nouvelle longueur
                        loadPreviewModelBeam(selectedProfile, selectedLength);
                    }
                });
            }
            
            // Fonction pour mettre à jour l'aperçu des informations de profil
            const updateProfileInfoPreview = (profile, length) => {
                const profilePreview = document.getElementById('profile-info-preview');
                if (profilePreview) {
                    profilePreview.innerHTML = `
                        Profil sélectionné: ${profile}<br>
                        Longueur: ${length}${cutOptions.unit}
                    `;
                }
                
                // Stocker les valeurs sélectionnées pour l'utilisation lors du placement
                selectedCutLength = length;
                element.selectedProfile = profile;
                element.selectedLength = length;
            };
            
            // Initialiser avec les valeurs par défaut
            updateProfileInfoPreview(selectedProfile, selectedLength);
        }

        // Gestionnaire pour l'option personnalisée
        if (cutOptions && cutOptions.custom) {
            const customBtn = document.getElementById('custom-cut-btn');
            if (customBtn) {
                customBtn.addEventListener('click', () => {
                    const customInput = document.getElementById('custom-cut-input');
                    const customUnit = document.getElementById('custom-unit');
                    if (customInput && customUnit) {
                        customInput.style.display = 'block';
                        customUnit.style.display = 'block';
                        customInput.focus();
                        customInput.select(); // Sélectionner le texte pour faciliter la modification
                    }
                    
                    selectCutOption(selectedCutLength, customBtn);
                });
            }
            
            // Gestionnaire pour l'input personnalisé
            const customInput = document.getElementById('custom-cut-input');
            if (customInput) {
                customInput.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value);
                    if (value && value >= 0.1 && value <= element.dims.x) {
                        selectedCutLength = value;
                        updateCutPreview(value);
                    }
                });
            }
        }        // Initialiser l'aperçu 3D après que le DOM soit complètement prêt
        const initPreview = () => {
            const canvas = document.getElementById('element-preview-canvas');
            if (canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {                console.log('Création de l\'aperçu 3D');
                createPreview();
                
                // Sélectionner la première option par défaut APRÈS création de l'aperçu
                if (cutOptions && cutOptions.type === 'scalable') {
                    // Pour les hourdis scalables, utiliser la première longueur prédéfinie
                    if (cutOptions.predefined && cutOptions.predefined.length > 0) {
                        const defaultLength = cutOptions.predefined[0].length;
                        const defaultButton = optionsPanel.querySelector('.length-option[data-length="' + defaultLength + '"]');
                        if (defaultButton) {
                            defaultButton.style.background = '#007acc';
                            defaultButton.style.borderColor = '#007acc';
                        }
                        
                        selectedCutLength = defaultLength;
                        // Ne pas charger le modèle scalable immédiatement, attendre que l'aperçu de base soit prêt
                        setTimeout(() => {
                            updateLengthPreview(defaultLength);
                        }, 1000);
                    } else {                        selectedCutLength = cutOptions.defaultLength;
                        setTimeout(() => {
                            updateLengthPreview(selectedCutLength);
                        }, 1000);
                    }
                } else if (cutOptions && cutOptions.type === 'configurable-profile') {
                    // Pour les profils configurables, utiliser la première longueur prédéfinie
                    if (cutOptions.predefined && cutOptions.predefined.length > 0) {
                        const defaultLength = cutOptions.predefined[0].length;
                        const defaultButton = optionsPanel.querySelector('.profile-length-option[data-length="' + defaultLength + '"]');
                        if (defaultButton) {
                            defaultButton.style.background = '#007acc';
                            defaultButton.style.borderColor = '#007acc';
                        }
                        
                        selectedCutLength = defaultLength;
                        // Ne pas charger le modèle de profil immédiatement, attendre que l'aperçu de base soit prêt
                        setTimeout(() => {
                            updateProfileLengthPreview(defaultLength);
                        }, 1000);
                    } else {
                        selectedCutLength = cutOptions.defaultLength;
                        setTimeout(() => {
                            updateProfileLengthPreview(selectedCutLength);
                        }, 1000);
                    }
                } else if (cutOptions && cutOptions.type === 'profile-selector') {
                    // Pour les poutres avec sélecteur de profil
                    const defaultProfile = cutOptions.currentProfile;
                    let defaultLength;
                    
                    if (cutOptions.predefined && cutOptions.predefined.length > 0) {
                        defaultLength = cutOptions.predefined[0].length;
                        const defaultButton = optionsPanel.querySelector('.profile-length-option[data-length="' + defaultLength + '"]');
                        if (defaultButton) {
                            defaultButton.style.background = '#007acc';
                            defaultButton.style.borderColor = '#007acc';
                        }
                    } else {
                        defaultLength = cutOptions.defaultLength;
                    }
                    
                    selectedCutLength = defaultLength;
                    // Charger le modèle de poutre avec le profil et la longueur par défaut
                    setTimeout(() => {
                        loadPreviewModelBeam(defaultProfile, defaultLength);
                    }, 1000);
                } else if (cutOptions && cutOptions.predefined && cutOptions.predefined.length > 0) {
                    // Pour les autres éléments, utiliser l'ancienne logique
                    const defaultButton = optionsPanel.querySelector('.cut-option[data-length="' + cutOptions.predefined[0].length + '"]');
                    if (defaultButton) {
                        selectCutOption(cutOptions.predefined[0].length, defaultButton);
                    }
                } else {
                    // Pas d'options de coupe, utiliser la longueur complète
                    selectedCutLength = element.dims.x;
                    if (cutOptions && cutOptions.type === 'scalable') {
                        updateLengthPreview(selectedCutLength);
                    } else {
                        updateCutPreview(selectedCutLength);
                    }
                }
            } else {
                console.log('Canvas pas encore prêt, nouvelle tentative...');
                setTimeout(initPreview, 200);
            }
        };
        
        // Lancer l'initialisation immédiatement et avec un fallback
        initPreview();
        
        // Fallback de sécurité si l'aperçu ne se charge pas dans les 2 secondes
        setTimeout(() => {
            if (!previewRenderer || !previewModel) {
                console.log('Fallback: Création d\'un aperçu de test car le modèle ne s\'est pas chargé');
                const canvas = document.getElementById('element-preview-canvas');
                if (canvas) {
                    try {
                        createPreview();
                        setTimeout(() => {
                            if (!previewModel) {
                                createTestCube(1.0);
                            }
                        }, 500);
                    } catch (error) {
                        console.error('Erreur de fallback:', error);
                    }
                }
            }
        }, 2000);        // Gestionnaires d'événements
        document.getElementById('place-element-btn').addEventListener('click', () => {
            // Vérifier si c'est un hourdis scalable
            if (cutOptions && cutOptions.type === 'scalable') {
                // Pour les hourdis scalables, utiliser la longueur personnalisée
                this.placeSelectedElement(1, selectedCutLength);
            } else if (cutOptions && cutOptions.type === 'profile-selector') {
                // Pour les poutres avec sélecteur de profil
                this.placeSelectedElementBeam(element.selectedProfile, element.selectedLength);
            } else if (cutOptions && cutOptions.type === 'configurable-profile') {
                // Pour les profils configurables, utiliser la longueur personnalisée sur l'axe Z
                this.placeSelectedElementProfile(selectedCutLength);
            } else {
                // Pour les autres éléments, utiliser le ratio de coupe
                const cutRatio = selectedCutLength / element.dims.x;
                this.placeSelectedElement(cutRatio);
            }
            closePanel();
        });
        
        document.getElementById('close-options-btn').addEventListener('click', () => {
            closePanel();
        });
        
        // Fermer en cliquant à l'extérieur
        this.currentClickOutsideHandler = (e) => {
            if (!optionsPanel.contains(e.target)) {
                closePanel();
            }
        };
          // Ajouter l'événement après un court délai pour éviter de fermer immédiatement
        setTimeout(() => {
            document.addEventListener('click', this.currentClickOutsideHandler);
        }, 100);        // Fonction pour mettre à jour les propriétés géométriques avec la nouvelle longueur
        const updateGeometricProperties = (newLength) => {
            if (element.category === 'planchers') {
                // Pour les hourdis/planchers, la longueur personnalisée affecte l'axe Z (profondeur)
                const updatedDims = { ...element.dims, z: newLength };
                const newElementProperties = this.app.elementsLibrary.calculateElementProperties(element.name, element.category, updatedDims);
                
                // Mettre à jour l'affichage de l'utilisation typique dans le menu d'options
                const usageDiv = optionsPanel.querySelector('.usage-description');
                if (usageDiv) {
                    usageDiv.textContent = newElementProperties.utilisationTypique;
                }
                
                // Mettre à jour l'affichage du volume dans le menu d'options
                const volumeDiv = optionsPanel.querySelector('[data-property="volume"]');
                if (volumeDiv) {
                    volumeDiv.textContent = `Volume: ${newElementProperties.volume.formatted}`;
                }
                
                // NOUVELLE PARTIE : Mettre à jour aussi le panneau de propriétés principal si un objet de cette catégorie est sélectionné
                if (this.app.selectedObject && 
                    this.app.selectedObject.userData && 
                    this.app.selectedObject.userData.isConstructionElement &&
                    this.app.selectedObject.userData.category === 'planchers') {
                    
                    // Mettre à jour les dimensions de l'objet sélectionné
                    this.app.selectedObject.userData.dims = updatedDims;
                    
                    // Recalculer et réafficher les propriétés dans le panneau principal
                    this.updatePropertiesPanel(this.app.selectedObject);
                }
            }
        };

        // Gestionnaires d'événements pour les changements de longueur
        if (cutOptions && cutOptions.type === 'scalable') {
            // Pour les sliders de longueur personnalisée
            const customLengthInput = document.getElementById('custom-length-input');
            if (customLengthInput) {
                customLengthInput.addEventListener('input', (e) => {
                    const newLength = parseFloat(e.target.value);
                    if (!isNaN(newLength)) {
                        selectedCutLength = newLength;
                        updateGeometricProperties(newLength);
                        
                        // Mettre à jour l'aperçu de longueur
                        const lengthPreview = document.getElementById('length-preview');
                        if (lengthPreview) {
                            lengthPreview.textContent = `Longueur sélectionnée: ${newLength}cm`;
                        }
                    }
                });
            }

            // Pour les boutons de longueurs prédéfinies
            const presetButtons = optionsPanel.querySelectorAll('.preset-length');
            presetButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const newLength = parseFloat(button.dataset.length);
                    selectedCutLength = newLength;
                    updateGeometricProperties(newLength);
                    
                    // Mettre à jour l'input
                    if (customLengthInput) {
                        customLengthInput.value = newLength;
                    }
                    
                    // Mettre à jour l'aperçu
                    const lengthPreview = document.getElementById('length-preview');
                    if (lengthPreview) {
                        lengthPreview.textContent = `Longueur sélectionnée: ${newLength}cm`;
                    }
                });
            });
        }
    }placeSelectedElement(cutRatio = 1, customLength = null) {
        if (!this.selectedElement) {
            console.warn('Aucun élément sélectionné');
            return;
        }
        
        console.log('Placement de l\'élément:', this.selectedElement.name, 'avec coupe:', cutRatio, 'longueur personnalisée:', customLength);
          
        // Gestion spéciale pour les hourdis scalables
        const config = this.app.elementsLibrary?.elementsConfig[this.selectedElement.category]?.[this.selectedElement.name];
        const isScalable = config && config.scalable;
        
        let finalDims;
        let elementInstance;
          if (isScalable && customLength) {
            // Pour les hourdis scalables, utiliser la longueur personnalisée sur l'axe Z (profondeur)
            finalDims = {
                x: this.selectedElement.dims.x, // Largeur inchangée
                y: this.selectedElement.dims.y, // Hauteur inchangée  
                z: customLength                 // Profondeur personnalisée
            };
            
            elementInstance = {
                ...this.selectedElement,
                dims: finalDims,
                customLength: customLength,   // Sauvegarder la longueur personnalisée
                isScalable: true,            // Marquer comme scalable
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 }
            };
        } else {
            // Gestion classique avec ratio de coupe
            // La coupe affecte seulement la longueur (axe X/rouge)
            const originalDims = this.selectedElement.dims;
            finalDims = {
                x: originalDims.x * cutRatio, // Seule la longueur est coupée
                y: originalDims.y,            // Largeur inchangée
                z: originalDims.z             // Hauteur inchangée
            };
            
            elementInstance = {
                ...this.selectedElement,
                dims: finalDims, // Appliquer les dimensions de coupe
                cutRatio: cutRatio, // Sauvegarder le ratio de coupe
                position: { x: 0, y: 0, z: 0 }, // Position par défaut au centre
                rotation: { x: 0, y: 0, z: 0 }  // Rotation par défaut
            };
        }
        
        // Ajouter l'élément directement via l'ElementManager
        if (this.app && this.app.elementManager) {
            this.app.elementManager.addElement(elementInstance)
                .then(() => {
                    console.log('Élément placé avec succès:', this.selectedElement.name);
                    let cutText = cutRatio === 1 ? '' : ` (coupe ${cutRatio})`;
                    this.showSuccessMessage(`${this.selectedElement.name}${cutText} placé avec succès`);
                })
                .catch((error) => {
                    console.error('Erreur lors du placement:', error);
                    this.showErrorMessage(`Erreur lors du placement: ${error.message}`);
                });
        } else {
            console.warn('ElementManager non trouvé');            this.showErrorMessage('ElementManager non disponible');
        }
    }

    placeSelectedElementProfile(customLength) {
        if (!this.selectedElement) {
            console.warn('Aucun élément sélectionné');
            return;
        }
        
        console.log('Placement du profil:', this.selectedElement.name, 'avec longueur personnalisée:', customLength);
          // Pour les profils configurables, utiliser la longueur personnalisée sur l'axe Z (hauteur)
        const finalDims = {
            x: this.selectedElement.dims.x, // Largeur inchangée
            y: this.selectedElement.dims.y, // Profondeur inchangée  
            z: customLength                 // Longueur personnalisée sur la hauteur (dims.z)
        };
        
        const elementInstance = {
            ...this.selectedElement,
            dims: finalDims,
            customLength: customLength,     // Sauvegarder la longueur personnalisée
            isConfigurableProfile: true,   // Marquer comme profil configurable
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
        };
        
        // Ajouter l'élément directement via l'ElementManager
        if (this.app && this.app.elementManager) {
            this.app.elementManager.addElement(elementInstance)
                .then(() => {
                    console.log('Profil placé avec succès:', this.selectedElement.name);
                    this.showSuccessMessage(`${this.selectedElement.name} (longueur ${customLength}cm) placé avec succès`);
                })
                .catch((error) => {
                    console.error('Erreur lors du placement du profil:', error);
                    this.showErrorMessage(`Erreur lors du placement: ${error.message}`);
                });
        } else {
            console.warn('ElementManager non trouvé');
            this.showErrorMessage('ElementManager non disponible');
        }    }

    placeSelectedElementBeam(selectedProfile, customLength) {
        if (!this.selectedElement) {
            console.warn('Aucun élément sélectionné');
            return;
        }
        
        console.log('Placement de la poutre:', this.selectedElement.name, 'profil:', selectedProfile, 'longueur:', customLength);
        
        // Récupérer la configuration du profil sélectionné
        const config = this.app.elementsLibrary?.elementsConfig[this.selectedElement.category]?.[this.selectedElement.name];
        if (!config || !config.profilePaths || !config.profilePaths[selectedProfile]) {
            console.error('Configuration ou chemin du profil non trouvé:', selectedProfile);
            this.showErrorMessage(`Profil ${selectedProfile} non disponible`);
            return;
        }
        
        // Pour les poutres, la longueur personnalisée est sur l'axe Y (selon la configuration)
        const scaleAxis = config.scaleAxis || 'y';
        const finalDims = { ...this.selectedElement.dims };
        finalDims[scaleAxis] = customLength;
        
        const elementInstance = {
            ...this.selectedElement,
            dims: finalDims,
            selectedProfile: selectedProfile,       // Profil sélectionné
            customLength: customLength,             // Longueur personnalisée
            profilePath: config.profilePaths[selectedProfile], // Chemin du modèle GLB
            isBeamProfile: true,                    // Marquer comme poutre avec profil
            scaleAxis: scaleAxis,                   // Axe de mise à l'échelle
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
        };
        
        // Ajouter l'élément directement via l'ElementManager
        if (this.app && this.app.elementManager) {
            this.app.elementManager.addElement(elementInstance)
                .then(() => {
                    console.log('Poutre placée avec succès:', selectedProfile, 'longueur:', customLength);
                    this.showSuccessMessage(`Poutre ${selectedProfile} (${customLength}cm) placée avec succès`);
                })
                .catch((error) => {
                    console.error('Erreur lors du placement de la poutre:', error);
                    this.showErrorMessage(`Erreur lors du placement: ${error.message}`);
                });
        } else {
            console.warn('ElementManager non trouvé');
            this.showErrorMessage('ElementManager non disponible');
        }
    }

    showPlacementInstructions() {
        // Créer ou récupérer le message d'instructions
        let instructionDiv = document.getElementById('placement-instructions');
        if (!instructionDiv) {
            instructionDiv = document.createElement('div');
            instructionDiv.id = 'placement-instructions';
            instructionDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 122, 204, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                z-index: 1001;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(instructionDiv);
        }
        
        instructionDiv.innerHTML = `
            📦 Mode placement activé - Cliquez sur la zone de dessin pour placer l'élément
            <span style="margin-left: 15px; cursor: pointer; opacity: 0.8;" onclick="this.parentElement.style.display='none'; document.body.style.cursor='default';">
                ✖️ Annuler
            </span>
        `;
        instructionDiv.style.display = 'block';
        
        // Masquer automatiquement après 10 secondes
        setTimeout(() => {
            if (instructionDiv) {
                instructionDiv.style.display = 'none';
            }        }, 10000);
    }

    showSuccessMessage(message) {
        this.showNotification(message, 'success');
    }

    showErrorMessage(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Créer ou récupérer le conteneur de notifications
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 2000;
                pointer-events: none;
            `;
            document.body.appendChild(notificationContainer);
        }

        // Créer la notification
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007acc';
        
        notification.style.cssText = `
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            margin-bottom: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            font-size: 14px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            pointer-events: auto;
        `;
        
        notification.textContent = message;
        notificationContainer.appendChild(notification);

        // Animation d'entrée
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto-suppression après 3 secondes
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}