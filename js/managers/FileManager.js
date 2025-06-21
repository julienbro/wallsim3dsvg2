import * as THREE from 'three';

export class FileManager {
    constructor(app) {
        this.app = app;
        this.projectData = null;
    }
    
    newProject() {
        if (confirm('Créer un nouveau projet ? Les modifications non sauvegardées seront perdues.')) {
            this.app.objects.forEach(obj => this.app.scene.remove(obj));
            this.app.objects = [];
            this.app.selectedObject = null;
            this.app.transformControls.detach();
            this.app.history = [];
            this.app.historyIndex = -1;
            this.app.uiManager.updateHistoryPanel();
            this.app.uiManager.updatePropertiesPanel(null);
        }
    }
    
    saveProject() {
        const projectData = {
            objects: this.app.objects.map(obj => ({
                type: obj.geometry.type,
                position: obj.position.toArray(),
                rotation: obj.rotation.toArray(),
                scale: obj.scale.toArray(),
                color: obj.material.color ? obj.material.color.getHex() : 0xffffff
            })),
            camera: {
                position: this.app.camera.position.toArray(),
                rotation: this.app.camera.rotation.toArray()
            }
        };
        
        const dataStr = JSON.stringify(projectData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', 'project.wcad');
        link.click();
        
        document.getElementById('command-output').textContent = 'Projet sauvegardé';
    }
    
    exportProject() {
        const exportData = {
            format: 'WebCAD Export',
            version: '1.0',
            objects: []
        };
        
        this.app.objects.forEach(obj => {
            if (obj.geometry && obj.geometry.attributes) {
                exportData.objects.push({
                    type: obj.geometry.type,
                    position: obj.position.toArray(),
                    rotation: obj.rotation.toArray(),
                    scale: obj.scale.toArray(),
                    vertices: obj.geometry.attributes.position ? 
                        Array.from(obj.geometry.attributes.position.array) : []
                });
            }
        });
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', 'export.json');
        link.click();
        
        document.getElementById('command-output').textContent = 'Projet exporté';
    }

    async importColladaFile() {
        // Créer un input file element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.dae,.xml';
        input.style.display = 'none';

        return new Promise((resolve, reject) => {
            input.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) {
                    reject(new Error('Aucun fichier sélectionné'));
                    return;
                }

                try {
                    document.getElementById('command-output').textContent = 'Chargement du fichier COLLADA...';
                    
                    // Charger le loader COLLADA dynamiquement
                    const { ColladaLoader } = await import('three/addons/loaders/ColladaLoader.js');
                    
                    const loader = new ColladaLoader();
                    
                    // Convertir le fichier en URL pour le loader
                    const fileUrl = URL.createObjectURL(file);
                    
                    loader.load(fileUrl, (collada) => {
                        try {
                            this.processColladaScene(collada);
                            URL.revokeObjectURL(fileUrl); // Nettoyer l'URL temporaire
                            document.getElementById('command-output').textContent = `Fichier COLLADA "${file.name}" importé avec succès`;
                            resolve(collada);
                        } catch (error) {
                            console.error('Erreur lors du traitement du fichier COLLADA:', error);
                            document.getElementById('command-output').textContent = 'Erreur lors du traitement du fichier COLLADA';
                            reject(error);
                        }
                    }, 
                    (progress) => {
                        // Progression du chargement
                        const percent = (progress.loaded / progress.total * 100).toFixed(1);
                        document.getElementById('command-output').textContent = `Chargement: ${percent}%`;
                    },
                    (error) => {
                        console.error('Erreur lors du chargement du fichier COLLADA:', error);
                        document.getElementById('command-output').textContent = 'Erreur lors du chargement du fichier COLLADA';
                        URL.revokeObjectURL(fileUrl);
                        reject(error);
                    });
                } catch (error) {
                    console.error('Erreur lors de l\'initialisation du loader COLLADA:', error);
                    document.getElementById('command-output').textContent = 'Erreur: Loader COLLADA non disponible';
                    reject(error);
                }
            };

            input.onerror = () => {
                reject(new Error('Erreur lors de la sélection du fichier'));
            };

            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
        });
    }

    processColladaScene(collada) {
        const scene = collada.scene;
        
        if (!scene) {
            console.error('COLLADA scene data is empty or invalid.');
            document.getElementById('command-output').textContent = 'Erreur: Données COLLADA invalides.';
            return;
        }

        console.log('Traitement de la scène COLLADA:', scene);

        // Réinitialiser les transformations pour éviter toute rotation ou échelle appliquée par le loader
        scene.rotation.set(0, 0, 0);
        scene.scale.set(1, 1, 1);

        // Placer l'objet importé à l'origine (0, 0, 0)
        scene.position.set(0, 0, 0);

        console.log('Objet importé placé à l\'origine:', scene.position);

        // Ajuster l'échelle pour que le modèle soit visible
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        if (maxDimension > 0) {
            const desiredSize = 50; // Taille souhaitée pour la plus grande dimension
            const scale = desiredSize / maxDimension;
            scene.scale.set(scale, scale, scale);
            console.log(`Modèle mis à l\'échelle par: ${scale.toFixed(2)} (Dimension max originale: ${maxDimension.toFixed(2)})`);
        } else {
            console.warn('Les dimensions du modèle sont nulles ou invalides. Il pourrait être invisible.');
        }

        this.forceVisibleMaterials(scene);
        
        this.app.scene.add(scene);
        
        if (typeof this.app.addObject === 'function') {
             this.app.addObject(scene);
        } else if (this.app.objects && Array.isArray(this.app.objects)) {
             this.app.objects.push(scene);
        } else {
            console.error("Impossible d'ajouter la scène importée au système de suivi des objets de l'application lors du traitement normal.");
        }

        this.app.selectObject(scene); 
    }

    forceVisibleMaterials(object) {
        // Remove magenta material override for GLB imports.
        object.traverse((child) => {
            if (child.isMesh) {
                // Geometry fixes (normals, vertex colors, edges)
                if (child.geometry) {
                    if (child.geometry.attributes.color) {
                        child.geometry.deleteAttribute('color');
                    }
                    if (!child.geometry.attributes.normal) {
                        child.geometry.computeVertexNormals();
                    } else {
                        child.geometry.computeVertexNormals();
                    }
                    // Add black outline/edges for visibility
                    const edges = new THREE.EdgesGeometry(child.geometry, 30);
                    const line = new THREE.LineSegments(
                        edges,
                        new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
                    );
                    line.renderOrder = 1;
                    child.add(line);
                }
                // DO NOT replace child.material! Keep original GLB material/texture
                child.visible = true;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }

    async exportViewToPDF() {
        console.log('Export PDF complet lancé');
        const totalPages = 7; 

        let originalCamera, originalControlsTarget, originalShadowsEnabled;
        let objectsOriginalShadowState = new Map();
        let axisIndicatorNode, axisDisplayBackup = null; 
        let hiddenAxesHelpersList = []; 

        try {
            if (typeof window.jspdf === 'undefined') {
                await this.loadJsPDF();
            }
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            const projectName = document.getElementById('project-name')?.value || 'Vue Actuelle';
            const projectDesigner = document.getElementById('project-designer')?.value || '';

            const logoUrl = "./logo/logofondnoir.png";
            const logoImg = await new Promise((resolve, reject) => {
                const img = new window.Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = logoUrl;
            });
            const logoCanvas = document.createElement('canvas');
            // Augmenter la résolution du canvas pour le logo pour une meilleure qualité dans le PDF
            // L'image originale est 855x97. Utilisons une largeur proche de cela.
            const logoTargetWidth = 800; // Augmenté de 100
            const logoTargetHeight = logoTargetWidth * (logoImg.height / logoImg.width);
            logoCanvas.width = logoTargetWidth;
            logoCanvas.height = logoTargetHeight;
            logoCanvas.getContext('2d').drawImage(logoImg, 0, 0, logoTargetWidth, logoTargetHeight);
            const logoDataUrl = logoCanvas.toDataURL('image/png');
            
            const logoAspectRatio = logoImg.height / logoImg.width; 

            originalCamera = this.app.camera.clone();
            originalControlsTarget = this.app.controls.target.clone();
            originalShadowsEnabled = this.app.renderer.shadowMap.enabled;
            
            this.app.scene.traverse(obj => {
                if (obj.isMesh || (obj.isLight && obj.type !== 'AmbientLight')) {
                    objectsOriginalShadowState.set(obj.uuid, { castShadow: obj.castShadow, receiveShadow: obj.receiveShadow });
                }
            });

            axisIndicatorNode = document.querySelector('.axis-indicator');
            if (axisIndicatorNode) {
                axisDisplayBackup = axisIndicatorNode.style.display;
                axisIndicatorNode.style.display = 'none'; 
            }
            
            // Masquer les AxesHelper, indicateurs d'axe et les lignes d'axe principales (rouge, vert, bleu)
            const axisColors = [0xff0000, 0x00ff00, 0x0000ff]; // Rouge, Vert, Bleu
            hiddenAxesHelpersList = []; // Réinitialiser pour être sûr

            this.app.scene.traverse(obj => {
                let shouldHide = false;
                if (obj.type === 'AxesHelper' || obj.name === 'AxesHelper' || obj.userData?.isAxisIndicator) {
                    shouldHide = true;
                } else if (obj.isLine && obj.name && (obj.name.toLowerCase().includes('axis') || obj.name.toLowerCase().includes('axes'))) {
                    shouldHide = true;
                } else if (obj.isLine && 
                           obj.material instanceof THREE.LineBasicMaterial &&
                           obj.geometry?.attributes?.position?.count === 2 && // Lignes définies par 2 points
                           axisColors.includes(obj.material.color.getHex()) &&
                           obj.material.linewidth === 2 && // Spécifique aux axes de createExtendedAxes
                           obj.material.opacity === 0.8 && // Spécifique aux axes de createExtendedAxes
                           obj.material.transparent === true) { // Spécifique aux axes de createExtendedAxes
                     shouldHide = true;
                }

                if (shouldHide && obj.visible) {
                    hiddenAxesHelpersList.push({ obj, visible: obj.visible });
                    obj.visible = false;
                }
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            const headerHeight = 15;
            const footerHeight = 15;
            const titleHeight = 10;
            const imgY_common = margin + headerHeight;
            
            let center = new THREE.Vector3(0, 0, 0);
            let modelBox = new THREE.Box3();
            if (this.app.objects && this.app.objects.length > 0) {
                this.app.objects.forEach(obj => { if(obj.visible && obj.geometry) modelBox.expandByObject(obj); });
                if (!modelBox.isEmpty()) {
                    center = modelBox.getCenter(new THREE.Vector3());
                } else {
                     modelBox.setFromCenterAndSize(new THREE.Vector3(0,0,0), new THREE.Vector3(100,100,100));
                     center = modelBox.getCenter(new THREE.Vector3());
                }
            } else {
                 modelBox.setFromCenterAndSize(new THREE.Vector3(0,0,0), new THREE.Vector3(100,100,100));
                 center = modelBox.getCenter(new THREE.Vector3());
            }
            const modelSize = modelBox.getSize(new THREE.Vector3());
            const baseFrustumSize = Math.max(modelSize.x, modelSize.y, modelSize.z, 10);
            const dynamicFrustumSize = baseFrustumSize * 1.2; 
            const viewDistance = baseFrustumSize * 3 > 500 ? baseFrustumSize * 3 : 500;

            // --- PAGE 1 : Vue actuelle (perspective ou isométrique) ---
            this.app.camera = originalCamera; 
            this.app.controls.target.copy(originalControlsTarget);
            this.app.renderer.shadowMap.enabled = originalShadowsEnabled; 
            objectsOriginalShadowState.forEach((state, uuid) => {
                const obj = this.app.scene.getObjectByProperty('uuid', uuid);
                if (obj) {
                    obj.castShadow = state.castShadow;
                    obj.receiveShadow = state.receiveShadow;
                }
            });

            // Ne pas ajouter de ligne de sol pour la vue perspective
            // const perspectiveGroundLine = this._createPdfGroundLine('x');
            // this.app.scene.add(perspectiveGroundLine);

            if (this.app.render) this.app.render();
            await new Promise(resolve => setTimeout(resolve, 150));
            const perspectiveCanvas = await this.captureView();

            // this.app.scene.remove(perspectiveGroundLine);
            // if (perspectiveGroundLine.geometry) perspectiveGroundLine.geometry.dispose();
            // if (perspectiveGroundLine.material) perspectiveGroundLine.material.dispose();
            
            const perspectiveImgData = perspectiveCanvas.toDataURL('image/png');
            
            pdf.setFontSize(18);
            pdf.setFont(undefined, 'bold');
            pdf.text(projectName, pageWidth / 2, margin, { align: 'center' });
            if (projectDesigner) {
                pdf.setFontSize(12);
                pdf.setFont(undefined, 'normal');
                pdf.text(`Dessinateur: ${projectDesigner}`, margin, margin);
            }
            const availableWidth = pageWidth - 2 * margin;
            const availableHeight = pageHeight - margin - headerHeight - titleHeight - footerHeight - margin;
            let pImgWidth, pImgHeight;
            if ((perspectiveCanvas.width / perspectiveCanvas.height) >= (availableWidth / availableHeight)) {
                pImgWidth = availableWidth;
                pImgHeight = (perspectiveCanvas.height / perspectiveCanvas.width) * pImgWidth;
            } else {
                pImgHeight = availableHeight;
                pImgWidth = (perspectiveCanvas.width / perspectiveCanvas.height) * pImgHeight;
            }
            const pImgX = (pageWidth - pImgWidth) / 2;
            pdf.addImage(perspectiveImgData, 'PNG', pImgX, imgY_common, pImgWidth, pImgHeight);
            const title1Y = imgY_common + pImgHeight + titleHeight;
            pdf.setFontSize(14); pdf.setFont(undefined, 'bold');
            pdf.text("Perspective 3D", pageWidth / 2, title1Y, { align: 'center' });
            const title1Width = pdf.getTextWidth("Perspective 3D");
            pdf.setLineWidth(0.7);
            pdf.line(pageWidth / 2 - title1Width / 2, title1Y + 1.5, pageWidth / 2 + title1Width / 2, title1Y + 1.5);
            
            const logoWidthOnPage1 = 60; 
            const logoHeightOnPage1 = logoWidthOnPage1 * logoAspectRatio;
            // Aligner le bas du logo avec la ligne de base du numéro de page
            const logoYPositionPage1 = pageHeight - (margin / 2) - logoHeightOnPage1;
            pdf.addImage(logoDataUrl, 'PNG', margin, logoYPositionPage1, logoWidthOnPage1, logoHeightOnPage1);
            pdf.setFontSize(10); pdf.setFont(undefined, 'normal');
            pdf.text(`Page 1 sur ${totalPages}`, pageWidth - margin, pageHeight - (margin / 2), { align: 'right' });

            this.app.renderer.shadowMap.enabled = false;
            this.app.scene.traverse(obj => {
                if ((obj.isMesh || obj.isLight) && obj.type !== 'AmbientLight') {
                    obj.castShadow = false;
                    obj.receiveShadow = false;
                }
            });

            const commonPageConfig = {
                projectName, projectDesigner, logoDataUrl, logoAspectRatio, 
                center, viewDistance, frustumSize: dynamicFrustumSize,
                pageWidth, pageHeight, margin, headerHeight, footerHeight, titleHeight, imgY_common, totalPages
                // groundLineAxis et sceneDimensionForScale seront définis ci-dessous pour chaque appel
            };

            const cameraSetups = {
                top: (camera, center, distance) => {
                    camera.position.set(center.x, center.y, center.z + distance);
                    camera.up.set(0, 1, 0); camera.lookAt(center);
                },
                front: (camera, center, distance) => { 
                    camera.position.set(center.x, center.y - distance, center.z);
                    camera.up.set(0, 0, 1); camera.lookAt(center);
                },
                back: (camera, center, distance) => { 
                    camera.position.set(center.x, center.y + distance, center.z);
                    camera.up.set(0, 0, 1); camera.lookAt(center);
                },
                left: (camera, center, distance) => { 
                    camera.position.set(center.x - distance, center.y, center.z);
                    camera.up.set(0, 0, 1); camera.lookAt(center);
                },
                right: (camera, center, distance) => { 
                    camera.position.set(center.x + distance, center.y, center.z);
                    camera.up.set(0, 0, 1); camera.lookAt(center);
                }
            };

            // Passer la dimension appropriée pour le calcul de l'échelle
            await this.addOrthographicViewPage(pdf, { ...commonPageConfig, title: "Vue du Dessus (X/Y)", cameraSetupFunc: cameraSetups.top, pageNum: 2, groundLineAxis: 'x', sceneDimensionForScale: modelSize.x });
            await this.addOrthographicViewPage(pdf, { ...commonPageConfig, title: "Vue de Face", cameraSetupFunc: cameraSetups.front, pageNum: 3, groundLineAxis: 'x', sceneDimensionForScale: modelSize.x });
            await this.addOrthographicViewPage(pdf, { ...commonPageConfig, title: "Vue Arrière", cameraSetupFunc: cameraSetups.back, pageNum: 4, groundLineAxis: 'x', sceneDimensionForScale: modelSize.x });
            await this.addOrthographicViewPage(pdf, { ...commonPageConfig, title: "Vue de Gauche", cameraSetupFunc: cameraSetups.left, pageNum: 5, groundLineAxis: 'y', sceneDimensionForScale: modelSize.y });
            await this.addOrthographicViewPage(pdf, { ...commonPageConfig, title: "Vue de Droite", cameraSetupFunc: cameraSetups.right, pageNum: 6, groundLineAxis: 'y', sceneDimensionForScale: modelSize.y });

            // --- PAGE 7 : Données du projet ---
            pdf.addPage();
            pdf.setFontSize(18); pdf.setFont(undefined, 'bold');
            pdf.text(projectName, pageWidth / 2, margin, { align: 'center' });
             if (projectDesigner) {
                pdf.setFontSize(12); pdf.setFont(undefined, 'normal');
                pdf.text(`Dessinateur: ${projectDesigner}`, margin, margin);
            }
            pdf.setFontSize(20); pdf.setFont(undefined, 'bold');
            pdf.text('Données du Projet', pageWidth / 2, margin + 15, { align: 'center' });

            const projectClient = document.getElementById('project-client')?.value || 'néant';
            const projectAddress = document.getElementById('project-address')?.value || 'néant';
            const projectDescription = document.getElementById('project-description')?.value || 'néant';
            const projectProcedure = document.getElementById('project-procedure')?.value || 'néant';
            const projectNotes = document.getElementById('project-notes')?.value || 'néant';

            let yPos = margin + 30;
            const dataLineHeight = 7;
            const dataFieldSpacing = 4;
            const dataTextWidth = pageWidth - 2 * margin;
            const col1X = margin;
            const col2X = pageWidth / 2 + 5;
            const colWidth = (pageWidth - 2 * margin - 10) / 2;

            const addDataField = (label, value, x, customWidth, isFullWidth = false) => {
                if (yPos > pageHeight - footerHeight - margin - (dataLineHeight * 2)) { 
                    pdf.addPage(); 
                    yPos = margin + 15; 
                    pdf.setFontSize(18);
                    pdf.setFont(undefined, 'bold');
                    pdf.text(projectName, pageWidth / 2, margin, { align: 'center' });
                    if (projectDesigner) {
                        pdf.setFontSize(12);
                        pdf.setFont(undefined, 'normal');
                        pdf.text(`Dessinateur: ${projectDesigner}`, margin, margin);
                    }
                }

                pdf.setFontSize(12); 
                pdf.setFont(undefined, 'bold');
                pdf.text(label, x, yPos);
                yPos += dataLineHeight;
                pdf.setFontSize(10); 
                pdf.setFont(undefined, 'normal');
                const lines = pdf.splitTextToSize(value, customWidth);
                lines.forEach(line => {
                    if (yPos > pageHeight - footerHeight - margin) {
                         pdf.addPage(); 
                         yPos = margin + 15;
                         pdf.setFontSize(18);
                         pdf.setFont(undefined, 'bold');
                         pdf.text(projectName, pageWidth / 2, margin, { align: 'center' });
                         if (projectDesigner) {
                             pdf.setFontSize(12);
                             pdf.setFont(undefined, 'normal');
                             pdf.text(`Dessinateur: ${projectDesigner}`, margin, margin);
                         }
                    }
                    pdf.text(line, x, yPos);
                    yPos += dataLineHeight * 0.8;
                });
                if (!isFullWidth) {
                    yPos -= (lines.length * dataLineHeight * 0.8) + dataLineHeight; 
                } else {
                    yPos += dataFieldSpacing; 
                }
                return yPos;
            };
            
            let yPosCol1 = margin + 30;
            let yPosCol2 = margin + 30;

            yPosCol1 = addDataField('Client:', projectClient, col1X, colWidth) + dataLineHeight + dataFieldSpacing;

            yPosCol2 = addDataField('Adresse du chantier:', projectAddress, col2X, colWidth) + dataLineHeight + dataFieldSpacing;
            
            yPos = Math.max(yPosCol1, yPosCol2); 

            yPos = addDataField('Description:', projectDescription, col1X, dataTextWidth, true);
            yPos = addDataField('Mode opératoire:', projectProcedure, col1X, dataTextWidth, true);
            yPos = addDataField('Notes:', projectNotes, col1X, dataTextWidth, true);

            const dataPageLogoWidth = 60; 
            const dataPageLogoHeight = dataPageLogoWidth * logoAspectRatio; 
            // Aligner le bas du logo avec la ligne de base du numéro de page
            const logoYPositionDataPage = pageHeight - (margin / 2) - dataPageLogoHeight;
            pdf.addImage(logoDataUrl, 'PNG', margin, logoYPositionDataPage, dataPageLogoWidth, dataPageLogoHeight);
            pdf.setFontSize(10); pdf.setFont(undefined, 'normal');
            pdf.text(`Page ${totalPages} sur ${totalPages}`, pageWidth - margin, pageHeight - (margin / 2), { align: 'right' });

            const fileName = `${projectName.replace(/[^a-z0-9]/gi, '_')}_complet_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
            document.getElementById('command-output').textContent = `Export PDF complet: ${fileName}`;

        } catch (error) {
            console.error('Erreur lors de l\'export PDF complet:', error);
            alert('Erreur lors de l\'export PDF complet: ' + error.message);
        } finally {
            // Restaurer l'état original de manière exhaustive
            if (this.app) {
                if (originalCamera) { 
                    this.app.camera = originalCamera; 
                    this.app.camera.updateProjectionMatrix();
                }
                if (this.app.controls && originalControlsTarget) {
                    this.app.controls.target.copy(originalControlsTarget);
                    this.app.controls.update(); 
                }
                if (this.app.renderer && typeof originalShadowsEnabled !== 'undefined') {
                    this.app.renderer.shadowMap.enabled = originalShadowsEnabled;
                }
                if (objectsOriginalShadowState.size > 0 && this.app.scene) {
                    objectsOriginalShadowState.forEach((state, uuid) => {
                        const obj = this.app.scene.getObjectByProperty('uuid', uuid);
                        if (obj) {
                            obj.castShadow = state.castShadow;
                            obj.receiveShadow = state.receiveShadow;
                        }
                    });
                }
                if (axisIndicatorNode && axisDisplayBackup !== null) {
                    axisIndicatorNode.style.display = axisDisplayBackup;
                }
                // Restaurer la visibilité des axes et helpers masqués
                if (hiddenAxesHelpersList.length > 0 && this.app.scene) {
                    hiddenAxesHelpersList.forEach(({ obj, visible }) => {
                        if (obj) obj.visible = visible;
                    });
                }
                if (this.app.render) {
                    this.app.render();
                }
                console.log('Vue initiale restaurée après export PDF.');
            }
        }
    }

    // Helper pour créer la ligne de sol pour le PDF
    _createPdfGroundLine(axis = 'x', length = 1000, linewidth = 3) {
        let points;
        if (axis === 'y') {
            points = [
                new THREE.Vector3(0, -length / 2, 0),
                new THREE.Vector3(0, length / 2, 0)
            ];
        } else { // Default to x-axis
            points = [
                new THREE.Vector3(-length / 2, 0, 0),
                new THREE.Vector3(length / 2, 0, 0)
            ];
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x000000, // Noir
            linewidth: linewidth, // Epaisseur souhaitée (peut être limitée par le driver)
            transparent: false
        });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 1; // S'assurer qu'elle est visible au-dessus du plan de travail si Z est identique
        return line;
    }

    async addOrthographicViewPage(pdf, config) {
        const {
            title,
            cameraSetupFunc,
            pageNum,
            totalPages,
            projectName,
            projectDesigner,
            logoDataUrl,
            logoAspectRatio, 
            center,
            viewDistance,
            frustumSize,
            pageWidth, pageHeight, margin, headerHeight, footerHeight, titleHeight,
            imgY_common,
            groundLineAxis,
            sceneDimensionForScale // Nouvelle propriété pour la dimension de l'échelle
        } = config;
    
        pdf.addPage();
    
        const availableWidthForCalc = pageWidth - 2 * margin;
        const availableHeightForCalc = pageHeight - margin - headerHeight - titleHeight - footerHeight - margin;
        const aspect = availableWidthForCalc / availableHeightForCalc;
    
        const orthoCamera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2, frustumSize * aspect / 2,
            frustumSize / 2, -frustumSize / 2,
            0.1, viewDistance * 2 // Adjusted far plane
        );
    
        cameraSetupFunc(orthoCamera, center, viewDistance);
    
        this.app.camera = orthoCamera;
        this.app.controls.target.copy(center);

        let groundLine = null;
        // Ne pas ajouter de ligne de sol pour la "Vue du Dessus"
        if (title !== "Vue du Dessus (X/Y)") {
            groundLine = this._createPdfGroundLine(groundLineAxis);
            this.app.scene.add(groundLine);
        }
    
        if (this.app.render) this.app.render();
        await new Promise(resolve => setTimeout(resolve, 150));
    
        const viewCanvas = await this.captureView();

        if (groundLine) {
            this.app.scene.remove(groundLine);
            if (groundLine.geometry) groundLine.geometry.dispose();
            if (groundLine.material) groundLine.material.dispose();
        }

        const viewImgData = viewCanvas.toDataURL('image/png');
    
        // Common header
        pdf.setFontSize(18);
        pdf.setFont(undefined, 'bold');
        pdf.text(projectName, pageWidth / 2, margin, { align: 'center' });
        if (projectDesigner) {
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'normal');
            pdf.text(`Dessinateur: ${projectDesigner}`, margin, margin);
        }
    
        let imgWidth, imgHeight;
        if ((viewCanvas.width / viewCanvas.height) >= (availableWidthForCalc / availableHeightForCalc)) {
            imgWidth = availableWidthForCalc;
            imgHeight = (viewCanvas.height / viewCanvas.width) * imgWidth;
        } else {
            imgHeight = availableHeightForCalc;
            imgWidth = (viewCanvas.width / viewCanvas.height) * imgHeight;
        }
        const imgX = (pageWidth - imgWidth) / 2;
    
        pdf.addImage(viewImgData, 'PNG', imgX, imgY_common, imgWidth, imgHeight);
    
        const viewTitleY = imgY_common + imgHeight + titleHeight;
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text(title, pageWidth / 2, viewTitleY, { align: 'center' });
        const viewTitleWidth = pdf.getTextWidth(title);
        pdf.setLineWidth(0.7);
        pdf.line(pageWidth / 2 - viewTitleWidth / 2, viewTitleY + 1.5, pageWidth / 2 + viewTitleWidth / 2, viewTitleY + 1.5);
    
        // Scale for relevant views
        const viewsForScale = ["vue du dessus", "vue de face", "vue arrière", "vue de gauche", "vue de droite"];
        if (viewsForScale.some(term => title.toLowerCase().includes(term))) {
            let scaleText = "1/50"; // Default scale
            // Utiliser sceneDimensionForScale passé en argument
            if (imgWidth > 0 && sceneDimensionForScale && sceneDimensionForScale > 0) {
                const effectiveScale = (sceneDimensionForScale * 10) / imgWidth; // Model units (cm) to PDF (mm)
                if (effectiveScale <= 0) { // Avoid division by zero or negative scales
                    scaleText = "N/A";
                } else if (effectiveScale <= 10) scaleText = "1/10";
                else if (effectiveScale <= 20) scaleText = "1/20";
                else if (effectiveScale <= 50) scaleText = "1/50";
                else if (effectiveScale <= 100) scaleText = "1/100";
                else scaleText = "1/200";
            } else {
                scaleText = "N/A"; // Not enough info for scale
            }
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(`Échelle: ${scaleText}`, pageWidth / 2, viewTitleY + 8, { align: 'center' });
        }
    
        // Common footer
        const logoWidth = 60; 
        const logoHeight = logoWidth * logoAspectRatio;
        // Aligner le bas du logo avec la ligne de base du numéro de page
        const logoYPosition = pageHeight - (margin / 2) - logoHeight;
        pdf.addImage(logoDataUrl, 'PNG', margin, logoYPosition, logoWidth, logoHeight);
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Page ${pageNum} sur ${totalPages}`, pageWidth - margin, pageHeight - (margin / 2), { align: 'right' });
    }

    async loadJsPDF() { // Définition de la méthode
        return new Promise((resolve, reject) => {
            if (window.jspdf) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                console.log('jsPDF chargé avec succès.');
                resolve();
            };
            script.onerror = () => {
                console.error('Erreur de chargement de jsPDF.');
                reject(new Error('Impossible de charger jsPDF'));
            };
            document.head.appendChild(script);
        });
    }

    async captureView() {
        console.log("captureView: Démarrage de la capture.");
        const renderer = this.app.renderer;
        const scene = this.app.scene;
        const camera = this.app.camera;

        if (!renderer) {
            console.error("captureView: Erreur - this.app.renderer est indéfini.");
            throw new Error("Renderer non disponible pour la capture.");
        }
        if (!scene) {
            console.error("captureView: Erreur - this.app.scene est indéfinie.");
            throw new Error("Scene non disponible pour la capture.");
        }
        if (!camera) {
            console.error("captureView: Erreur - this.app.camera est indéfinie.");
            throw new Error("Camera non disponible pour la capture.");
        }
        if (!THREE) {
            console.error("captureView: Erreur - La bibliothèque THREE n'est pas définie globalement ou importée correctement.");
            throw new Error("Bibliothèque THREE non disponible pour la capture.");
        }
        if (!(renderer.domElement instanceof HTMLCanvasElement)) {
            console.error("captureView: Erreur - renderer.domElement n'est pas un HTMLCanvasElement. Type:", typeof renderer.domElement);
            throw new Error("Le DOM element du renderer n'est pas un canvas.");
        }

        let capturedCanvas;

        try {
            const originalBackground = scene.background ? scene.background.clone() : null;
            const originalClearAlpha = renderer.getClearAlpha();
            
            scene.background = new THREE.Color(0xffffff); 
            renderer.setClearAlpha(1.0); 

            console.log("captureView: Rendu de la scène pour la capture...");
            renderer.render(scene, camera);
            console.log("captureView: Rendu pour capture terminé.");

            const mainCanvas = renderer.domElement;
            if (!mainCanvas || typeof mainCanvas.width === 'undefined' || typeof mainCanvas.height === 'undefined') {
                console.error("captureView: Erreur - mainCanvas (renderer.domElement) est invalide ou n'a pas de dimensions.");
                throw new Error("Canvas principal invalide pour la capture.");
            }
            if (mainCanvas.width === 0 || mainCanvas.height === 0) {
                console.warn(`captureView: Attention - mainCanvas a une largeur de ${mainCanvas.width} et une hauteur de ${mainCanvas.height}.`);
                // Si les dimensions sont nulles, la capture d'image sera vide ou pourrait échouer.
            }

            capturedCanvas = document.createElement('canvas');
            capturedCanvas.width = mainCanvas.width || 1; // Assurer une dimension minimale
            capturedCanvas.height = mainCanvas.height || 1; // Assurer une dimension minimale
            
            console.log(`captureView: capturedCanvas créé avec dimensions ${capturedCanvas.width}x${capturedCanvas.height}`);

            const context = capturedCanvas.getContext('2d');
            if (!context) {
                console.error("captureView: Erreur - Impossible d'obtenir le contexte 2D pour capturedCanvas.");
                throw new Error("Contexte 2D non disponible pour le canvas de capture.");
            }
            
            console.log("captureView: Dessin de mainCanvas sur capturedCanvas...");
            context.drawImage(mainCanvas, 0, 0);
            console.log("captureView: Dessin sur capturedCanvas terminé.");

            scene.background = originalBackground;
            renderer.setClearAlpha(originalClearAlpha);
            
            console.log("captureView: Restauration du rendu original de la scène...");
            renderer.render(scene, camera);
            console.log("captureView: Rendu original restauré.");

            if (!(capturedCanvas instanceof HTMLCanvasElement)) {
                 console.error("captureView: Erreur critique - capturedCanvas n'est pas un HTMLCanvasElement avant le retour. Type:", typeof capturedCanvas);
                 throw new Error("Le canvas capturé n'est pas un élément canvas valide.");
            }
            console.log("captureView: Capture terminée avec succès, retour de capturedCanvas.");
            return capturedCanvas;

        } catch (e) {
            console.error("captureView: Une erreur est survenue PENDANT la capture:", e);
            throw e; // Re-lancer l'erreur pour qu'elle soit gérée par l'appelant
        }
    }
    
    calculateModelBounds() {
        // ...existing code...
    }

    calculateScale(viewType) { 
        // ...existing code...
    }

    addPageFooter(pdf, currentPage, totalPages) {
        // ...existing code...
    }

    addDataPage(pdf, projectName, projectData, totalPages) {
        // ...existing code...
    }

    getProjectData() {
        // ...existing code...
    }
    
    async setViewForExport(viewType) {
        // ...existing code...
    }

    showSKPImportInfo() {
        // Créer un dialogue informatif pour l'importation SKP
        const existingDialog = document.querySelector('.skp-import-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.className = 'skp-import-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #007bff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 600px;
            font-family: Arial, sans-serif;
        `;
        
        dialog.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h2 style="margin: 0 0 20px 0; color: #333; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-draw-polygon" style="color: #007bff;"></i>
                    Importation de fichiers SketchUp (.skp)
                </h2>
                <p style="margin-bottom: 15px; line-height: 1.6;">
                    Les fichiers .skp sont dans un format propriétaire de SketchUp. 
                    Pour les importer dans WallSim3D, vous devez d'abord les convertir 
                    dans un format compatible.
                </p>
                
                <div style="background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 10px 0; color: #007bff; font-size: 16px;">
                        <i class="fas fa-info-circle"></i> Instructions de conversion
                    </h3>
                    <ol style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                        <li>Ouvrez votre fichier .skp dans SketchUp</li>
                        <li>Allez dans <strong>Fichier → Exporter → Modèle 3D</strong></li>
                        <li>Choisissez l'un de ces formats :
                            <ul style="margin-top: 5px;">
                                <li><strong>COLLADA (.dae)</strong> - Recommandé, conserve les textures</li>
                                <li><strong>GLTF/GLB (.gltf/.glb)</strong> - Format moderne, excellente compatibilité</li>
                                <li><strong>STL (.stl)</strong> - Géométrie uniquement, sans textures</li>
                            </ul>
                        </li>
                        <li>Cliquez sur "Exporter" et sauvegardez le fichier</li>
                        <li>Importez le fichier converti dans WallSim3D</li>
                    </ol>
                </div>

                <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #2e7d32;">
                        <i class="fas fa-lightbulb"></i> <strong>Astuce :</strong> 
                        Pour de meilleurs résultats, utilisez le format COLLADA (.dae) qui 
                        préserve les matériaux et les textures de votre modèle SketchUp.
                    </p>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="skp-import-collada" style="
                    background: #28a745; color: white; border: none; 
                    padding: 12px 24px; border-radius: 4px;
                    cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-file-import"></i> Importer un fichier COLLADA
                </button>
                <button id="skp-import-gltf" style="
                    background: #17a2b8; color: white; border: none; 
                    padding: 12px 24px; border-radius: 4px;
                    cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-cube"></i> Importer un fichier GLTF/GLB
                </button>
                <button id="skp-cancel" style="
                    background: #6c757d; color: white; border: none; 
                    padding: 12px 24px; border-radius: 4px;
                    cursor: pointer; font-size: 14px;">
                    Fermer
                </button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Gestionnaires d'événements
        document.getElementById('skp-import-collada').addEventListener('click', () => {
            document.body.removeChild(dialog);
            this.importColladaFile();
        });
        
        document.getElementById('skp-import-gltf').addEventListener('click', () => {
            document.body.removeChild(dialog);
            this.importGLBFile();
        });
        
        document.getElementById('skp-cancel').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
    }

    processSTLGeometry(geometry, filename) {
        if (!geometry) {
            console.error('STL geometry data is empty or invalid.');
            document.getElementById('command-output').textContent = 'Erreur: Données STL invalides.';
            return;
        }

        console.log('Traitement de la géométrie STL:', geometry);

        // Pas de rotation appliquée à la géométrie
        console.log('Géométrie STL importée sans rotation');

        // Créer un matériau par défaut pour le STL
        const material = new THREE.MeshPhongMaterial({
            color: 0x999999, // Gris par défaut
            side: THREE.DoubleSide,
            flatShading: true // Pour mieux voir les facettes STL
        });

        // Créer un mesh avec la géométrie
        const mesh = new THREE.Mesh(geometry, material);
        
        // Pas de rotation appliquée (0 degrés sur tous les axes)
        mesh.rotation.x = 0;
        mesh.rotation.y = 0;
        mesh.rotation.z = 0;
        
        // Placer l'objet à l'origine
        mesh.position.set(0, 0, 0);

        console.log('Mesh STL créé sans rotation');

        // Calculer les limites
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        if (maxDimension > 0) {
            const desiredSize = 50; // Taille souhaitée pour la plus grande dimension
            const scale = desiredSize / maxDimension;
            mesh.scale.set(scale, scale, scale);
            console.log(`Modèle STL mis à l'échelle par: ${scale.toFixed(2)} (Dimension max: ${maxDimension.toFixed(2)})`);
        } else {
            console.warn('Les dimensions du modèle STL sont nulles ou invalides.');
        }

        // Forcer la mise à jour de la matrice
        mesh.updateMatrix();
        mesh.updateMatrixWorld(true);

        // Activer les ombres
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Marquer comme objet importé
        mesh.userData.isImported = true;
        mesh.userData.importType = 'STL';
        mesh.userData.filename = filename;
        mesh.name = filename.replace('.stl', '').replace('.STL', '');
        
        // Ajouter à la scène
        this.app.scene.add(mesh);
        
        if (typeof this.app.addObject === 'function') {
            this.app.addObject(mesh);
        } else if (this.app.objects && Array.isArray(this.app.objects)) {
            this.app.objects.push(mesh);
        } else {
            console.error("Impossible d'ajouter le mesh STL au système de suivi des objets de l'application.");
        }

        this.app.selectObject(mesh);
        
        // Forcer le rendu après l'import
        if (this.app.render) {
            this.app.render();
        }
    }

    /**
     * Nouvelle fonction d'importation de fichier GLB (Three.js GLTFLoader)
     */
    async importGLBFile() {
        // Créer un input file element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.glb,model/gltf-binary';
        input.style.display = 'none';

        return new Promise((resolve, reject) => {
            input.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) {
                    reject(new Error('Aucun fichier sélectionné'));
                    return;
                }
                try {
                    document.getElementById('command-output').textContent = 'Chargement du fichier GLB...';
                    // Charger le loader GLTF dynamiquement
                    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
                    const loader = new GLTFLoader();
                    const fileUrl = URL.createObjectURL(file);
                    loader.load(fileUrl, (gltf) => {
                        try {
                            this.processGLBScene(gltf, file.name);
                            URL.revokeObjectURL(fileUrl);
                            document.getElementById('command-output').textContent = `Fichier GLB "${file.name}" importé avec succès`;
                            resolve(gltf);
                        } catch (error) {
                            console.error('Erreur lors du traitement du fichier GLB:', error);
                            document.getElementById('command-output').textContent = 'Erreur lors du traitement du fichier GLB';
                            reject(error);
                        }
                    },
                    (progress) => {
                        // Progression du chargement
                        if (progress.lengthComputable) {
                            const percent = (progress.loaded / progress.total * 100).toFixed(1);
                            document.getElementById('command-output').textContent = `Chargement: ${percent}%`;
                        }
                    },
                    (error) => {
                        console.error('Erreur lors du chargement du fichier GLB:', error);
                        document.getElementById('command-output').textContent = 'Erreur lors du chargement du fichier GLB';
                        URL.revokeObjectURL(fileUrl);
                        reject(error);
                    });
                } catch (error) {
                    console.error('Erreur lors de l\'initialisation du loader GLTF:', error);
                    document.getElementById('command-output').textContent = 'Erreur: Loader GLTF non disponible';
                    reject(error);
                }
            };
            input.onerror = () => {
                reject(new Error('Erreur lors de la sélection du fichier'));
            };
            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
        });
    }

    /**
     * Traite la scène GLB importée et l'ajoute à la scène Three.js
     */
    processGLBScene(gltf, fileName) {
        const scene = gltf.scene;
        if (!scene) {
            console.error('GLB scene data is empty or invalid.');
            document.getElementById('command-output').textContent = 'Erreur: Données GLB invalides.';
            return;
        }
        console.log('Traitement de la scène GLB:', scene);
        // Appliquer une rotation de -270° sur l'axe X
        scene.rotation.set(-3 * Math.PI / 2, 0, 0);
        scene.scale.set(1, 1, 1);
        scene.position.set(0, 0, 0);
        // Ne pas appliquer de mise à l'échelle automatique, garder l'échelle d'origine du modèle GLB
        // const box = new THREE.Box3().setFromObject(scene);
        // const size = box.getSize(new THREE.Vector3());
        // const maxDimension = Math.max(size.x, size.y, size.z);
        // if (maxDimension > 0) {
        //     const desiredSize = 50;
        //     const scale = desiredSize / maxDimension;
        //     scene.scale.multiplyScalar(scale);
        //     console.log(`Modèle mis à l'échelle par: ${scale.toFixed(2)} (Dimension max originale: ${maxDimension.toFixed(2)})`);
        // }
        // Forcer les matériaux pour la visibilité
        this.forceVisibleMaterials(scene);
        this.app.scene.add(scene);
        // Trouver le premier mesh avec géométrie pour la sélection
        let selectableMesh = null;
        scene.traverse((child) => {
            if (child.isMesh && child.geometry) {
                if (!selectableMesh) selectableMesh = child;
            }
        });
        if (typeof this.app.addObject === 'function') {
            this.app.addObject(scene);
        } else if (this.app.objects && Array.isArray(this.app.objects)) {
            this.app.objects.push(scene);
        }
        if (selectableMesh) {
            this.app.selectObject(selectableMesh);
        } else {
            console.warn('Aucun mesh sélectionnable trouvé dans la scène importée');
        }
    }
}
