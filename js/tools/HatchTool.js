import * as THREE from 'three';

export class HatchTool {    constructor(app) {
        this.app = app;
        this.active = false; // Propriété pour indiquer si l'outil est actif
        this.selectedSurface = null;
        this.selectedHatch = null; // Pour les hachures existantes sélectionnées
        this.hatchPattern = 'parallel'; // parallel, cross, diagonal, dots, bricks
        this.hatchDensity = 1; // espacement en unités (plus fin par défaut)
        this.hatchAngle = 45; // angle en degrés
        this.hatchLines = [];
        this.hatchColor = '#000000'; // couleur des hachures
        this.initializeDialog();
    }initializeDialog() {
        // Initialiser les événements du dialogue HTML
        this.setupDialogEvents();
        this.updatePreviewCanvases();
    }

    setupDialogEvents() {
        // Écouter les clics sur les motifs
        document.addEventListener('click', (e) => {
            if (e.target.closest('.pattern-item')) {
                // Désélectionner tous les motifs
                document.querySelectorAll('.pattern-item').forEach(item => {
                    item.classList.remove('selected');
                });
                
                // Sélectionner le motif cliqué
                const patternItem = e.target.closest('.pattern-item');
                patternItem.classList.add('selected');
                this.hatchPattern = patternItem.dataset.pattern;
            }
        });        // Écouter les changements de contrôles
        document.addEventListener('input', (e) => {
            if (e.target.id === 'hatch-spacing') {
                this.hatchDensity = parseFloat(e.target.value);
                document.getElementById('spacing-value').textContent = this.hatchDensity.toFixed(1);
                this.updatePreviewCanvases(); // Mise à jour en temps réel
            } else if (e.target.id === 'hatch-angle') {
                this.hatchAngle = parseFloat(e.target.value);
                document.getElementById('angle-value').textContent = this.hatchAngle;
                this.updatePreviewCanvases(); // Mise à jour en temps réel
            } else if (e.target.id === 'hatch-color') {
                this.hatchColor = e.target.value;
                this.updatePreviewCanvases(); // Mise à jour en temps réel
            }
        });// Bouton d'application
        document.addEventListener('click', (e) => {
            if (e.target.id === 'apply-hatch-pattern') {
                this.applyHatch();
                this.hidePatternDialog();
                // Ne pas désactiver l'outil après application pour permettre de sélectionner d'autres hachures
                // this.deactivate(); <- Ne pas faire cela
            }
        });
    }    updatePreviewCanvases() {
        // Mettre à jour les aperçus des motifs - liste complète de tous les motifs disponibles
        const patterns = [
            // Motifs de base
            'parallel', 'cross', 'diagonal', 'dots',
            // Matériaux de construction
            'concrete', 'concrete-block', 'clay-block', 'cellular-concrete', 'brick',
            // Matériaux naturels
            'stone', 'gravel', 'sand', 'earth', 'grass',
            // Bois
            'wood-cross', 'wood-longitudinal',
            // Isolants
            'insulation-soft', 'insulation-rigid',
            // Métaux
            'steel', 'copper',
            // Couverture
            'tile-flat', 'tile-wave',
            // Autres
            'glass', 'water', 'zigzag', 'solid-black', 'solid-gray'
        ];
          patterns.forEach(pattern => {
            const canvas = document.getElementById(`preview-${pattern}`);
            if (canvas) {
                try {
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.strokeStyle = this.hatchColor || '#000';
                    ctx.fillStyle = this.hatchColor || '#000';
                    ctx.lineWidth = 1;
                    
                    const rect = { x: 5, y: 5, width: 50, height: 50 };
                    this.drawPatternPreview(ctx, rect, pattern);
                } catch (error) {
                    console.error(`Erreur lors du dessin du motif ${pattern}:`, error);
                    // Dessiner un motif par défaut en cas d'erreur
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(5, 5);
                    ctx.lineTo(55, 55);
                    ctx.moveTo(55, 5);
                    ctx.lineTo(5, 55);
                    ctx.stroke();
                }
            } else {
                console.warn(`Canvas preview-${pattern} non trouvé dans le DOM`);
            }
        });
    }    drawPatternPreview(ctx, rect, pattern) {
        // Utiliser la densité actuelle pour l'aperçu - permettre une vraie variation
        // Mapping plus dynamique : hatchDensity de 0.1 à 5.0 -> spacing de 2 à 20 pixels
        const spacing = Math.max(this.hatchDensity * 4, 2); // Variation plus visible dans l'aperçu
        const angle = this.hatchAngle; // Utiliser l'angle actuel
        
        switch(pattern) {
            case 'parallel':
                this.drawParallelPreview(ctx, rect, spacing, angle);
                break;
            case 'cross':
                this.drawCrossPreview(ctx, rect, spacing, angle);
                break;
            case 'diagonal':
                this.drawDiagonalPreview(ctx, rect, spacing, angle);
                break;            case 'dots':
                this.drawDotsPreview(ctx, rect, spacing, angle);
                break;
            case 'brick':
                this.drawBricksPreview(ctx, rect, spacing, angle);
                break;
            case 'concrete':
                this.drawConcretePreview(ctx, rect, spacing, angle);
                break;
            case 'concrete-block':
                this.drawConcreteBlockPreview(ctx, rect, spacing, angle);
                break;
            case 'clay-block':
                this.drawClayBlockPreview(ctx, rect, spacing, angle);
                break;
            case 'cellular-concrete':
                this.drawCellularConcretePreview(ctx, rect, spacing, angle);
                break;
            case 'stone':
                this.drawStonePreview(ctx, rect, spacing, angle);
                break;
            case 'gravel':
                this.drawGravelPreview(ctx, rect, spacing, angle);
                break;
            case 'sand':
                this.drawSandPreview(ctx, rect, spacing, angle);
                break;
            case 'earth':
                this.drawEarthPreview(ctx, rect, spacing, angle);
                break;
            case 'grass':
                this.drawGrassPreview(ctx, rect, spacing, angle);
                break;
            case 'wood-cross':
                this.drawWoodCrossPreview(ctx, rect, spacing, angle);
                break;
            case 'wood-longitudinal':
                this.drawWoodLongitudinalPreview(ctx, rect, spacing, angle);
                break;            case 'insulation-soft':
                this.drawInsulationSoftPreview(ctx, rect, spacing, angle);
                break;
            case 'insulation-rigid':
                this.drawInsulationRigidPreview(ctx, rect, spacing, angle);
                break;
            case 'steel':
                this.drawSteelPreview(ctx, rect, spacing, angle);
                break;
            case 'copper':
                this.drawCopperPreview(ctx, rect, spacing, angle);
                break;
            case 'tile-flat':
                this.drawTileFlatPreview(ctx, rect, spacing, angle);
                break;
            case 'tile-wave':
                this.drawTileWavePreview(ctx, rect, spacing, angle);
                break;
            case 'glass':
                this.drawGlassPreview(ctx, rect, spacing, angle);
                break;            case 'water':
                this.drawWaterPreview(ctx, rect, spacing, angle);
                break;
            case 'zigzag':
                this.drawZigzagPreview(ctx, rect, spacing, angle);
                break;
            case 'solid-black':
                this.drawSolidPreview(ctx, rect, '#000000');
                break;
            case 'solid-gray':
                this.drawSolidPreview(ctx, rect, '#808080');
                break;            case 'solid-white':
                this.drawSolidPreview(ctx, rect, '#ffffff');
                break;
            default:
                // Motif par défaut si non implémenté
                console.warn(`Motif d'aperçu non implémenté: ${pattern}, utilisation du motif parallèle par défaut`);
                this.drawParallelPreview(ctx, rect, spacing);
                break;
        }
    }    drawParallelPreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        
        // Calculer le nombre de lignes nécessaires
        const numLines = Math.ceil(diagonal / spacing) + 1;
          // Vecteurs directionnels
        const cos = Math.cos(actualAngle);
        const sin = Math.sin(actualAngle);
        const perpX = -sin;
        const perpY = cos;
        
        // Générer les lignes parallèles avec rotation
        for (let i = -numLines; i <= numLines; i++) {
            const offset = i * spacing;
            const lineX = centerX + perpX * offset;
            const lineY = centerY + perpY * offset;
            
            // Créer une ligne suffisamment longue
            const lineLength = diagonal;
            const x1 = lineX - cos * lineLength;
            const y1 = lineY - sin * lineLength;
            const x2 = lineX + cos * lineLength;
            const y2 = lineY + sin * lineLength;
            
            // Clipper la ligne au rectangle
            const clipped = this.clipLineToRect(x1, y1, x2, y2, rect);
            if (clipped) {
                ctx.beginPath();
                ctx.moveTo(clipped.x1, clipped.y1);
                ctx.lineTo(clipped.x2, clipped.y2);
                ctx.stroke();
            }
        }
    }    drawCrossPreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        
        // Dessiner les lignes parallèles dans une direction
        this.drawParallelPreview(ctx, rect, spacing, angle);
        
        // Dessiner les lignes perpendiculaires (angle + 90°)
        const perpAngle = (angle !== null ? angle : this.hatchAngle) + 90;
        this.drawParallelPreview(ctx, rect, spacing, perpAngle);
    }    drawDiagonalPreview(ctx, rect, spacing, angle = null) {
        // Utiliser l'angle fourni ou l'angle par défaut (45°) + angle de rotation
        const baseAngle = 45; // Angle de base pour les diagonales
        const rotationAngle = angle !== null ? angle : this.hatchAngle;
        
        // Première série de diagonales
        const angle1 = (baseAngle + rotationAngle) * Math.PI / 180;
        this.drawParallelPreview(ctx, rect, spacing, baseAngle + rotationAngle);
        
        // Deuxième série de diagonales (perpendiculaires)
        const angle2 = (-baseAngle + rotationAngle) * Math.PI / 180;
        this.drawParallelPreview(ctx, rect, spacing, -baseAngle + rotationAngle);
    }    drawDotsPreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        
        // Agrandir le rectangle pour compenser la rotation
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2; // Marge de sécurité
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };
        
        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        
        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);
        
        // Utiliser le rectangle agrandi pour le motif
        for (let x = expandedRect.x + spacing/2; x < expandedRect.x + expandedRect.width; x += spacing) {
            for (let y = expandedRect.y + spacing/2; y < expandedRect.y + expandedRect.height; y += spacing) {
                ctx.beginPath();
                ctx.arc(x, y, Math.max(1, spacing * 0.1), 0, 2 * Math.PI);
                ctx.fill();
            }
        }
        
        ctx.restore();
    }

    // Fonction de clipping pour Canvas (preview)
    clipLineCanvas(ctx, x1, y1, x2, y2, rect) {
        const INSIDE = 0; // 0000
        const LEFT = 1;   // 0001
        const RIGHT = 2;  // 0010
        const BOTTOM = 4; // 0100
        const TOP = 8;    // 1000

        const computeOutCode = (x, y) => {
            let code = INSIDE;
            if (x < rect.x) code |= LEFT;
            else if (x > rect.x + rect.width) code |= RIGHT;
            if (y < rect.y) code |= BOTTOM;
            else if (y > rect.y + rect.height) code |= TOP;
            return code;
        };

        let outcode1 = computeOutCode(x1, y1);
        let outcode2 = computeOutCode(x2, y2);
        let accept = false;

        while (true) {
            if (!(outcode1 | outcode2)) {
                accept = true;
                break;
            } else if (outcode1 & outcode2) {
                break;
            } else {
                let x, y;
                const outcodeOut = outcode1 ? outcode1 : outcode2;

                if (outcodeOut & TOP) {
                    x = x1 + (x2 - x1) * (rect.y + rect.height - y1) / (y2 - y1);
                    y = rect.y + rect.height;
                } else if (outcodeOut & BOTTOM) {
                    x = x1 + (x2 - x1) * (rect.y - y1) / (y2 - y1);
                    y = rect.y;
                } else if (outcodeOut & RIGHT) {
                    y = y1 + (y2 - y1) * (rect.x + rect.width - x1) / (x2 - x1);
                    x = rect.x + rect.width;
                } else if (outcodeOut & LEFT) {
                    y = y1 + (y2 - y1) * (rect.x - x1) / (x2 - x1);
                    x = rect.x;
                }

                if (outcodeOut === outcode1) {
                    x1 = x;
                    y1 = y;
                    outcode1 = computeOutCode(x1, y1);
                } else {
                    x2 = x;
                    y2 = y;
                    outcode2 = computeOutCode(x2, y2);
                }
            }
        }

        if (accept) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();        }    }    drawBricksPreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const brickHeight = Math.max(spacing, 4);
        const brickWidth = brickHeight * 2;
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        
        // Agrandir le rectangle pour compenser la rotation
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };
        
        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        
        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);
        
        let offsetX = 0;
        for (let y = expandedRect.y; y <= expandedRect.y + expandedRect.height + brickHeight; y += brickHeight) {
            // Ligne horizontale
            ctx.beginPath();
            ctx.moveTo(expandedRect.x, y);
            ctx.lineTo(expandedRect.x + expandedRect.width, y);
            ctx.stroke();
            
            // Lignes verticales pour cette rangée
            for (let x = expandedRect.x + offsetX; x <= expandedRect.x + expandedRect.width + brickWidth; x += brickWidth) {
                if (y > expandedRect.y) {
                    ctx.beginPath();
                    ctx.moveTo(x, y - brickHeight);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }
            }
            // Alterner le décalage pour créer le motif de briques en quinconce
            offsetX = offsetX === 0 ? brickWidth / 2 : 0;
        }
        
        ctx.restore();    }drawConcretePreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const density = Math.max(spacing * 0.5, 3);
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        
        // Agrandir le rectangle pour compenser la rotation
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };
        
        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        
        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);
        
        // Créer un motif de béton avec des points aléatoires selon la densité
        const numPoints = Math.floor((expandedRect.width * expandedRect.height) / (density * density));
          for (let i = 0; i < numPoints; i++) {
            const x = expandedRect.x + Math.random() * expandedRect.width;
            const y = expandedRect.y + Math.random() * expandedRect.height;
            const radius = Math.random() * density * 0.3 + 1;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.stroke();
        }
        
        ctx.restore();
    }drawConcreteBlockPreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;

        // Calculer la taille du rectangle étendu
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };
        
        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();

        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);
        
        // Calculer la taille des blocs basée sur spacing
        const blockHeight = Math.max(spacing * 0.8, 4);
        const blockWidth = blockHeight * 2; // Ratio largeur/hauteur ~ 2:1 pour les blocs béton
        
        let rowIndex = 0;
        for (let y = expandedRect.y; y < expandedRect.y + expandedRect.height; y += blockHeight) {
            // Décalage en quinconce : une ligne sur deux est décalée de la moitié de la largeur d'un bloc
            const offset = (rowIndex % 2 === 0) ? 0 : blockWidth / 2;
              for (let x = expandedRect.x - offset; x < expandedRect.x + expandedRect.width + blockWidth; x += blockWidth) {
                // Dessiner chaque bloc de béton
                ctx.strokeRect(x, y, blockWidth, blockHeight);
                
                // Divisions internes du bloc (alveoles) - seulement si assez large
                if (blockWidth > 15) {
                    const div1X = x + blockWidth/3;
                    const div2X = x + 2*blockWidth/3;
                    
                    ctx.beginPath();
                    ctx.moveTo(div1X, y);
                    ctx.lineTo(div1X, y + blockHeight);
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.moveTo(div2X, y);
                    ctx.lineTo(div2X, y + blockHeight);
                    ctx.stroke();
                  }
            }
            rowIndex++;
        }
        
        ctx.restore();
    }drawClayBlockPreview(ctx, rect, spacing, angle = null) {
        const blockHeight = Math.max(spacing * 0.6, 4);
        const blockWidth = blockHeight * 2.5; // Ratio largeur/hauteur pour les briques terre cuite
        
        for (let y = rect.y; y < rect.y + rect.height; y += blockHeight) {
            const offset = ((y - rect.y) / blockHeight) % 2 === 0 ? 0 : blockWidth / 2;
            
            for (let x = rect.x - offset; x < rect.x + rect.width; x += blockWidth) {
                ctx.strokeRect(x, y, blockWidth, blockHeight);
                // Texture terre cuite adaptée à la taille
                const numTextures = Math.max(1, Math.floor(blockWidth * blockHeight / 40));
                for (let i = 0; i < numTextures; i++) {
                    const px = x + Math.random() * blockWidth;
                    const py = y + Math.random() * blockHeight;
                    ctx.fillRect(px, py, 1, 1);
                }
            }
        }
    }    drawCellularConcretePreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const cellSpacing = Math.max(spacing * 0.3, 2);
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        
        // Calculer la taille du rectangle étendu basé sur la diagonale
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };
        
        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        
        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);
        
        // Lignes horizontales avec des bulles dans la zone étendue
        for (let y = expandedRect.y; y <= expandedRect.y + expandedRect.height; y += cellSpacing) {
            ctx.beginPath();
            ctx.moveTo(expandedRect.x, y);
            ctx.lineTo(expandedRect.x + expandedRect.width, y);
            ctx.stroke();
        }
        
        // Ajouter des cercles pour représenter les bulles d'air
        const numBubbles = Math.floor((expandedRect.width * expandedRect.height) / (cellSpacing * cellSpacing * 4));
        for (let i = 0; i < numBubbles; i++) {
            const x = expandedRect.x + Math.random() * expandedRect.width;
            const y = expandedRect.y + Math.random() * expandedRect.height;
            const radius = Math.random() * 2 + 1;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.stroke();
        }
        
        ctx.restore();
    }    drawStonePreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        
        // Calculer la taille du rectangle étendu
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };
        
        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        
        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);
        
        // Polygones irréguliers pour représenter les pierres
        const numStones = Math.max(3, Math.floor((expandedRect.width * expandedRect.height) / (spacing * spacing * 10)));
        for (let i = 0; i < numStones; i++) {
            const stoneX = expandedRect.x + Math.random() * expandedRect.width;
            const stoneY = expandedRect.y + Math.random() * expandedRect.height;
            const size = Math.random() * spacing + spacing/2;
            
            ctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const stoneAngle = (j / 6) * 2 * Math.PI;
                const radius = size + Math.random() * 3 - 1.5;
                const x = stoneX + Math.cos(stoneAngle) * radius;
                const y = stoneY + Math.sin(stoneAngle) * radius;
                
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
        
        ctx.restore();
    }    drawGravelPreview(ctx, rect, spacing, angle = null) {
        // Petits cercles et ellipses pour représenter les graviers
        const numGravels = Math.max(5, Math.floor(100 / spacing));
        for (let i = 0; i < numGravels; i++) {
            const x = rect.x + Math.random() * rect.width;
            const y = rect.y + Math.random() * rect.height;
            const radius = Math.random() * 2 + 1;
            
            ctx.beginPath();
            ctx.ellipse(x, y, radius, radius * 0.7, Math.random() * Math.PI, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }    drawSandPreview(ctx, rect, spacing, angle = null) {
        // Points fins pour représenter le sable
        const numSandGrains = Math.max(20, Math.floor(200 / spacing));
        for (let i = 0; i < numSandGrains; i++) {
            const x = rect.x + Math.random() * rect.width;
            const y = rect.y + Math.random() * rect.height;
            ctx.fillRect(x, y, 0.5, 0.5);
        }
    }    drawEarthPreview(ctx, rect, spacing, angle = null) {
        // Motif organique avec des courbes
        const earthSpacing = Math.max(spacing * 0.4, 3);
        
        for (let y = rect.y; y < rect.y + rect.height; y += earthSpacing) {
            ctx.beginPath();
            let first = true;
            for (let x = rect.x; x <= rect.x + rect.width; x += 2) {
                const noise = Math.sin(x * 0.1) * 2 + Math.random() - 0.5;
                const yPos = y + noise;
                
                if (first) {
                    ctx.moveTo(x, yPos);
                    first = false;
                } else {
                    ctx.lineTo(x, yPos);
                }
            }
            ctx.stroke();
        }
        
        // Ajouter quelques petites mottes
        for (let i = 0; i < 5; i++) {
            const x = rect.x + Math.random() * rect.width;
            const y = rect.y + Math.random() * rect.height;
            ctx.fillRect(x, y, 2, 1);
        }
    }    drawGrassPreview(ctx, rect, spacing, angle = null) {
        // Brins d'herbe verticaux
        const numGrassBlades = Math.max(5, Math.floor(80 / spacing));
        for (let i = 0; i < numGrassBlades; i++) {
            const x = rect.x + Math.random() * rect.width;
            const y = rect.y + rect.height;
            const height = Math.random() * 15 + 5;
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            // Brin d'herbe légèrement courbé
            ctx.quadraticCurveTo(
                x + Math.random() * 2 - 1, 
                y - height/2, 
                x + Math.random() * 3 - 1.5, 
                y - height
            );
            ctx.stroke();
        }
    }    drawWoodCrossPreview(ctx, rect, spacing, angle = null) {
        const ringSpacing = Math.max(spacing * 0.5, 3);
        const rotationAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        
        // Cercles concentriques pour représenter les cernes
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        
        for (let r = ringSpacing; r < Math.min(rect.width, rect.height) / 2; r += ringSpacing) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
            ctx.stroke();
        }
        
        // Fentes radiales avec rotation
        for (let i = 0; i < 4; i++) {
            const baseAngle = (i / 4) * 2 * Math.PI;
            const finalAngle = baseAngle + rotationAngle;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);            ctx.lineTo(
                centerX + Math.cos(finalAngle) * Math.min(rect.width, rect.height) / 2,
                centerY + Math.sin(finalAngle) * Math.min(rect.width, rect.height) / 2
            );
            ctx.stroke();
        }
    }    drawWoodLongitudinalPreview(ctx, rect, spacing, angle = null) {
        const lineSpacing = Math.max(spacing * 0.3, 2);
        const rotationAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        
        // Si angle significatif, utiliser des lignes parallèles rotées
        if (Math.abs(rotationAngle) > 0.1) {
            this.drawParallelPreview(ctx, rect, lineSpacing, angle);
        } else {
            // Lignes longitudinales avec du grain (horizontal par défaut)
            for (let y = rect.y; y <= rect.y + rect.height; y += lineSpacing) {
                ctx.beginPath();
                let first = true;
                for (let x = rect.x; x <= rect.x + rect.width; x += 2) {
                    const noise = Math.sin(x * 0.2 + y * 0.1) * 0.5;
                    const yPos = y + noise;
                    
                    if (first) {
                        ctx.moveTo(x, yPos);
                        first = false;
                    } else {
                        ctx.lineTo(x, yPos);                    }
                }
                ctx.stroke();
            }
        }
    }    drawInsulationSoftPreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        
        // Calculer la taille du rectangle étendu
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };
        
        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        
        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);
        
        // Motif ondulé souple - utiliser le paramètre spacing
        const waveSpacing = Math.max(spacing * 0.5, 3);
        
        for (let y = expandedRect.y; y <= expandedRect.y + expandedRect.height; y += waveSpacing) {
            ctx.beginPath();
            let first = true;
            for (let x = expandedRect.x; x <= expandedRect.x + expandedRect.width; x += 1) {
                const wave = Math.sin(x * 0.3) * 2 + Math.sin(x * 0.1 + y) * 1;
                const yPos = y + wave;
                
                if (first) {
                    ctx.moveTo(x, yPos);
                    first = false;
                } else {
                    ctx.lineTo(x, yPos);
                }
            }
            ctx.stroke();
        }
        
        ctx.restore();
    }    drawInsulationRigidPreview(ctx, rect, spacing, angle = null) {
        // Motif de panneaux rigides
        const panelWidth = Math.max(spacing * 1.2, 8);
        const panelHeight = Math.max(spacing * 0.9, 6);
        
        for (let y = rect.y; y < rect.y + rect.height; y += panelHeight) {
            for (let x = rect.x; x < rect.x + rect.width; x += panelWidth) {
                ctx.strokeRect(x, y, panelWidth, panelHeight);
                
                // Lignes internes pour montrer la structure
                ctx.beginPath();
                ctx.moveTo(x + panelWidth/3, y);
                ctx.lineTo(x + panelWidth/3, y + panelHeight);
                ctx.moveTo(x + 2*panelWidth/3, y);
                ctx.lineTo(x + 2*panelWidth/3, y + panelHeight);
                ctx.stroke();
            }
        }
    }    drawSteelPreview(ctx, rect, spacing, angle = null) {
        // Motif acier : double trait puis espace puis double trait
        const steelSpacing = Math.max(spacing * 0.6, 4);
        
        for (let y = rect.y; y <= rect.y + rect.height; y += steelSpacing) {
            // Premier double trait
            ctx.beginPath();
            ctx.moveTo(rect.x, y);
            ctx.lineTo(rect.x + rect.width * 0.3, y);
            ctx.moveTo(rect.x, y + 1);
            ctx.lineTo(rect.x + rect.width * 0.3, y + 1);
            ctx.stroke();
            
            // Deuxième double trait après l'espace
            ctx.beginPath();
            ctx.moveTo(rect.x + rect.width * 0.7, y);
            ctx.lineTo(rect.x + rect.width, y);
            ctx.moveTo(rect.x + rect.width * 0.7, y + 1);
            ctx.lineTo(rect.x + rect.width, y + 1);
            ctx.stroke();
        }
    }    drawCopperPreview(ctx, rect, spacing, angle = null) {
        // Motif cuivre avec hachures diagonales serrées
        const copperSpacing = Math.max(spacing * 0.2, 2);
        
        // Hachures diagonales dans un sens
        for (let i = rect.x - rect.height; i <= rect.x + rect.width; i += copperSpacing) {
            ctx.beginPath();
            ctx.moveTo(i, rect.y);
            ctx.lineTo(i + rect.height, rect.y + rect.height);
            ctx.stroke();
        }
          // Hachures diagonales dans l'autre sens
        for (let i = rect.x - rect.height; i <= rect.x + rect.width; i += copperSpacing) {
            ctx.beginPath();
            ctx.moveTo(i, rect.y + rect.height);
            ctx.lineTo(i + rect.height, rect.y);
            ctx.stroke();
        }
    }    drawTileFlatPreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        
        // Calculer la taille du rectangle étendu
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };
        
        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        
        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);
        
        // Tuiles plates rectangulaires - taille adaptée au spacing
        const tileWidth = Math.max(spacing * 2, 6);
        const tileHeight = Math.max(spacing, 3);
        
        for (let y = expandedRect.y; y < expandedRect.y + expandedRect.height; y += tileHeight) {
            const offset = ((y - expandedRect.y) / tileHeight) % 2 === 0 ? 0 : tileWidth / 2;
            
            for (let x = expandedRect.x - offset; x < expandedRect.x + expandedRect.width; x += tileWidth) {
                ctx.strokeRect(x, y, tileWidth, tileHeight);
            }
        }
        
        ctx.restore();
    }    drawTileWavePreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const waveSpacing = Math.max(spacing, 4);
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;

        // Agrandir le rectangle pour compenser la rotation
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };
        
        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();

        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);

        // Dessiner les tuiles ondulées sur la zone étendue
        for (let y = expandedRect.y; y <= expandedRect.y + expandedRect.height; y += waveSpacing) {
            ctx.beginPath();
            let first = true;
            for (let x = expandedRect.x; x <= expandedRect.x + expandedRect.width; x += 2) {
                const wave = Math.sin((x - expandedRect.x) * 0.4) * 3;
                const yPos = y + wave;
                
                if (first) {
                    ctx.moveTo(x, yPos);
                    first = false;
                } else {
                    ctx.lineTo(x, yPos);
                }
            }
            ctx.stroke();
        }
        
        ctx.restore();
    }    drawGlassPreview(ctx, rect, spacing, angle = null) {
        // Lignes diagonales fines pour représenter le verre - espacement adapté
        const glassSpacing = Math.max(spacing * 2, 8);
        
        for (let i = rect.x - rect.height; i <= rect.x + rect.width; i += glassSpacing) {
            ctx.beginPath();
            ctx.moveTo(i, rect.y);
            ctx.lineTo(i + rect.height, rect.y + rect.height);
            ctx.stroke();
        }
        
        // Quelques reflets - espacement aussi adapté
        ctx.strokeStyle = '#cccccc';
        const reflectSpacing = Math.max(spacing * 4, 15);
        for (let i = rect.x + reflectSpacing; i <= rect.x + rect.width; i += reflectSpacing) {
            ctx.beginPath();
            ctx.moveTo(i, rect.y);
            ctx.lineTo(i + rect.height * 0.5, rect.y + rect.height * 0.5);
            ctx.stroke();
        }
        ctx.strokeStyle = '#000000'; // Remettre en noir
    }    drawWaterPreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const waveSpacing = Math.max(spacing, 4);
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;

        // Agrandir le rectangle pour compenser la rotation
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };

        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();

        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);

        // Dessiner les vagues d'eau sur la zone étendue
        for (let y = expandedRect.y; y <= expandedRect.y + expandedRect.height; y += waveSpacing) {
            ctx.beginPath();
            let first = true;
            for (let x = expandedRect.x; x <= expandedRect.x + expandedRect.width; x += 2) {
                const wave1 = Math.sin((x - expandedRect.x) * 0.3) * 2;
                const wave2 = Math.sin((x - expandedRect.x) * 0.1) * 4;
                const yPos = y + wave1 + wave2;
                
                if (first) {
                    ctx.moveTo(x, yPos);
                    first = false;
                } else {
                    ctx.lineTo(x, yPos);
                }
            }
            ctx.stroke();
        }

        ctx.restore();
    }    drawZigzagPreview(ctx, rect, spacing, angle = null) {
        const actualAngle = (angle !== null ? angle : this.hatchAngle) * Math.PI / 180;
        const zigzagSpacing = Math.max(spacing, 4);
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;

        // Agrandir le rectangle pour compenser la rotation
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const expandedSize = diagonal * 1.2;
        const expandedRect = {
            x: centerX - expandedSize / 2,
            y: centerY - expandedSize / 2,
            width: expandedSize,
            height: expandedSize
        };

        ctx.save();
        // Clipper à la zone d'aperçu originale
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();

        ctx.translate(centerX, centerY);
        ctx.rotate(actualAngle);
        ctx.translate(-centerX, -centerY);

        // Dessiner les motifs zigzag sur la zone étendue
        for (let y = expandedRect.y; y <= expandedRect.y + expandedRect.height; y += zigzagSpacing * 2) {
            ctx.beginPath();
            let first = true;
            for (let x = expandedRect.x; x <= expandedRect.x + expandedRect.width; x += zigzagSpacing) {
                const yOffset = (Math.floor((x - expandedRect.x) / zigzagSpacing) % 2) * zigzagSpacing;
                const yPos = y + yOffset;
                
                if (first) {
                    ctx.moveTo(x, yPos);
                    first = false;
                } else {
                    ctx.lineTo(x, yPos);
                }
            }
            ctx.stroke();
        }

        ctx.restore();
    }drawSolidPreview(ctx, rect, color) {
        // Surface pleine avec la couleur spécifiée
        ctx.fillStyle = color;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.fillStyle = '#000000'; // Remettre en noir
        
        // Bordure
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    // ========== METHODS FOR 3D HATCH GENERATION ==========

    activate() {
        console.log('HatchTool.activate() appelé');
        this.active = true;
        document.getElementById('command-output').textContent = 'Sélectionnez une surface à hachurer';
        this.app.renderer.domElement.style.cursor = 'crosshair';
    }

    deactivate() {
        console.log('HatchTool.deactivate() appelé');
        this.active = false;
        this.hidePatternDialog();
        this.app.renderer.domElement.style.cursor = 'default';
        this.selectedSurface = null;
        this.selectedHatch = null;
    }

    showPatternDialog(existingHatchData = null) {
        console.log('showPatternDialog appelé');
        const dialog = document.getElementById('hatch-pattern-dialog');
        if (dialog) {
            // Si on modifie une hachure existante, charger ses paramètres
            if (existingHatchData) {
                this.hatchPattern = existingHatchData.pattern || 'parallel';
                this.hatchDensity = existingHatchData.density || 1;
                this.hatchAngle = existingHatchData.angle || 45;
                this.hatchColor = existingHatchData.color || '#000000';
                
                // Mettre à jour l'interface
                document.getElementById('hatch-spacing').value = this.hatchDensity;
                document.getElementById('spacing-value').textContent = this.hatchDensity.toFixed(1);
                document.getElementById('hatch-angle').value = this.hatchAngle;
                document.getElementById('angle-value').textContent = this.hatchAngle;
                document.getElementById('hatch-color').value = this.hatchColor;
                
                // Sélectionner le bon motif
                document.querySelectorAll('.pattern-item').forEach(item => {
                    item.classList.remove('selected');
                    if (item.dataset.pattern === this.hatchPattern) {
                        item.classList.add('selected');
                    }
                });
            }
            
            dialog.style.display = 'block';
            this.updatePreviewCanvases();
        }
    }

    hidePatternDialog() {
        const dialog = document.getElementById('hatch-pattern-dialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    }

    onMouseDown(event) {
        if (!this.active) return false;

        console.log('HatchTool.onMouseDown appelé');
        const intersections = this.app.getIntersections(event);        
        if (intersections && intersections.length > 0) {
            // Vérifier si on clique sur une hachure existante
            let hatchObject = intersections[0].object;
            while (hatchObject && !hatchObject.userData.isHatch) {
                hatchObject = hatchObject.parent;
            }
            
            if (hatchObject && hatchObject.userData.isHatch) {
                // Modification d'une hachure existante
                this.selectedHatch = hatchObject;
                this.selectedSurface = null; // Pas de nouvelle surface
                
                const hatchData = {
                    pattern: hatchObject.userData.pattern,
                    density: hatchObject.userData.density,
                    angle: hatchObject.userData.angle,
                    color: hatchObject.userData.color
                };
                  this.showPatternDialog(hatchData);
                return true;            }
            // Vérifier si on clique sur une surface (rectangle, cercle, etc.) ou polyligne fermée
            else {
                // Rechercher la surface en remontant la hiérarchie si nécessaire
                let surfaceObject = intersections[0].object;
                while (surfaceObject && !this.isSurface(surfaceObject) && surfaceObject.parent && !(surfaceObject.parent instanceof THREE.Scene)) {
                    surfaceObject = surfaceObject.parent;
                }
                
                if (surfaceObject && this.isSurface(surfaceObject)) {
                    this.selectedSurface = surfaceObject;
                    this.selectedHatch = null;
                    this.showPatternDialog();
                    return true;
                }
            }
        }
        
        return false;
    }

    handleClick(point, event) {
        // Fallback si onMouseDown ne fonctionne pas
        return this.onMouseDown(event);
    }

    applyHatch() {
        console.log('applyHatch appelé', { selectedSurface: this.selectedSurface, selectedHatch: this.selectedHatch });
        
        // Cas 1: Modification d'une hachure existante
        if (this.selectedHatch) {
            // Supprimer les anciennes lignes de hachure
            this.selectedHatch.children.slice().forEach(child => {
                this.selectedHatch.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            
            // Régénérer les hachures avec les nouveaux paramètres
            const bounds = this.selectedHatch.userData.bounds;
            const lines = this.generateHatchLines(bounds);
            
            lines.forEach(line => {
                if (line) this.selectedHatch.add(line);
            });
            
            // Mettre à jour les métadonnées
            this.selectedHatch.userData.pattern = this.hatchPattern;
            this.selectedHatch.userData.density = this.hatchDensity;
            this.selectedHatch.userData.angle = this.hatchAngle;
            this.selectedHatch.userData.color = this.hatchColor;
            
            document.getElementById('command-output').textContent = `Hachures ${this.hatchPattern} modifiées`;
            this.selectedHatch = null;
        }
        // Cas 2: Création d'une nouvelle hachure
        else if (this.selectedSurface) {
            const bounds = this.calculateSurfaceBounds(this.selectedSurface);
            const lines = this.generateHatchLines(bounds);
            
            // Créer un groupe pour les hachures
            const hatchGroup = new THREE.Group();
            hatchGroup.userData.isHatch = true;
            hatchGroup.userData.surfaceId = this.selectedSurface.uuid;
            hatchGroup.userData.pattern = this.hatchPattern;
            hatchGroup.userData.density = this.hatchDensity;
            hatchGroup.userData.angle = this.hatchAngle;
            hatchGroup.userData.color = this.hatchColor;
            hatchGroup.userData.bounds = bounds;
            
            lines.forEach(line => {
                if (line) hatchGroup.add(line);
            });
            
            this.app.scene.add(hatchGroup);
            this.hatchLines.push(hatchGroup);
            
            // Ajouter aux éléments sélectionnables
            if (this.app.toolManager && this.app.toolManager.selectionManager) {
                this.app.toolManager.selectionManager.addSelectableObject(hatchGroup);
            }
            
            document.getElementById('command-output').textContent = `Hachures ${this.hatchPattern} appliquées`;
            this.selectedSurface = null;
        }    }    calculateSurfaceBounds(surface) {
        // Gestion spéciale pour les polylignes fermées
        if (surface.userData.type === 'polyline' && surface.userData.closed && surface.userData.points) {
            return this.calculatePolylineBounds(surface);
        }
        
        // Pour les autres surfaces (rectangles, cercles)
        const box = new THREE.Box3().setFromObject(surface);
        
        const bounds = {
            minX: box.min.x,
            maxX: box.max.x,
            minY: box.min.y,
            maxY: box.max.y,
            z: surface.position.z + 0.01  // Décalage plus visible au-dessus de la surface
        };

        // Vérifier si c'est une surface circulaire
        if (this.isCircularSurface(surface)) {
            const radius = this.getCircleRadius(surface);
            const center = surface.position;
            bounds.isCircle = true;
            bounds.center = { x: center.x, y: center.y };
            bounds.radius = radius;
        }

        console.log('calculateSurfaceBounds:', bounds);
        return bounds;
    }

    // Détection des surfaces circulaires
    isCircularSurface(surface) {
        if (surface.geometry && surface.geometry.type === 'CircleGeometry') {
            return true;
        }
        // Autres vérifications possibles selon le type de géométrie
        return false;
    }

    getCircleRadius(surface) {
        if (surface.geometry && surface.geometry.parameters) {
            return surface.geometry.parameters.radius || 1;
        }
        return 1;
    }

    isPointInCircle(x, y, center, radius) {
        const dx = x - center.x;
        const dy = y - center.y;
        return (dx * dx + dy * dy) <= (radius * radius);
    }

    clipLineToCircle(x1, y1, x2, y2, center, radius) {
        const intersections = this.getLineCircleIntersections(x1, y1, x2, y2, center, radius);
        
        if (intersections.length === 0) return null;
        if (intersections.length === 1) {
            // Une intersection - ligne tangente ou point sur le cercle
            return { x1: intersections[0].x, y1: intersections[0].y, x2: intersections[0].x, y2: intersections[0].y };
        }
        
        // Deux intersections - prendre le segment à l'intérieur du cercle
        return { 
            x1: intersections[0].x, 
            y1: intersections[0].y, 
            x2: intersections[1].x, 
            y2: intersections[1].y 
        };
    }

    getLineCircleIntersections(x1, y1, x2, y2, center, radius) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const fx = x1 - center.x;
        const fy = y1 - center.y;
        
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = (fx * fx + fy * fy) - radius * radius;
        
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) return [];
        
        const discriminantSqrt = Math.sqrt(discriminant);
        const t1 = (-b - discriminantSqrt) / (2 * a);
        const t2 = (-b + discriminantSqrt) / (2 * a);
        
        const intersections = [];
        
        if (t1 >= 0 && t1 <= 1) {
            intersections.push({
                x: x1 + t1 * dx,
                y: y1 + t1 * dy
            });
        }
        
        if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-6) {
            intersections.push({
                x: x1 + t2 * dx,
                y: y1 + t2 * dy
            });
        }
        
        return intersections;
    }

    generateHatchLines(bounds) {
        const lines = [];
        
        switch(this.hatchPattern) {
            case 'parallel':
                lines.push(...this.generateParallelLines(bounds));
                break;
            case 'cross':
                lines.push(...this.generateCrossLines(bounds));
                break;
            case 'diagonal':
                lines.push(...this.generateDiagonalLines(bounds));
                break;
            case 'dots':
                lines.push(...this.generateDots(bounds));
                break;
            case 'brick':
                lines.push(...this.generateBrickLines(bounds));
                break;
            case 'concrete':
                lines.push(...this.generateConcreteLines(bounds));
                break;
            case 'concrete-block':
                lines.push(...this.generateConcreteBlockLines(bounds));
                break;
            case 'clay-block':
                lines.push(...this.generateClayBlockLines(bounds));
                break;
            case 'cellular-concrete':
                lines.push(...this.generateCellularConcreteLines(bounds));
                break;
            case 'stone':
                lines.push(...this.generateStoneLines(bounds));
                break;
            case 'gravel':
                lines.push(...this.generateGravelLines(bounds));
                break;
            case 'sand':
                lines.push(...this.generateSandLines(bounds));
                break;
            case 'earth':
                lines.push(...this.generateEarthLines(bounds));
                break;
            case 'grass':
                lines.push(...this.generateGrassLines(bounds));
                break;
            case 'wood-cross':
                lines.push(...this.generateWoodCrossLines(bounds));
                break;
            case 'wood-longitudinal':
                lines.push(...this.generateWoodLongitudinalLines(bounds));
                break;
            case 'insulation-soft':
                lines.push(...this.generateInsulationSoftLines(bounds));
                break;
            case 'insulation-rigid':
                lines.push(...this.generateInsulationRigidLines(bounds));
                break;
            case 'steel':
                lines.push(...this.generateSteelLines(bounds));
                break;
            case 'copper':
                lines.push(...this.generateCopperLines(bounds));
                break;
            case 'tile-flat':
                lines.push(...this.generateTileFlatLines(bounds));
                break;
            case 'tile-wave':
                lines.push(...this.generateTileWaveLines(bounds));
                break;
            case 'glass':
                lines.push(...this.generateGlassLines(bounds));
                break;
            case 'water':
                lines.push(...this.generateWaterLines(bounds));
                break;
            case 'zigzag':
                lines.push(...this.generateZigzagLines(bounds));
                break;
            case 'solid-black':
            case 'solid-gray':
            case 'solid-white':
                lines.push(...this.generateSolidLines(bounds));
                break;
        }
        
        return lines;
    }

    // Fonction utilitaire pour créer une ligne avec clipping
    createClippedLine(x1, y1, x2, y2, z, bounds) {
        let clippedCoords;
        
        if (bounds.isCircle) {
            // Clipping circulaire
            if (!this.isPointInCircle(x1, y1, bounds.center, bounds.radius) && 
                !this.isPointInCircle(x2, y2, bounds.center, bounds.radius)) {
                // Vérifier si la ligne traverse le cercle
                const clipped = this.clipLineToCircle(x1, y1, x2, y2, bounds.center, bounds.radius);
                if (!clipped) return null;
                clippedCoords = clipped;
            } else {
                // Au moins un point est dans le cercle
                const clipped = this.clipLineToCircle(x1, y1, x2, y2, bounds.center, bounds.radius);
                if (!clipped) {
                    clippedCoords = { x1, y1, x2, y2 };
                } else {
                    clippedCoords = clipped;
                }
            }        } else if (bounds.isPolyline) {
            // Clipping pour polyligne fermée
            clippedCoords = this.clipLineToPolyline(x1, y1, x2, y2, bounds);
            if (!clippedCoords) return null;
        } else {
            // Clipping rectangulaire standard
            clippedCoords = this.clipLine(x1, y1, x2, y2, bounds);
            if (!clippedCoords) return null;
        }
        
        const points = [
            new THREE.Vector3(clippedCoords.x1, clippedCoords.y1, z),
            new THREE.Vector3(clippedCoords.x2, clippedCoords.y2, z)
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: this.hatchColor || '#000000',
            linewidth: 1 
        });
        
        return new THREE.Line(geometry, material);
    }

    // Fonction de clipping Cohen-Sutherland pour rectangles
    clipLine(x1, y1, x2, y2, bounds) {
        const INSIDE = 0;
        const LEFT = 1;
        const RIGHT = 2;
        const BOTTOM = 4;
        const TOP = 8;
        
        const computeOutCode = (x, y) => {
            let code = INSIDE;
            if (x < bounds.minX) code |= LEFT;
            else if (x > bounds.maxX) code |= RIGHT;
            if (y < bounds.minY) code |= BOTTOM;
            else if (y > bounds.maxY) code |= TOP;
            return code;
        };
        
        let outcode1 = computeOutCode(x1, y1);
        let outcode2 = computeOutCode(x2, y2);
        let accept = false;
        
        while (true) {
            if (!(outcode1 | outcode2)) {
                accept = true;
                break;
            } else if (outcode1 & outcode2) {
                break;
            } else {
                let x, y;
                const outcodeOut = outcode1 ? outcode1 : outcode2;
                
                if (outcodeOut & TOP) {
                    x = x1 + (x2 - x1) * (bounds.maxY - y1) / (y2 - y1);
                    y = bounds.maxY;
                } else if (outcodeOut & BOTTOM) {
                    x = x1 + (x2 - x1) * (bounds.minY - y1) / (y2 - y1);
                    y = bounds.minY;
                } else if (outcodeOut & RIGHT) {
                    y = y1 + (y2 - y1) * (bounds.maxX - x1) / (x2 - x1);
                    x = bounds.maxX;
                } else if (outcodeOut & LEFT) {
                    y = y1 + (y2 - y1) * (bounds.minX - x1) / (x2 - x1);
                    x = bounds.minX;
                }
                
                if (outcodeOut === outcode1) {
                    x1 = x;
                    y1 = y;
                    outcode1 = computeOutCode(x1, y1);
                } else {
                    x2 = x;
                    y2 = y;
                    outcode2 = computeOutCode(x2, y2);
                }
            }
        }
        
        return accept ? { x1, y1, x2, y2 } : null;
    }

    // ========== 3D PATTERN GENERATION METHODS ==========
    
    generateParallelLines(bounds) {
        const lines = [];
        const angle = this.hatchAngle * Math.PI / 180;
        const spacing = this.hatchDensity;
        
        console.log('generateParallelLines: Starting with angle=' + this.hatchAngle + '°, spacing=' + spacing);
        
        // Calculer la taille de la zone à couvrir
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        const diagonal = Math.sqrt(width * width + height * height);
        
        // Centre de la zone
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        // Vecteurs directionnels
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        // Vecteur perpendiculaire (pour l'espacement entre lignes parallèles)
        const perpX = -sin;  // perpendiculaire = rotation de 90°
        const perpY = cos;
        
        // Calculer la distance maximale du centre aux coins
        const corners = [
            { x: bounds.minX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.maxY },
            { x: bounds.minX, y: bounds.maxY }
        ];
        
        let maxDistancePerp = 0;
        corners.forEach(corner => {
            // Distance perpendiculaire du centre du rectangle au coin
            const dx = corner.x - centerX;
            const dy = corner.y - centerY;
            const distPerp = Math.abs(dx * perpX + dy * perpY);
            maxDistancePerp = Math.max(maxDistancePerp, distPerp);
        });
        
        // Nombre de lignes nécessaires pour couvrir toute la zone
        const numLines = Math.ceil(maxDistancePerp / spacing) + 1;
        
        console.log('Bounds: ' + width + 'x' + height + ', maxDistancePerp: ' + maxDistancePerp + ', numLines: ' + (numLines * 2 + 1));
        
        // Générer les lignes parallèles
        for (let i = -numLines; i <= numLines; i++) {
            // Position de la ligne parallèle (décalage perpendiculaire depuis le centre)
            const offset = i * spacing;
            const lineX = centerX + perpX * offset;
            const lineY = centerY + perpY * offset;
            
            // Créer une ligne suffisamment longue dans la direction souhaitée
            const lineLength = diagonal * 1.5; // Marge de sécurité
            const x1 = lineX - cos * lineLength;
            const y1 = lineY - sin * lineLength;
            const x2 = lineX + cos * lineLength;
            const y2 = lineY + sin * lineLength;
            
            const line = this.createClippedLine(x1, y1, x2, y2, bounds.z, bounds);
            if (line) {
                lines.push(line);
            }
        }
        
        console.log('generateParallelLines: Generated ' + lines.length + ' lines for bounds', bounds);
        return lines;
    }

    generateCrossLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity;
        
        // Lignes verticales
        for (let x = bounds.minX; x <= bounds.maxX; x += spacing) {
            const line = this.createClippedLine(x, bounds.minY, x, bounds.maxY, bounds.z, bounds);
            if (line) lines.push(line);
        }
        
        // Lignes horizontales
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            const line = this.createClippedLine(bounds.minX, y, bounds.maxX, y, bounds.z, bounds);
            if (line) lines.push(line);
        }
        
        return lines;
    }

    generateDiagonalLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity;
        const height = bounds.maxY - bounds.minY;
        
        // Diagonales descendantes
        for (let i = bounds.minX - height; i <= bounds.maxX; i += spacing) {
            const line = this.createClippedLine(i, bounds.minY, i + height, bounds.maxY, bounds.z, bounds);
            if (line) lines.push(line);
        }
        
        // Diagonales montantes
        for (let i = bounds.minX - height; i <= bounds.maxX; i += spacing) {
            const line = this.createClippedLine(i, bounds.maxY, i + height, bounds.minY, bounds.z, bounds);
            if (line) lines.push(line);
        }
        
        return lines;
    }

    generateDots(bounds) {
        const dots = [];
        const spacing = this.hatchDensity;
        
        for (let x = bounds.minX; x <= bounds.maxX; x += spacing) {
            for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
                // Pour les cercles, vérifier si le point est à l'intérieur
                if (bounds.isCircle && !this.isPointInCircle(x, y, bounds.center, bounds.radius)) {
                    continue;
                }
                
                if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
                    const geometry = new THREE.SphereGeometry(0.02, 8, 8);
                    const material = new THREE.MeshBasicMaterial({ color: this.hatchColor || '#000000' });
                    const dot = new THREE.Mesh(geometry, material);
                    dot.position.set(x, y, bounds.z);
                    dots.push(dot);
                }
            }
        }
        
        return dots;
    }

    generateBrickLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity;
        const brickHeight = spacing;
        const brickWidth = spacing * 2;
        
        let offsetX = 0;
        for (let y = bounds.minY; y <= bounds.maxY; y += brickHeight) {
            // Ligne horizontale
            const hLine = this.createClippedLine(bounds.minX, y, bounds.maxX, y, bounds.z, bounds);
            if (hLine) lines.push(hLine);
            
            // Lignes verticales pour cette rangée
            for (let x = bounds.minX + offsetX; x <= bounds.maxX; x += brickWidth) {
                if (y > bounds.minY) {
                    const vLine = this.createClippedLine(x, y - brickHeight, x, y, bounds.z, bounds);
                    if (vLine) lines.push(vLine);
                }
            }
            // Alterner le décalage pour créer le motif de briques en quinconce
            offsetX = offsetX === 0 ? brickWidth / 2 : 0;
        }
        
        return lines;
    }

    generateConcreteLines(bounds) {
        const objects = [];
        const numCircles = Math.max(10, (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / (this.hatchDensity * this.hatchDensity) * 0.1);
        
        for (let i = 0; i < numCircles; i++) {
            const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            
            // Pour les cercles, vérifier si le point est à l'intérieur
            if (bounds.isCircle && !this.isPointInCircle(x, y, bounds.center, bounds.radius)) {
                continue;
            }
            
            const radius = Math.random() * this.hatchDensity * 0.3 + 0.05;
            
            if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
                // Créer un cercle avec des segments
                const segments = 16;
                const points = [];
                for (let j = 0; j <= segments; j++) {
                    const ang = (j / segments) * Math.PI * 2;
                    points.push(new THREE.Vector3(
                        x + Math.cos(ang) * radius,
                        y + Math.sin(ang) * radius,
                        bounds.z
                    ));
                }
                
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
                const circle = new THREE.Line(geometry, material);
                objects.push(circle);
            }
        }
        
        return objects;
    }    generateConcreteBlockLines(bounds) {
        const lines = [];
        const blockHeight = this.hatchDensity * 0.6;
        const blockWidth = this.hatchDensity * 1.2;
        
        let rowIndex = 0;
        for (let y = bounds.minY; y < bounds.maxY; y += blockHeight) {
            // Décalage en quinconce : une ligne sur deux est décalée
            const offset = (rowIndex % 2 === 0) ? 0 : blockWidth / 2;
            
            for (let x = bounds.minX - offset; x < bounds.maxX + blockWidth; x += blockWidth) {
                // Bloc principal
                const blockLines = [
                    this.createClippedLine(x, y, x + blockWidth, y, bounds.z, bounds),
                    this.createClippedLine(x + blockWidth, y, x + blockWidth, y + blockHeight, bounds.z, bounds),
                    this.createClippedLine(x + blockWidth, y + blockHeight, x, y + blockHeight, bounds.z, bounds),
                    this.createClippedLine(x, y + blockHeight, x, y, bounds.z, bounds)
                ];
                
                // Séparations internes (alveoles)
                const div1 = this.createClippedLine(x + blockWidth/3, y, x + blockWidth/3, y + blockHeight, bounds.z, bounds);
                const div2 = this.createClippedLine(x + 2*blockWidth/3, y, x + 2*blockWidth/3, y + blockHeight, bounds.z, bounds);
                
                blockLines.push(div1, div2);
                blockLines.forEach(line => { if (line) lines.push(line); });
            }
            rowIndex++;
        }
        
        return lines;
    }

    generateClayBlockLines(bounds) {
               const lines = [];
        const blockHeight = this.hatchDensity * 0.4;
        const blockWidth = this.hatchDensity * 1.0;
        
        for (let y = bounds.minY; y < bounds.maxY; y += blockHeight) {
            const offset = ((y - bounds.minY) / blockHeight) % 2 === 0 ? 0 : blockWidth / 2;
            
            for (let x = bounds.minX - offset; x < bounds.maxX; x += blockWidth) {
                const blockLines = [
                    this.createClippedLine(x, y, x + blockWidth, y, bounds.z, bounds),
                    this.createClippedLine(x + blockWidth, y, x + blockWidth, y + blockHeight, bounds.z, bounds),
                    this.createClippedLine(x + blockWidth, y + blockHeight, x, y + blockHeight, bounds.z, bounds),
                    this.createClippedLine(x, y + blockHeight, x, y, bounds.z, bounds)
                ];
                
                blockLines.forEach(line => { if (line) lines.push(line); });
                
                // Ajouter quelques points pour la texture
                for (let i = 0; i < 3; i++) {
                    const px = x + Math.random() * blockWidth;
                    const py = y + Math.random() * blockHeight;
                    
                    if (bounds.isCircle && !this.isPointInCircle(px, py, bounds.center, bounds.radius)) {
                        continue;
                    }
                    
                    const geometry = new THREE.SphereGeometry(0.01, 4, 4);
                    const material = new THREE.MeshBasicMaterial({ color: this.hatchColor || '#000000' });
                    const dot = new THREE.Mesh(geometry, material);
                    dot.position.set(px, py, bounds.z);
                    lines.push(dot);
                }
            }
        }
        
        return lines;
    }

    generateCellularConcreteLines(bounds) {
        const objects = [];
        const spacing = this.hatchDensity * 0.8;
        
        // Lignes horizontales de base
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            const line = this.createClippedLine(bounds.minX, y, bounds.maxX, y, bounds.z, bounds);
            if (line) objects.push(line);
        }
        
        // Bulles d'air (cercles)
        const numBubbles = Math.floor((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / (spacing * spacing) * 0.3);
        
        for (let i = 0; i < numBubbles; i++) {
            const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            
            if (bounds.isCircle && !this.isPointInCircle(x, y, bounds.center, bounds.radius)) {
                continue;
            }
            
            const radius = Math.random() * spacing * 0.2 + 0.02;
            
            const segments = 12;
            const points = [];
            for (let j = 0; j <= segments; j++) {
                const ang = (j / segments) * Math.PI * 2;
                points.push(new THREE.Vector3(
                    x + Math.cos(ang) * radius,
                    y + Math.sin(ang) * radius,
                    bounds.z
                ));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
            const bubble = new THREE.Line(geometry, material);
            objects.push(bubble);
        }
        
        return objects;
    }

    generateStoneLines(bounds) {
        const lines = [];
        const stoneSize = this.hatchDensity * 1.5;
        
        for (let y = bounds.minY; y < bounds.maxY; y += stoneSize * 0.7) {
            const rowOffset = Math.random() * stoneSize * 0.3;
            
            for (let x = bounds.minX + rowOffset; x < bounds.maxX; x += stoneSize) {
                const width = stoneSize * (0.7 + Math.random() * 0.6);
                const height = stoneSize * (0.5 + Math.random() * 0.5);
                
                // Pierre irrégulière
                const points = [];
                const numPoints = 6 + Math.floor(Math.random() * 4);
                
                for (let i = 0; i <= numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2;
                    const radius = (width + height) / 4 * (0.8 + Math.random() * 0.4);
                    const px = x + Math.cos(angle) * radius + width/2;
                    const py = y + Math.sin(angle) * radius + height/2;
                    points.push(new THREE.Vector3(px, py, bounds.z));
                }
                
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
                const stone = new THREE.Line(geometry, material);
                lines.push(stone);
            }
        }
        
        return lines;
    }

    generateGravelLines(bounds) {
        const dots = [];
        const density = this.hatchDensity * 0.5;
        const numGrains = Math.floor((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / (density * density));
        
        for (let i = 0; i < numGrains; i++) {
            const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            
            if (bounds.isCircle && !this.isPointInCircle(x, y, bounds.center, bounds.radius)) {
                continue;
            }
            
            const size = Math.random() * density * 0.3 + 0.01;
            
            // Petit polygone irrégulier pour représenter un grain de gravier
            const points = [];
            const numSides = 3 + Math.floor(Math.random() * 4);
            for (let j = 0; j <= numSides; j++) {
                const angle = (j / numSides) * Math.PI * 2;
                const radius = size * (0.7 + Math.random() * 0.6);
                points.push(new THREE.Vector3(
                    x + Math.cos(angle) * radius,
                    y + Math.sin(angle) * radius,
                    bounds.z
                ));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
            const grain = new THREE.Line(geometry, material);
            dots.push(grain);
        }
        
        return dots;
    }

    generateSandLines(bounds) {
        const dots = [];
        const density = this.hatchDensity * 0.3;
        const numGrains = Math.floor((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / (density * density) * 2);
        
        for (let i = 0; i < numGrains; i++) {
            const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            
            if (bounds.isCircle && !this.isPointInCircle(x, y, bounds.center, bounds.radius)) {
                continue;
            }
            
            const size = Math.random() * 0.015 + 0.005;
            
            const geometry = new THREE.SphereGeometry(size, 6, 6);
            const material = new THREE.MeshBasicMaterial({ color: this.hatchColor || '#000000' });
            const grain = new THREE.Mesh(geometry, material);
            grain.position.set(x, y, bounds.z);
            dots.push(grain);
        }
        
        return dots;
    }

    generateEarthLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity * 0.8;
        
        for (let y = bounds.minY; y < bounds.maxY; y += spacing) {
            const points = [];
            const numSegments = Math.floor((bounds.maxX - bounds.minX) / 0.1) + 1;
            
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                const x = bounds.minX + t * (bounds.maxX - bounds.minX);
                const noise = Math.sin(x * 0.5) * spacing * 0.2 + (Math.random() - 0.5) * spacing * 0.1;
                const yPos = y + noise;
                
                if (bounds.isCircle) {
                    if (this.isPointInCircle(x, yPos, bounds.center, bounds.radius)) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                } else {
                    if (x >= bounds.minX && x <= bounds.maxX && yPos >= bounds.minY && yPos <= bounds.maxY) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                }
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
                const line = new THREE.Line(geometry, material);
                lines.push(line);
            }
        }
        
        // Ajouter quelques mottes de terre
        const numClumps = Math.floor((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / (spacing * spacing) * 0.1);
        for (let i = 0; i < numClumps; i++) {
            const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            
            if (bounds.isCircle && !this.isPointInCircle(x, y, bounds.center, bounds.radius)) {
                continue;
            }
            
            
            const size = Math.random() * spacing * 0.2 + 0.02;
            const geometry = new THREE.SphereGeometry(size, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: this.hatchColor || '#000000' });
            const clump = new THREE.Mesh(geometry, material);
            clump.position.set(x, y, bounds.z);
            lines.push(clump);
        }
        
        return lines;
    }

    generateGrassLines(bounds) {
        const lines = [];
        const density = this.hatchDensity * 0.6;
        const numBlades = Math.floor((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / (density * density));
        
        for (let i = 0; i < numBlades; i++) {
            const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            
            if (bounds.isCircle && !this.isPointInCircle(x, y, bounds.center, bounds.radius)) {
                continue;
            }
            
            const height = Math.random() * density * 0.8 + density * 0.2;
            const curve = (Math.random() - 0.5) * density * 0.3;
            
            // Brin d'herbe courbé
            const points = [
                new THREE.Vector3(x, y, bounds.z),
                new THREE.Vector3(x + curve * 0.5, y + height * 0.5, bounds.z),
                new THREE.Vector3(x + curve, y + height, bounds.z)
            ];
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
            const blade = new THREE.Line(geometry, material);
            lines.push(blade);
        }
        
        return lines;
    }

    generateWoodCrossLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity;
        
        // Cercles concentriques pour les cernes
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const maxRadius = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2;
        
        for (let r = spacing; r < maxRadius; r += spacing) {
            const points = [];
            const segments = Math.max(16, Math.floor(r * 8));
            
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                
                if (bounds.isCircle) {
                    if (this.isPointInCircle(x, y, bounds.center, bounds.radius)) {
                        points.push(new THREE.Vector3(x, y, bounds.z));
                    }
                } else {
                    if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
                        points.push(new THREE.Vector3(x, y, bounds.z));
                    }
                }
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
                const ring = new THREE.Line(geometry, material);
                lines.push(ring);
            }
        }
        
        // Fentes radiales
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * 2 * Math.PI;
            const line = this.createClippedLine(
                centerX, centerY,
                centerX + Math.cos(angle) * maxRadius,
                centerY + Math.sin(angle) * maxRadius,
                bounds.z, bounds
            );
            if (line) lines.push(line);
        }
        
        return lines;
    }

    generateWoodLongitudinalLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity * 0.6;
        
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            const points = [];
            const numSegments = Math.floor((bounds.maxX - bounds.minX) / 0.05) + 1;
            
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                const x = bounds.minX + t * (bounds.maxX - bounds.minX);
                const noise = Math.sin(x * 0.8 + y * 0.2) * spacing * 0.1;
                const yPos = y + noise;
                
                if (bounds.isCircle) {
                    if (this.isPointInCircle(x, yPos, bounds.center, bounds.radius)) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                } else {
                    if (x >= bounds.minX && x <= bounds.maxX && yPos >= bounds.minY && yPos <= bounds.maxY) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                }
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
                const line = new THREE.Line(geometry, material);
                lines.push(line);
            }
        }
        
        return lines;
    }

    generateInsulationSoftLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity * 0.8;
        
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            const points = [];
            const numSegments = Math.floor((bounds.maxX - bounds.minX) / 0.02) + 1;
            const amplitude = spacing * 0.3;
            
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                const x = bounds.minX + t * (bounds.maxX - bounds.minX);
                const wave = Math.sin(x * 1.5) * amplitude + Math.sin(x * 0.5 + y) * amplitude * 0.5;
                const yPos = y + wave;
                
                if (bounds.isCircle) {
                   
                    if (this.isPointInCircle(x, yPos, bounds.center, bounds.radius)) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                } else {
                    if (x >= bounds.minX && x <= bounds.maxX && yPos >= bounds.minY && yPos <= bounds.maxY) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                }
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
                const line = new THREE.Line(geometry, material);
                lines.push(line);
            }
        }
        
        return lines;
    }

    generateInsulationRigidLines(bounds) {
        const lines = [];
        const panelWidth = this.hatchDensity * 1.5;
        const panelHeight = this.hatchDensity * 1.0;
        
        for (let y = bounds.minY; y < bounds.maxY; y += panelHeight) {
            for (let x = bounds.minX; x < bounds.maxX; x += panelWidth) {
                // Contour du panneau
                const panelLines = [
                    this.createClippedLine(x, y, x + panelWidth, y, bounds.z, bounds),
                    this.createClippedLine(x + panelWidth, y, x + panelWidth, y + panelHeight, bounds.z, bounds),
                    this.createClippedLine(x + panelWidth, y + panelHeight, x, y + panelHeight, bounds.z, bounds),
                    this.createClippedLine(x, y + panelHeight, x, y, bounds.z, bounds)
                ];
                
                // Lignes structurelles internes
                const div1 = this.createClippedLine(x + panelWidth/3, y, x + panelWidth/3, y + panelHeight, bounds.z, bounds);
                const div2 = this.createClippedLine(x + 2*panelWidth/3, y, x + 2*panelWidth/3, y + panelHeight, bounds.z, bounds);
                
                panelLines.push(div1, div2);
                panelLines.forEach(line => { if (line) lines.push(line); });
            }
        }
        
        return lines;
    }

    generateSteelLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity;
        
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            // Double trait puis espace puis double trait
            const line1a = this.createClippedLine(bounds.minX, y, bounds.minX + (bounds.maxX - bounds.minX) * 0.3, y, bounds.z, bounds);
            const line1b = this.createClippedLine(bounds.minX, y + spacing * 0.1, bounds.minX + (bounds.maxX - bounds.minX) * 0.3, y + spacing * 0.1, bounds.z, bounds);
            
            const line2a = this.createClippedLine(bounds.minX + (bounds.maxX - bounds.minX) * 0.7, y, bounds.maxX, y, bounds.z, bounds);
            const line2b = this.createClippedLine(bounds.minX + (bounds.maxX - bounds.minX) * 0.7, y + spacing * 0.1, bounds.maxX, y + spacing * 0.1, bounds.z, bounds);
            
            [line1a, line1b, line2a, line2b].forEach(line => { if (line) lines.push(line); });
        }
        
        return lines;
    }

    generateCopperLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity * 0.4;
        const height = bounds.maxY - bounds.minY;
        
        // Hachures diagonales serrées dans un sens
        for (let i = bounds.minX - height; i <= bounds.maxX; i += spacing) {
            const line = this.createClippedLine(i, bounds.minY, i + height, bounds.maxY, bounds.z, bounds);
            if (line) lines.push(line);
        }
        
        // Hachures diagonales serrées dans l'autre sens
        for (let i = bounds.minX - height; i <= bounds.maxX; i += spacing) {
            const line = this.createClippedLine(i, bounds.maxY, i + height, bounds.minY, bounds.z, bounds);
            if (line) lines.push(line);
        }
        
        return lines;
    }

    generateTileFlatLines(bounds) {
        const lines = [];
        const tileWidth = this.hatchDensity * 0.8;
        const tileHeight = this.hatchDensity * 0.4;
        
        for (let y = bounds.minY; y < bounds.maxY; y += tileHeight) {
            const offset = ((y - bounds.minY) / tileHeight) % 2 === 0 ? 0 : tileWidth / 2;
            
            for (let x = bounds.minX - offset; x < bounds.maxX; x += tileWidth) {
                const tileLines = [
                    this.createClippedLine(x, y, x + tileWidth, y, bounds.z, bounds),
                    this.createClippedLine(x + tileWidth, y, x + tileWidth, y + tileHeight, bounds.z, bounds),
                    this.createClippedLine(x + tileWidth, y + tileHeight, x, y + tileHeight, bounds.z, bounds),
                    this.createClippedLine(x, y + tileHeight, x, y, bounds.z, bounds)
                ];
                
                tileLines.forEach(line => { if (line) lines.push(line); });
            }
        }
        
        return lines;
    }

    generateTileWaveLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity;
        
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            const points = [];
            const numSegments = Math.floor((bounds.maxX - bounds.minX) / 0.05) + 1;
            
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                const x = bounds.minX + t * (bounds.maxX - bounds.minX);
                const wave = Math.sin(x * 2.0) * spacing * 0.4;
                const yPos = y + wave;
                
                if (bounds.isCircle) {
                    if (this.isPointInCircle(x, yPos, bounds.center, bounds.radius)) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                } else {
                    if (x >= bounds.minX && x <= bounds.maxX && yPos >= bounds.minY && yPos <= bounds.maxY) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                }
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.MeshBasicMaterial({ color: this.hatchColor || '#000000' });
                const line = new THREE.Mesh(geometry, material);
                lines.push(line);
            }
        }
        
        return lines;
    }

    generateGlassLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity * 1.5;
        const height = bounds.maxY - bounds.minY;
        
        // Quelques lignes diagonales espacées
        for (let i = bounds.minX; i <= bounds.maxX; i += spacing) {
            const line = this.createClippedLine(i, bounds.minY, i + height, bounds.maxY, bounds.z, bounds);
            if (line) lines.push(line);
        }
        
        // Quelques reflets (lignes plus claires simulées par des lignes plus courtes)
        for (let i = bounds.minX + spacing * 0.3; i <= bounds.maxX; i += spacing * 2) {
            const startY = bounds.minY + height * 0.2;
            const endY = bounds.minY + height * 0.6;
            const line = this.createClippedLine(i, startY, i + height * 0.4, endY, bounds.z, bounds);
            if (line) lines.push(line);
        }
        
        return lines;
    }

    generateWaterLines(bounds) {
        const lines = [];
        const numWaves = Math.floor((bounds.maxY - bounds.minY) / this.hatchDensity) + 1;
        
        for (let i = 0; i < numWaves; i++) {
            const y = bounds.minY + (i + 1) * (bounds.maxY - bounds.minY) / (numWaves + 1);
            const points = [];
            const numSegments = Math.floor((bounds.maxX - bounds.minX) / 0.05) + 1;
            
            for (let j = 0; j <= numSegments; j++) {
                const t = j / numSegments;
                const x = bounds.minX + t * (bounds.maxX - bounds.minX);
                const wave = Math.sin((x - bounds.minX) * 0.8 + i) * this.hatchDensity * 0.2;
                const yPos = y + wave;
                
                if (bounds.isCircle) {
                    if (this.isPointInCircle(x, yPos, bounds.center, bounds.radius)) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                } else {
                    if (x >= bounds.minX && x <= bounds.maxX && yPos >= bounds.minY && yPos <= bounds.maxY) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                }
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
                const wave = new THREE.Line(geometry, material);
                lines.push(wave);
            }
        }
        
        return lines;
    }

    generateZigzagLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity;
        const amplitude = spacing * 0.5;
        
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            const points = [];
            const segmentLength = amplitude;
            
            for (let x = bounds.minX; x <= bounds.maxX; x += segmentLength) {
                const segmentIndex = Math.floor((x - bounds.minX) / segmentLength);
                const yPos = y + (segmentIndex % 2 === 0 ? -amplitude/2 : amplitude/2);
                
                if (bounds.isCircle) {
                    if (this.isPointInCircle(x, yPos, bounds.center, bounds.radius)) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                } else {
                    if (x >= bounds.minX && x <= bounds.maxX && yPos >= bounds.minY && yPos <= bounds.maxY) {
                        points.push(new THREE.Vector3(x, yPos, bounds.z));
                    }
                }
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: this.hatchColor || '#000000' });
                const zigzag = new THREE.Line(geometry, material);
                lines.push(zigzag);
            }
        }
        
        return lines;
    }

    generateSolidLines(bounds) {
        // Pour les motifs solides, on peut créer un plan coloré
        const lines = [];
        let color = '#000000';
        
        switch(this.hatchPattern) {
            case 'solid-black':
                color = '#000000';
                break;
            case 'solid-gray':
                color = '#808080';
                break;
            case 'solid-white':
                color = '#ffffff';
                break;
        }
        
        if (bounds.isCircle) {
            // Créer un cercle plein
            const geometry = new THREE.CircleGeometry(bounds.radius, 32);
            const material = new THREE.MeshBasicMaterial({ color: color });
            const circle = new THREE.Mesh(geometry, material);
            circle.position.set(bounds.center.x, bounds.center.y, bounds.z);
            lines.push(circle);
        } else {
            // Créer un rectangle plein
            const width = bounds.maxX - bounds.minX;
            const height = bounds.maxY - bounds.minY;
            const geometry = new THREE.PlaneGeometry(width, height);
            const material = new THREE.MeshBasicMaterial({ color: color });
            const plane = new THREE.Mesh(geometry, material);
            plane.position.set(
                bounds.minX + width/2,
                bounds.minY + height/2,
                bounds.z
            );
            lines.push(plane);
        }
        
        return lines;
    }

    // ========== UTILITY METHODS ==========

    clearHatchLines() {
        this.hatchLines.forEach(hatch => {
            this.app.scene.remove(hatch);
            hatch.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        });
        this.hatchLines = [];
    }

    cancel() {
        this.selectedSurface = null;
        this.selectedHatch = null;
        document.getElementById('command-output').textContent = 'Opération annulée - Sélectionnez une surface à hachurer';
    }

    destroy() {
        this.hidePatternDialog();
        this.clearHatchLines();
    }

    // Méthode pour vérifier si un objet peut être hachuré
    isSurface(object) {
        // Vérifier si l'objet est explicitement marqué comme surface
        if (object.userData.isSurface) {
            return true;
        }
        
        // Vérifier si c'est une polyligne fermée
        if (object.userData.type === 'polyline' && object.userData.closed) {
            return true;
        }
        
        // Vérifier d'autres types de surfaces
        if (object.userData.type === 'rectangle' || object.userData.type === 'circle') {
            return true;
        }
        
        return false;
    }

    // Calcul des bounds spécifique aux polylignes fermées
    calculatePolylineBounds(surface) {
        const points = surface.userData.points;
        if (!points || points.length < 3) {
            throw new Error('Polyligne fermée invalide: pas assez de points');
        }
        
        let minX = points[0].x;
        let maxX = points[0].x;
        let minY = points[0].y;
        let maxY = points[0].y;
        
        // Trouver les limites de la polyligne
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
        
        const bounds = {
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY,
            z: surface.position.z + 0.01,
            isPolyline: true,
            points: points // Conserver les points pour le clipping
        };
        
        console.log('calculatePolylineBounds:', bounds);
        return bounds;
    }

    // Clipping de ligne par rapport à une polyligne fermée (algorithme de Sutherland-Hodgman simplifié)
    clipLineToPolyline(x1, y1, x2, y2, bounds) {
        const points = bounds.points;
        if (!points || points.length < 3) return null;
        
        // Vérifier si au moins un point de la ligne est à l'intérieur du polygone
        const p1Inside = this.isPointInPolygon(x1, y1, points);
        const p2Inside = this.isPointInPolygon(x2, y2, points);
        
        if (!p1Inside && !p2Inside) {
            // Aucun point à l'intérieur, vérifier si la ligne traverse le polygone
            const intersections = this.getLinePolygonIntersections(x1, y1, x2, y2, points);
            if (intersections.length >= 2) {
                // La ligne traverse le polygone
                return {
                    x1: intersections[0].x,
                    y1: intersections[0].y,
                    x2: intersections[1].x,
                    y2: intersections[1].y
                };
            }
            return null; // Ligne complètement à l'extérieur
        }
        
        if (p1Inside && p2Inside) {
            // Les deux points sont à l'intérieur
            return { x1, y1, x2, y2 };
        }
        
        // Un point à l'intérieur, un à l'extérieur
        const intersections = this.getLinePolygonIntersections(x1, y1, x2, y2, points);
        if (intersections.length > 0) {
            const intersection = intersections[0];
            if (p1Inside) {
                return { x1, y1, x2: intersection.x, y2: intersection.y };
            } else {
                return { x1: intersection.x, y1: intersection.y, x2, y2 };
            }
        }
        
        return null;
    }
    
    // Test point dans polygone (ray casting algorithm)
    isPointInPolygon(x, y, points) {
        let inside = false;
        const n = points.length;
        
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
    
    // Trouver les intersections entre une ligne et un polygone
    getLinePolygonIntersections(x1, y1, x2, y2, points) {
        const intersections = [];
        const n = points.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const p1 = points[i];
            const p2 = points[j];
            
            const intersection = this.getLineIntersection(
                x1, y1, x2, y2,
                p1.x, p1.y, p2.x, p2.y
            );
            
            if (intersection) {
                intersections.push(intersection);
            }
        }
        
        // Trier les intersections par distance depuis le point de départ
        intersections.sort((a, b) => {
            const distA = Math.sqrt((a.x - x1) ** 2 + (a.y - y1) ** 2);
            const distB = Math.sqrt((b.x - x1) ** 2 + (b.y - y1) ** 2);
            return distA - distB;
        });
        
        return intersections;
    }
    
    // Intersection entre deux segments de ligne
    getLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return null; // Lignes parallèles
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)            };
        }
        
        return null;
    }

    // Méthode utilitaire pour clipper une ligne à un rectangle (pour l'aperçu)
    clipLineToRect(x1, y1, x2, y2, rect) {
        const INSIDE = 0;
        const LEFT = 1;
        const RIGHT = 2;
        const BOTTOM = 4;
        const TOP = 8;
        
        const computeOutCode = (x, y) => {
            let code = INSIDE;
            if (x < rect.x) code |= LEFT;
            else if (x > rect.x + rect.width) code |= RIGHT;
            if (y < rect.y) code |= BOTTOM;
            else if (y > rect.y + rect.height) code |= TOP;
            return code;
        };

        let outcode1 = computeOutCode(x1, y1);
        let outcode2 = computeOutCode(x2, y2);
        let accept = false;

        while (true) {
            if (!(outcode1 | outcode2)) {
                accept = true;
                break;
            } else if (outcode1 & outcode2) {
                break;
            } else {
                let x, y;
                const outcodeOut = outcode1 ? outcode1 : outcode2;

                if (outcodeOut & TOP) {
                    x = x1 + (x2 - x1) * (rect.y + rect.height - y1) / (y2 - y1);
                    y = rect.y + rect.height;
                } else if (outcodeOut & BOTTOM) {
                    x = x1 + (x2 - x1) * (rect.y - y1) / (y2 - y1);
                    y = rect.y;
                } else if (outcodeOut & RIGHT) {
                    y = y1 + (y2 - y1) * (rect.x + rect.width - x1) / (x2 - x1);
                    x = rect.x + rect.width;
                } else if (outcodeOut & LEFT) {
                    y = y1 + (y2 - y1) * (rect.x - x1) / (x2 - x1);
                    x = rect.x;
                }

                if (outcodeOut === outcode1) {
                    x1 = x;
                    y1 = y;
                    outcode1 = computeOutCode(x1, y1);
                } else {
                    x2 = x;
                    y2 = y;
                    outcode2 = computeOutCode(x2, y2);
                }
            }
        }

        return accept ? { x1, y1, x2, y2 } : null;
    }
}