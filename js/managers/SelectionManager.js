import * as THREE from 'three';

export class SelectionManager {    constructor(app) {
        this.app = app;
        this.selectedObjects = [];
        this.raycaster = new THREE.Raycaster();
        
        // Écouteur d'événements pour les clics de souris
        this.setupEventHandlers();
        
        // Créer le menu contextuel
        this.createContextMenu();
    }setupEventHandlers() {
        // DÉSACTIVÉ : Les écouteurs d'événements sont gérés par WebCAD.onMouseClick()
        // pour éviter les conflits entre systèmes de sélection
        // this.app.renderer.domElement.addEventListener('click', (e) => this.handleClick(e));
        // this.app.renderer.domElement.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        
        console.log('SelectionManager: écouteurs d\'événements désactivés pour éviter les conflits avec WebCAD.onMouseClick()');
    }handleClick(event) {
        // Si l'application est en mode texture/couleur, laisser WebCAD.onMouseClick() gérer le clic
        if (this.app.textureApplyMode && this.app.selectedTexture) {
            return; // Ne pas traiter la sélection, laisser l'application de texture se faire
        }
        
        const mouse = new THREE.Vector2();
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(mouse, this.app.camera);
        const intersects = this.raycaster.intersectObjects(this.app.objects, true);
        
        if (intersects.length > 0) {
            let handled = false;
            
            // Vérifier d'abord si on clique sur une cotation en mode dimension
            if (this.app.currentTool === 'dimension' && this.app.drawingManager && this.app.drawingManager.dimensionTool) {
                const dimensionTool = this.app.drawingManager.dimensionTool;
                
                // Chercher une cotation dans les objets intersectés
                for (const intersect of intersects) {
                    if (dimensionTool.handleDimensionClick(intersect.object)) {
                        handled = true;
                        break;
                    }
                }
            }
            
            // Si ce n'est pas une cotation ou qu'on n'est pas en mode dimension, sélection normale
            if (!handled) {
                const clickedObject = this.getTopLevelObject(intersects[0].object);
                
                if (event.shiftKey || event.ctrlKey) {
                    // Multi-sélection
                    const index = this.selectedObjects.indexOf(clickedObject);
                    if (index > -1) {
                        this.deselectObject(clickedObject);
                    } else {
                        this.addToSelection(clickedObject);
                    }
                } else {
                    // Sélection simple
                    this.selectObject(clickedObject);
                }
            }
        } else if (!event.shiftKey && !event.ctrlKey) {
            // Clic dans le vide, désélectionner tout
            this.clearSelection();
            
            // Si on est en mode édition de cotation, annuler l'édition
            if (this.app.currentTool === 'dimension' && this.app.drawingManager && this.app.drawingManager.dimensionTool) {
                const dimensionTool = this.app.drawingManager.dimensionTool;
                if (dimensionTool.selectedDimensionGroup) {
                    dimensionTool.cancelDimensionEdit();
                }
            }
        }
        
        if (this.onSelectionChange) {        this.onSelectionChange(this.selectedObjects);
        }
    }    handleRightClick(event) {
        console.log('SelectionManager.handleRightClick appelé', event);
        event.preventDefault(); // Empêcher le menu contextuel par défaut

        const mouse = new THREE.Vector2();
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(mouse, this.app.camera);
        const intersects = this.raycaster.intersectObjects(this.app.objects, true);
        
        console.log(`Intersections trouvées: ${intersects.length}`);
        
        if (intersects.length > 0) {
            console.log('Objet intersecté:', intersects[0].object);
            
            // Vérifier si on fait un clic droit sur une cotation
            if (this.app.drawingManager && this.app.drawingManager.dimensionTool) {
                const dimensionTool = this.app.drawingManager.dimensionTool;
                
                // Chercher une cotation dans les objets intersectés
                for (const intersect of intersects) {
                    if (dimensionTool.handleRightClick(event, intersect.object)) {
                        console.log('Cotation gérée');
                        return; // Une cotation a été trouvée et gérée
                    }
                }
            }
        }
        
        // Si ce n'est pas une cotation, afficher le menu contextuel pour l'objet sélectionné
        if (intersects.length > 0) {
            const clickedObject = this.getTopLevelObject(intersects[0].object);
            console.log('Affichage du menu contextuel pour:', clickedObject);
            this.showContextMenu(event, clickedObject);
        } else {
            console.log('Aucun objet cliqué - pas de menu contextuel');
        }
    }    createContextMenu() {
        // TOUJOURS utiliser le menu contextuel du DOM s'il existe
        this.contextMenu = document.getElementById('object-context-menu');
        
        if (!this.contextMenu) {
            console.log('Création du menu contextuel...');
            this.contextMenu = document.createElement('div');
            this.contextMenu.id = 'object-context-menu';
            this.contextMenu.className = 'object-context-menu';
            this.contextMenu.style.display = 'none';
            this.contextMenu.innerHTML = `
                <div class="context-menu-item" id="context-copy">
                    <i class="fas fa-copy"></i> Copier
                </div>
                <div class="context-menu-item" id="context-cut">
                    <i class="fas fa-cut"></i> Couper
                </div>
                <div class="context-menu-item" id="context-duplicate">
                    <i class="fas fa-clone"></i> Dupliquer
                </div>
                <div class="context-menu-separator"></div>
                <div class="context-menu-item" id="context-properties">
                    <i class="fas fa-cog"></i> Propriétés
                </div>
                <div class="context-menu-separator"></div>
                <div class="context-menu-item" id="context-delete">
                    <i class="fas fa-trash"></i> Supprimer
                </div>
            `;
            
            document.body.appendChild(this.contextMenu);
        } else {
            console.log('Menu contextuel trouvé dans le DOM - utilisation du menu existant');
        }
        
        // FORCE la configuration des événements même si le menu existait déjà
        this.setupContextMenuEvents();
        
        // Fermer le menu en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (this.contextMenu && !this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
        
        console.log('Menu contextuel configuré:', this.contextMenu);
    }    setupContextMenuEvents() {
        console.log('Configuration des gestionnaires d\'événements du menu contextuel...');
        console.log('Menu contextuel disponible:', !!this.contextMenu);
        
        if (!this.contextMenu) {
            console.error('Aucun menu contextuel disponible pour configurer les événements');
            return;
        }
        
        // Supprimer les anciens gestionnaires d'événements s'ils existent
        const oldClone = this.contextMenu.cloneNode(true);
        this.contextMenu.parentNode.replaceChild(oldClone, this.contextMenu);
        this.contextMenu = oldClone;
        
        // Utiliser la délégation d'événement sur le menu contextuel lui-même
        this.contextMenu.addEventListener('click', (e) => {
            console.log('🖱️ Clic détecté sur le menu contextuel', e.target);
            e.preventDefault();
            e.stopPropagation();
            
            const menuItem = e.target.closest('.context-menu-item');
            if (!menuItem) {
                console.log('Clic en dehors d\'un élément de menu');
                return;
            }
            
            const itemId = menuItem.id;
            console.log('🎯 Action cliquée:', itemId);
              // Sauvegarder la cible avant de cacher le menu
            const target = this.contextMenuTarget;
            
            // Cacher le menu
            this.hideContextMenu();
            
            // Exécuter l'action appropriée
            if (target) {
                console.log('Objet cible disponible:', target.name || target.uuid);
                this.app.selectObject(target);
                
                switch(itemId) {
                    case 'context-copy':
                        console.log('🔄 Exécution: Copier');
                        if (this.app.copySelected) {
                            this.app.copySelected();
                            console.log('✅ Copier exécuté');
                        } else {
                            console.error('❌ Méthode copySelected non disponible');
                        }
                        break;
                        
                    case 'context-cut':
                        console.log('🔄 Exécution: Couper');
                        if (this.app.cutSelected) {
                            this.app.cutSelected();
                            console.log('✅ Couper exécuté');
                        } else {
                            console.error('❌ Méthode cutSelected non disponible');
                        }
                        break;
                        
                    case 'context-duplicate':
                        console.log('🔄 Exécution: Dupliquer');
                        try {
                            this.duplicateObject(this.contextMenuTarget);
                            console.log('✅ Dupliquer exécuté');
                        } catch (error) {
                            console.error('❌ Erreur lors de la duplication:', error);
                        }
                        break;
                        
                    case 'context-properties':
                        console.log('🔄 Exécution: Propriétés');
                        try {
                            this.showPropertiesPanel();
                            console.log('✅ Propriétés affichées');
                        } catch (error) {
                            console.error('❌ Erreur lors de l\'affichage des propriétés:', error);
                        }
                        break;                        case 'context-delete':
                        console.log('🔄 Exécution: Supprimer');
                        if (this.app.deleteSelected) {
                            // Assurer que l'objet est sélectionné avant de le supprimer
                            if (this.selectedObjects.indexOf(target) === -1) {
                                this.clearSelection();
                                this.selectObject(target);
                            }
                            this.app.deleteSelected();
                            console.log('✅ Supprimer exécuté');
                        } else {
                            console.error('❌ Méthode deleteSelected non disponible');
                        }
                        // Nettoyer la référence à l'objet supprimé
                        this.contextMenuTarget = null;
                        break;
                        
                    default:
                        console.log('❓ Action non reconnue:', itemId);
                }
            } else {
                console.error('❌ Aucun objet cible pour l\'action du menu contextuel');
            }
        });
        
        console.log('✅ Gestionnaires d\'événements configurés via délégation sur:', this.contextMenu);
        
        // Test de vérification
        const menuItems = this.contextMenu.querySelectorAll('.context-menu-item');
        console.log(`📊 ${menuItems.length} éléments de menu trouvés:`, Array.from(menuItems).map(item => item.id));
    }showContextMenu(event, targetObject) {
        console.log('showContextMenu appelé', { event, targetObject, contextMenu: this.contextMenu });
        
        if (!this.contextMenu) {
            console.error('Menu contextuel non trouvé !');
            return;
        }
        
        this.contextMenuTarget = targetObject;
        
        // Positionner le menu près du curseur
        const rect = this.app.renderer.domElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        console.log('Position du menu:', { x, y, clientX: event.clientX, clientY: event.clientY });
        
        // S'assurer que le menu reste dans la fenêtre
        const menuWidth = 150;
        const menuHeight = 200;
        const maxX = rect.width - menuWidth;
        const maxY = rect.height - menuHeight;
        
        this.contextMenu.style.position = 'absolute';
        this.contextMenu.style.left = Math.min(x + rect.left, maxX + rect.left) + 'px';
        this.contextMenu.style.top = Math.min(y + rect.top, maxY + rect.top) + 'px';
        this.contextMenu.style.display = 'block';
        this.contextMenu.style.zIndex = '10000';
        
        console.log('Menu contextuel affiché à:', {
            left: this.contextMenu.style.left,
            top: this.contextMenu.style.top,
            display: this.contextMenu.style.display
        });
        
        // Mettre à jour les options du menu selon le type d'objet
        this.updateContextMenuOptions(targetObject);
    }    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
        }
        // Ne pas effacer la cible ici car on en a besoin pour l'action
        // this.contextMenuTarget sera nettoyé après l'exécution de l'action
    }

    updateContextMenuOptions(object) {
        // Activer/désactiver certaines options selon le type d'objet
        const copyBtn = document.getElementById('context-copy');
        const cutBtn = document.getElementById('context-cut');
        const duplicateBtn = document.getElementById('context-duplicate');
        const deleteBtn = document.getElementById('context-delete');
        
        // Vérifier si l'objet peut être copié/dupliqué
        const canCopy = object && object.userData && !object.userData.isHelper;
        const canDelete = object && object.userData && !object.userData.isProtected;
        
        if (copyBtn) copyBtn.style.opacity = canCopy ? '1' : '0.5';
        if (cutBtn) cutBtn.style.opacity = canCopy ? '1' : '0.5';
        if (duplicateBtn) duplicateBtn.style.opacity = canCopy ? '1' : '0.5';
        if (deleteBtn) deleteBtn.style.opacity = canDelete ? '1' : '0.5';
        
        if (copyBtn) copyBtn.style.pointerEvents = canCopy ? 'auto' : 'none';
        if (cutBtn) cutBtn.style.pointerEvents = canCopy ? 'auto' : 'none';
        if (duplicateBtn) duplicateBtn.style.pointerEvents = canCopy ? 'auto' : 'none';
        if (deleteBtn) deleteBtn.style.pointerEvents = canDelete ? 'auto' : 'none';
    }

    duplicateObject(object) {
        if (!object) return;

        try {
            // Cloner l'objet
            const clonedObject = object.clone();
            
            // Décaler légèrement la position du clone
            clonedObject.position.x += 5;
            clonedObject.position.y += 5;
            
            // Générer un nouvel UUID pour le clone
            clonedObject.uuid = THREE.MathUtils.generateUUID();
            
            // Copier les données utilisateur
            if (object.userData) {
                clonedObject.userData = { ...object.userData };
            }
            
            // Ajouter le clone à la scène
            this.app.scene.add(clonedObject);
            
            // Ajouter aux objets trackés
            if (this.app.objects && Array.isArray(this.app.objects)) {
                this.app.objects.push(clonedObject);
            }
            
            // Ajouter au calque actuel
            if (this.app.layers && this.app.layers[this.app.currentLayer]) {
                this.app.layers[this.app.currentLayer].objects.push(clonedObject);
            }
            
            // Sélectionner le clone
            this.app.selectObject(clonedObject);
            
            // Ajouter à l'historique
            if (this.app.addToHistory) {
                this.app.addToHistory('duplicate', clonedObject);
            }
            
            document.getElementById('command-output').textContent = 'Objet dupliqué avec succès';
            
        } catch (error) {
            console.error('Erreur lors de la duplication:', error);
            document.getElementById('command-output').textContent = 'Erreur lors de la duplication de l\'objet';
        }
    }

    showPropertiesPanel() {
        // Activer l'onglet Propriétés dans la barre latérale droite
        const propertiesTab = document.querySelector('.sidebar-tab[data-panel="properties"]');
        if (propertiesTab) {
            propertiesTab.click();
        }
        
        // Mettre à jour le panneau des propriétés
        if (this.app.uiManager && this.app.uiManager.updatePropertiesPanel && this.contextMenuTarget) {
            this.app.uiManager.updatePropertiesPanel(this.contextMenuTarget);
        }
    }    getTopLevelObject(object) {
        // Trouver l'objet de niveau supérieur jusqu'au premier parent qui est un groupe ou un objet interactif
        let currentObject = object;
        while (currentObject.parent && 
               currentObject.parent.isObject3D && 
               currentObject.parent !== this.app.scene &&
               !currentObject.userData?.isClickable) {
            // Si l'objet parent est un groupe ou a un userdata, l'utiliser
            if (currentObject.parent.type === 'Group' || currentObject.parent.userData?.isClickable) {
                currentObject = currentObject.parent;
                break;
            }
            currentObject = currentObject.parent;
        }
        return currentObject;
    }    selectObject(object) {
        if (!object) return;
        
        if (this.selectedObjects.indexOf(object) === -1) {
            this.selectedObjects.push(object);
            
            // Gérer différents types d'objets
            if (object.material) {
                if (object.material.emissive) {
                    // Pour les Mesh avec matériau standard
                    object.material.emissive.setHex(0x444444);
                } else if (object.type === 'Line') {
                    // Pour les lignes, stocker la couleur originale si elle n'est pas déjà stockée
                    if (object.userData.originalColor === undefined) {
                        object.userData.originalColor = object.material.color.getHex();
                    }
                    // Changer leur couleur pour indiquer la sélection
                    object.material.color.setHex(0x00ff00); // Vert pour les lignes sélectionnées
                }
            }
            // Les autres types d'objets sont juste ajoutés à la sélection sans changement visuel
        }
        
        // Notifier le changement de sélection
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selectedObjects);
        }
    }    deselectObject(object) {
        if (!object) return;
        
        const index = this.selectedObjects.indexOf(object);
        if (index !== -1) {
            this.selectedObjects.splice(index, 1);
            
            // Gérer différents types d'objets
            if (object.material) {
                if (object.material.emissive) {
                    // Pour les Mesh avec matériau standard
                    object.material.emissive.setHex(0x000000);
                } else if (object.type === 'Line') {
                    // Pour les lignes, restaurer leur couleur d'origine depuis userData.originalColor
                    const originalColor = object.userData.originalColor !== undefined ? 
                        object.userData.originalColor : 0x000000;
                    object.material.color.setHex(originalColor);
                }
            }
        }
        
        // Notifier le changement de sélection
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selectedObjects);
        }
    }    clearSelection() {
        this.selectedObjects.forEach(object => {
            if (!object) return;
            
            // Gérer différents types d'objets
            if (object.material) {
                if (object.material.emissive) {
                    // Pour les Mesh avec matériau standard
                    object.material.emissive.setHex(0x000000);
                } else if (object.type === 'Line') {
                    // Pour les lignes, restaurer leur couleur d'origine depuis userData.originalColor
                    const originalColor = object.userData.originalColor !== undefined ? 
                        object.userData.originalColor : 0x000000;
                    object.material.color.setHex(originalColor);
                }
            }
        });
        this.selectedObjects = [];
        
        // Notifier le changement de sélection
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selectedObjects);
        }
    }

    addToSelection(object) {
        this.selectObject(object);
    }

    removeFromSelection(object) {
        this.deselectObject(object);
    }
}