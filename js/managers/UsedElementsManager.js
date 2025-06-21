// Initialize trackedConstructionElements at the very beginning of the script
if (typeof window.trackedConstructionElements === 'undefined') {
    window.trackedConstructionElements = [];
}

// Gestion de l'affichage des éléments utilisés
window.updateUsedElementsDisplay = async function() {
    const callOrigin = window.DEBUG_CALL_ORIGIN || 'Unknown';    const container = document.getElementById('used-elements-list-display');
    if (!container) {
        return;
    }    const originalTrackedCount = window.trackedConstructionElements.length;
    window.trackedConstructionElements = window.trackedConstructionElements.filter(element => {
        if (!element || !element.name) {
            return false;
        }
        // Garder tous les éléments valides
        return true;
    });

    const groupedElements = {};
    window.trackedConstructionElements.forEach(element => {
        if (!element || !element.name) {
            return;
        }
        
        // Create a more specific key that includes dimensions to differentiate cut lengths
        // For bricks and other elements with different cut lengths, this ensures they are grouped separately
        const dimsKey = element.dims ? `${element.dims.x.toFixed(1)}x${element.dims.y.toFixed(1)}x${element.dims.z.toFixed(1)}` : 'no-dims';
        const key = `${element.name}_${element.category || 'autres'}_${dimsKey}`;
        
        if (!groupedElements[key]) {
            groupedElements[key] = {
                name: element.name,
                category: element.category || 'autres',
                dims: element.dims,
                count: 0,
                elements: [] 
            };
        }        groupedElements[key].count++;
        groupedElements[key].elements.push(element);
    });

    const byCategory = {};
    Object.values(groupedElements).forEach(group => {
        if (!group.category) {
            group.category = 'autres';
        }
        if (!byCategory[group.category]) {
            byCategory[group.category] = [];
        }
        byCategory[group.category].push(group);
    });
    // Helper functions for color manipulation
    function darkenColor(hex, percent) {
        hex = hex.replace(/^#/, '');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        r = Math.max(0, Math.floor(r * (1 - percent / 100)));
        g = Math.max(0, Math.floor(g * (1 - percent / 100)));
        b = Math.max(0, Math.floor(b * (1 - percent / 100)));
        return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
    }

    function lightenColor(hex, percent) {
        hex = hex.replace(/^#/, '');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        r = Math.min(255, Math.floor(r * (1 + percent / 100)));
        g = Math.min(255, Math.floor(g * (1 + percent / 100)));
        b = Math.min(255, Math.floor(b * (1 + percent / 100)));
        return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
    }

    // Helper function to render CSS Cube fallback
    function renderCSSCube(previewContainer, groupDataForDims, elementDataForColor) {
        previewContainer.innerHTML = ''; // Clear previous content

        if (!groupDataForDims.dims ||
            typeof groupDataForDims.dims.x !== 'number' ||
            typeof groupDataForDims.dims.y !== 'number' ||
            typeof groupDataForDims.dims.z !== 'number') {
            console.warn(`[UsedElementsManager renderCSSCube] Group for ${elementDataForColor.name} missing valid dims, cannot render CSS cube:`, groupDataForDims.dims);
            previewContainer.innerHTML = '<div style="width:100%; height:100%; background:#444; display:flex; align-items:center; justify-content:center; color:#888; font-size:10px; text-align:center;">Preview N/A (dims)</div>';
            return;
        }

        const mainColor = elementDataForColor.color || '#cccccc';
        const actualDimX = groupDataForDims.dims.x; // Length
        const actualDimY = groupDataForDims.dims.y; // Depth
        const actualDimZ = groupDataForDims.dims.z; // Height

        const previewBoxMaxSide = 48; // Max size for the CSS cube visual
        let scaledCubeWidth = 0, scaledCubeHeight = 0, scaledCubeDepth = 0;
        const maxActualDim = Math.max(actualDimX, actualDimY, actualDimZ);

        if (maxActualDim > 0) {
            const scalingFactor = previewBoxMaxSide / maxActualDim;
            scaledCubeWidth = actualDimX * scalingFactor;
            scaledCubeHeight = actualDimZ * scalingFactor; // Visual height
            scaledCubeDepth = actualDimY * scalingFactor;  // Visual depth
        } else {
            scaledCubeWidth = 2; scaledCubeHeight = 2; scaledCubeDepth = 2;
        }
        
        const minPreviewSize = 2;
        scaledCubeWidth = Math.max(scaledCubeWidth, minPreviewSize);
        scaledCubeHeight = Math.max(scaledCubeHeight, minPreviewSize);
        scaledCubeDepth = Math.max(scaledCubeDepth, minPreviewSize);

        const faceColor = lightenColor(mainColor, 15);
        const topColor = lightenColor(mainColor, 30);
        const sideColor = darkenColor(mainColor, 15);

        previewContainer.innerHTML = `
            <div class="element-3d-wrapper" style="width: ${previewBoxMaxSide + 2}px; height: ${previewBoxMaxSide + 2}px;">
                <div class="element-3d-cube" style="--cube-width: ${scaledCubeWidth}px; --cube-height: ${scaledCubeHeight}px; --cube-depth: ${scaledCubeDepth}px; --main-bg: ${mainColor}; --face-bg: ${faceColor}; --top-bg: ${topColor}; --side-bg: ${sideColor};">
                    <div class="cube-face front"></div>
                    <div class="cube-face back"></div>
                    <div class="cube-face right"></div>
                    <div class="cube-face left"></div>
                    <div class="cube-face top"></div>
                    <div class="cube-face bottom"></div>
                </div>
            </div>
        `;
    }    // Générer le HTML structure
    let html = '';
    if (Object.keys(byCategory).length === 0) {
        html = '<div class="no-elements" style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 12px;">Aucun élément utilisé dans le modèle</div>';
    } else {Object.entries(byCategory).forEach(([category, groups]) => {
            html += `<div class="used-category-header">${category.charAt(0).toUpperCase() + category.slice(1)}</div>`;
            groups.forEach(group => {
                // Use group.elements[0] for representative data if available, otherwise group itself for dims
                const representativeElementForDisplay = group.elements && group.elements.length > 0 ? group.elements[0] : group;
                const dimText = (group.dims && typeof group.dims.x === 'number' && typeof group.dims.y === 'number' && typeof group.dims.z === 'number') 
                                ? `${group.dims.x.toFixed(1)}×${group.dims.y.toFixed(1)}×${group.dims.z.toFixed(1)} cm`
                                : 'Dims N/A';
                
                // Create dimensions key for data attribute
                const dimsKey = group.dims ? `${group.dims.x.toFixed(1)}x${group.dims.y.toFixed(1)}x${group.dims.z.toFixed(1)}` : 'no-dims';                html += `
                    <div class="used-element-item" data-element-name="${group.name}" data-element-category="${group.category}" data-element-dims="${dimsKey}" title="${group.name} - ${dimText}">
                        <div class="element-info">
                            <div class="element-name-preview">${group.name}</div>
                            <div class="element-dimensions-preview">${dimText}</div>
                        </div>
                        ${group.count > 1 ? `<div class="element-count-badge">${group.count}</div>` : ''}
                    </div>
                `;
            });
        });    }
      container.innerHTML = html;    // Ajouter les gestionnaires de clic directement
    container.querySelectorAll('.used-element-item').forEach(item => {        item.addEventListener('click', async () => {
            const elementName = item.getAttribute('data-element-name');
            const elementCategory = item.getAttribute('data-element-category');
            const elementDims = item.getAttribute('data-element-dims');

            // Use the same key format as in grouping logic
            const key = `${elementName}_${elementCategory}_${elementDims}`;
            if (groupedElements && groupedElements[key] && groupedElements[key].elements && groupedElements[key].elements.length > 0) {
                const usedElement = groupedElements[key].elements[0];
                
                // Récupérer l'élément d'origine depuis la bibliothèque pour avoir la bonne orientation
                let originalElement = null;
                if (window.app && window.app.uiManager && window.app.uiManager.elementsData) {
                    const categoryData = window.app.uiManager.elementsData[elementCategory];
                    if (categoryData) {
                        originalElement = categoryData.find(el => el.name === elementName);
                    }
                }
                
                // Si on trouve l'élément d'origine, l'utiliser comme base
                let elementToReinsert;
                if (originalElement) {
                    // Partir de l'élément d'origine de la bibliothèque
                    elementToReinsert = { ...originalElement };
                    
                    // Appliquer les modifications spécifiques de l'élément utilisé (coupe, etc.)
                    if (usedElement.cut) {
                        elementToReinsert.cut = usedElement.cut;
                    }
                    if (usedElement.customCut) {
                        elementToReinsert.customCut = usedElement.customCut;
                    }
                    if (usedElement.dims && usedElement.dims !== originalElement.dims) {
                        // Si les dimensions ont été modifiées (par coupe), les appliquer
                        elementToReinsert.dims = { ...usedElement.dims };
                    }
                    
                    console.log(`[UsedElementsManager] Réinsertion avec élément d'origine:`, {
                        original: originalElement.name,
                        modified: elementToReinsert
                    });
                } else {
                    // Fallback : utiliser l'élément stocké tel quel
                    elementToReinsert = { ...usedElement };
                    console.warn(`[UsedElementsManager] Élément d'origine non trouvé pour ${elementName}, utilisation de l'élément stocké`);
                }

                if (window.app && window.app.elementManager && typeof window.app.elementManager.addElement === 'function') {
                    try {
                        await window.app.elementManager.addElement(elementToReinsert);
                        
                        const commandOutput = document.getElementById('command-output');
                        if (commandOutput) {
                            commandOutput.textContent = `${elementName} réinséré dans la scène.`;
                        }
                    } catch (e) {
                        console.error(`Error calling addElement:`, e);
                    }
                } else {
                    console.error(`ElementManager or addElement function not available.`);
                }
            } else {
                console.warn(`Could not find element data for key: ${key}`);
            }
        });});
};

// Fonction pour nettoyer les éléments invalides (simplifiée)
window.cleanupTrackedElements = function() {
    if (typeof window.trackedConstructionElements !== 'undefined') {
        const originalCount = window.trackedConstructionElements.length;
        
        window.trackedConstructionElements = window.trackedConstructionElements.filter(element => {
            // Exclure spécifiquement "Hourdis 13+6"
            if (element && element.name === 'Hourdis 13+6') {
                return false;
            }
            
            return element && 
                   element.name && 
                   element.name.trim() !== '' &&
                   element.dims && 
                   typeof element.dims.x === 'number' && 
                   typeof element.dims.y === 'number' && 
                   typeof element.dims.z === 'number' &&
                   !isNaN(element.dims.x) && 
                   !isNaN(element.dims.y) && 
                   !isNaN(element.dims.z);
        });
        
        const cleanedCount = window.trackedConstructionElements.length;
        console.log(`Nettoyage terminé: ${originalCount - cleanedCount} éléments invalides supprimés`);
        
        // Mettre à jour l'affichage après le nettoyage
        window.updateUsedElementsDisplay();
    }
};

// Fonction spécifique pour supprimer un type d'élément
window.removeElementType = function(elementName) {
    if (typeof window.trackedConstructionElements !== 'undefined') {
        const originalCount = window.trackedConstructionElements.length;
        
        window.trackedConstructionElements = window.trackedConstructionElements.filter(element => {
            return element && element.name !== elementName;
        });
        
        const removedCount = originalCount - window.trackedConstructionElements.length;
        console.log(`${removedCount} élément(s) "${elementName}" supprimé(s)`);
        
        // Mettre à jour l'affichage
        window.updateUsedElementsDisplay();
    }
};

// Initialiser l'affichage au chargement (une seule fois)
document.addEventListener('DOMContentLoaded', () => {
    // Fonction de nettoyage unique
    function cleanHourdis() {
        const origin = 'DOMContentLoaded';
        if (window.trackedConstructionElements) {
            const before = window.trackedConstructionElements.length;
            window.trackedConstructionElements = window.trackedConstructionElements.filter(element => {
                if (!element || !element.name) return true; 
                const name = element.name.toLowerCase();
                const isHourdis = name.includes('hourdis') || name.includes('13+6');
                return !isHourdis;
            });
            const after = window.trackedConstructionElements.length;
        }
        
        if (typeof window.updateUsedElementsDisplay === 'function') {
            window.DEBUG_CALL_ORIGIN = origin; // Set flag for this call
            try {
                window.updateUsedElementsDisplay();
            } finally {
                delete window.DEBUG_CALL_ORIGIN; // Clean up flag
            }
        }
    }
    
    cleanHourdis();
});
