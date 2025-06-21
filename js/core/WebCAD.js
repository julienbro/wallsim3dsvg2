// Import Three.js et modules
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { DrawingManager } from '../managers/DrawingManager.js';
import { ElementManager } from '../managers/ElementManager.js';
import { ExtrusionManager } from '../managers/ExtrusionManager.js';
import { SelectionManager } from '../managers/SelectionManager.js';
import { SnapManager } from '../managers/SnapManager.js';
import { ToolManager } from '../managers/ToolManager.js';
import { UIManager } from '../managers/UIManager.js';
import { FileManager } from '../managers/FileManager.js';
import { ViewManager } from '../managers/ViewManager.js';
import { SunlightManager } from '../managers/SunlightManager.js';
import { ElementsLibrary } from '../managers/ElementsLibrary.js'; // Import ajouté
import { HatchTool } from '../tools/HatchTool.js'; // Import pour les hachures

// Classe pour gérer l\'indicateur de nord
export class NorthIndicator {
    constructor(app) {
        this.app = app;
        this.currentAngle = 0; // Angle actuel en degrés
        this.indicator = null;
        this.label = null;
        this.createNorthIndicator();
        this.addToScene();
        console.log('NorthIndicator construit avec succès');
    }
    
    createNorthIndicator() {
        // Créer un groupe pour l\'indicateur de nord
        this.indicator = new THREE.Group();
        
        // Forme simplifiée : une flèche plate
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 15); // Pointe de la flèche
        arrowShape.lineTo(-5, 5); // Côté gauche
        arrowShape.lineTo(-2, 5); // Rentrée gauche
        arrowShape.lineTo(-2, -10); // Base gauche
        arrowShape.lineTo(2, -10); // Base droite
        arrowShape.lineTo(2, 5); // Rentrée droite
        arrowShape.lineTo(5, 5); // Côté droit
        arrowShape.lineTo(0, 15); // Retour à la pointe
        
        const arrowGeometry = new THREE.ExtrudeGeometry(arrowShape, {
            depth: 2,
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.2,
            bevelSegments: 2
        });
        
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            transparent: false,
            opacity: 1
        });
        
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.position.z = 1;
        
        // Ajouter seulement la flèche au groupe
        this.indicator.add(arrow);
        
        // Positionner l\'indicateur au-dessus du plateau
        this.indicator.position.set(50, 50, 5);
        this.indicator.renderOrder = 1000;
        
        // Créer le label "N"
        this.createNorthLabel();
        
        // Masquer par défaut
        this.indicator.visible = false;
    }
    
    createNorthLabel() {
        // Créer un canvas pour le texte "N"
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Dessiner le "N" avec un style simple
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(0, 0, 64, 64);
        
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', 32, 32);
        
        // Créer la texture
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 1
        });
        
        this.label = new THREE.Sprite(material);
        this.label.scale.set(8, 8, 1);
        this.label.position.set(0, 20, 5);
        this.label.renderOrder = 1001;
        
        this.indicator.add(this.label);
    }
    
    addToScene() {
        if (this.app.scene && this.indicator) {
            this.app.scene.add(this.indicator);
            console.log('Indicateur Nord ajouté à la scène');
        }
    }
    
    // Méthode pour définir l\'angle du Nord
    setAngle(degrees) {
        if (this.indicator) {
            this.currentAngle = degrees;
            // Convertir les degrés en radians et appliquer la rotation
            // Rotation autour de l\'axe Z (vertical)
            this.indicator.rotation.z = (degrees * Math.PI) / 180;
            console.log(`Indicateur Nord orienté à ${degrees}°`);
            
            // CRITIQUE: S\'assurer que le SunlightManager utilise le bon angle
            if (this.app.sunlightManager) {
                // Mettre à jour l\'angle du Nord dans le SunlightManager
                this.app.sunlightManager.northAngle = degrees;
                console.log(`SunlightManager.northAngle mis à jour: ${degrees}°`);
                
                // Forcer immédiatement la mise à jour de la position du soleil
                if (typeof this.app.sunlightManager.updateSunPosition === 'function') {
                    console.log('Appel updateSunPosition depuis NorthIndicator avec northAngle:', degrees);
                    this.app.sunlightManager.updateSunPosition();
                } else {
                    console.error('updateSunPosition n\\\'existe pas dans SunlightManager');
                }
            } else {
                console.error('SunlightManager non trouvé dans NorthIndicator.setAngle');
            }
        }
    }
    
    // Méthode pour obtenir l\'angle actuel
    getAngle() {
        return this.currentAngle;
    }
    
    // Méthode pour afficher/masquer l\'indicateur
    setVisible(visible) {
        if (this.indicator) {
            this.indicator.visible = visible;
        }
    }
}

// WebCAD Application
export class WebCAD {
    constructor(container) {
        this.container = document.getElementById(container) || document.getElementById('viewport');
        this.THREE = THREE; // Exposer THREE globalement pour l'accès depuis d'autres modules
        
        // Rendre OBJLoader disponible sans modifier l'objet THREE
        this.OBJLoader = OBJLoader;
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.transformControls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
          this.objects = [];
        this.selectedObject = null;        this.selectedObjects = []; // Add array to track multiple selections
        this.currentTool = 'select';
        this.is3DMode = true; // Démarrer en mode 3D par défaut
        this.gridHelper = null;
        this.snapEnabled = true;
        this.gridSize = 1;
        
        // Système d'historique simplifié
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Presse-papier pour copier-coller
        this.clipboard = null;
        
        // Initialiser les layers
        this.layers = [
            { name: 'Calque 0', visible: true, objects: [] }
        ];
        this.currentLayer = 0;
        
        this.init();
        this.elementsLibrary = new ElementsLibrary(this); // Ajouté ici
        this.initManagers();
        // Initialiser l'indicateur nord
        this.northIndicator = new NorthIndicator(this);
        this.setupEventListeners();
        this.animate();
        
        console.log('WebCAD initialized');
    }
    
    init() {
        // Créer la scène
        this.scene = new THREE.Scene();
        
        // Créer un ciel avec dégradé
        this.createSky();
        
        // Créer le plateau de travail
        this.createWorkPlane();
        
        // Configurer la caméra
        const container = document.getElementById('viewport');
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
        // Positionner la caméra plus bas pour voir plus de ciel
        this.camera.position.set(60, -60, 30);
        this.camera.up.set(0, 0, 1); // Z est vers le haut
        
        // Configurer le renderer avec antialiasing amélioré
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // Activer les ombres dès le début        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // Plus de précision pour les ombres
        this.renderer.shadowMap.autoUpdate = true;
        this.renderer.autoClear = true;
        container.appendChild(this.renderer.domElement);
        
        // Ajouter les contrôles
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Ajouter TransformControls
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });
        this.scene.add(this.transformControls);
        
        // Configurer l'éclairage avec ombres
        this.setupLighting();
        
        // Créer le gestionnaire de lumière solaire
        this.createSunlightManager();
        
        // Ajouter les axes étendus jusqu'aux bords du plateau
        this.createExtendedAxes();
    }      initManagers() {
        // Initialiser les gestionnaires
        this.toolManager = new ToolManager(this);
        this.drawingManager = new DrawingManager(this);
        this.snapManager = new SnapManager(this);
        this.extrusionManager = new ExtrusionManager(this);
        this.viewManager = new ViewManager(this);
        this.fileManager = new FileManager(this);
        this.elementManager = new ElementManager(this);        this.selectionManager = new SelectionManager(this);
        this.uiManager = new UIManager(this);

        // Configurer la connexion entre SelectionManager et UIManager pour le panneau propriétés
        this.selectionManager.onSelectionChange = (selectedObjects) => {
            // Mettre à jour le panneau propriétés avec le premier objet sélectionné
            const selectedObject = selectedObjects && selectedObjects.length > 0 ? selectedObjects[0] : null;
            this.uiManager.updatePropertiesPanel(selectedObject);
        };

        // Ensure specific data fields are empty after UIManager initialization.
        this.ensureDataFieldsAreEmpty();
        
        // Ajouter les gestionnaires d'événements pour les raccourcis clavier d'import
        this.setupImportKeyboardShortcuts();
    }

    setupImportKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl+I pour importer COLLADA
            if (event.ctrlKey && event.key === 'i') {
                event.preventDefault();
                this.fileManager.importColladaFile().catch(error => {
                    console.error('Erreur lors de l\'importation via raccourci:', error);
                });
            }
            // Ctrl+Shift+G pour importer GLTF/GLB
            if (event.ctrlKey && event.shiftKey && event.key === 'G') {
                event.preventDefault();
                this.fileManager.importGLTFFile().catch(error => {
                    console.error('Erreur lors de l\'importation GLTF via raccourci:', error);
                });
            }
            // Ctrl+Shift+S pour importer STL
            if (event.ctrlKey && event.shiftKey && event.key === 'S') {
                event.preventDefault();
                this.fileManager.importSTLFile().catch(error => {
                    console.error('Erreur lors de l\'importation STL via raccourci:', error);
                });
            }
            // Ctrl+Shift+K pour importer SKP (affiche les instructions)
            if (event.ctrlKey && event.shiftKey && event.key === 'K') {
                event.preventDefault();
                this.fileManager.showSKPImportInfo();
            }
        });
    }

    ensureDataFieldsAreEmpty() {
        const designerField = document.getElementById('project-designer');
        if (designerField) {
            designerField.value = '';
        }

        const descriptionField = document.getElementById('project-description');
        if (descriptionField) {
            descriptionField.value = '';
        }
        // console.log("Data tab fields 'project-designer' and 'project-description' set to empty.");
    }
    
    createSky() {
        // Créer un shader pour le dégradé du ciel
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            
            void main() {
                float h = normalize(vWorldPosition + offset).z;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `;
        
        const uniforms = {
            topColor: { value: new THREE.Color(0x87CEEB) }, // Bleu ciel
            bottomColor: { value: new THREE.Color(0xFFFFFF) }, // Blanc
            offset: { value: 33 },
            exponent: { value: 0.6 }
        };
        
        const skyGeo = new THREE.SphereGeometry(4000, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    }
    
    createWorkPlane() {
        // Créer un grand plan pour le plateau de travail
        const planeGeometry = new THREE.PlaneGeometry(1000, 1000);        // Utiliser MeshLambertMaterial avec émissivité moins forte pour voir les ombres
        const planeMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff,
            emissive: 0xcccccc,      // Gris clair au lieu de blanc pur
            emissiveIntensity: 0.4,  // Intensité modérée pour permettre la visibilité des ombres
            side: THREE.DoubleSide
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.position.z = -0.1;
        plane.renderOrder = -2;
        plane.receiveShadow = true; // Le plateau reçoit les ombres
        this.scene.add(plane);
        
        // Ne plus créer de grille
        this.gridHelper = null;
    }
      setupEventListeners() {
        // Redimensionnement
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Souris
        this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
        this.renderer.domElement.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            // Vérifier d'abord si on utilise le nouveau système d'outils (currentToolInstance)
            if (this.currentToolInstance && 
                this.currentToolInstance.onRightClick &&
                typeof this.currentToolInstance.onRightClick === 'function') {
                const handled = this.currentToolInstance.onRightClick(e);
                if (handled) return;
            }
            
            // Vérifier ensuite si un outil actif du DrawingManager peut gérer le clic droit
            if (this.drawingManager && this.drawingManager.activeTool && 
                this.drawingManager.activeTool.onRightClick &&
                typeof this.drawingManager.activeTool.onRightClick === 'function') {
                const handled = this.drawingManager.activeTool.onRightClick(e);
                if (handled) return;
            }
            
            // Déléguer au SelectionManager si disponible
            if (this.selectionManager && typeof this.selectionManager.handleRightClick === 'function') {
                this.selectionManager.handleRightClick(e);
            }
        });
        
        // Raccourcis clavier
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
      onMouseClick(event) {
        console.log('WebCAD.onMouseClick() déclenché');
        
        // Gérer le mode texture/couleur
        if (this.textureApplyMode && this.selectedTexture) {
            const intersects = this.getIntersections(event);
            if (intersects.length > 0) {
                const object = intersects[0].object;
                
                if (this.selectedTextureType === 'color') {
                    this.applyColorToObject(object, this.selectedTexture);
                } else {
                    this.applyTextureToObject(object, this.selectedTexture);
                }

                // Après avoir appliqué la texture/couleur, repasser en mode sélection
                this.textureApplyMode = false;
                this.selectedTexture = null;
                if (this.toolManager) {
                    this.toolManager.setTool('select');
                    // Restaurer le curseur par défaut
                    this.renderer.domElement.style.cursor = 'default';
                }
            }
            return;
        }
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
          if (this.currentTool === 'select') {
            console.log('Mode sélection actif');
            const intersects = this.getIntersections(event);
            console.log(`Intersections trouvées: ${intersects.length}`);
            
            if (intersects.length > 0) {
                // Chercher un objet différent de celui actuellement sélectionné
                let targetObject = null;
                
                for (let i = 0; i < intersects.length; i++) {
                    const candidateObject = intersects[i].object;
                    
                    // Si on a déjà un objet sélectionné, essayer de trouver un objet différent
                    if (this.selectedObjects.length > 0) {
                        const currentSelected = this.selectedObjects[0];
                        if (candidateObject.uuid !== currentSelected.uuid) {
                            targetObject = candidateObject;
                            break;
                        }
                    } else {
                        // Aucun objet sélectionné, prendre le premier
                        targetObject = candidateObject;
                        break;
                    }
                }
                
                // Si on n'a pas trouvé d'objet différent, prendre le premier (comportement par défaut)
                if (!targetObject) {
                    targetObject = intersects[0].object;
                }
                
                console.log(`Objet cible: ${targetObject.uuid}, type: ${targetObject.type}`);
                
                // Si l'objet cliqué fait partie d'un groupe, sélectionner le groupe entier
                if (targetObject.parent instanceof THREE.Group) {
                    console.log('Sélection du groupe parent');
                    this.selectObject(targetObject.parent);
                } else {
                    console.log('Sélection de l\'objet individuel');
                    this.selectObject(targetObject);
                }
            } else {
                console.log('Clic dans le vide, désélection');
                this.deselectAll();
            }        } else if (this.currentTool === 'extrude') {
            this.extrusionManager.handleExtrusion(event);        } else if (this.currentTool === 'hatch') {
            // Pour l'outil hachure, d'abord tenter de détecter les objets cliqués
            if (this.drawingManager && this.drawingManager.hatchTool) {
                // Laisser l'outil hachure gérer directement le clic avec l'événement complet
                const handled = this.drawingManager.hatchTool.onMouseDown(event);
                if (!handled) {
                    // Si l'outil hachure n'a pas géré le clic, faire un fallback vers le point 3D
                    let point = this.getWorldPoint(event);
                    if (point) {
                        point = this.snapManager.checkSnapping(point, event);
                        this.drawingManager.handleDrawing(point, event);
                    }
                }
            }
        } else if (['parallel', 'trim', 'extend', 'dimension'].includes(this.currentTool)) {
            // Pour les nouveaux outils, passer directement le point 3D
            let point = this.getWorldPoint(event);
            if (point) {
                // Appliquer l'accrochage
                point = this.snapManager.checkSnapping(point, event);
                this.drawingManager.handleDrawing(point, event);
            }
        } else {
            // Gérer le dessin multi-points pour les autres outils
            let point = this.getWorldPoint(event);
            if (point) {
                // Appliquer l'accrochage
                point = this.snapManager.checkSnapping(point, event);
                this.drawingManager.handleDrawing(point, event);
            }
        }
    }    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        
        // Mettre à jour les coordonnées
        let worldPoint = this.getWorldPoint(event);
        
        if (worldPoint) {
            // D'abord vérifier l'accrochage aux points spécifiques (prioritaire)
            worldPoint = this.snapManager.checkSnapping(worldPoint, event);
            this.uiManager.updateCoordinates(worldPoint);
            
            // Mettre à jour l'aperçu pendant le dessin
            // Simplification de la condition : si un outil de dessin est actif, on tente de mettre à jour l'aperçu.
            // Le DrawingManager et l'outil spécifique détermineront si un aperçu est réellement nécessaire.
            if (this.drawingManager && 
                this.currentTool !== 'select' && 
                this.currentTool !== 'extrude' &&
                this.currentTool !== null) { // Assurez-vous qu'un outil est défini
                this.drawingManager.updateDrawingPreview(worldPoint, event);
            }
            
            // Mettre à jour l'aperçu pendant l'extrusion
            if (this.extrusionManager.isExtruding) {
                this.extrusionManager.updateExtrusionPreview(event);
            }
        }
    }
    
    getWorldPoint(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const point = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(planeZ, point);
        
        return point;
    }      getIntersections(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // Obtenir toutes les intersections avec gestion des groupes
        const intersects = raycaster.intersectObjects(this.objects, true);
        
        // Créer une map pour éviter les doublons d'objets réellement sélectionnables
        const uniqueObjects = new Map();
        const validIntersects = [];
        
        for (const intersect of intersects) {
            let selectableObject = intersect.object;
            
            // Chercher l'objet sélectionnable : 
            // - Objet avec userData.elementType (éléments de construction)
            // - Objet avec userData.type (formes géométriques : rectangle, circle, etc.)
            // - Sinon remonter jusqu'au parent qui a l'une de ces propriétés
            while (selectableObject && 
                   !selectableObject.userData.elementType && 
                   !selectableObject.userData.type && 
                   selectableObject.parent && 
                   !(selectableObject.parent instanceof THREE.Scene)) {
                selectableObject = selectableObject.parent;
            }
            
            // Si on a trouvé un objet sélectionnable et qu'il n'est pas déjà dans la liste
            if (selectableObject && 
                (selectableObject.userData.elementType || selectableObject.userData.type) && 
                !uniqueObjects.has(selectableObject.uuid)) {
                
                uniqueObjects.set(selectableObject.uuid, true);
                validIntersects.push({
                    ...intersect,
                    object: selectableObject,
                    originalObject: intersect.object,
                    distance: intersect.distance
                });
            }
        }
        
        // Trier par distance (le plus proche en premier)
        return validIntersects.sort((a, b) => a.distance - b.distance);
    }selectObject(object) {
        console.log(`selectObject appelé pour: ${object.uuid}`);
        console.log(`État avant sélection - isSelected: ${object.userData.isSelected}, dans selectedObjects: ${this.selectedObjects.includes(object)}`);

        // Check if shift is held for multi-select - avec vérification de sécurité
        const shiftPressed = this.drawingManager && this.drawingManager.shiftPressed;
        if (!shiftPressed) {
            this.deselectAll();
        }

        this.selectedObject = object;
        object.userData.isSelected = true;
        
        // S'assurer que l'objet n'est pas déjà dans selectedObjects
        if (!this.selectedObjects.includes(object)) {
            this.selectedObjects.push(object);
        }
        
        this.transformControls.attach(object);
        
        // Highlight le groupe et tous ses enfants
        if (object instanceof THREE.Group) {
            // Highlight chaque enfant du groupe individuellement
            object.children.forEach(child => {
                this.highlightObject(child);
                child.userData.isSelected = true;
            });
        } else {
            this.highlightObject(object);
        }        if (this.uiManager) {
            this.uiManager.updatePropertiesPanel(object);
        }
          // Vérifier si une hachure a été sélectionnée pour permettre sa modification directe
        if (this.currentTool === 'select') {
            this.checkAndModifySelectedHatch(object);
        }
        
        console.log(`Objet sélectionné avec succès: ${object.uuid}, selectedObjects count: ${this.selectedObjects.length}`);
    }
    
    checkAndModifySelectedHatch(object) {
        // Vérifier si l'objet sélectionné ou son parent est une hachure
        let hatchObject = object;
        while (hatchObject && !hatchObject.userData.isHatch) {
            hatchObject = hatchObject.parent;
        }
        
        if (hatchObject && hatchObject.userData.isHatch) {
            console.log('🎯 Hachure détectée, activation de l\'outil de modification');
            
            // Activer l'outil hatch si ce n'est pas déjà fait
            if (this.currentTool !== 'hatch') {
                this.toolManager.setTool('hatch');
            }
            
            // Obtenir l'instance de HatchTool depuis le DrawingManager
            if (this.drawingManager && this.drawingManager.hatchTool) {
                const hatchTool = this.drawingManager.hatchTool;
                
                // Préparer les données de la hachure existante
                const hatchData = {
                    pattern: hatchObject.userData.pattern || 'parallel',
                    density: hatchObject.userData.density || 1,
                    angle: hatchObject.userData.angle || 45,
                    color: hatchObject.userData.color || '#000000'
                };
                
                // Sélectionner la hachure dans l'outil
                hatchTool.selectedHatch = hatchObject;
                hatchTool.selectedSurface = null;
                
                // Afficher le dialogue de modification
                hatchTool.showPatternDialog(hatchData);
                
                console.log('🎯 Dialogue de modification de hachure ouvert');
                return true;
            }
        }
        
        return false;
    }
    
    deselectAll() {
        console.log(`Désélection de ${this.selectedObjects.length} objets`);
        
        this.selectedObjects.forEach(obj => {
            if (obj instanceof THREE.Group) {
                // Unhighlight chaque enfant du groupe
                obj.children.forEach(child => {
                    this.unhighlightObject(child);
                    child.userData.isSelected = false;
                });
            } else {
                this.unhighlightObject(obj);
            }
            obj.userData.isSelected = false;
        });
        
        this.selectedObjects = [];
        this.selectedObject = null;
        this.transformControls.detach();
        
        if (this.uiManager) {
            this.uiManager.updatePropertiesPanel(null);
        }
        
        console.log('Désélection terminée');
    }
    
    highlightObject(object) {
        // Si c'est un groupe, mettre en surbrillance tous ses enfants qui ont une géométrie
        if (object instanceof THREE.Group) {
            let hasHighlightableChildren = false;
            object.traverse(child => {
                if (child.isMesh && child.geometry) {
                    hasHighlightableChildren = true;
                    // Sauvegarder les matériaux originaux
                    if (!child.userData.originalMaterial && child.material) {
                        child.userData.originalMaterial = child.material.clone();
                        child.userData.originalOpacity = child.material.opacity;
                        child.userData.originalTransparent = child.material.transparent;
                    }

                    // Créer un contour pour les meshes avec gestion GLB améliorée
                    this.createHighlightOutline(child);                } else if (child instanceof THREE.Line) {
                    // Pour les lignes, sauvegarder le matériau original et stocker la couleur originale
                    if (!child.userData.originalMaterial) {
                        child.userData.originalMaterial = child.material.clone();
                    }
                    // Stocker la couleur originale si elle n'est pas déjà stockée
                    if (child.userData.originalColor === undefined) {
                        child.userData.originalColor = child.material.color.getHex();
                    }
                    // Appliquer la couleur de sélection
                    child.material = new THREE.LineBasicMaterial({
                        color: 0x0066ff,
                        linewidth: 4,
                        opacity: 1,
                        transparent: false
                    });
                }
            });
            
            if (!hasHighlightableChildren) {
                console.log('Groupe sans éléments surlignables ignoré:', object);
            }
            return;
        }

        // Pour un objet individuel
        if (object.isMesh && object.geometry) {
            // Sauvegarder le matériau original
            if (!object.userData.originalMaterial) {
                object.userData.originalMaterial = object.material.clone();
                object.userData.originalOpacity = object.material.opacity;
                object.userData.originalTransparent = object.material.transparent;
            }

            // Créer un contour pour le mesh avec gestion GLB améliorée
            this.createHighlightOutline(object);        } else if (object instanceof THREE.Line) {
            // Pour les lignes, sauvegarder le matériau original et stocker la couleur originale
            if (!object.userData.originalMaterial) {
                object.userData.originalMaterial = object.material.clone();
            }
            // Stocker la couleur originale si elle n'est pas déjà stockée
            if (object.userData.originalColor === undefined) {
                object.userData.originalColor = object.material.color.getHex();
            }
            // Appliquer la couleur de sélection
            object.material = new THREE.LineBasicMaterial({
                color: 0x0066ff,
                linewidth: 4,
                opacity: 1,
                transparent: false
            });
        } else {
            console.log('Objet non surlignables ignoré:', object);
        }
    }    createHighlightOutline(mesh) {
        // Méthode robuste pour créer un outline parfaitement centré
        try {
            // MÉTHODE 1: EdgesGeometry pour un outline précis
            const edges = new THREE.EdgesGeometry(mesh.geometry);
            const outlineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x0066ff, 
                linewidth: 4,
                transparent: true,
                opacity: 0.9
            });
            
            const outline = new THREE.LineSegments(edges, outlineMaterial);
            outline.name = 'highlight-outline';
            outline.renderOrder = mesh.renderOrder + 1;
            mesh.add(outline);
            
            console.log('Outline créé avec EdgesGeometry - centrage parfait');
            
        } catch (edgeError) {
            // MÉTHODE 2: Utiliser un matériau émissif sur l'objet original
            try {
                console.warn('EdgesGeometry échoué, utilisation matériau émissif:', edgeError);
                
                // Sauvegarder le matériau original
                if (!mesh.userData.originalMaterial) {
                    mesh.userData.originalMaterial = mesh.material;
                }
                
                // Créer un matériau avec émission bleue
                const highlightMaterial = mesh.material.clone();
                highlightMaterial.emissive = new THREE.Color(0x0033aa);
                highlightMaterial.emissiveIntensity = 0.3;
                
                mesh.material = highlightMaterial;
                mesh.userData.hasEmissiveHighlight = true;
                
                console.log('Outline créé avec matériau émissif');
                
            } catch (emissiveError) {
                // MÉTHODE 3: Fallback wireframe simple
                try {
                    console.warn('Matériau émissif échoué, utilisation wireframe:', emissiveError);
                    
                    const outlineGeometry = mesh.geometry.clone();
                    const outlineMaterial = new THREE.MeshBasicMaterial({
                        color: 0x0066ff,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.8
                    });
                    
                    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
                    outline.name = 'highlight-outline';
                    outline.renderOrder = mesh.renderOrder + 1;
                    mesh.add(outline);
                    
                    console.log('Outline créé avec wireframe');
                    
                } catch (wireframeError) {
                    // MÉTHODE 4: Fallback scaling minimal
                    console.warn('Wireframe échoué, utilisation scaling minimal:', wireframeError);
                    
                    const outlineGeometry = mesh.geometry.clone();
                    const outlineMaterial = new THREE.MeshBasicMaterial({
                        color: 0x0066ff,
                        side: THREE.BackSide,
                        transparent: true,
                        opacity: 0.5
                    });
                    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
                    outline.scale.multiplyScalar(1.01); // Scaling très minimal
                    outline.name = 'highlight-outline';
                    outline.renderOrder = mesh.renderOrder - 1;
                    mesh.add(outline);
                    
                    console.log('Outline créé avec scaling minimal');
                }
            }
        }
    }      unhighlightObject(object) {
        // Si c'est un groupe, parcourir tous ses enfants
        if (object instanceof THREE.Group) {
            object.traverse(child => {
                if (child.isMesh) {
                    this.removeMeshHighlight(child);
                } else if (child instanceof THREE.Line) {
                    this.removeLineHighlight(child);
                }
            });
            return;
        }

        // Pour un objet individuel
        if (object.isMesh) {
            this.removeMeshHighlight(object);
        } else if (object instanceof THREE.Line) {
            this.removeLineHighlight(object);
        }
    }
    
    removeMeshHighlight(mesh) {
        if (!mesh || !mesh.isMesh) return;
        
        // Méthode 1: Retirer outline géométrique
        const outline = mesh.getObjectByName('highlight-outline');
        if (outline) {
            mesh.remove(outline);
            if (outline.geometry) outline.geometry.dispose();
            if (outline.material) outline.material.dispose();
        }
        
        // Méthode 2: Restaurer matériau original (surbrillance émissive)
        if (mesh.userData.hasEmissiveHighlight && mesh.userData.originalMaterial) {
            mesh.material = mesh.userData.originalMaterial;
            delete mesh.userData.originalMaterial;
            delete mesh.userData.hasEmissiveHighlight;
            console.log(`[WebCAD] Restored material for emissive highlight on:`, mesh.name, mesh.userData.elementType);
        }
        
        // Méthode 3: Restaurer propriétés matériau (ancienne méthode)
        if (mesh.userData.originalMaterial) {
            console.log(`[WebCAD] Restoring original material for:`, mesh.name, mesh.userData.elementType);
            console.log(`[WebCAD] Before restoration - originalOpacity: ${mesh.userData.originalOpacity}, originalTransparent: ${mesh.userData.originalTransparent}`);
            mesh.material = mesh.userData.originalMaterial;
            if (mesh.userData.originalOpacity !== undefined) {
                mesh.material.opacity = mesh.userData.originalOpacity;
            }
            if (mesh.userData.originalTransparent !== undefined) {
                mesh.material.transparent = mesh.userData.originalTransparent;
            }            

            // FORCER L'OPACITÉ POUR LES BRIQUES APRÈS RESTAURATION
            const isBrick = (mesh.userData.category === 'briques') || 
                            (mesh.userData.elementType && typeof mesh.userData.elementType === 'string' && mesh.userData.elementType.toLowerCase().includes('brique'));

            if (isBrick) {
                console.log(`[WebCAD] Object is a BRICK. Forcing opaque material after restoration.`);
                mesh.material.transparent = false;
                mesh.material.opacity = 1.0;
                mesh.material.depthWrite = true; // Assurer l'écriture au depth buffer
                if (mesh.material.color.getHexString() !== 'cc0000') {
                    console.warn(`[WebCAD] Brick material color was not red (${mesh.material.color.getHexString()}), forcing red.`);
                    mesh.material.color.setHex(0xCC0000);
                }
                mesh.material.needsUpdate = true;
            }
            console.log(`[WebCAD] After restoration - material.opacity: ${mesh.material.opacity}, material.transparent: ${mesh.material.transparent}`);

            delete mesh.userData.originalMaterial;
            delete mesh.userData.originalOpacity;
            delete mesh.userData.originalTransparent;
        }
    }
    
    removeLineHighlight(line) {
        if (!line || !(line instanceof THREE.Line)) return;
        
        console.log(`[WebCAD] Removing line highlight for:`, line.name, line.userData.type);
        
        // Restaurer la couleur originale stockée dans userData.originalColor
        if (line.userData.originalColor !== undefined) {
            console.log(`[WebCAD] Restoring original color: #${line.userData.originalColor.toString(16).padStart(6, '0')}`);
            line.material.color.setHex(line.userData.originalColor);
            line.material.needsUpdate = true;
        } else if (line.userData.originalMaterial) {
            // Fallback vers le matériau original si originalColor n'est pas disponible
            console.log(`[WebCAD] Restoring original material for line`);
            line.material = line.userData.originalMaterial;
            delete line.userData.originalMaterial;
        } else {
            // Fallback vers noir par défaut
            console.log(`[WebCAD] No original color found, defaulting to black`);
            line.material.color.setHex(0x000000);
            line.material.needsUpdate = true;
        }
    }

    // ...existing code...
    
    // Méthode alternative pour la surbrillance utilisant les coordonnées monde
    createWorldSpaceHighlight(mesh) {
        try {
            // Calculer la bounding box dans l'espace monde
            mesh.updateMatrixWorld(true);
            const worldBox = new THREE.Box3().setFromObject(mesh);
            const center = worldBox.getCenter(new THREE.Vector3());
            const size = worldBox.getSize(new THREE.Vector3());
            
            // Créer une géométrie d'outline basée sur la bounding box
            const outlineGeometry = new THREE.BoxGeometry(
                size.x * 1.05, 
                size.y * 1.05, 
                size.z * 1.05
            );
            
            const outlineMaterial = new THREE.MeshBasicMaterial({
                color: 0x0066ff,
                transparent: true,
                opacity: 0.3,
                wireframe: true
            });
            
            const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outline.position.copy(center);
            outline.name = 'world-highlight-outline';
            outline.renderOrder = 999; // Rendre en dernier
            
            // Ajouter à la scène plutôt qu'à l'objet
            this.scene.add(outline);
            
            // Stocker la référence pour pouvoir le supprimer plus tard
            if (!mesh.userData.worldOutlines) {
                mesh.userData.worldOutlines = [];
            }
            mesh.userData.worldOutlines.push(outline);
            
            console.log('Outline monde créé pour objet GLB');
            return outline;
        } catch (error) {
            console.warn('Erreur création outline monde:', error);
            return null;
        }
    }
    
    // Méthode pour supprimer les outlines monde
    removeWorldSpaceHighlight(mesh) {
        if (mesh.userData.worldOutlines) {
            mesh.userData.worldOutlines.forEach(outline => {
                this.scene.remove(outline);
                if (outline.geometry) outline.geometry.dispose();
                if (outline.material) outline.material.dispose();
            });
            mesh.userData.worldOutlines = [];
        }
    }
    
    addToHistory(action, object, oldData = null) {
        // Supprimer les éléments futurs si on est au milieu de l'historique
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        const historyEntry = {
            action: action,
            object: object,
            objectId: object.uuid,
            timestamp: Date.now(),
            oldData: oldData
        };
        
        this.history.push(historyEntry);
        this.historyIndex++;
        
        // Limiter la taille de l'historique
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        console.log(`Historique ajouté: ${action}, index: ${this.historyIndex}`);
    }
    
    undo() {
        console.log(`Tentative d'annulation, index: ${this.historyIndex}, historique: ${this.history.length}`);
        
        if (this.historyIndex >= 0) {
            const entry = this.history[this.historyIndex];
            console.log(`Annulation de: ${entry.action}`);
            
            switch(entry.action) {
                case 'create':
                    // Supprimer l'objet créé
                    const objToRemove = this.objects.find(obj => obj.uuid === entry.objectId);
                    if (objToRemove) {
                        this.scene.remove(objToRemove);
                        this.objects = this.objects.filter(obj => obj.uuid !== entry.objectId);
                        
                        // Supprimer des calques
                        this.layers.forEach(layer => {
                            layer.objects = layer.objects.filter(obj => obj.uuid !== entry.objectId);
                        });
                        
                        // Désélectionner si c'était l'objet sélectionné
                        if (this.selectedObject && this.selectedObject.uuid === entry.objectId) {
                            this.deselectAll();
                        }
                        
                        console.log('Objet supprimé par annulation');
                    }
                    break;
                    
                case 'delete':
                    // Pour l'instant, on ne peut pas recréer l'objet supprimé
                    console.log('Annulation de suppression non implémentée');
                    break;
            }
            
            this.historyIndex--;
            document.getElementById('command-output').textContent = `Annulé: ${entry.action}`;
            
            if (this.uiManager) {
                this.uiManager.updateHistoryPanel();
            }
        } else {
            document.getElementById('command-output').textContent = 'Rien à annuler';
            console.log('Rien à annuler');
        }
    }
    
    redo() {
        console.log(`Tentative de rétablissement, index: ${this.historyIndex}, historique: ${this.history.length}`);
        
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const entry = this.history[this.historyIndex];
            console.log(`Rétablir: ${entry.action}`);
            
            switch(entry.action) {
                case 'create':
                    // Recréer l'objet qui avait été supprimé par undo
                    if (entry.object && !this.objects.find(obj => obj.uuid === entry.objectId)) {
                        this.scene.add(entry.object);
                        this.objects.push(entry.object);
                        this.layers[this.currentLayer].objects.push(entry.object);
                        console.log('Objet recréé par rétablissement');
                    }
                    break;
                    
                case 'delete':
                    // Supprimer à nouveau l'objet
                    const objToRemove = this.objects.find(obj => obj.uuid === entry.objectId);
                    if (objToRemove) {
                        this.scene.remove(objToRemove);
                        this.objects = this.objects.filter(obj => obj.uuid !== entry.objectId);
                        this.layers.forEach(layer => {
                            layer.objects = layer.objects.filter(obj => obj.uuid !== entry.objectId);
                        });
                        
                        if (this.selectedObject && this.selectedObject.uuid === entry.objectId) {
                            this.deselectAll();
                        }
                        console.log('Objet supprimé par rétablissement');
                    }
                    break;
            }
            
            document.getElementById('command-output').textContent = `Rétabli: ${entry.action}`;
            
            if (this.uiManager) {
                this.uiManager.updateHistoryPanel();
            }
        } else {
            document.getElementById('command-output').textContent = 'Rien à rétablir';
            console.log('Rien à rétablir');
        }
    }
    
    deleteSelected() {
        if (this.selectedObject) {
            console.log('Suppression de l\'objet sélectionné');
            
            // Vérifier si c'est un rectangle (PlaneGeometry)
            if (
                this.selectedObject instanceof THREE.Mesh &&
                this.selectedObject.geometry instanceof THREE.PlaneGeometry
            ) {
                console.log('Rectangle détecté, affichage du menu de suppression');
                this.showRectangleDeleteOptions();
                return;
            }
            
            // Ajouter à l'historique AVANT la suppression
            this.addToHistory('delete', this.selectedObject);
            
            // Supprimer de la scène
            this.scene.remove(this.selectedObject);
            
            // Supprimer des tableaux
            this.objects = this.objects.filter(obj => obj.uuid !== this.selectedObject.uuid);
            this.layers.forEach(layer => {
                layer.objects = layer.objects.filter(obj => obj.uuid !== this.selectedObject.uuid);
            });
            
            // Détacher les contrôles
            this.transformControls.detach();
            this.selectedObject = null;
            
            // Mettre à jour l'interface
            if (this.uiManager) {
                this.uiManager.updatePropertiesPanel(null);
            }
            
            document.getElementById('command-output').textContent = 'Objet supprimé';
            console.log('Objet supprimé avec succès');
        } else {
            document.getElementById('command-output').textContent = 'Aucun objet sélectionné';
        }
    }

    showRectangleDeleteOptions() {
        console.log('Affichage du dialogue de suppression');
        
        // Supprimer les dialogues existants
        const existingDialog = document.querySelector('.rectangle-delete-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.className = 'rectangle-delete-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #007bff;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
            min-width: 300px;
        `;
        
        dialog.innerHTML = `
            <div style="margin-bottom: 15px; font-weight: bold; text-align: center; font-size: 16px;">
                Supprimer le rectangle
            </div>
            <div style="margin-bottom: 15px; color: #666; text-align: center;">
                Comment souhaitez-vous supprimer ce rectangle ?
            </div>
            <div style="text-align: center;">
                <button id="delete-surface-only-btn" style="
                    background: #28a745; color: white; border: none; 
                    padding: 12px 20px; border-radius: 4px; margin: 8px 0;
                    cursor: pointer; display: block; width: 100%; font-size: 14px;">
                    🔲 Supprimer la surface (garder les contours)
                </button>
                <button id="delete-completely-btn" style="
                    background: #dc3545; color: white; border: none; 
                    padding: 12px 20px; border-radius: 4px; margin: 8px 0;
                    cursor: pointer; display: block; width: 100%; font-size: 14px;">
                    🗑️ Supprimer complètement
                </button>
                <button id="cancel-delete-btn" style="
                    background: #6c757d; color: white; border: none; 
                    padding: 12px 20px; border-radius: 4px; margin: 8px 0;
                    cursor: pointer; display: block; width: 100%; font-size: 14px;">
                    ❌ Annuler
                </button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        console.log('Dialogue ajouté au DOM');
        
        // Gestionnaires d'événements
        document.getElementById('delete-surface-only-btn').addEventListener('click', () => {
            console.log('Suppression surface seulement');
            this.removeRectangleSurfaceKeepEdges();
            document.body.removeChild(dialog);
        });
        
        document.getElementById('delete-completely-btn').addEventListener('click', () => {
            console.log('Suppression complète');
            this.deleteSelectedCompletely();
            document.body.removeChild(dialog);
        });
        
        document.getElementById('cancel-delete-btn').addEventListener('click', () => {
            console.log('Annulation suppression');
            document.body.removeChild(dialog);
            document.getElementById('command-output').textContent = 'Suppression annulée';
        });
    }

    removeRectangleSurfaceKeepEdges() {
        if (!this.selectedObject) return;

        const rectMesh = this.selectedObject;
        
        // Supprimer uniquement la géométrie de la surface
        if (rectMesh.geometry) {
            rectMesh.geometry.dispose();
            rectMesh.geometry = null;
        }
        
        // Restaurer le matériau d'origine s'il existe
        if (rectMesh.userData.originalMaterial) {
            rectMesh.material = rectMesh.userData.originalMaterial;
            delete rectMesh.userData.originalMaterial;
        }
        
        // Mettre à jour l'interface
        if (this.uiManager) {
            this.uiManager.updatePropertiesPanel(rectMesh);
        }
        
        document.getElementById('command-output').textContent = 'Surface du rectangle supprimée, contours conservés';
        console.log('Surface du rectangle supprimée, contours conservés');
    }

    deleteSelectedCompletely() {
        if (!this.selectedObject) return;

        // Ajouter à l'historique AVANT la suppression
        this.addToHistory('delete', this.selectedObject);
        
        // Supprimer de la scène
        this.scene.remove(this.selectedObject);
        
        // Supprimer des tableaux
        this.objects = this.objects.filter(obj => obj.uuid !== this.selectedObject.uuid);
        this.layers.forEach(layer => {
            layer.objects = layer.objects.filter(obj => obj.uuid !== this.selectedObject.uuid);
        });
        
        // Détacher les contrôles
        this.transformControls.detach();
        this.selectedObject = null;
        
        // Mettre à jour l'interface
        if (this.uiManager) {
            this.uiManager.updatePropertiesPanel(null);
        }
        
        document.getElementById('command-output').textContent = 'Objet supprimé complètement';
        console.log('Objet supprimé complètement');
    }
    
    handleKeyboard(event) {
        // If an input field is focused, don't process global shortcuts
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) {
            if (event.key !== 'Escape') {
                return;
            }        }

        // Mettre à jour shiftPressed de manière sécurisée
        if (this.drawingManager) {
            this.drawingManager.shiftPressed = event.shiftKey;
        }
        
        // Pass keyboard events to DrawingManager safely
        if (this.drawingManager && typeof this.drawingManager.handleKeyboard === 'function') {
            try {
                this.drawingManager.handleKeyboard(event);
            } catch (error) {
                console.warn('Error in DrawingManager.handleKeyboard:', error);
            }
        }
        
        if (event.key === 'Escape') {
            if (this.drawingManager && this.drawingManager.isDrawing) {
                this.drawingManager.cancelDrawing();
            } else if (this.extrusionManager && this.extrusionManager.isExtruding) {
                this.extrusionManager.cancelExtrusion();
            } else if (this.currentTool === 'parallel' && this.drawingManager && this.drawingManager.parallelTool) {
                this.drawingManager.parallelTool.cancel();
            } else {
                this.deselectAll();
            }
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
            if (this.selectedObject) {
                if (this.uiManager && typeof this.uiManager.deleteSelected === 'function') {
                    this.uiManager.deleteSelected();
                } else {
                    this.deleteSelected();
                }
            }
        } else if (event.key === 'z' && event.ctrlKey) {
            event.preventDefault();
            this.undo();
        } else if (event.key === 'y' && event.ctrlKey) {
            event.preventDefault();
            this.redo();
        } else if (event.key === 'c' && event.ctrlKey) {
            event.preventDefault();
            this.copySelected();
        } else if (event.key === 'v' && event.ctrlKey) {
            event.preventDefault();
            this.pasteFromClipboard();
        } else if (event.key === 'x' && event.ctrlKey) {
            event.preventDefault();
            this.cutSelected();        } else if (event.key === 'o' || event.key === 'O') {
            // Raccourci pour activer le mode orbit
            this.activateOrbitMode();
        } else if (event.key === 'p' || event.key === 'P') {
            // Raccourci pour activer l'outil extrude
            if (this.toolManager) {
                this.toolManager.setTool('extrude');
                document.getElementById('command-output').textContent = 'Outil Extrusion activé (P)';
            }
        } else if (event.key === 'l' || event.key === 'L') {
            // Raccourci pour activer l'outil polyline
            if (this.toolManager) {
                this.toolManager.setTool('polyline');
                document.getElementById('command-output').textContent = 'Outil Polyline activé (L)';
            }
        } else if (event.key === 'm' || event.key === 'M') {
            // Raccourci pour activer l'outil move (transformer en mode déplacement)
            if (this.selectedObject && this.transformControls) {
                this.transformControls.setMode('translate');
                document.getElementById('command-output').textContent = 'Mode Déplacement activé (M)';
            } else {
                document.getElementById('command-output').textContent = 'Sélectionnez un objet pour utiliser le mode Déplacement (M)';
            }
        } else if (event.key === 'g' && event.ctrlKey) {
            event.preventDefault();
            const selectedObjects = this.objects.filter(obj => obj.userData.isSelected);
            this.createGroup(selectedObjects);
        } else if (event.key === 'e' && event.ctrlKey) {
            event.preventDefault();
            if (this.selectedObject instanceof THREE.Group) {
                this.explodeGroup(this.selectedObject);
            }
        }
        
        // Déléguer aux gestionnaires safely
        if (this.snapManager && typeof this.snapManager.handleKeyboard === 'function') {
            this.snapManager.handleKeyboard(event);
        }
    }
    
    copySelected() {
        if (this.selectedObject) {
            // Cloner l'objet sélectionné
            this.clipboard = this.cloneObject(this.selectedObject);
            document.getElementById('command-output').textContent = 'Objet copié dans le presse-papier';
            console.log('Objet copié');
        } else {
            document.getElementById('command-output').textContent = 'Aucun objet sélectionné à copier';
        }
    }
    
    cutSelected() {
        if (this.selectedObject) {
            // Copier puis supprimer
            this.clipboard = this.cloneObject(this.selectedObject);
            this.deleteSelected();
            document.getElementById('command-output').textContent = 'Objet coupé';
            console.log('Objet coupé');
        } else {
            document.getElementById('command-output').textContent = 'Aucun objet sélectionné à couper';
        }
    }
    
    pasteFromClipboard() {
        if (this.clipboard) {
            // Cloner l'objet du presse-papier
            const newObject = this.cloneObject(this.clipboard);
            
            // Décaler légèrement la position pour éviter la superposition
            newObject.position.x += 5;
            newObject.position.y += 5;
            
            // Ajouter à la scène
            this.scene.add(newObject);
            this.objects.push(newObject);
            this.layers[this.currentLayer].objects.push(newObject);
            
            // Ajouter à l'historique
            this.addToHistory('create', newObject);
            
            // Sélectionner le nouvel objet
            this.selectObject(newObject);
            
            document.getElementById('command-output').textContent = 'Objet collé';
            console.log('Objet collé');
            
            if (this.uiManager) {
                this.uiManager.updateHistoryPanel();
            }
        } else {
            document.getElementById('command-output').textContent = 'Presse-papier vide';
        }
    }
    
    cloneObject(object) {
        try {
            // Cloner la géométrie
            const clonedGeometry = object.geometry.clone();
            
            // Cloner le matériau
            const clonedMaterial = object.material.clone();
            
            // Créer le nouvel objet
            let clonedObject;
            if (object instanceof THREE.Line) {
                clonedObject = new THREE.Line(clonedGeometry, clonedMaterial);
            } else if (object instanceof THREE.Mesh) {
                clonedObject = new THREE.Mesh(clonedGeometry, clonedMaterial);
            } else {
                console.warn('Type d\'objet non supporté pour le clonage');
                return null;
            }
            
            // Copier les propriétés de transformation
            clonedObject.position.copy(object.position);
            clonedObject.rotation.copy(object.rotation);
            clonedObject.scale.copy(object.scale);
            clonedObject.renderOrder = object.renderOrder;
            
            // Copier les données utilisateur
            if (object.userData) {
                clonedObject.userData = JSON.parse(JSON.stringify(object.userData));
            }
            
            // Cloner les enfants (comme les arêtes)
            object.children.forEach(child => {
                if (child instanceof THREE.LineSegments) {
                    const childClone = new THREE.LineSegments(
                        child.geometry.clone(),
                        child.material.clone()
                    );
                    childClone.renderOrder = child.renderOrder;
                    clonedObject.add(childClone);
                }
            });
            
            return clonedObject;
        } catch (error) {
            console.error('Erreur lors du clonage:', error);
            return null;
        }
    }
    
    activateOrbitMode() {
        // Activer les contrôles d'orbite
        this.controls.enabled = true;
        this.controls.enableRotate = true;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        
        // Passer en mode sélection pour libérer les autres outils
        this.toolManager.setTool('select');
        
        document.getElementById('command-output').textContent = 'Mode Orbit activé - Utilisez la souris pour naviguer dans la vue 3D';
    }
      onWindowResize() {
        // Déléguer le redimensionnement au ViewManager qui gère les caméras perspective et orthogonale
        if (this.viewManager && this.viewManager.onWindowResize) {
            this.viewManager.onWindowResize();
        } else {
            // Fallback pour compatibilité
            const container = document.getElementById('viewport');
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    createExtendedAxes() {
        // Créer des axes qui s'étendent sur toute la longueur du plateau (1000x1000)
        const axisLength = 500; // Demi-longueur du plateau
        
        // Axe X (Rouge) - sur le plateau à Z = 0
        const xPoints = [
            new THREE.Vector3(-axisLength, 0, 0),
            new THREE.Vector3(axisLength, 0, 0)
        ];
        const xGeometry = new THREE.BufferGeometry().setFromPoints(xPoints);
        const xMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff0000,
            linewidth: 2,
            opacity: 0.8,
            transparent: true
        });        const xAxis = new THREE.Line(xGeometry, xMaterial);
        xAxis.name = 'AXIS'; // Nommer pour permettre le toggle
        xAxis.userData.axisType = 'X';
        xAxis.renderOrder = 100;
        this.scene.add(xAxis);
        
        // Axe Y (Vert) - sur le plateau à Z = 0
        const yPoints = [
            new THREE.Vector3(0, -axisLength, 0),
            new THREE.Vector3(0, axisLength, 0)
        ];
        const yGeometry = new THREE.BufferGeometry().setFromPoints(yPoints);
        const yMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            linewidth: 2,
            opacity: 0.8,
            transparent: true
        });        const yAxis = new THREE.Line(yGeometry, yMaterial);
        yAxis.name = 'AXIS'; // Nommer pour permettre le toggle
        yAxis.userData.axisType = 'Y';
        yAxis.renderOrder = 100;
        this.scene.add(yAxis);
        
        // Axe Z (Bleu) - vertical, commence exactement à l'origine
        const zPoints = [
            new THREE.Vector3(0, 0, 0), // Commence à l'origine
            new THREE.Vector3(0, 0, 200) // 2 mètres de haut
        ];
        const zGeometry = new THREE.BufferGeometry().setFromPoints(zPoints);
        const zMaterial = new THREE.LineBasicMaterial({ 
            color: 0x0000ff,
            linewidth: 2,
            opacity: 0.8,
            transparent: true
        });        const zAxis = new THREE.Line(zGeometry, zMaterial);
        zAxis.name = 'AXIS'; // Nommer pour permettre le toggle
        zAxis.userData.axisType = 'Z';
        zAxis.renderOrder = 100;
        this.scene.add(zAxis);
    }
    
    setupLighting() {        // Lumière ambiante réduite pour mieux voir les ombres
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);        // Stocker directionalLight comme propriété de l'instance
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.6); // Intensité augmentée
        this.directionalLight.position.set(50, 100, 75);
        this.directionalLight.castShadow = true;
          // Configuration détaillée des ombres        // Meilleure qualité d'ombres avec taille de map plus grande
        this.directionalLight.shadow.mapSize.width = 4096; // Doublé pour plus de précision
        this.directionalLight.shadow.mapSize.height = 4096;
        this.directionalLight.shadow.bias = -0.0005; // Valeur ajustée pour réduire les artefacts
        this.directionalLight.shadow.normalBias = 0.02; // Ajouté pour améliorer les ombres sur surfaces planes
        this.directionalLight.shadow.radius = 1.5; // Ajoute un léger flou aux ombres
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 500;
        this.directionalLight.shadow.camera.left = -100;
        this.directionalLight.shadow.camera.right = 100;
        this.directionalLight.shadow.camera.top = 100;
        this.directionalLight.shadow.camera.bottom = -100;
        
        this.scene.add(this.directionalLight);
        
        // Ajouter une cible pour la lumière directionnelle
        const lightTarget = new THREE.Object3D();
        lightTarget.position.set(0, 0, 0);
        this.scene.add(lightTarget);
        this.directionalLight.target = lightTarget;
        
        // Lumière hémisphérique blanche
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.2);
        this.scene.add(hemisphereLight);

        console.log("Lighting setup complete with shadows enabled.");
    }

    createSunlightManager() {
        console.log('Creating SunlightManager...');
        if (typeof SunlightManager !== 'undefined') {
            this.sunlightManager = new SunlightManager(this);
            this.sunlightManager.createSunHelper();
            console.log('SunlightManager created successfully');
        } else {
            console.error('SunlightManager class is not defined.');
        }
    }
    
    calculateSunPosition(month, hour, latitude) {
        // Calcul simplifié de la position du soleil
        // Jour de l'année approximatif
        const dayOfYear = month * 30.5 - 15;
        
        // Déclinaison solaire
        const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
        
        // Angle horaire
        const hourAngle = 15 * (hour - 12);
        
        // Élévation
        const latRad = latitude * Math.PI / 180;
        const declRad = declination * Math.PI / 180;
        const hourRad = hourAngle * Math.PI / 180;
        
        const elevation = Math.asin(
            Math.sin(latRad) * Math.sin(declRad) +
            Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad)
        ) * 180 / Math.PI;
        
        // Azimut
        const azimuth = Math.atan2(
            -Math.sin(hourRad),
            Math.tan(declRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(hourRad)
        ) * 180 / Math.PI + 180;
        
        return { azimuth, elevation: Math.max(0, elevation) };
    }
    
    updateLayerVisibility(layerIndex) {
        const layer = this.layers[layerIndex];
        if (layer) {
            layer.objects.forEach(obj => {
                obj.visible = layer.visible;
            });
        }
    }      deleteLayer(index) {
        if (index === 0) return; // Ne pas supprimer le calque 0
        
        // Déplacer les objets vers le calque 0
        const layer = this.layers[index];
        if (layer) {
            layer.objects.forEach(obj => {
                this.layers[0].objects.push(obj);
            });
        }
        
        // Supprimer le calque
        this.layers.splice(index, 1);
        
        // Ajuster le calque actuel si nécessaire
        if (this.currentLayer >= this.layers.length) {
            this.currentLayer = this.layers.length - 1;
        }
        
        // Mettre à jour le panneau des propriétés si un objet est sélectionné
        // pour que la liste des calques soit mise à jour
        if (this.selectedObject && this.uiManager) {
            this.uiManager.updatePropertiesPanel(this.selectedObject);
        }
    }

    /**
     * Déplace un objet vers un autre calque
     * @param {Object} object - L'objet Three.js à déplacer
     * @param {number} targetLayerIndex - L'index du calque de destination
     */
    moveObjectToLayer(object, targetLayerIndex) {
        if (!object || targetLayerIndex < 0 || targetLayerIndex >= this.layers.length) {
            console.warn('Objet invalide ou index de calque invalide');
            return false;
        }

        // Retirer l'objet de son calque actuel
        let sourceLayerIndex = -1;
        this.layers.forEach((layer, index) => {
            const objectIndex = layer.objects.indexOf(object);
            if (objectIndex !== -1) {
                layer.objects.splice(objectIndex, 1);
                sourceLayerIndex = index;
            }
        });

        // Ajouter l'objet au calque de destination
        this.layers[targetLayerIndex].objects.push(object);

        // Ajouter à l'historique
        this.addToHistory('moveLayer', object, { 
            sourceLayer: sourceLayerIndex, 
            targetLayer: targetLayerIndex 
        });

        console.log(`Objet déplacé du calque ${sourceLayerIndex} vers le calque ${targetLayerIndex}`);
        return true;
    }
    
    async loadModules() {
        try {
            console.log('Loading modules...');
            
            // Load core modules that exist
            const modulePromises = [
                import('../managers/UIManager.js').then(module => {
                    this.uiManager = new module.UIManager(this);
                    console.log('UIManager loaded');
                }).catch(err => console.warn('UIManager not found:', err)),
                
                import('../managers/FileManager.js').then(module => {
                    this.fileManager = new module.FileManager(this);
                    console.log('FileManager loaded');
                }).catch(err => console.warn('FileManager not found:', err)),
                
                import('../managers/ViewManager.js').then(module => {
                    this.viewManager = new module.ViewManager(this);
                    console.log('ViewManager loaded');
                }).catch(err => console.warn('ViewManager not found:', err)),
                
                import('../managers/DrawingManager.js').then(module => {
                    this.drawingManager = new module.DrawingManager(this);
                    console.log('DrawingManager loaded');
                }).catch(err => console.warn('DrawingManager not found:', err)),
                
                import('../managers/SnapManager.js').then(module => {
                    this.snapManager = new module.SnapManager(this);
                    console.log('SnapManager loaded');
                }).catch(err => console.warn('SnapManager not found:', err)),
                  import('../managers/ToolManager.js').then(module => {
                    this.toolManager = new module.ToolManager(this);
                    console.log('ToolManager loaded');
                }).catch(err => console.warn('ToolManager not found:', err)),

                import('../managers/ElementManager.js').then(module => {
                    this.elementManager = new module.ElementManager(this);
                    console.log('ElementManager loaded');
                }).catch(err => console.warn('ElementManager not found:', err))
            ];

            // Wait for all modules to load (or fail gracefully)
            await Promise.allSettled(modulePromises);
            
            console.log('Module loading completed');
        } catch (error) {
            console.error('Error during module loading:', error);
        }
   }

    // Appliquer une couleur (hex ou THREE.Color) à un objet (Mesh ou Line)
    applyColorToObject(object, color) {
        if (!object) {
            console.warn('[WebCAD applyColorToObject] Target object is null.');
            return;
        }
        console.log('[WebCAD applyColorToObject] Attempting to apply color:', color, 'to object:', object.uuid);

        let hexColorValue = color;
        if (typeof color === 'object' && color !== null && color.hex) {
            hexColorValue = color.hex;
        }
        if (typeof hexColorValue === 'string' && hexColorValue.startsWith('#')) {
            hexColorValue = hexColorValue.substring(1);
        }

        const applyToMaterialAndOriginal = (mat, meshOwner) => {
            console.log('[WebCAD applyColorToObject] Applying color to material for mesh:', meshOwner ? (meshOwner.name || meshOwner.uuid) : 'N/A');
            
            // Apply to the current material
            if (mat.map !== undefined) {
                if (mat.map !== null) {
                    console.log('[WebCAD applyColorToObject] Removing existing texture from current material.');
                    mat.map = null;
                }
            }
            if (mat.color) {
                mat.color.set('#' + hexColorValue);
            }
            mat.needsUpdate = true;
            console.log('[WebCAD applyColorToObject] Current material updated. Color:', '#' + hexColorValue, 'Texture removed.');

            // If the object was highlighted, its originalMaterial also needs this change
            if (meshOwner && meshOwner.userData && meshOwner.userData.originalMaterial) {
                const originalMat = meshOwner.userData.originalMaterial;
                console.log('[WebCAD applyColorToObject] Updating userData.originalMaterial for highlighted object:', meshOwner.uuid);
                if (originalMat.map !== undefined) {
                    originalMat.map = null;
                }
                if (originalMat.color) {
                    originalMat.color.set('#' + hexColorValue);
                }
                originalMat.needsUpdate = true; // Good practice
            }
        };

        if (object.isMesh && object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(mat => applyToMaterialAndOriginal(mat, object));
            } else {
                applyToMaterialAndOriginal(object.material, object);
            }
        }

        object.traverse((child) => {
            if (child.isMesh && child.material && child !== object) { // child !== object to avoid double-processing if object itself is a mesh
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => applyToMaterialAndOriginal(mat, child));
                } else {
                    applyToMaterialAndOriginal(child.material, child);
                }
            }
        });
    }

    // Appliquer une texture (THREE.Texture ou objet) à un objet (Mesh ou Line)
    applyTextureToObject(object, textureInfo) { // Renamed texture to textureInfo for clarity
        if (!object) {
            console.warn('[WebCAD applyTextureToObject] Target object is null.');
            return;
        }
        console.log('[WebCAD applyTextureToObject] Attempting to apply texture to object:', object, 'with textureInfo:', textureInfo);

        const applyToMaterialAndOriginal = (mat, texResource, meshOwner) => {
            console.log('[WebCAD applyToMaterial] Applying to material:', mat, 'for mesh:', meshOwner ? (meshOwner.name || meshOwner.uuid) : 'N/A');
            console.log('[WebCAD applyToMaterial] Texture resource:', texResource);

            if (!texResource || !(texResource instanceof THREE.Texture)) {
                console.error('[WebCAD applyToMaterial] Invalid or non-THREE.Texture resource provided.', texResource);
                return;
            }            const setupMaterialWithTexture = (targetMat, meshOwner) => {
                if (targetMat.color) {
                    targetMat.color.set(0xffffff);
                               }
                if (targetMat.map !== undefined) {
                    targetMat.map = texResource;
                    texResource.wrapS = THREE.RepeatWrapping;
                    texResource.wrapT = THREE.RepeatWrapping;
                    
                    // Calculer une répétition appropriée basée sur la taille de l'objet
                    let repeatX = 1, repeatY = 1;
                    
                    if (meshOwner && meshOwner.geometry) {
                        // Calculer les dimensions de l'objet
                        const boundingBox = new THREE.Box3().setFromObject(meshOwner);
                        const size = boundingBox.getSize(new THREE.Vector3());                        // Échelle de texture basée sur la taille réelle
                        // 1 répétition pour environ 4.0 unités (motifs plus grands, moins serrés)
                        const textureScale = 4.0; // Taille d'une "brique" ou motif en unités 3D (augmentée pour moins de répétition)
                        
                        repeatX = Math.max(0.3, size.x / textureScale);
                        repeatY = Math.max(0.3, size.z / textureScale); // Z pour la hauteur des murs
                        
                        console.log(`[WebCAD] Texture repeat calculated for object ${meshOwner.uuid}: size=${size.x.toFixed(2)}x${size.z.toFixed(2)}, repeat=${repeatX.toFixed(2)}x${repeatY.toFixed(2)}`);
                    } else {
                        // Valeur par défaut plus raisonnable que 5x5
                        repeatX = 2;
                        repeatY = 2;
                        console.log(`[WebCAD] Using default texture repeat: ${repeatX}x${repeatY}`);
                    }
                    
                    texResource.repeat.set(repeatX, repeatY);
                    texResource.needsUpdate = true; 
                } else {
                    console.warn('[WebCAD applyToMaterial] Material does not have a .map property. Cannot apply texture map. Material type:', targetMat.type);
                    return; // Cannot apply texture if no .map property
                }
                targetMat.needsUpdate = true;
                console.log('[WebCAD applyToMaterial] Texture set on material.map. Material and Texture marked for update for:', targetMat.uuid);
            };            // Apply to the current material
            setupMaterialWithTexture(mat, meshOwner);            // If the object was highlighted, its originalMaterial also needs this change
            if (meshOwner && meshOwner.userData && meshOwner.userData.originalMaterial) {
                const originalMat = meshOwner.userData.originalMaterial;
                console.log('[WebCAD applyToMaterial] Updating userData.originalMaterial for highlighted object:', meshOwner.uuid);
                // Ensure originalMat is a clone or a distinct material instance if it might be shared
                // For simplicity, assuming it's a direct reference or a clone that can be modified.
                setupMaterialWithTexture(originalMat, meshOwner);
            }

            // Log UV information for the mesh this material belongs to
            if (meshOwner && meshOwner.geometry) {
                const boundingBox = new THREE.Box3().setFromObject(meshOwner);
                const size = boundingBox.getSize(new THREE.Vector3());
                console.log(`[WebCAD applyToMaterial] Mesh ${meshOwner.name || meshOwner.uuid} bounding box size: X=${size.x.toFixed(2)}, Y=${size.y.toFixed(2)}, Z=${size.z.toFixed(2)}`);
                if (meshOwner.geometry.attributes.uv) {
                    console.log(`[WebCAD applyToMaterial] Mesh ${meshOwner.name || meshOwner.uuid} HAS UVs. Count: ${meshOwner.geometry.attributes.uv.count}, ItemSize: ${meshOwner.geometry.attributes.uv.itemSize}`);
                } else {
                    console.warn(`[WebCAD applyToMaterial] Mesh ${meshOwner.name || meshOwner.uuid} MISSING UVs attribute on its geometry. Texture repeat changes will likely have no effect.`);
                }
            } else if (meshOwner) {
                    console.warn(`[WebCAD applyToMaterial] Mesh ${meshOwner.name || meshOwner.uuid} has no geometry to check for UVs.`);
            }
        };

        const processLoadedTexture = (loadedTex, targetObject) => {
            console.log(`[WebCAD processLoadedTexture] Processing loaded texture for targetObject: ${targetObject.uuid}`);
            
            const textureInstance = loadedTex.clone(); // Clone the texture once before processing
                                                    // to ensure each material gets a distinct texture instance if needed,
                                                    // especially if texResource.needsUpdate = true is critical.

            if (targetObject.isMesh && targetObject.material) {
                if (Array.isArray(targetObject.material)) {
                    targetObject.material.forEach(mat => applyToMaterialAndOriginal(mat, textureInstance.clone(), targetObject));
                } else {
                    applyToMaterialAndOriginal(targetObject.material, textureInstance, targetObject);
                }
            }

            targetObject.traverse((child) => {
                if (child.isMesh && child.material && child !== targetObject) {
                    console.log(`[WebCAD processLoadedTexture] Applying texture to child mesh: ${child.name || child.uuid}`);
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => applyToMaterialAndOriginal(mat, textureInstance.clone(), child));
                    } else {
                        applyToMaterialAndOriginal(child.material, textureInstance.clone(), child); // Clone for each child material
                    }
                } else {
                    // console.log(\`[WebCAD processLoadedTexture] Skipping child (not a mesh or no material): \${child.name || child.uuid}\`);
                }
            });
        };

        if (textureInfo && textureInfo.url) {
            console.log('[WebCAD applyTextureToObject] Loading texture from URL:', textureInfo.url);
            new THREE.TextureLoader().load(
                textureInfo.url,
                (loadedTex) => { 
                    console.log('[WebCAD applyTextureToObject] Texture loaded successfully from URL:', textureInfo.url, loadedTex);
                                       processLoadedTexture(loadedTex, object);
                },
                undefined, 
                (err) => { 
                    console.error('[WebCAD applyTextureToObject] Error loading texture from URL:', textureInfo.url, err);
                }
            );
        } else if (textureInfo && textureInfo instanceof THREE.Texture) {
            console.log('[WebCAD applyTextureToObject] Applying existing THREE.Texture instance:', textureInfo);
            processLoadedTexture(textureInfo, object);
        } else if (textureInfo && textureInfo.map && textureInfo.map instanceof THREE.Texture) {
            console.log('[WebCAD applyTextureToObject] Applying existing THREE.Texture instance from textureInfo.map:', textureInfo.map);
            processLoadedTexture(textureInfo.map, object);
        } else {
            console.warn('[WebCAD applyTextureToObject] Invalid textureInfo provided. Expected object with URL, or a THREE.Texture instance.', textureInfo);
        }
    }    onDoubleClick(event) {
        console.log('WebCAD.onDoubleClick() déclenché');
        
        // Empêcher la propagation pour éviter les conflits
        event.stopPropagation();
        
        // D'abord, vérifier si DrawingManager peut gérer le double-clic
        if (this.drawingManager && this.drawingManager.handleDoubleClick) {
            const handled = this.drawingManager.handleDoubleClick(event);
            if (handled) {
                console.log('Double-clic géré par DrawingManager');
                return;
            }
        }
        
        // Sinon, gérer le double-clic selon l'outil actif
        if (this.drawingManager && this.drawingManager.activeTool) {
            const tool = this.drawingManager.activeTool;
            
            // Vérifier si l'outil a une méthode onDoubleClick
            if (tool.onDoubleClick && typeof tool.onDoubleClick === 'function') {
                console.log('Délégation du double-clic à l\'outil:', tool.constructor.name);
                tool.onDoubleClick(event);
                return;
            }
        }
        
        console.log('Double-clic non géré par l\'outil actif');
    }
}

