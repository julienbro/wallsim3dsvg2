import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export class DimensionTool {
    constructor(app) {
        this.app = app;
        this.active = false;
        this.dimensionType = 'linear'; // linear, aligned, angular, radius, diameter
        this.points = [];
        this.tempDimension = null;
        this.dimensionOffset = 10; // Distance par défaut de la ligne de cote
        this.baseTextSize = 3; // Taille de base du texte
        this.baseArrowSize = 2; // Taille de base des flèches
        this.dimensionColor = 0x0000ff; // Bleu par défaut
        this.selectedObject = null;
        this.dimensionScale = 1; // Échelle par défaut 1:1
        this.createdDimensions = []; // Stocker toutes les cotations créées
        this.font = null; // Police chargée
        this.fontLoader = new FontLoader();
        
        // Charger la police par défaut
        this.loadDefaultFont();
        
        this.createDimensionUI();
        
        // S'assurer que l'app a accès à cet outil
        if (!app.dimensionTool) {
            app.dimensionTool = this;
        }
    }

    loadDefaultFont() {
        // Charger une police depuis le CDN de Three.js
        this.fontLoader.load(
            'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
            (font) => {
                this.font = font;
                console.log('Police de cotation chargée');
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% chargé');
            },
            (error) => {
                console.error('Erreur lors du chargement de la police:', error);
                // En cas d'erreur, utiliser la méthode canvas comme fallback
                this.font = null;
            }
        );
    }

    get textSize() {
        return this.baseTextSize * this.dimensionScale;
    }
    get arrowSize() {
        return this.baseArrowSize * this.dimensionScale;
    }

    updateScale(scale) {
        this.dimensionScale = scale;
        // Met à jour la valeur affichée dans l'UI
        if (this.dimensionUI && this.dimensionUI.style.display !== 'none') {
            document.getElementById('dimension-font-size').value = this.textSize;
        }
        // Met à jour toutes les cotations déjà posées
        this.updateAllDimensionsScale();
    }

    recreateDimensionWithNewScale(dimensionGroup) {
        // Sauvegarder les informations de la cotation
        const userData = dimensionGroup.userData;
        const dimensionType = userData.dimensionType;
        const points = userData.points;
        
        // Sauvegarder la couleur actuelle du groupe
        let groupColor = this.dimensionColor;
        if (dimensionGroup.children.length > 0) {
            // Chercher la première ligne ou mesh avec une couleur
            for (const child of dimensionGroup.children) {
                if (child.material && child.material.color) {
                    groupColor = child.material.color.getHex();
                    break;
                }
            }
        }
        
        // Sauvegarder temporairement la couleur actuelle de l'outil
        const savedColor = this.dimensionColor;
        this.dimensionColor = groupColor;
        
        // Supprimer tous les enfants du groupe
        while (dimensionGroup.children.length > 0) {
            const child = dimensionGroup.children[0];
            dimensionGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
        
        // Recréer la cotation selon son type
        try {
            switch (dimensionType) {
                case 'linear':
                case 'aligned':
                    if (points && points.length >= 3) {
                        const p1 = points[0];
                        const p2 = points[1];
                        const p3 = points[2];
                        
                        let distance;
                        if (dimensionType === 'linear') {
                            const dx = Math.abs(p2.x - p1.x);
                            const dy = Math.abs(p2.y - p1.y);
                            const offsetDir = p3.clone().sub(p1).normalize();
                            
                            if (Math.abs(offsetDir.x) > Math.abs(offsetDir.y)) {
                                distance = dx;
                                this.createHorizontalDimension(dimensionGroup, p1, p2, p3, distance);
                            } else {
                                distance = dy;
                                this.createVerticalDimension(dimensionGroup, p1, p2, p3, distance);
                            }
                        } else {
                            distance = p1.distanceTo(p2);
                            this.createAlignedDimension(dimensionGroup, p1, p2, p3, distance);
                        }
                    }
                    break;
                    
                case 'angular':
                    if (points && points.length >= 4) {
                        // Recréer la cotation angulaire complète
                        this.recreateAngularDimension(dimensionGroup, points);
                    }
                    break;
                    
                case 'radius':
                case 'diameter':
                    if (userData.targetObject && userData.points && userData.points.length >= 2) {
                        this.recreateRadialDimension(dimensionGroup, userData, dimensionType);
                    }
                    break;
            }
        } catch (error) {
            console.error('Erreur lors de la recréation de la cotation:', error);
        }
        
        // Restaurer la couleur originale
        this.dimensionColor = savedColor;
        
        // S'assurer que le groupe est toujours visible
        if (dimensionGroup.children.length === 0) {
            console.warn(`Échec de la recréation de la cotation ${dimensionType}`);
        }
    }
    
    updateAllDimensionsScale() {
        console.log(`Mise à jour de ${this.createdDimensions.length} cotations avec l'échelle ${this.dimensionScale}`);
        
        // Nettoyer la liste des cotations qui n'existent plus dans la scène
        this.createdDimensions = this.createdDimensions.filter(dimensionGroup => {
            return this.app.scene.children.includes(dimensionGroup);
        });
        console.log(`Cotations valides trouvées: ${this.createdDimensions.length}`);

        // Reconstruire chaque cotation avec la nouvelle échelle en utilisant la méthode existante
        for (let i = 0; i < this.createdDimensions.length; i++) {
            const dimensionGroup = this.createdDimensions[i];
            if (dimensionGroup && dimensionGroup.userData && dimensionGroup.userData.type === 'dimension') {
                // Mettre à jour l'échelle dans les userData
                dimensionGroup.userData.scale = this.dimensionScale;
                // Recréer le contenu du groupe avec la nouvelle échelle
                this.recreateDimensionWithNewScale(dimensionGroup);
            }
        }

        // Mettre à jour l'affichage de l'échelle dans l'UI
        const scaleDisplay = document.getElementById('current-scale-display');
        if (scaleDisplay) {
            const scaleRatio = Math.round(1 / this.dimensionScale);
            scaleDisplay.textContent = `Échelle actuelle: 1:${scaleRatio}`;
        }
        console.log('Mise à jour des cotations terminée');
    }

    recreateAngularDimension(dimensionGroup, points) {
        const p1_side = points[0];
        const vertex = points[1];
        const p2_side = points[2];
        const p3_pos = points[3];
        
        // Recalculer tous les éléments
        const v1 = p1_side.clone().sub(vertex).normalize();
        const v2 = p2_side.clone().sub(vertex).normalize();
        
        const angleV1 = Math.atan2(v1.y, v1.x);
        const angleV2 = Math.atan2(v2.y, v2.x);
        
        let sweepAngleRad = angleV2 - angleV1;
        if (sweepAngleRad < 0) {
            sweepAngleRad += 2 * Math.PI;
        }
        const angleDeg = sweepAngleRad * 180 / Math.PI;
        
        const radius = vertex.distanceTo(p3_pos);
        
        // Créer l'arc
        const arcPoints = [];
        const segments = 32;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const currentAngle = angleV1 + sweepAngleRad * t;
            const x = vertex.x + radius * Math.cos(currentAngle);
            const y = vertex.y + radius * Math.sin(currentAngle);
            arcPoints.push(new THREE.Vector3(x, y, 0));
        }
        
        const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
        const arcLine = new THREE.Line(arcGeometry, new THREE.LineBasicMaterial({ 
            color: this.dimensionColor,
            linewidth: 1
        }));
        dimensionGroup.add(arcLine);
        
        // Lignes d'extension
        const ext1End = vertex.clone().add(v1.clone().multiplyScalar(radius));
        const ext2End = vertex.clone().add(v2.clone().multiplyScalar(radius));
        const ext1Target = vertex.distanceTo(p1_side) > radius ? p1_side : ext1End;
        const ext2Target = vertex.distanceTo(p2_side) > radius ? p2_side : ext2End;
        
        this.addExtensionLine(dimensionGroup, vertex, ext1Target);
        this.addExtensionLine(dimensionGroup, vertex, ext2Target);
        
        // Texte
        const midArcAngle = angleV1 + sweepAngleRad / 2;
        const textOffset = this.textSize * 0.75;
        const textPos = new THREE.Vector3(
            vertex.x + (radius + textOffset) * Math.cos(midArcAngle),
            vertex.y + (radius + textOffset) * Math.sin(midArcAngle),
            0
        );
        let textRotation = midArcAngle + Math.PI / 2;
        if (textRotation > Math.PI / 2 && textRotation < 3 * Math.PI / 2) {
            textRotation += Math.PI;
        }
        
        this.addDimensionText(dimensionGroup, `${angleDeg.toFixed(1)}°`, textPos, textRotation);
    }
    
    recreateRadialDimension(dimensionGroup, userData, dimensionType) {
        const targetObj = userData.targetObject;
        const clickPoint = userData.points[1];
        
        // Obtenir le centre et le rayon
        let center, radius;
        
        if (targetObj.geometry instanceof THREE.CircleGeometry) {
            center = targetObj.position.clone();
            radius = targetObj.geometry.parameters.radius;
        } else if (targetObj.userData && targetObj.userData.center) {
            center = targetObj.userData.center.clone();
            radius = targetObj.userData.radius;
        } else {
            console.warn('Impossible de récupérer les informations du cercle/arc');
            return;
        }
        
        const dir = clickPoint.clone().sub(center).normalize();
        
        if (dimensionType === 'radius') {
            // Recréer la cotation de rayon
            const adaptiveOffset = Math.min(this.dimensionOffset, radius * 0.5);
            const lineStart = center.clone();
            const lineEnd = center.clone().add(dir.multiplyScalar(radius + adaptiveOffset));
            
            this.addDimensionLine(dimensionGroup, lineStart, lineEnd);
            this.addArrow(dimensionGroup, lineEnd, dir.negate());
            
            const textPos = center.clone().add(dir.multiplyScalar(radius + adaptiveOffset + this.textSize));
            this.addDimensionText(dimensionGroup, `R${radius.toFixed(1)}`, textPos);
        } else {
            // Recréer la cotation de diamètre
            const p1 = center.clone().sub(dir.clone().multiplyScalar(radius));
            const p2 = center.clone().add(dir.clone().multiplyScalar(radius));
            
            const adaptiveOffset = Math.min(this.dimensionOffset, radius * 0.3);
            const perpDir = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
            const offset = perpDir.multiplyScalar(adaptiveOffset);
            
            const dimP1 = p1.clone().add(offset);
            const dimP2 = p2.clone().add(offset);
            
            // Lignes d'extension plus courtes
            const extLength = Math.min(adaptiveOffset * 1.5, radius * 0.5);
            const ext1Start = p1.clone();
            const ext1End = p1.clone().add(perpDir.multiplyScalar(extLength));
            const ext2Start = p2.clone();
            const ext2End = p2.clone().add(perpDir.multiplyScalar(extLength));
            
            this.addExtensionLine(dimensionGroup, ext1Start, ext1End);
            this.addExtensionLine(dimensionGroup, ext2Start, ext2End);
            this.addDimensionLine(dimensionGroup, dimP1, dimP2);
            this.addArrow(dimensionGroup, dimP1, dir);
            this.addArrow(dimensionGroup, dimP2, dir.clone().negate());
            
            const textPos = dimP1.clone().add(dimP2).multiplyScalar(0.5);
            this.addDimensionText(dimensionGroup, `Ø${(radius * 2).toFixed(1)}`, textPos);
        }
    }

    activate() {
        this.active = true;
        this.points = [];
        this.app.controls.enabled = false;
        this.updateCommandOutput();
    }
    
    deactivate() {
        this.active = false;
        this.points = [];
        this.clearPreview();
        this.app.controls.enabled = true;
        if (this.dimensionUI) {
            this.dimensionUI.style.display = 'none';
        }
    }
    
    createDimensionUI() {
        // Créer l'interface pour les options de cotation
        this.dimensionUI = document.createElement('div');
        this.dimensionUI.className = 'dimension-ui-panel';        this.dimensionUI.style.cssText = `
            position: fixed;
            top: 15%;
            left: 10%;
            background: #2c3e50;
            border: 2px solid #3498db;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: none;
            z-index: 10000;
            font-family: Arial, sans-serif;
            color: white;
            min-width: 280px;
        `;
          this.dimensionUI.innerHTML = `
            <div style="margin-bottom: 15px; font-weight: bold; color: #3498db; border-bottom: 1px solid #34495e; padding-bottom: 8px;">
                📏 Options de cotation
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 12px;">Type:</label>                <select id="dimension-type" style="width: 100%; padding: 8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;">
                    <option value="linear">Linéaire</option>
                    <option value="aligned">Alignée</option>
                    <option value="angular">Angulaire</option>
                    <option value="radius">Rayon</option>
                    <option value="diameter">Diamètre</option>
                </select>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 12px;">Distance:</label>
                <input type="number" id="dimension-offset" value="${this.dimensionOffset}" 
                       min="1" max="100" step="1" style="width: 100%; padding: 8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 12px;">Taille police:</label>
                <input type="number" id="dimension-font-size" value="${this.textSize}" 
                       min="0.5" max="20" step="0.5" style="width: 100%; padding: 8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;">
            </div>            <div style="margin-bottom: 8px;">
                <label style="font-size: 12px;">Taille flèches:</label>
                <input type="number" id="dimension-arrow-size" value="${this.arrowSize}"
                       min="0.5" max="10" step="0.5" style="width: 100%; padding: 8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 12px;">Couleur:</label>
                <input type="color" id="dimension-color" value="#0000ff" 
                       style="width: 100%; padding: 3px; height: 25px; background: #444; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px; background: #34495e; padding: 5px; border-radius: 3px;">
                <label style="font-size: 11px; color: #bdc3c7;">
                    <span id="current-scale-display" style="cursor:pointer;text-decoration:underline dotted #3498db;" title="Changer l'échelle de cotation">Échelle actuelle: 1:1</span>
                </label>
            </div>
            <div style="margin-bottom: 8px;">
                <button id="dimension-properties-btn" style="width:100%;padding:6px 0;background:#3498db;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;">
                    <i class="fas fa-cog"></i> Style global de cotation
                </button>
            </div>            <div id="dimension-properties-panel" style="display:none; margin-bottom:8px; background:#34495e; border:1px solid #3498db; border-radius:5px; padding:10px;">
                <div style="margin-bottom:8px;">
                    <label style="font-size:12px; color: white;">Taille texte :</label>
                    <input type="number" id="dimension-properties-font-size" value="${this.textSize}" min="1" max="20" step="0.5" style="width:100%;padding:8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;">
                </div>
                <div style="margin-bottom:8px;">
                    <label style="font-size:12px; color: white;">Taille flèche :</label>
                    <input type="number" id="dimension-properties-arrow-size" value="${this.arrowSize}" min="1" max="20" step="0.5" style="width:100%;padding:8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;">
                </div>
                <div style="margin-bottom:8px;">
                    <label style="font-size:12px; color: white;">Style texte :</label>
                    <select id="dimension-properties-font-style" style="width:100%;padding:8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;">
                        <option value="Arial">Arial</option>
                        <option value="Consolas">Consolas</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Courier New">Courier New</option>
                    </select>
                </div>
                <div style="margin-bottom:8px;">
                    <label style="font-size:12px; color: white;">Couleur :</label>
                    <input type="color" id="dimension-properties-color" value="#0000ff" style="width:100%;padding:3px;height:25px; background: #444; border: 1px solid #555; border-radius: 4px;">
                </div>
                <div style="margin-bottom:8px;">
                    <label style="font-size:12px; color: white;">Calque :</label>
                    <select id="dimension-properties-layer-select" style="width:100%;padding:8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;"></select>
                </div>                <div style="text-align: center;">
                    <button id="dimension-properties-apply" style="background: #27ae60; color: white; border: none; 
                            padding: 10px 20px; margin-right: 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        ✓ Appliquer
                    </button>
                    <button id="dimension-properties-cancel" style="background: #e74c3c; color: white; border: none; 
                            padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        ✗ Annuler
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.dimensionUI);
        
        // Gestionnaires d'événements
        document.getElementById('dimension-type').addEventListener('change', (e) => {
            this.dimensionType = e.target.value;
            this.points = [];
            this.clearPreview();
            this.updateCommandOutput();
        });
        
        document.getElementById('dimension-offset').addEventListener('input', (e) => {
            this.dimensionOffset = parseFloat(e.target.value) || 10;
            this.updatePreview();
        });
        
        document.getElementById('dimension-font-size').addEventListener('input', (e) => {
            const newSize = parseFloat(e.target.value) || 3;
            this.baseTextSize = newSize / this.dimensionScale; // Ajuster la taille de base
            this.updatePreview();
        });
        
        document.getElementById('dimension-arrow-size').addEventListener('input', (e) => {
            const newSize = parseFloat(e.target.value) || 2;
            this.baseArrowSize = newSize / this.dimensionScale; // Ajuster la taille de base
            this.updatePreview();
        });
        
        document.getElementById('dimension-color').addEventListener('change', (e) => {
            this.dimensionColor = parseInt(e.target.value.replace('#', '0x'), 16);
            this.updatePreview();
        });
        
        // Ajout : clic sur l'échelle pour ouvrir le menu déroulant
        setTimeout(() => {
            const scaleDisplay = document.getElementById('current-scale-display');
            if (scaleDisplay) {
                scaleDisplay.addEventListener('click', () => {
                    // Ouvre le menu déroulant d'échelle dans la barre de menu
                    const menu = document.getElementById('dimension-scale-menu');
                    if (menu) {
                        const dropdown = menu.querySelector('.dropdown-content');
                        if (dropdown) {
                            dropdown.style.display = 'block';
                            // Réapplique les listeners si besoin
                            if (window.setupScaleMenuListeners) window.setupScaleMenuListeners();
                            // Ferme le menu si on clique ailleurs
                            const closeDropdown = (e) => {
                                if (!dropdown.contains(e.target) && e.target !== scaleDisplay) {
                                    dropdown.style.display = '';
                                    document.removeEventListener('mousedown', closeDropdown);
                                }
                            };
                            document.addEventListener('mousedown', closeDropdown);
                        }
                    }
                });
            }
        }, 100);
        
        // --- SUPPRIMER OU COMMENTER LES LIGNES SUIVANTES ---
        // document.getElementById('apply-dimension-changes').addEventListener('click', () => {
        //     this.applyChangesToSelectedDimension();
        // });
        // document.getElementById('cancel-dimension-edit').addEventListener('click', () => {
        //     this.cancelDimensionEdit();
        // });
        // ---------------------------------------------------
          // Bouton pour ouvrir/fermer le panneau propriétés
        const propBtn = this.dimensionUI.querySelector('#dimension-properties-btn');
        const propPanel = this.dimensionUI.querySelector('#dimension-properties-panel');
        propBtn.addEventListener('click', () => {
            // Remplir la liste des calques à chaque ouverture
            const layerSelect = this.dimensionUI.querySelector('#dimension-properties-layer-select');
            if (layerSelect && this.app.layers) {
                layerSelect.innerHTML = '';
                this.app.layers.forEach((layer, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = layer.name || `Calque ${idx}`;
                    if (idx === this.app.currentLayer) opt.selected = true;
                    layerSelect.appendChild(opt);
                });
            }
            propPanel.style.display = propPanel.style.display === 'none' ? 'block' : 'none';
        });

        // Appliquer les propriétés à toutes les cotations placées
        this.dimensionUI.querySelector('#dimension-properties-apply').addEventListener('click', () => {
            // Récupère les valeurs UNIQUEMENT du panneau propriétés
            const propPanel = this.dimensionUI.querySelector('#dimension-properties-panel');
            const fontSize = parseFloat(propPanel.querySelector('#dimension-properties-font-size').value) || this.textSize;
            const arrowSize = parseFloat(propPanel.querySelector('#dimension-properties-arrow-size').value) || this.arrowSize;
            const fontStyle = propPanel.querySelector('#dimension-properties-font-style').value || 'Arial';
            const color = propPanel.querySelector('#dimension-properties-color').value || '#0000ff';
            const layerIdx = parseInt(propPanel.querySelector('#dimension-properties-layer-select').value);

            // Appliquer à toutes les cotations existantes
            this.createdDimensions.forEach(dimGroup => {
                // Mettre à jour userData
                dimGroup.userData.textSize = fontSize;
                dimGroup.userData.arrowSize = arrowSize;
                dimGroup.userData.fontStyle = fontStyle;
                dimGroup.userData.color = parseInt(color.replace('#', '0x'), 16);

                // Déplacer vers le calque choisi si différent
                if (typeof layerIdx === 'number' && this.app.layers && this.app.layers[layerIdx]) {
                    // Retirer du calque actuel
                    this.app.layers.forEach(layer => {
                        const i = layer.objects.indexOf(dimGroup);
                        if (i !== -1) layer.objects.splice(i, 1);
                    });
                    // Ajouter au nouveau calque
                    if (!this.app.layers[layerIdx].objects.includes(dimGroup)) {
                        this.app.layers[layerIdx].objects.push(dimGroup);
                    }
                }

                // Recréer la cotation avec les nouvelles propriétés
                this.recreateDimensionWithNewProperties(dimGroup);
            });

            // Mettre à jour les valeurs par défaut pour les prochaines cotations
            this.baseTextSize = fontSize / this.dimensionScale;
            this.baseArrowSize = arrowSize / this.dimensionScale;
            this.fontStyle = fontStyle;
            this.dimensionColor = parseInt(color.replace('#', '0x'), 16);

            propPanel.style.display = 'none';
            document.getElementById('command-output').textContent = 'Propriétés des cotations appliquées';
        });

        // Annuler la modification
        this.dimensionUI.querySelector('#dimension-properties-cancel').addEventListener('click', () => {
            propPanel.style.display = 'none';
        });
    }
    
    handleClick(point) {
        if (!this.active) return;

        // Prevent drawing on the Z-axis (blue axis)
        if (point.z !== 0) {
            console.warn('Cannot draw dimensions on the Z-axis.');
            document.getElementById('command-output').textContent = 'Cotation impossible sur l\'axe bleu.';
            return;
        }

        switch (this.dimensionType) {
            case 'linear':
            case 'aligned':
                this.handleLinearDimension(point);
                break;
            case 'angular':
                this.handleAngularDimension(point);
                break;
            case 'radius':
            case 'diameter':
                this.handleRadialDimension(point);
                break;
        }
    }
    
    handleLinearDimension(point) {
        if (this.points.length === 0) {
            this.points.push(point.clone());
            document.getElementById('command-output').textContent = 'Cliquez sur le second point';
        } else if (this.points.length === 1) {
            this.points.push(point.clone());
            document.getElementById('command-output').textContent = 'Cliquez pour positionner la cotation';
        } else if (this.points.length === 2) {
            this.points.push(point.clone());
            this.createLinearDimension();
            this.points = [];
        }
    }
    
    handleAngularDimension(point) {
        if (this.points.length === 0) {
            this.points.push(point.clone());
            document.getElementById('command-output').textContent = 'Cliquez sur le sommet de l\'angle';
        } else if (this.points.length === 1) {
            this.points.push(point.clone());
            document.getElementById('command-output').textContent = 'Cliquez sur le second côté de l\'angle';
        } else if (this.points.length === 2) {
            this.points.push(point.clone());
            document.getElementById('command-output').textContent = 'Cliquez pour positionner la cotation';
        } else if (this.points.length === 3) {
            this.points.push(point.clone());
            this.createAngularDimension();
            this.points = [];
        }
    }
    
    handleRadialDimension(point) {
        if (this.points.length === 0) {
            // Premier clic : détecter les cercles ou arcs à proximité du point
            this.selectedObject = this.findCircleOrArcNear(point);
            
            if (this.selectedObject) {
                this.points.push(point.clone());
                // Obtenir les informations du cercle pour affichage
                let radius = 0;
                if (this.selectedObject.geometry instanceof THREE.CircleGeometry) {
                    radius = this.selectedObject.geometry.parameters.radius;
                } else if (this.selectedObject.userData && this.selectedObject.userData.radius) {
                    radius = this.selectedObject.userData.radius;
                }
                document.getElementById('command-output').textContent = `Cercle sélectionné (R=${radius.toFixed(1)}) - Cliquez pour positionner la cotation`;
            } else {
                document.getElementById('command-output').textContent = 'Aucun cercle ou arc trouvé - Cliquez plus près d\'un cercle ou un arc';
            }
        } else if (this.points.length === 1 && this.selectedObject) {
            // Deuxième clic : positionner la cotation
            this.points.push(point.clone());
            if (this.dimensionType === 'radius') {
                this.createRadiusDimension();
            } else {
                this.createDiameterDimension();
            }
            this.points = [];
            this.selectedObject = null;
        }
    }
    
    findCircleOrArcNear(point, tolerance = 10) {
        let closestObject = null;
        let closestDistance = tolerance;
        
        console.log(`Recherche de cercles près du point (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
        console.log(`Nombre d'objets à vérifier: ${this.app.objects.length}`);
        
        // Parcourir tous les objets pour trouver des cercles ou arcs
        for (let i = 0; i < this.app.objects.length; i++) {
            const obj = this.app.objects[i];
            
            // Debug: afficher le type d'objet
            console.log(`Objet ${i}: ${obj.constructor.name}, geometry: ${obj.geometry ? obj.geometry.constructor.name : 'none'}`);
            
            if (this.isCircleOrArc(obj)) {
                const distance = this.getDistanceToCircleOrArc(obj, point);
                console.log(`Cercle/arc trouvé, distance: ${distance.toFixed(2)}`);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestObject = obj;
                    console.log(`Nouveau cercle le plus proche, distance: ${distance.toFixed(2)}`);
                }
            }
        }
        
        if (closestObject) {
            console.log(`Cercle sélectionné à distance: ${closestDistance.toFixed(2)}`);
        } else {
            console.log('Aucun cercle trouvé dans la tolérance');
        }
        
        return closestObject;
    }
    
    isCircleOrArc(obj) {
        // Vérifier si c'est un cercle (Mesh avec CircleGeometry)
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CircleGeometry) {
            console.log('Cercle Mesh détecté');
            return true;
        }
        
        // Vérifier si c'est un arc (Line avec userData.type === 'arc')
        if (obj instanceof THREE.Line && obj.userData && obj.userData.type === 'arc') {
            console.log('Arc Line détecté');
            return true;
        }
        
        // Vérifier si c'est un cercle créé par CircleTool (qui peut être stocké différemment)
        if (obj.userData && obj.userData.type === 'circle') {
            console.log('Cercle userData détecté');
            return true;
        }
        
        // Vérifier si l'objet a des enfants qui pourraient être des cercles
        if (obj.children && obj.children.length > 0) {
            for (const child of obj.children) {
                if (child instanceof THREE.Mesh && child.geometry instanceof THREE.CircleGeometry) {
                    console.log('Cercle enfant détecté');
                    // Copier les informations vers l'objet parent
                    obj.userData.center = child.position.clone();
                    obj.userData.radius = child.geometry.parameters.radius;
                    obj.userData.type = 'circle-parent';
                    return true;
                }
            }
        }
        
        return false;
    }
    
    getDistanceToCircleOrArc(obj, point) {
        let center, radius;
        
        // Obtenir le centre et le rayon selon le type d'objet
        if (obj.geometry instanceof THREE.CircleGeometry) {
            center = obj.position.clone();
            radius = obj.geometry.parameters.radius;
        } else if (obj.userData && obj.userData.center && obj.userData.radius) {
            center = obj.userData.center.clone();
            radius = obj.userData.radius;
        } else if (obj.userData && obj.userData.type === 'circle') {
            // Pour les cercles créés par CircleTool, essayer de déduire centre et rayon
            center = obj.position ? obj.position.clone() : new THREE.Vector3(0, 0, 0);
            radius = obj.userData.radius || 1;
        } else {
            console.log('Impossible d\'obtenir centre et rayon');
            return Infinity;
        }
        
        console.log(`Centre: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}), Rayon: ${radius.toFixed(2)}`);
        
        // Calculer la distance du point au contour du cercle/arc
        const distanceToCenter = point.distanceTo(center);
        const distanceToEdge = Math.abs(distanceToCenter - radius);
        
        console.log(`Distance au centre: ${distanceToCenter.toFixed(2)}, Distance au contour: ${distanceToEdge.toFixed(2)}`);
        
        return distanceToEdge;
    }
    
    createLinearDimension() {
        const p1 = this.points[0];
        const p2 = this.points[1];
        const p3 = this.points[2];
        
        const dimensionGroup = new THREE.Group();
        dimensionGroup.userData = { 
            type: 'dimension', 
            dimensionType: this.dimensionType,
            points: this.points.map(p => p.clone()),
            scale: this.dimensionScale
        };
        
        // Calculer la distance
        let distance;
        if (this.dimensionType === 'linear') {
            // Distance horizontale ou verticale selon la position du 3e point
            const dx = Math.abs(p2.x - p1.x);
            const dy = Math.abs(p2.y - p1.y);
            const offsetDir = p3.clone().sub(p1).normalize();
            
            if (Math.abs(offsetDir.x) > Math.abs(offsetDir.y)) {
                // Cotation horizontale
                distance = dx;
                this.createHorizontalDimension(dimensionGroup, p1, p2, p3, distance);
            } else {
                // Cotation verticale
                distance = dy;
                this.createVerticalDimension(dimensionGroup, p1, p2, p3, distance);
            }
        } else {
            // Cotation alignée
            distance = p1.distanceTo(p2);
            this.createAlignedDimension(dimensionGroup, p1, p2, p3, distance);
        }
        
        // Ajouter à la liste AVANT d'ajouter à la scène
        this.createdDimensions.push(dimensionGroup);
        
        this.app.scene.add(dimensionGroup);
        this.app.objects.push(dimensionGroup);
        this.app.layers[this.app.currentLayer].objects.push(dimensionGroup);
        this.app.addToHistory('create', dimensionGroup);
        
        document.getElementById('command-output').textContent = `Cotation créée: ${distance.toFixed(2)} cm`;
    }
    
    createHorizontalDimension(group, p1, p2, p3, distance) {
        const y = p3.y;
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        
        // Lignes d'extension
        this.addExtensionLine(group, new THREE.Vector3(p1.x, p1.y, 0), new THREE.Vector3(p1.x, y, 0));
        this.addExtensionLine(group, new THREE.Vector3(p2.x, p2.y, 0), new THREE.Vector3(p2.x, y, 0));
        
        // Ligne de cote
        this.addDimensionLine(group, new THREE.Vector3(minX, y, 0), new THREE.Vector3(maxX, y, 0));
        
        // Flèches
        this.addArrow(group, new THREE.Vector3(minX, y, 0), new THREE.Vector3(1, 0, 0));
        this.addArrow(group, new THREE.Vector3(maxX, y, 0), new THREE.Vector3(-1, 0, 0));
        
        // Texte
        const textPos = new THREE.Vector3((minX + maxX) / 2, y + this.textSize * 0.5, 0);
        this.addDimensionText(group, distance.toFixed(1), textPos);
    }
    
    createVerticalDimension(group, p1, p2, p3, distance) {
        const x = p3.x;
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);
        
        // Lignes d'extension
        this.addExtensionLine(group, new THREE.Vector3(p1.x, p1.y, 0), new THREE.Vector3(x, p1.y, 0));
        this.addExtensionLine(group, new THREE.Vector3(p2.x, p2.y, 0), new THREE.Vector3(x, p2.y, 0));
        
        // Ligne de cote
        this.addDimensionLine(group, new THREE.Vector3(x, minY, 0), new THREE.Vector3(x, maxY, 0));
        
        // Flèches
        this.addArrow(group, new THREE.Vector3(x, minY, 0), new THREE.Vector3(0, 1, 0));
        this.addArrow(group, new THREE.Vector3(x, maxY, 0), new THREE.Vector3(0, -1, 0));
        
        // Texte (avec rotation)
        const textPos = new THREE.Vector3(x + this.textSize * 0.5, (minY + maxY) / 2, 0);
        this.addDimensionText(group, distance.toFixed(1), textPos, Math.PI / 2);
    }
    
    createAlignedDimension(group, p1, p2, p3, distance) {
        const dir = p2.clone().sub(p1).normalize();
        const perpDir = new THREE.Vector3(-dir.y, dir.x, 0);
        
        // Calculer la distance de décalage
        const offset = p3.clone().sub(p1).dot(perpDir);
        const offsetVec = perpDir.multiplyScalar(offset);
        
        const dimP1 = p1.clone().add(offsetVec);
        const dimP2 = p2.clone().add(offsetVec);
        
        // Lignes d'extension
        this.addExtensionLine(group, p1, dimP1);
        this.addExtensionLine(group, p2, dimP2);
        
        // Ligne de cote
        this.addDimensionLine(group, dimP1, dimP2);
        
        // Flèches
        this.addArrow(group, dimP1, dir);
        this.addArrow(group, dimP2, dir.negate());
        
        // Texte
        const textPos = dimP1.clone().add(dimP2).multiplyScalar(0.5);
        const angle = Math.atan2(dir.y, dir.x);
        this.addDimensionText(group, distance.toFixed(1), textPos, angle);
    }
    
    createAngularDimension() {
        const p1_side = this.points[0];
        const vertex = this.points[1];
        const p2_side = this.points[2];
        const p3_pos = this.points[3];
        
        const dimensionGroup = new THREE.Group();
        dimensionGroup.userData = { 
            type: 'dimension', 
            dimensionType: 'angular',
            points: this.points.map(p => p.clone()),
            scale: this.dimensionScale
        };
        
        // Calculate vectors from vertex to points on sides
        const v1 = p1_side.clone().sub(vertex).normalize();
        const v2 = p2_side.clone().sub(vertex).normalize();
        
        // Calculate angles of these vectors with respect to positive X-axis
        const angleV1 = Math.atan2(v1.y, v1.x); // Start angle for the arc
        const angleV2 = Math.atan2(v2.y, v2.x);
        
        // Calculate the counter-clockwise sweep angle from v1 to v2
        let sweepAngleRad = angleV2 - angleV1;
        if (sweepAngleRad < 0) {
            sweepAngleRad += 2 * Math.PI; // Ensure positive CCW sweep
        }
        const angleDeg = sweepAngleRad * 180 / Math.PI;
        
        // Calculate the radius of the dimension arc
        const radius = vertex.distanceTo(p3_pos);
        
        // Create the arc points for the dimension line
        const arcPoints = [];
        const segments = 32; // Number of segments for the arc
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const currentAngle = angleV1 + sweepAngleRad * t; // Interpolate angle along the sweep
            const x = vertex.x + radius * Math.cos(currentAngle);
            const y = vertex.y + radius * Math.sin(currentAngle);
            arcPoints.push(new THREE.Vector3(x, y, 0));
        }
        
        const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
        const arcLine = new THREE.Line(arcGeometry, new THREE.LineBasicMaterial({ 
            color: this.dimensionColor,
            linewidth: 1 // Standard linewidth for dimension arc
        }));
        dimensionGroup.add(arcLine);
        
        // Lignes d'extension from vertex to the start/end of the arc
        // (or to the original p1_side, p2_side if preferred, but arc points are cleaner)
        const ext1End = vertex.clone().add(v1.clone().multiplyScalar(radius)); // Point on arc start
        const ext2End = vertex.clone().add(v2.clone().multiplyScalar(radius)); // Point on arc end
        
        // Check if p1_side and p2_side are further than the arc radius, if so, extend to them
        const ext1Target = vertex.distanceTo(p1_side) > radius ? p1_side : ext1End;
        const ext2Target = vertex.distanceTo(p2_side) > radius ? p2_side : ext2End;

        this.addExtensionLine(dimensionGroup, vertex, ext1Target);
        this.addExtensionLine(dimensionGroup, vertex, ext2Target);
        
        // Text: Position in the middle of the arc sweep, slightly offset outwards
        const midArcAngle = angleV1 + sweepAngleRad / 2;
        const textOffset = this.textSize * 0.75; // Offset for text from arc
        const textPos = new THREE.Vector3(
            vertex.x + (radius + textOffset) * Math.cos(midArcAngle),
            vertex.y + (radius + textOffset) * Math.sin(midArcAngle),
            0
        );
        // Text rotation to align with the tangent at midArcAngle (optional, can be complex)
        // For simplicity, keeping text horizontal or slightly rotated based on midArcAngle.
        let textRotation = midArcAngle + Math.PI / 2; // Perpendicular to radius
        // Normalize rotation to be more readable (e.g., avoid upside down text)
        if (textRotation > Math.PI / 2 && textRotation < 3 * Math.PI / 2) {
            textRotation += Math.PI;
        }

        this.addDimensionText(dimensionGroup, `${angleDeg.toFixed(1)}°`, textPos, textRotation);
        
        // Ajouter à la liste AVANT d'ajouter à la scène
        this.createdDimensions.push(dimensionGroup);
        
        this.app.scene.add(dimensionGroup);
        this.app.objects.push(dimensionGroup);
        this.app.layers[this.app.currentLayer].objects.push(dimensionGroup);
        this.app.addToHistory('create', dimensionGroup);
        
        document.getElementById('command-output').textContent = `Cotation angulaire créée: ${angleDeg.toFixed(1)}°`;
    }
    
    createRadiusDimension() {
        if (!this.selectedObject) return;
        
        const dimensionGroup = new THREE.Group();
        dimensionGroup.userData = { 
            type: 'dimension', 
            dimensionType: 'radius',
            targetObject: this.selectedObject,
            points: this.points.map(p => p.clone()),
            scale: this.dimensionScale
        };
        
        // Obtenir le centre et le rayon
        let center, radius;
        if (this.selectedObject.geometry instanceof THREE.CircleGeometry) {
            center = this.selectedObject.position.clone();
            radius = this.selectedObject.geometry.parameters.radius;
        } else if (this.selectedObject.userData && this.selectedObject.userData.center) {
            center = this.selectedObject.userData.center.clone();
            radius = this.selectedObject.userData.radius;
        } else {
            return;
        }
        
        // Direction de la cotation vers le point cliqué
        const dir = this.points[1].clone().sub(center).normalize();
        
        // Point sur le contour du cercle
        const edgePoint = center.clone().add(dir.multiplyScalar(radius));
        
        // Ajuster le décalage pour qu'il soit proportionnel au rayon
        const adaptiveOffset = Math.min(this.dimensionOffset, radius * 0.5);
        
        // Point de début de la ligne de cotation (du centre vers l'extérieur)
        const lineStart = center.clone();
        
        // Point de fin de la ligne de cotation (légèrement au-delà du contour)
        const lineEnd = center.clone().add(dir.multiplyScalar(radius + adaptiveOffset));
        
        // Ligne de cotation du centre vers l'extérieur
        this.addDimensionLine(dimensionGroup, lineStart, lineEnd);
        
        // Flèche à la fin de la ligne
        this.addArrow(dimensionGroup, lineEnd, dir.negate());
        
        // Position du texte
        const textPos = center.clone().add(dir.multiplyScalar(radius + adaptiveOffset + this.textSize));
        this.addDimensionText(dimensionGroup, `R${radius.toFixed(1)}`, textPos);
        
        // Ajouter à la liste AVANT d'ajouter à la scène
        this.createdDimensions.push(dimensionGroup);
        
        this.app.scene.add(dimensionGroup);
        this.app.objects.push(dimensionGroup);
        this.app.layers[this.app.currentLayer].objects.push(dimensionGroup);
        this.app.addToHistory('create', dimensionGroup);
        
        document.getElementById('command-output').textContent = `Cotation de rayon créée: R${radius.toFixed(1)} cm`;
    }
    
    createDiameterDimension() {
        if (!this.selectedObject) return;
        
        const dimensionGroup = new THREE.Group();
        dimensionGroup.userData = { 
            type: 'dimension', 
            dimensionType: 'diameter',
            targetObject: this.selectedObject,
            points: this.points.map(p => p.clone()),
            scale: this.dimensionScale
        };
        
        // Obtenir le centre et le rayon
        let center, radius;
        if (this.selectedObject.geometry instanceof THREE.CircleGeometry) {
            center = this.selectedObject.position.clone();
            radius = this.selectedObject.geometry.parameters.radius;
        } else if (this.selectedObject.userData && this.selectedObject.userData.center) {
            center = this.selectedObject.userData.center.clone();
            radius = this.selectedObject.userData.radius;
        } else {
            return;
        }
        
        // Direction de la cotation
        const dir = this.points[1].clone().sub(center).normalize();
        const p1 = center.clone().sub(dir.clone().multiplyScalar(radius));
        const p2 = center.clone().add(dir.clone().multiplyScalar(radius));
        
        // Ajuster le décalage pour qu'il soit proportionnel au rayon
        const adaptiveOffset = Math.min(this.dimensionOffset, radius * 0.3);
        
        // Créer un vecteur perpendiculaire
        const perpDir = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
        const offset = perpDir.multiplyScalar(adaptiveOffset);
        
        // Points de la ligne de cotation
        const dimP1 = p1.clone().add(offset);
        const dimP2 = p2.clone().add(offset);
        
        // Lignes d'extension plus courtes
        const extLength = Math.min(adaptiveOffset * 1.5, radius * 0.5);
        const ext1Start = p1.clone();
        const ext1End = p1.clone().add(perpDir.multiplyScalar(extLength));
        const ext2Start = p2.clone();
        const ext2End = p2.clone().add(perpDir.multiplyScalar(extLength));
        
        this.addExtensionLine(dimensionGroup, ext1Start, ext1End);
        this.addExtensionLine(dimensionGroup, ext2Start, ext2End);
        this.addDimensionLine(dimensionGroup, dimP1, dimP2);
        this.addArrow(dimensionGroup, dimP1, dir);
        this.addArrow(dimensionGroup, dimP2, dir.clone().negate());
        
        // Texte
        const textPos = dimP1.clone().add(dimP2).multiplyScalar(0.5);
        this.addDimensionText(dimensionGroup, `Ø${(radius * 2).toFixed(1)}`, textPos);
        
        // Ajouter à la liste AVANT d'ajouter à la scène
        this.createdDimensions.push(dimensionGroup);
        
        this.app.scene.add(dimensionGroup);
        this.app.objects.push(dimensionGroup);
        this.app.layers[this.app.currentLayer].objects.push(dimensionGroup);
        this.app.addToHistory('create', dimensionGroup);
        
        document.getElementById('command-output').textContent = `Cotation de diamètre créée: Ø${(radius * 2).toFixed(1)} cm`;
    }
    
    addExtensionLine(group, start, end) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        // Use LineBasicMaterial for solid lines on confirmed dimensions
        const material = new THREE.LineBasicMaterial({ 
            color: this.dimensionColor,
            linewidth: 1
        });
        const line = new THREE.Line(geometry, material);
        // line.computeLineDistances(); // Not needed for LineBasicMaterial
        group.add(line);
    }
    
    addDimensionLine(group, start, end) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const material = new THREE.LineBasicMaterial({ 
            color: this.dimensionColor,
            linewidth: 2
        });
        const line = new THREE.Line(geometry, material);
        group.add(line);
    }
    
    addArrow(group, position, direction) {
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 0);
        arrowShape.lineTo(-this.arrowSize, -this.arrowSize * 0.5);
        arrowShape.lineTo(-this.arrowSize, this.arrowSize * 0.5);
        arrowShape.closePath();
        
        const geometry = new THREE.ShapeGeometry(arrowShape);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.dimensionColor,
            side: THREE.DoubleSide
        });
        const arrow = new THREE.Mesh(geometry, material);
        
        arrow.position.copy(position);
        const angle = Math.atan2(direction.y, direction.x);
        arrow.rotation.z = angle;
        
        group.add(arrow);
    }
    
    addDimensionText(group, text, position, rotation = 0) {
        if (this.font && (!this.fontStyle || this.fontStyle === 'Arial')) {
            // Utiliser TextGeometry si la police est chargée
            const textGeometry = new TextGeometry(text, {
                font: this.font,
                size: this.textSize, // Taille directement liée à textSize
                height: 0.1, // Épaisseur du texte (fine)
                curveSegments: 12,
                bevelEnabled: false
            });
            
            // Centrer le texte
            textGeometry.computeBoundingBox();
            const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
            const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
            textGeometry.translate(-textWidth / 2, -textHeight / 2, 0);
            
            const textMaterial = new THREE.MeshBasicMaterial({ 
                color: this.dimensionColor,
                side: THREE.DoubleSide
            });
            
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.copy(position);
            textMesh.rotation.z = rotation;
            
            // Ajouter un fond blanc derrière le texte pour la lisibilité
            const backgroundGeometry = new THREE.PlaneGeometry(
                textWidth * 1.2, 
                textHeight * 1.4
            );
            const backgroundMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                side: THREE.DoubleSide,
                opacity: 0.9,
                transparent: true
            });
            const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
            background.position.copy(position);
            background.position.z -= 0.05; // Légèrement derrière le texte
            background.rotation.z = rotation;
            
            // Ajouter une bordure
            const borderGeometry = new THREE.EdgesGeometry(backgroundGeometry);
            const borderMaterial = new THREE.LineBasicMaterial({ 
                color: this.dimensionColor,
                linewidth: 1
            });
            const border = new THREE.LineSegments(borderGeometry, borderMaterial);
            background.add(border);
            
            // S'assurer que le texte est au-dessus des autres éléments
            textMesh.renderOrder = 101;
            background.renderOrder = 100;
            
            group.add(background);
            group.add(textMesh);
        } else {
            // Fallback : utiliser la méthode canvas si la police n'est pas chargée
            this.addDimensionTextCanvas(group, text, position, rotation);
        }
    }
    
    addDimensionTextCanvas(group, text, position, rotation = 0, fontStyle = 'Arial') {
        // Méthode canvas existante comme fallback
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Adapter la taille du canvas à la taille du texte
        const fontSize = Math.round(this.textSize * 20); // Convertir en pixels
        canvas.width = text.length * fontSize * 0.7;
        canvas.height = fontSize * 2;
        
        // Fond blanc
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Bordure
        context.strokeStyle = this.dimensionColor.toString(16).padStart(6, '0');
        context.strokeStyle = '#' + context.strokeStyle;
        context.lineWidth = 2;
        context.strokeRect(0, 0, canvas.width, canvas.height);
        
        // Texte
        context.font = `bold ${fontSize}px ${fontStyle}`;
        context.fillStyle = '#000000';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Créer la texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Créer un plan avec une taille appropriée basée sur this.textSize
        const planeWidth = this.textSize * text.length * 0.6;
        const planeHeight = this.textSize * 0.8;
        
        const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const planeMaterial = new THREE.MeshBasicMaterial({ 
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const textPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        textPlane.position.copy(position);
        textPlane.rotation.z = rotation;
        
        // S'assurer que le texte est au-dessus des autres éléments
        textPlane.renderOrder = 100;
        
        group.add(textPlane);
    }

    updatePreview(currentPoint) {
        this.clearPreview();
        
        if (!currentPoint || this.points.length === 0) return;
        
        this.tempDimension = new THREE.Group();
        
        switch (this.dimensionType) {
            case 'linear':
            case 'aligned':
                if (this.points.length === 1) {
                    // Preview de la ligne entre les deux points
                    const geometry = new THREE.BufferGeometry().setFromPoints([this.points[0], currentPoint]);
                    const material = new THREE.LineDashedMaterial({ 
                        color: this.dimensionColor,
                        opacity: 0.5,
                        transparent: true,
                        dashSize: 2, // Maintained dash for direct preview line
                        gapSize: 1
                    });
                    const line = new THREE.Line(geometry, material);
                    line.computeLineDistances();
                    this.tempDimension.add(line);
                    
                    // Afficher la distance temporaire
                    const distance = this.points[0].distanceTo(currentPoint);
                    document.getElementById('command-output').textContent = 
                        `Distance: ${distance.toFixed(2)} cm - Cliquez pour le second point`;
                } else if (this.points.length === 2) {
                    // Preview de la cotation complète
                    const p1 = this.points[0];
                    const p2 = this.points[1];
                    const p3 = currentPoint;
                    
                    if (this.dimensionType === 'linear') {
                        const dx = Math.abs(p2.x - p1.x);
                        const dy = Math.abs(p2.y - p1.y);
                        const offsetDir = p3.clone().sub(p1).normalize();
                        
                        if (Math.abs(offsetDir.x) > Math.abs(offsetDir.y)) {
                            this.createHorizontalDimension(this.tempDimension, p1, p2, p3, dx);
                        } else {
                            this.createVerticalDimension(this.tempDimension, p1, p2, p3, dy);
                        }
                    } else {
                        const distance = p1.distanceTo(p2);
                        this.createAlignedDimension(this.tempDimension, p1, p2, p3, distance);
                    }
                    
                    // Rendre les éléments semi-transparents
                    this.tempDimension.traverse((child) => {
                        if (child.material) {
                            child.material.opacity = 0.5;
                            child.material.transparent = true;
                            // If child is a Line with LineBasicMaterial (now from addExtensionLine),
                            // it will just become a transparent solid line in preview.
                        }
                    });
                }
                break;
                
            case 'angular':
                // Preview pour cotation angulaire
                if (this.points.length > 0) {
                    const geometry = new THREE.BufferGeometry().setFromPoints([this.points[this.points.length - 1], currentPoint]);
                    const material = new THREE.LineDashedMaterial({ 
                        color: this.dimensionColor,
                        opacity: 0.5,
                        transparent: true,
                        dashSize: 2,
                        gapSize: 1
                    });
                    const line = new THREE.Line(geometry, material);
                    line.computeLineDistances();
                    this.tempDimension.add(line);
                }
                break;
        }
        
        if (this.tempDimension.children.length > 0) {
            this.app.scene.add(this.tempDimension);
        }
    }
    
    clearPreview() {
        if (this.tempDimension) {
            this.app.scene.remove(this.tempDimension);
            // Nettoyer les géométries et matériaux
            this.tempDimension.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.tempDimension = null;
        }
    }
    
    updateCommandOutput() {
        const messages = {
            'linear': 'Cotation linéaire: Cliquez sur le premier point',
            'aligned': 'Cotation alignée: Cliquez sur le premier point',
            'angular': 'Cotation angulaire: Cliquez sur le premier côté de l\'angle',
            'radius': 'Cotation de rayon: Cliquez sur un cercle ou un arc',
            'diameter': 'Cotation de diamètre: Cliquez sur un cercle'
        };
        
        document.getElementById('command-output').textContent = messages[this.dimensionType] || 'Sélectionnez un type de cotation';
        
        if (this.dimensionUI) {
            this.dimensionUI.style.display = 'block';
        }
    }
    
    cancel() {
        this.points = [];
        this.selectedObject = null;
        this.clearPreview();
        this.deactivate();
        document.getElementById('command-output').textContent = 'Cotation annulée';
    }

    // Méthode pour créer une cotation complète (pour stockage/recréation si besoin)
    createDimension(data) {
        const dimensionGroup = new THREE.Group();
        dimensionGroup.userData = {
            type: 'dimension',
            dimensionData: data,
            scale: this.dimensionScale
        };
        
        // ...existing code...
        this.createdDimensions.push(dimensionGroup);
        this.app.addToHistory('create', dimensionGroup);
        return dimensionGroup;
    }

    // Méthode pour supprimer toutes les cotations
    removeAllDimensions() {
        console.log(`Suppression de ${this.createdDimensions.length} cotations`);
        
        // Supprimer toutes les cotations de la scène
        this.createdDimensions.forEach(dimensionGroup => {
            if (dimensionGroup) {
                // Retirer de la scène
                this.app.scene.remove(dimensionGroup);
                
                // Retirer des listes d'objets
                const objIndex = this.app.objects.indexOf(dimensionGroup);
                if (objIndex !== -1) {
                    this.app.objects.splice(objIndex, 1);
                }
                
                // Retirer du layer actuel
                if (this.app.layers && this.app.layers[this.app.currentLayer]) {
                    const layerIndex = this.app.layers[this.app.currentLayer].objects.indexOf(dimensionGroup);
                    if (layerIndex !== -1) {
                        this.app.layers[this.app.currentLayer].objects.splice(layerIndex, 1);
                    }
                }
                
                // Nettoyer la mémoire
                dimensionGroup.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        });
        
        // Vider la liste
        this.createdDimensions = [];
        console.log('Toutes les cotations ont été supprimées');
    }
    
    // Nouvelle méthode pour détecter le clic sur une cotation
    handleDimensionClick(intersectedObject) {
        // Trouver le groupe parent de cotation
        let dimensionGroup = intersectedObject;
        while (dimensionGroup.parent && dimensionGroup.parent !== this.app.scene) {
            if (dimensionGroup.userData && dimensionGroup.userData.type === 'dimension') {
                break;
            }
            dimensionGroup = dimensionGroup.parent;
        }
        
        if (dimensionGroup && dimensionGroup.userData && dimensionGroup.userData.type === 'dimension') {
            this.editDimension(dimensionGroup);
            return true;
        }
        return false;
    }

    // Méthode pour éditer une cotation existante
    editDimension(dimensionGroup) {
        this.selectedDimensionGroup = dimensionGroup;
        
        // Afficher l'UI si elle n'est pas visible
        if (this.dimensionUI) {
            this.dimensionUI.style.display = 'block';
        }
        
        // Afficher les contrôles d'édition
        const editControls = document.getElementById('dimension-edit-controls');
        if (editControls) {
            editControls.style.display = 'block';
        }
        
        // Récupérer les valeurs actuelles de la cotation
        const userData = dimensionGroup.userData;
        
        // Mettre à jour l'UI avec les valeurs actuelles
        if (userData.dimensionType) {
            document.getElementById('dimension-type').value = userData.dimensionType;
            document.getElementById('dimension-type').disabled = true; // Désactiver le changement de type
        }
        
        // Récupérer la taille actuelle du texte et des flèches depuis userData ou utiliser les valeurs actuelles
        const currentTextSize = userData.textSize || this.textSize;
        const currentArrowSize = userData.arrowSize || this.arrowSize;
        const currentColor = userData.color || this.dimensionColor;
        
        document.getElementById('dimension-font-size').value = currentTextSize;
        document.getElementById('dimension-arrow-size').value = currentArrowSize;
        
        // Convertir la couleur en hexadécimal pour l'input color
        const colorHex = '#' + currentColor.toString(16).padStart(6, '0');
        document.getElementById('dimension-color').value = colorHex;
        
        // Mettre en surbrillance la cotation sélectionnée
        this.highlightDimension(dimensionGroup, true);
        
        document.getElementById('command-output').textContent = 'Modification de cotation - Ajustez les paramètres et cliquez sur Appliquer';
    }

    // Nouvelle méthode pour gérer le clic droit sur une cotation
    handleRightClick(event, intersectedObject) {
        // Empêcher le menu contextuel par défaut du navigateur
        event.preventDefault();
        
        // Trouver le groupe parent de cotation
        let dimensionGroup = intersectedObject;
        while (dimensionGroup && dimensionGroup.parent && dimensionGroup.parent !== this.app.scene) {
            if (dimensionGroup.userData && dimensionGroup.userData.type === 'dimension') {
                break;
            }
            dimensionGroup = dimensionGroup.parent;
        }
        
        if (dimensionGroup && dimensionGroup.userData && dimensionGroup.userData.type === 'dimension') {
            // Positionner le panneau près du curseur
            if (this.dimensionUI) {
                const rect = this.app.renderer.domElement.getBoundingClientRect();
                const x = event.clientX - rect.left + 20; // Décalage de 20px à droite du curseur
                const y = event.clientY - rect.top;
                
                // S'assurer que le panneau reste dans la fenêtre
                const maxX = rect.width - 300; // Largeur approximative du panneau
                const maxY = rect.height - 400; // Hauteur approximative du panneau
                
                this.dimensionUI.style.position = 'absolute';
                this.dimensionUI.style.left = Math.min(x, maxX) + 'px';
                this.dimensionUI.style.top = Math.min(y, maxY) + 'px';
            }
            
            this.editDimension(dimensionGroup);
            return true;
        }
        return false;
    }

    // Méthode pour mettre en surbrillance une cotation
    highlightDimension(dimensionGroup, highlight) {
        dimensionGroup.traverse((child) => {
            if (child.material) {
                if (highlight) {
                    child.userData.originalOpacity = child.material.opacity || 1;
                    child.material.opacity = 0.7;
                    child.material.emissive = new THREE.Color(0x00ff00);
                    child.material.emissiveIntensity = 0.3;
                } else {
                    child.material.opacity = child.userData.originalOpacity || 1;
                    if (child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                }
                child.material.needsUpdate = true;
            }
        });
    }

    // Appliquer les changements à la cotation sélectionnée
    applyChangesToSelectedDimension() {
        if (!this.selectedDimensionGroup) return;
        
        // Récupérer les nouvelles valeurs
        const newTextSize = parseFloat(document.getElementById('dimension-font-size').value) || 3;
        const newArrowSize = parseFloat(document.getElementById('dimension-arrow-size').value) || 2;
        const newColor = parseInt(document.getElementById('dimension-color').value.replace('#', '0x'), 16);
        
        // Sauvegarder les nouvelles valeurs dans userData
        this.selectedDimensionGroup.userData.textSize = newTextSize;
        this.selectedDimensionGroup.userData.arrowSize = newArrowSize;
        this.selectedDimensionGroup.userData.color = newColor;
        
        // Appliquer temporairement les nouvelles valeurs
        const savedTextSize = this.baseTextSize;
        const savedArrowSize = this.baseArrowSize;
        const savedColor = this.dimensionColor;
        
        this.baseTextSize = newTextSize / this.dimensionScale;
        this.baseArrowSize = newArrowSize / this.dimensionScale;
        this.dimensionColor = newColor;
        
        // Recréer la cotation avec les nouvelles valeurs
        this.recreateDimensionWithNewScale(this.selectedDimensionGroup);
        
        // Restaurer les valeurs originales
        this.baseTextSize = savedTextSize;
        this.baseArrowSize = savedArrowSize;
        this.dimensionColor = savedColor;
        
        // Terminer l'édition
        this.finishDimensionEdit();
        
        document.getElementById('command-output').textContent = 'Cotation modifiée avec succès';
    }

    // Annuler l'édition
    cancelDimensionEdit() {
        if (this.selectedDimensionGroup) {
            this.highlightDimension(this.selectedDimensionGroup, false);
        }
        this.finishDimensionEdit();
        document.getElementById('command-output').textContent = 'Modification annulée';
    }

    // Terminer l'édition
    finishDimensionEdit() {
        this.selectedDimensionGroup = null;
        
        // Masquer les contrôles d'édition
        const editControls = document.getElementById('dimension-edit-controls');
        if (editControls) {
            editControls.style.display = 'none';
        }
        
        // Réactiver le sélecteur de type
        document.getElementById('dimension-type').disabled = false;
        
        // Restaurer les valeurs par défaut dans l'UI
        document.getElementById('dimension-font-size').value = this.textSize;
        document.getElementById('dimension-arrow-size').value = this.arrowSize;
        document.getElementById('dimension-color').value = '#0000ff';
    }

    // Ajoutez une méthode pour recréer la cotation avec les nouvelles propriétés
    recreateDimensionWithNewProperties(dimensionGroup) {
        // Supprimer tous les enfants (lignes, flèches, texte)
        while (dimensionGroup.children.length > 0) {
            const child = dimensionGroup.children.pop();
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
        // Récupérer les données
        const data = dimensionGroup.userData;
        // Appliquer les propriétés personnalisées si présentes
        const oldTextSize = this.baseTextSize;
        const oldArrowSize = this.baseArrowSize;
        const oldColor = this.dimensionColor;
        const oldFontStyle = this.fontStyle;

        if (data.textSize) this.baseTextSize = data.textSize / (data.scale || this.dimensionScale);
        if (data.arrowSize) this.baseArrowSize = data.arrowSize / (data.scale || this.dimensionScale);
        if (data.color) this.dimensionColor = data.color;
        if (data.fontStyle) this.fontStyle = data.fontStyle;

        // Recréer selon le type
        switch (data.dimensionType) {
            case 'linear':
            case 'aligned':
                if (data.points && data.points.length === 3) {
                    const [p1, p2, p3] = data.points;
                    let distance;
                    if (data.dimensionType === 'linear') {
                        const dx = Math.abs(p2.x - p1.x);
                        const dy = Math.abs(p2.y - p1.y);
                        const offsetDir = p3.clone().sub(p1).normalize();
                        if (Math.abs(offsetDir.x) > Math.abs(offsetDir.y)) {
                            distance = dx;
                            this.createHorizontalDimension(dimensionGroup, p1, p2, p3, distance);
                        } else {
                            distance = dy;
                            this.createVerticalDimension(dimensionGroup, p1, p2, p3, distance);
                        }
                    } else {
                        distance = p1.distanceTo(p2);
                        this.createAlignedDimension(dimensionGroup, p1, p2, p3, distance);
                    }
                }
                break;
            case 'angular':
                if (data.points && data.points.length === 4) {
                    this.createAngularDimension.call({ ...this, points: data.points, createdDimensions: [], app: this.app, dimensionColor: this.dimensionColor, textSize: this.baseTextSize * (data.scale || this.dimensionScale), arrowSize: this.baseArrowSize * (data.scale || this.dimensionScale), fontStyle: this.fontStyle }, dimensionGroup);
                }
                break;
            case 'radius':
                if (data.targetObject && data.points && data.points.length >= 2) {
                    this.selectedObject = data.targetObject;
                    this.points = data.points;
                    this.createRadiusDimension.call(this, dimensionGroup);
                }
                break;
            case 'diameter':
                if (data.targetObject && data.points && data.points.length >= 2) {
                    this.selectedObject = data.targetObject;
                    this.points = data.points;
                    this.createDiameterDimension.call(this, dimensionGroup);
                }
                break;
        }

        // Restaurer les valeurs par défaut
        this.baseTextSize = oldTextSize;
        this.baseArrowSize = oldArrowSize;
        this.dimensionColor = oldColor;
        this.fontStyle = oldFontStyle;
    }
}
