import * as THREE from 'three';

export class SunlightManager {
    constructor(app) {
        this.app = app;
        this.northAngle = 0; // Angle du nord en degrés (0 = axe Y positif)
        this.sunAzimuth = 180; // Azimut du soleil en degrés (0 = nord, 180 = sud)
        this.sunElevation = 45; // Élévation du soleil en degrés
        this.intensity = 0.8; // Intensité de la lumière
        this.month = 6; // Juin par défaut
        this.hour = 12; // Midi par défaut
        
        console.log("SunlightManager initialisé");
        
        // Initialiser la position du soleil après un court délai pour s'assurer que tout est chargé
        setTimeout(() => {
            this.updateSunPosition();
        }, 100);
        
        // Créer l'indicateur solaire
        this.createSunHelper();
    }
    
    // Ajout d'un indicateur solaire (sunHelper)
    createSunHelper() {
        if (this.sunHelper) return; // Déjà créé
        // Agrandir la boule du soleil (rayon 12 au lieu de 4)
        const geometry = new THREE.SphereGeometry(12, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffd700 });
        this.sunHelper = new THREE.Mesh(geometry, material);
        this.sunHelper.name = 'SunHelper';
        this.sunHelper.visible = false;
        this.app.scene.add(this.sunHelper);
    }

    updateSunPosition(azimuth = null, elevation = null) {
        // Si azimuth et elevation ne sont pas fournis, calculer selon l'heure et le mois
        if (azimuth === null || elevation === null) {
            const calculated = this.calculateSunPosition(this.month, this.hour);
            azimuth = calculated.azimuth;
            elevation = calculated.elevation;
        }
        
        // Vérifier que directionalLight existe
        if (!this.app.directionalLight) {
            console.warn("DirectionalLight non trouvée dans l'application");
            return;
        }
        
        this.sunAzimuth = azimuth;
        this.sunElevation = elevation;
        
        // Convertir les angles en radians en tenant compte de l'angle du nord
        const azimuthRad = (azimuth + this.northAngle) * Math.PI / 180;
        const elevationRad = elevation * Math.PI / 180;
        
        // Calculer la position du soleil
        const distance = 200; // Distance arbitraire pour positionner la lumière
        const x = distance * Math.sin(azimuthRad) * Math.cos(elevationRad);
        const y = -distance * Math.cos(azimuthRad) * Math.cos(elevationRad); // Négatif car nord = -Y
        const z = distance * Math.sin(elevationRad);
        
        // Mettre à jour la position de la lumière
        this.app.directionalLight.position.set(x, y, z);
        
        // Mettre à jour la cible de la lumière
        if (this.app.directionalLight.target) {
            this.app.directionalLight.target.position.set(0, 0, 0);
            this.app.directionalLight.target.updateMatrixWorld();
        }
        
        // Mettre à jour la caméra d'ombre
        if (this.app.directionalLight.shadow && this.app.directionalLight.shadow.camera) {
            const shadowCamera = this.app.directionalLight.shadow.camera;
            shadowCamera.position.copy(this.app.directionalLight.position);
            shadowCamera.lookAt(0, 0, 0);
            shadowCamera.updateProjectionMatrix();
            shadowCamera.updateMatrixWorld();
            
            // Forcer la mise à jour de la carte d'ombre
            this.app.directionalLight.shadow.needsUpdate = true;
        }
        
        // Mettre à jour la position de l'indicateur solaire
        if (this.sunHelper) {
            this.sunHelper.position.set(x, y, z);
        }
        
        console.log(`Position soleil: azimut=${azimuth.toFixed(1)}°, élévation=${elevation.toFixed(1)}°`);
        console.log(`Nouvelle position lumière: x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)}`);
    }
    
    // Calcul de la position du soleil pour la Belgique (latitude 50.5°)
    calculateSunPosition(month, hour) {
        // Déclinaison solaire approximative selon le mois
        const declination = 23.45 * Math.sin((360 * (284 + month * 30.5) / 365) * Math.PI / 180);
        // Angle horaire (15 degrés par heure, midi = 0)
        const hourAngle = (hour - 12) * 15;
        // Latitude Belgique ~50.5°
        const latitude = 50.5;
        // Calcul de l'élévation
        const elevationRad = Math.asin(
            Math.sin(latitude * Math.PI / 180) * Math.sin(declination * Math.PI / 180) +
            Math.cos(latitude * Math.PI / 180) * Math.cos(declination * Math.PI / 180) * 
            Math.cos(hourAngle * Math.PI / 180)
        );
        const elevation = Math.max(0, elevationRad * 180 / Math.PI);
        // Calcul de l'azimut
        const azimuthRad = Math.atan2(
            Math.sin(hourAngle * Math.PI / 180),
            Math.cos(hourAngle * Math.PI / 180) * Math.sin(latitude * Math.PI / 180) -
            Math.tan(declination * Math.PI / 180) * Math.cos(latitude * Math.PI / 180)
        );
        let azimuth = azimuthRad * 180 / Math.PI + 180; // 0=nord
        
        return { azimuth, elevation };
    }
    
    setNorthAngle(angle) {
        this.northAngle = angle;
        // Recalculer la position du soleil avec le nouvel angle nord
        this.updateSunPosition();
    }
    
    setIntensity(intensity) {
        this.intensity = intensity;
        if (this.app.directionalLight) {
            this.app.directionalLight.intensity = intensity;
        }
    }
    
    enableShadows(enabled) {
        if (this.app.directionalLight) {
            this.app.directionalLight.castShadow = enabled;
            // Forcer la mise à jour si on réactive les ombres
            if (enabled && this.app.directionalLight.shadow) {
                this.app.directionalLight.shadow.needsUpdate = true;
            }
        }
        if (this.app.renderer) {
            this.app.renderer.shadowMap.enabled = enabled;
            // Forcer la mise à jour du shadowMap
            if (enabled) {
                this.app.renderer.shadowMap.needsUpdate = true;
            }
        }
    }
}
