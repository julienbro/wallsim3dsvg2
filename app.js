import * as THREE from 'three';
import { WebCAD } from './js/core/WebCAD.js';
import { addRectangleDeleteMethods } from './js/managers/UIManager.js';

// Liste des modules à charger
const loadingSteps = [
    { message: "Chargement de Three.js...", duration: 300 },
    { message: "Initialisation du moteur 3D...", duration: 400 },
    { message: "Chargement des outils de dessin...", duration: 300 },
    { message: "Configuration de l'interface...", duration: 350 },
    { message: "Chargement des textures de murs...", duration: 400 },
    { message: "Initialisation du gestionnaire de fichiers...", duration: 200 },
    { message: "Configuration des contrôles...", duration: 300 },
    { message: "Chargement du système d'éclairage solaire...", duration: 250 },
    { message: "Préparation de l'espace de travail...", duration: 200 },
    { message: "Finalisation...", duration: 300 }
];

// Fonction pour simuler le chargement
async function simulateLoading() {
    const loadingText = document.getElementById('loading-text');
    const loadingProgress = document.querySelector('.loading-progress');
    const totalSteps = loadingSteps.length;
    
    for (let i = 0; i < totalSteps; i++) {
        const step = loadingSteps[i];
        
        // Mettre à jour le texte
        loadingText.textContent = step.message;
        
        // Mettre à jour la barre de progression
        const progress = ((i + 1) / totalSteps) * 100;
        loadingProgress.style.width = `${progress}%`;
        
        // Attendre avant la prochaine étape
        await new Promise(resolve => setTimeout(resolve, step.duration));
    }
    
    // Attendre un peu avant de masquer l'écran
    await new Promise(resolve => setTimeout(resolve, 500));
}

// Masquer l'écran de chargement
function hideSplashScreen() {
    const splashScreen = document.getElementById('splash-screen');
    splashScreen.classList.add('fade-out');
    
    // Supprimer complètement après la transition
    setTimeout(() => {
        splashScreen.style.display = 'none';
    }, 500);
}

// Fonction pour démarrer l'application après le clic
async function startApplication() {
    const startButton = document.getElementById('start-button');
    const loadingSection = document.getElementById('loading-section');
    
    // Masquer le bouton et afficher la section de chargement
    startButton.classList.add('hidden');
    loadingSection.style.display = 'block';
    
    try {
        // Lancer la simulation de chargement
        await simulateLoading();
        
        console.log('Application WebCAD en cours d\'initialisation...');
        
        // Créer l'instance de l'application
        const app = new WebCAD();
        
        // Ajouter les méthodes de suppression de rectangle
        addRectangleDeleteMethods(app);
        
        // Exposer THREE à window.app pour les scripts externes
        app.THREE = THREE;
        
        // S'assurer que l'app est globalement accessible pour le débogage
        window.app = app;
        
        console.log('Application WallSim3D initialisée avec fonctionnalités surfaces');
        
        // Masquer l'écran de chargement
        hideSplashScreen();
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        
        // En cas d'erreur, afficher un message
        const loadingText = document.getElementById('loading-text');
        loadingText.textContent = 'Erreur lors du chargement. Veuillez rafraîchir la page.';
        loadingText.style.color = '#ff4444';
    }
}

// Initialisation au chargement de la page
function initializeApp() {
    const startButton = document.getElementById('start-button');
    
    if (startButton) {
        // Ajouter l'écouteur d'événement pour le bouton démarrer
        startButton.addEventListener('click', startApplication);
    } else {
        console.error('Bouton démarrer non trouvé');
    }
}

// Démarrer l'application quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// SIMPLIFICATION des extensions WebCAD
if (typeof WebCAD !== "undefined") {
    WebCAD.prototype.setDimensionScale = function(scale, scaleText) {
        const previousScale = this.dimensionScale || 1;
        this.dimensionScale = scale;
        this.currentScaleText = scaleText;

        if (this.drawingManager?.dimensionTool) {
            this.drawingManager.dimensionTool.updateScale(scale);
            const scaleDisplay = document.getElementById('current-scale-display');
            if (scaleDisplay) {
                scaleDisplay.textContent = scaleText;
            }
        }

        // Gestion des cotations existantes
        const existingDimensions = this.drawingManager?.dimensionTool?.createdDimensions?.length || 0;
        
        if (existingDimensions > 0) {
            const confirmDelete = confirm(
                `Le changement d'échelle va supprimer ${existingDimensions} cotation(s) existante(s).\nNouvelle échelle: ${scaleText}\nVoulez-vous continuer ?`
            );
            
            if (confirmDelete) {
                if (this.drawingManager.dimensionTool.removeAllDimensions) {
                    this.drawingManager.dimensionTool.removeAllDimensions();
                }
                document.getElementById('command-output').textContent = 
                    `Échelle de cotation changée à ${scaleText}. Les anciennes cotations ont été supprimées.`;
            } else {
                this.dimensionScale = previousScale;
                return;
            }
        } else {
            document.getElementById('command-output').textContent = 
                `Échelle de cotation définie à ${scaleText}`;
        }
        
        if (this.updateStatusBar) {
            this.updateStatusBar();
        }
    };

    WebCAD.prototype.getScaleText = function(scale) {
        const scaleMap = {
            1: '1:1',
            0.5: '1:2',
            0.2: '1:5',
            0.1: '1:10',
            0.05: '1:20',
            0.02: '1:50',
            0.01: '1:100',
            0.005: '1:200',
            0.002: '1:500'
        };
        return scaleMap[scale] || `1:${Math.round(1/scale)}`;
    };

    WebCAD.prototype.updateStatusBar = function() {
        const modeIndicator = document.getElementById('mode-indicator');
        if (modeIndicator) {
            modeIndicator.textContent = `Mode: ${this.is3DMode ? '3D' : '2D'} | Échelle: ${this.currentScaleText || '1:1'}`;
        }
    };
}
