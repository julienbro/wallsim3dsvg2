import * as THREE from 'three';

export class ViewManager {    constructor(app) {
        this.app = app;
        this.originalPerspectiveCamera = null; // Pour sauvegarder la caméra perspective
        this.orthographicCamera = null; // Pour stocker la caméra orthogonale
        this.saved3DPosition = null; // Pour sauvegarder la position 3D
        this.saved3DTarget = null; // Pour sauvegarder la cible 3D
        
        // Propriétés pour la grille 2D
        this.gridVisible = false;
        this.gridHelper = null;
        this.gridSize = 1; // 1cm
        this.gridDivisions = 1000; // 1000 divisions pour une grille de 10m x 10m
        
        // Initialiser l'état de l'interface en mode 3D
        this.initializeUI();
    }
    
    initializeUI() {
        // S'assurer que l'interface reflète le mode 3D par défaut
        setTimeout(() => {
            const modeIndicator = document.getElementById('mode-indicator');
            const toggleBtn = document.getElementById('toggle-2d3d');
            
            if (modeIndicator) {
                modeIndicator.textContent = 'Mode: 3D';
            }
            
            if (toggleBtn) {
                toggleBtn.textContent = '2D';
                toggleBtn.title = 'Basculer en mode 2D orthogonal';
            }
            
            console.log('🔄 Interface initialisée en mode 3D');
        }, 100);
    }
      toggle2D3D() {
        this.app.is3DMode = !this.app.is3DMode;
        document.getElementById('mode-indicator').textContent = `Mode: ${this.app.is3DMode ? '3D' : '2D'}`;
        
        const orbitBtn = document.getElementById('toolbar-view-orbit');
        const toggleBtn = document.getElementById('toggle-2d3d');
        
        if (!this.app.is3DMode) {
            // Sauvegarder la position 3D actuelle avant de basculer
            if (this.app.camera && this.app.controls) {
                this.saved3DPosition = this.app.camera.position.clone();
                this.saved3DTarget = this.app.controls.target.clone();
                console.log('💾 Position 3D sauvegardée:', this.saved3DPosition, this.saved3DTarget);
            }
            
            // Passer en mode 2D - Caméra orthogonale
            this.switchToOrthographicCamera();
            this.setView('top'); // Vue du dessus
            
            // Désactiver la rotation
            this.app.controls.enableRotate = false;
            this.app.controls.enabled = true; // Garder pan/zoom
            
            // Mise à jour des boutons
            if (orbitBtn) orbitBtn.classList.remove('active');
            if (toggleBtn) {
                toggleBtn.textContent = '3D';
                toggleBtn.title = 'Basculer en mode 3D perspective';
            }
            
            console.log('🔄 Mode 2D activé - Caméra orthogonale, vue du dessus');
        } else {
            // Passer en mode 3D - Caméra perspective
            this.switchToPerspectiveCamera();
            
            // Restaurer la position 3D sauvegardée ou utiliser la vue isométrique par défaut
            if (this.saved3DPosition && this.saved3DTarget) {
                this.app.camera.position.copy(this.saved3DPosition);
                this.app.controls.target.copy(this.saved3DTarget);
                this.app.controls.update();
                console.log('🔄 Position 3D restaurée:', this.saved3DPosition, this.saved3DTarget);
            } else {
                this.setView('iso'); // Vue isométrique par défaut
                console.log('🔄 Vue isométrique par défaut appliquée');
            }
            
            // Réactiver la rotation
            this.app.controls.enableRotate = true;
            this.app.controls.enabled = true;
            
            // Mise à jour des boutons
            if (orbitBtn) orbitBtn.classList.add('active');
            if (toggleBtn) {
                toggleBtn.textContent = '2D';
                toggleBtn.title = 'Basculer en mode 2D orthogonal';
            }
            
            console.log('🔄 Mode 3D activé - Caméra perspective, rotation libre');
        }
        
        // Mise à jour du rendu
        if (this.app.render) {
            this.app.render();
        }
    }
      switchToOrthographicCamera() {
        // Sauvegarder la caméra perspective actuelle
        if (this.app.camera && this.app.camera.isPerspectiveCamera) {
            this.originalPerspectiveCamera = this.app.camera;
        }
        
        // Créer ou réutiliser la caméra orthogonale
        if (!this.orthographicCamera) {
            const container = document.getElementById('viewport');
            const aspect = container.clientWidth / container.clientHeight;
            const frustumSize = 100; // Taille de base pour la vue orthogonale
            
            this.orthographicCamera = new THREE.OrthographicCamera(
                -frustumSize * aspect / 2, frustumSize * aspect / 2,
                frustumSize / 2, -frustumSize / 2,
                0.1, 2000
            );
            
            // Copier la position de la caméra perspective
            if (this.originalPerspectiveCamera) {
                this.orthographicCamera.position.copy(this.originalPerspectiveCamera.position);
                this.orthographicCamera.up.copy(this.originalPerspectiveCamera.up);
            }
        }
        
        // Remplacer la caméra dans l'application
        this.app.camera = this.orthographicCamera;
        
        // Mettre à jour les contrôles
        if (this.app.controls) {
            this.app.controls.object = this.orthographicCamera;
        }
        
        // Mettre à jour le renderer
        if (this.app.renderer) {
            const container = document.getElementById('viewport');
            this.app.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
      switchToPerspectiveCamera() {
        // Restaurer la caméra perspective
        if (this.originalPerspectiveCamera) {
            // NE PAS copier la position de la caméra orthogonale pour garder la vue 3D d'origine
            this.app.camera = this.originalPerspectiveCamera;
        } else {
            // Créer une nouvelle caméra perspective si nécessaire
            const container = document.getElementById('viewport');
            const aspect = container.clientWidth / container.clientHeight;
            this.app.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
            this.app.camera.position.set(150, 150, 150);
        }
        
        // Mettre à jour les contrôles
        if (this.app.controls) {
            this.app.controls.object = this.app.camera;
        }
        
        // Mettre à jour le renderer
        if (this.app.renderer) {
            const container = document.getElementById('viewport');
            this.app.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
    
    // Méthode pour gérer le redimensionnement de la fenêtre
    onWindowResize() {
        const container = document.getElementById('viewport');
        const width = container.clientWidth;
        const height = container.clientHeight;
        const aspect = width / height;
        
        if (this.app.camera.isPerspectiveCamera) {
            // Caméra perspective
            this.app.camera.aspect = aspect;
            this.app.camera.updateProjectionMatrix();
        } else {
            // Caméra orthogonale
            const frustumSize = 100;
            this.app.camera.left = -frustumSize * aspect / 2;
            this.app.camera.right = frustumSize * aspect / 2;
            this.app.camera.top = frustumSize / 2;
            this.app.camera.bottom = -frustumSize / 2;
            this.app.camera.updateProjectionMatrix();
        }
        
        // Mettre à jour le renderer
        if (this.app.renderer) {
            this.app.renderer.setSize(width, height);
        }
    }
    
    setView(view) {
        // Exemples de positions/cibles pour chaque vue
        const views = {
            top:    { position: new THREE.Vector3(0, 0, 200), target: new THREE.Vector3(0, 0, 0) },
            iso:    { position: new THREE.Vector3(150, 150, 150), target: new THREE.Vector3(0, 0, 0) },
            front:  { position: new THREE.Vector3(0, -200, 0), target: new THREE.Vector3(0, 0, 0) },
            back:   { position: new THREE.Vector3(0, 200, 0), target: new THREE.Vector3(0, 0, 0) },
            right:  { position: new THREE.Vector3(200, 0, 0), target: new THREE.Vector3(0, 0, 0) },
            left:   { position: new THREE.Vector3(-200, 0, 0), target: new THREE.Vector3(0, 0, 0) },
        };

        const v = views[view];
        if (!v) {
            console.warn('Vue inconnue:', view);
            return;
        }

        // Utiliser la caméra et les contrôles de l'app
        const camera = this.app.camera;
        const controls = this.app.controls;

        if (camera && v.position && v.target) {
            camera.position.copy(v.position);
            if (controls) {
                controls.target.copy(v.target);
                controls.update();
            }
            camera.lookAt(v.target);
            if (camera.updateProjectionMatrix) camera.updateProjectionMatrix();
        } else {
            console.error('Camera ou cible non définie pour la vue', view);
        }
    }
      toggleGrid() {
        this.gridVisible = !this.gridVisible;
        
        if (this.gridVisible) {
            this.createGrid();
            document.getElementById('command-output').textContent = 'Grille 2D activée (1cm)';
        } else {
            this.removeGrid();
            document.getElementById('command-output').textContent = 'Grille 2D désactivée';
        }
    }
    
    createGrid() {
        // Supprimer la grille existante si elle existe
        this.removeGrid();
        
        // Créer la grille principale avec des tirets gris serrés
        const gridSize = 1000; // 10m x 10m total
        const divisions = this.gridDivisions; // 1000 divisions = 1cm chaque
        
        // Grille principale
        this.gridHelper = new THREE.GridHelper(gridSize, divisions, 0x808080, 0x808080);
        this.gridHelper.material.opacity = 0.3;
        this.gridHelper.material.transparent = true;
        this.gridHelper.position.z = 0.01; // Légèrement au-dessus du plan de travail
        this.gridHelper.renderOrder = -1;
        
        // Modifier le matériau pour avoir des tirets serrés
        this.gridHelper.material.dispose();
        this.gridHelper.material = new THREE.LineDashedMaterial({
            color: 0x808080,
            opacity: 0.3,
            transparent: true,
            dashSize: 0.2,
            gapSize: 0.1,
            linewidth: 1
        });
        
        // Calculer les distances pour les lignes pointillées
        this.gridHelper.computeLineDistances();
        
        this.app.scene.add(this.gridHelper);
        
        // Activer l'accrochage aux coins de grille
        if (this.app.snapManager) {
            this.app.snapManager.enableGridSnapping = true;
            this.app.snapManager.gridSize = this.gridSize;
        }
        
        console.log('🔳 Grille 2D créée avec espacement 1cm');
    }
    
    removeGrid() {
        if (this.gridHelper) {
            this.app.scene.remove(this.gridHelper);
            if (this.gridHelper.geometry) this.gridHelper.geometry.dispose();
            if (this.gridHelper.material) this.gridHelper.material.dispose();
            this.gridHelper = null;
        }
        
        // Désactiver l'accrochage aux coins de grille
        if (this.app.snapManager) {
            this.app.snapManager.enableGridSnapping = false;
        }
        
        console.log('🔳 Grille 2D supprimée');
    }
    
    zoomExtents() {
        if (this.app.objects.length === 0) return;
        
        const box = new THREE.Box3();
        this.app.objects.forEach(obj => {
            box.expandByObject(obj);
        });
        
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.app.camera.fov * (Math.PI / 180);
        const distance = Math.abs(maxDim / Math.sin(fov / 2));
        
        this.app.controls.target.copy(center);
        this.app.camera.position.copy(center);
        this.app.camera.position.z += distance;
        this.app.camera.lookAt(center);
        this.app.controls.update();
    }
}
