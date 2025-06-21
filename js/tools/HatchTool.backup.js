import * as THREE from 'three';

export class HatchTool {
    constructor(app) {
        this.app = app;
        this.selectedSurface = null;
        this.hatchPattern = 'parallel'; // parallel, cross, diagonal, dots, bricks
        this.hatchDensity = 1; // espacement en unités (plus fin par défaut)
        this.hatchAngle = 45; // angle en degrés
        this.hatchLines = [];
        this.patternDialog = null;
        this.createPatternDialog();
    }

    createPatternDialog() {
        this.patternDialog = document.createElement('div');
        this.patternDialog.className = 'hatch-pattern-dialog';
        this.patternDialog.style.cssText = `
            position: fixed;
            top: 50px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border: 2px solid #007bff;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: none;
            z-index: 1000;
            font-family: Arial, sans-serif;
            min-width: 300px;
        `;
        
        this.patternDialog.innerHTML = `
            <div style="margin-bottom: 15px; font-weight: bold; text-align: center;">
                Motifs de hachures
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Motif:</label>
                <select id="hatch-pattern" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="parallel">Traits parallèles</option>
                    <option value="cross">Quadrillage</option>
                    <option value="diagonal">Diagonales croisées</option>
                    <option value="dots">Points</option>
                    <option value="bricks">Briques</option>
                    <option value="concrete">Béton</option>
                    <option value="insulation">Isolation</option>
                    <option value="wood">Bois</option>
                </select>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Espacement: <span id="density-value">${this.hatchDensity}</span> cm</label>
                <input type="range" id="hatch-density" min="0.1" max="20" step="0.1" value="${this.hatchDensity}" 
                       style="width: 100%;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Angle: <span id="angle-value">${this.hatchAngle}</span>°</label>
                <input type="range" id="hatch-angle" min="0" max="180" value="${this.hatchAngle}" 
                       style="width: 100%;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <canvas id="hatch-preview" width="200" height="100" 
                        style="border: 1px solid #ccc; display: block; margin: 0 auto;"></canvas>
            </div>
            
            <div style="text-align: center;">
                <button id="hatch-apply" style="
                    background: #007bff; color: white; border: none; 
                    padding: 8px 16px; border-radius: 4px; margin-right: 10px;
                    cursor: pointer;">Appliquer</button>
                <button id="hatch-cancel" style="
                    background: #6c757d; color: white; border: none; 
                    padding: 8px 16px; border-radius: 4px; cursor: pointer;">Annuler</button>
            </div>
        `;
        
        document.body.appendChild(this.patternDialog);
        this.setupPatternDialogEvents();
    }

    setupPatternDialogEvents() {
        document.getElementById('hatch-pattern').addEventListener('change', (e) => {
            this.hatchPattern = e.target.value;
            this.updatePreview();
        });

        document.getElementById('hatch-density').addEventListener('input', (e) => {
            this.hatchDensity = parseFloat(e.target.value);
            document.getElementById('density-value').textContent = this.hatchDensity;
            this.updatePreview();
        });

        document.getElementById('hatch-angle').addEventListener('input', (e) => {
            this.hatchAngle = parseFloat(e.target.value);
            document.getElementById('angle-value').textContent = this.hatchAngle;
            this.updatePreview();
        });

        document.getElementById('hatch-apply').addEventListener('click', () => {
            this.applyHatch();
            this.hidePatternDialog();
        });

        document.getElementById('hatch-cancel').addEventListener('click', () => {
            this.hidePatternDialog();
            this.cancel();
        });
    }

    updatePreview() {
        const canvas = document.getElementById('hatch-preview');
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        
        // Dessiner un aperçu du motif
        const rect = { x: 20, y: 20, width: 160, height: 60 };
        
        switch(this.hatchPattern) {
            case 'parallel':
                this.drawParallelPreview(ctx, rect);
                break;
            case 'cross':
                this.drawCrossPreview(ctx, rect);
                break;
            case 'diagonal':
                this.drawDiagonalPreview(ctx, rect);
                break;
            case 'dots':
                this.drawDotsPreview(ctx, rect);
                break;
            case 'bricks':
                this.drawBricksPreview(ctx, rect);
                break;
            case 'concrete':
                this.drawConcretePreview(ctx, rect);
                break;
            case 'insulation':
                this.drawInsulationPreview(ctx, rect);
                break;
            case 'wood':
                this.drawWoodPreview(ctx, rect);
                break;
        }
        
        // Dessiner le contour du rectangle
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
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
            ctx.stroke();
        }
    }

    drawParallelPreview(ctx, rect) {
        const density = Math.max(this.hatchDensity * 3, 2); // Échelle pour preview
        const angle = this.hatchAngle * Math.PI / 180;
        
        const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const startX = rect.x - diagonal;
        const endX = rect.x + rect.width + diagonal;
        
        for (let x = startX; x <= endX; x += density) {
            const y1 = rect.y - diagonal;
            const y2 = rect.y + rect.height + diagonal;
            
            const dx = (y2 - y1) * Math.sin(angle);
            const dy = (y2 - y1) * Math.cos(angle);
            
            const x1 = x;
            const x2 = x + dx;
            const y1_rot = y1;
            const y2_rot = y1 + dy;
            
            this.clipLineCanvas(ctx, x1, y1_rot, x2, y2_rot, rect);
        }
    }

    drawCrossPreview(ctx, rect) {
        const density = Math.max(this.hatchDensity * 3, 2);
        
        // Lignes verticales
        for (let x = rect.x; x <= rect.x + rect.width; x += density) {
            this.clipLineCanvas(ctx, x, rect.y, x, rect.y + rect.height, rect);
        }
        
        // Lignes horizontales
        for (let y = rect.y; y <= rect.y + rect.height; y += density) {
            this.clipLineCanvas(ctx, rect.x, y, rect.x + rect.width, y, rect);
        }
    }

    drawDiagonalPreview(ctx, rect) {
        const density = Math.max(this.hatchDensity * 3, 2);
        
        // Diagonales descendantes
        for (let i = rect.x - rect.height; i <= rect.x + rect.width; i += density) {
            this.clipLineCanvas(ctx, i, rect.y, i + rect.height, rect.y + rect.height, rect);
        }
        
        // Diagonales montantes
        for (let i = rect.x - rect.height; i <= rect.x + rect.width; i += density) {
            this.clipLineCanvas(ctx, i, rect.y + rect.height, i + rect.height, rect.y, rect);
        }
    }

    drawDotsPreview(ctx, rect) {
        const density = Math.max(this.hatchDensity * 3, 4);
        
        for (let x = rect.x; x <= rect.x + rect.width; x += density) {
            for (let y = rect.y; y <= rect.y + rect.height; y += density) {
                if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
    }

    drawBricksPreview(ctx, rect) {
        const density = Math.max(this.hatchDensity * 6, 8);
        const brickHeight = density;
        const brickWidth = density * 2;
        
        let offsetX = 0;
        for (let y = rect.y; y <= rect.y + rect.height; y += brickHeight) {
            for (let x = rect.x + offsetX; x <= rect.x + rect.width; x += brickWidth) {
                // Ligne horizontale
                this.clipLineCanvas(ctx, x, y, x + brickWidth, y, rect);
                // Ligne verticale
                if (y > rect.y) {
                    this.clipLineCanvas(ctx, x, y - brickHeight, x, y, rect);
                }
            }
            offsetX = offsetX === 0 ? brickWidth / 2 : 0;
        }
    }

    drawConcretePreview(ctx, rect) {
        const density = Math.max(this.hatchDensity * 4, 6);
        
        for (let i = 0; i < 15; i++) {
            const x = rect.x + Math.random() * rect.width;
            const y = rect.y + Math.random() * rect.height;
            const radius = Math.random() * density * 0.3 + 1;
            
            if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.stroke();
            }
        }
    }

    drawInsulationPreview(ctx, rect) {
        const density = Math.max(this.hatchDensity * 3, 4);
        
        for (let y = rect.y; y <= rect.y + rect.height; y += density) {
            const numSegments = 20;
            const amplitude = density * 0.4;
            
            ctx.beginPath();
            let first = true;
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                const x = rect.x + t * rect.width;
                const waveY = y + Math.sin(t * Math.PI * 4) * amplitude;
                
                if (first) {
                    ctx.moveTo(x, waveY);
                    first = false;
                } else {
                    ctx.lineTo(x, waveY);
                }
            }
            ctx.stroke();
        }
    }

    drawWoodPreview(ctx, rect) {
        const density = Math.max(this.hatchDensity * 3, 4);
        
        for (let y = rect.y; y <= rect.y + rect.height; y += density) {
            const numSegments = 20;
            const amplitude = density * 0.2;
            
            ctx.beginPath();
            let first = true;
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                const x = rect.x + t * rect.width;
                const waveY = y + Math.sin(t * Math.PI * 2 + y) * amplitude;
                
                if (first) {
                    ctx.moveTo(x, waveY);
                    first = false;
                } else {
                    ctx.lineTo(x, waveY);
                }
            }
            ctx.stroke();
        }
    }

    showPatternDialog() {
        if (this.patternDialog) {
            this.patternDialog.style.display = 'block';
            this.updatePreview();
        }
    }

    hidePatternDialog() {
        if (this.patternDialog) {
            this.patternDialog.style.display = 'none';
        }
    }

    activate() {
        document.getElementById('command-output').textContent = 'Sélectionnez une surface à hachurer';
        this.app.renderer.domElement.style.cursor = 'crosshair';
    }

    deactivate() {
        this.hidePatternDialog();
        this.app.renderer.domElement.style.cursor = 'default';
    }

    onMouseDown(event) {
        const intersection = this.app.getIntersection(event);
        
        if (intersection && intersection.object.userData.isSurface) {
            this.selectedSurface = intersection.object;
            this.showPatternDialog();
        }
    }

    applyHatch() {
        if (!this.selectedSurface) return;
        
        const bounds = this.calculateSurfaceBounds(this.selectedSurface);
        const lines = this.generateHatchLines(bounds);
        
        // Créer un groupe pour les hachures
        const hatchGroup = new THREE.Group();
        hatchGroup.userData.isHatch = true;
        hatchGroup.userData.surfaceId = this.selectedSurface.uuid;
        hatchGroup.userData.pattern = this.hatchPattern;
        hatchGroup.userData.density = this.hatchDensity;
        hatchGroup.userData.angle = this.hatchAngle;
        hatchGroup.userData.bounds = bounds;
        
        lines.forEach(line => {
            if (line) hatchGroup.add(line);
        });
        
        this.app.scene.add(hatchGroup);
        this.hatchLines.push(hatchGroup);
        
        // Ajouter aux éléments sélectionnables
        this.app.toolManager.selectionManager.addSelectableObject(hatchGroup);
        
        document.getElementById('command-output').textContent = `Hachures ${this.hatchPattern} appliquées`;
        this.selectedSurface = null;
    }

    calculateSurfaceBounds(surface) {
        const box = new THREE.Box3().setFromObject(surface);
        const position = surface.position;
        
        return {
            minX: position.x + box.min.x,
            maxX: position.x + box.max.x,
            minY: position.y + box.min.y,
            maxY: position.y + box.max.y,
            z: position.z + 0.001
        };
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
            case 'bricks':
                lines.push(...this.generateBrickLines(bounds));
                break;
            case 'concrete':
                lines.push(...this.generateConcretePattern(bounds));
                break;
            case 'insulation':
                lines.push(...this.generateInsulationLines(bounds));
                break;
            case 'wood':
                lines.push(...this.generateWoodLines(bounds));
                break;
        }
        
        return lines;
    }

    // Fonction de clipping Cohen-Sutherland pour 3D
    clipLine(x1, y1, x2, y2, bounds) {
        const INSIDE = 0; // 0000
        const LEFT = 1;   // 0001
        const RIGHT = 2;  // 0010
        const BOTTOM = 4; // 0100
        const TOP = 8;    // 1000

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

        if (accept) {
            return { x1, y1, x2, y2 };
        }
        return null;
    }

    // Fonction utilitaire pour créer une ligne avec clipping
    createClippedLine(x1, y1, x2, y2, z, bounds) {
        const clipped = this.clipLine(x1, y1, x2, y2, bounds);
        if (!clipped) return null;

        const points = [
            new THREE.Vector3(clipped.x1, clipped.y1, z),
            new THREE.Vector3(clipped.x2, clipped.y2, z)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
        return new THREE.Line(geometry, material);
    }

    generateParallelLines(bounds) {
        const lines = [];
        const angle = this.hatchAngle * Math.PI / 180;
        const spacing = this.hatchDensity;
        
        // Calculer les limites étendues pour couvrir la zone après rotation
        const diagonal = Math.sqrt(Math.pow(bounds.maxX - bounds.minX, 2) + Math.pow(bounds.maxY - bounds.minY, 2));
        const startX = bounds.minX - diagonal;
        const endX = bounds.maxX + diagonal;
        
        for (let x = startX; x <= endX; x += spacing) {
            const y1 = bounds.minY - diagonal;
            const y2 = bounds.maxY + diagonal;
            
            // Calculer les points de la ligne avec l'angle
            const dx = (y2 - y1) * Math.sin(angle);
            const dy = (y2 - y1) * Math.cos(angle);
            
            const x1 = x;
            const x2 = x + dx;
            const y1_rot = y1;
            const y2_rot = y1 + dy;
            
            const line = this.createClippedLine(x1, y1_rot, x2, y2_rot, bounds.z, bounds);
            if (line) lines.push(line);
        }
        
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
        const width = bounds.maxX - bounds.minX;
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
                if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
                    const geometry = new THREE.SphereGeometry(0.02, 8, 8);
                    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
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
            
            offsetX = offsetX === 0 ? brickWidth / 2 : 0;
        }
        
        return lines;
    }

    generateConcretePattern(bounds) {
        const objects = [];
        const numCircles = Math.max(10, (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / (this.hatchDensity * this.hatchDensity) * 0.1);
        
        for (let i = 0; i < numCircles; i++) {
            const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            const radius = Math.random() * this.hatchDensity * 0.3 + 0.05;
            
            // Vérifier que le cercle est dans les limites
            if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
                // Créer un cercle avec des segments
                const segments = 16;
                const points = [];
                for (let j = 0; j <= segments; j++) {
                    const angle = (j / segments) * Math.PI * 2;
                    const px = x + Math.cos(angle) * radius;
                    const py = y + Math.sin(angle) * radius;
                    
                    // Clipper chaque point du cercle
                    if (px >= bounds.minX && px <= bounds.maxX && py >= bounds.minY && py <= bounds.maxY) {
                        points.push(new THREE.Vector3(px, py, bounds.z));
                    }
                }
                
                if (points.length > 2) {
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                    const circle = new THREE.LineLoop(geometry, material);
                    objects.push(circle);
                }
            }
        }
        
        return objects;
    }

    generateInsulationLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity;
        
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            const points = [];
            const numSegments = 40;
            const amplitude = Math.min(spacing * 0.4, (bounds.maxY - bounds.minY) * 0.1);
            
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                const x = bounds.minX + t * (bounds.maxX - bounds.minX);
                const waveY = y + Math.sin(t * Math.PI * 4) * amplitude;
                
                // Clipper le point
                const clippedY = Math.max(bounds.minY, Math.min(bounds.maxY, waveY));
                points.push(new THREE.Vector3(x, clippedY, bounds.z));
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                const line = new THREE.Line(geometry, material);
                lines.push(line);
            }
        }
        
        return lines;
    }

    generateWoodLines(bounds) {
        const lines = [];
        const spacing = this.hatchDensity;
        
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            const points = [];
            const numSegments = 20;
            const amplitude = spacing * 0.2;
            
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                const x = bounds.minX + t * (bounds.maxX - bounds.minX);
                const waveY = y + Math.sin(t * Math.PI * 2 + y) * amplitude;
                
                // Clipper le point
                const clippedY = Math.max(bounds.minY, Math.min(bounds.maxY, waveY));
                points.push(new THREE.Vector3(x, clippedY, bounds.z));
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                const line = new THREE.Line(geometry, material);
                lines.push(line);
            }
        }
        
        return lines;
    }

    clearHatchLines() {
        this.hatchLines.forEach(line => {
            this.app.scene.remove(line);
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
        });
        this.hatchLines = [];
    }

    cancel() {
        this.selectedSurface = null;
        document.getElementById('command-output').textContent = 'Opération annulée - Sélectionnez une surface à hachurer';
    }

    destroy() {
        if (this.patternDialog && this.patternDialog.parentNode) {
            this.patternDialog.parentNode.removeChild(this.patternDialog);
        }
        this.clearHatchLines();
    }
}
