/**
 * Interface Soleil Pédagogique - Wallsim3D
 * Gestion du diagramme solaire interactif et des calculs astronomiques
 */

class SunlightPedagogicalInterface {
    constructor() {
        this.currentMonth = 6;
        this.currentHour = 12;
        this.northAngle = 0;
        this.pedagogyBoxCollapsed = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateSunPosition();
    }
    
    initializeElements() {
        // Éléments DOM principaux
        this.sunPosition = document.getElementById('sunPosition');
        this.sunDiagram = document.getElementById('sunDiagram');
        this.monthSelect = document.getElementById('sun-month');
        this.hourSlider = document.getElementById('sun-hour');
        this.hourDisplay = document.getElementById('hour-display');
        this.northAngleSlider = document.getElementById('north-angle');
        this.northAngleDisplay = document.getElementById('north-angle-display');
        
        // Éléments d'affichage des données
        this.solarAzimuthSpan = document.getElementById('solar-azimuth');
        this.solarElevationSpan = document.getElementById('solar-elevation');
        this.dayLengthSpan = document.getElementById('day-length');
        this.sunriseSunsetSpan = document.getElementById('sunrise-sunset');
        
        // Éléments de contrôle
        this.seasonBtns = document.querySelectorAll('.season-btn');
        this.directionBtns = document.querySelectorAll('.direction-btn');
        
        console.log('Interface soleil pédagogique initialisée');
    }
    
    setupEventListeners() {
        // Contrôles temporels
        if (this.monthSelect) {
            this.monthSelect.addEventListener('change', (e) => {
                this.currentMonth = parseInt(e.target.value);
                this.updateSunPosition();
            });
        }
        
        if (this.hourSlider) {
            this.hourSlider.addEventListener('input', (e) => {
                this.currentHour = parseFloat(e.target.value);
                if (this.hourDisplay) {
                    this.hourDisplay.textContent = this.formatHour(this.currentHour);
                }
                this.updateSunPosition();
            });
        }
        
        // Contrôle du nord
        if (this.northAngleSlider) {
            this.northAngleSlider.addEventListener('input', (e) => {
                this.northAngle = parseInt(e.target.value);
                if (this.northAngleDisplay) {
                    this.northAngleDisplay.textContent = `${this.northAngle}°`;
                }
                this.updateSunPosition();
            });
        }
        
        // Presets saisonniers
        this.seasonBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const month = parseInt(btn.dataset.month);
                const hour = parseFloat(btn.dataset.hour);
                
                this.currentMonth = month;
                this.currentHour = hour;
                
                if (this.monthSelect) this.monthSelect.value = month;
                if (this.hourSlider) this.hourSlider.value = hour;
                if (this.hourDisplay) this.hourDisplay.textContent = this.formatHour(hour);
                
                // Mettre à jour les styles des boutons
                this.seasonBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.updateSunPosition();
            });
        });
        
        // Boutons de direction
        this.directionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const angle = parseInt(btn.dataset.angle);
                this.northAngle = angle;
                
                if (this.northAngleSlider) this.northAngleSlider.value = angle;
                if (this.northAngleDisplay) this.northAngleDisplay.textContent = `${angle}°`;
                
                // Mettre à jour les styles des boutons
                this.directionBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.updateSunPosition();
            });
        });
    }
    
    /**
     * Calculs astronomiques simplifiés pour la latitude de Lyon (45.75°N)
     */
    calculateSolarPosition(month, hour, latitude = 45.75) {
        const dayOfYear = month * 30 - 15; // Approximation
        const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
        
        const hourAngle = (hour - 12) * 15; // 15° par heure
        const latRad = latitude * Math.PI / 180;
        const declRad = declination * Math.PI / 180;
        const hourRad = hourAngle * Math.PI / 180;
        
        // Élévation solaire
        const elevation = Math.asin(
            Math.sin(latRad) * Math.sin(declRad) + 
            Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad)
        ) * 180 / Math.PI;
        
        // Azimut solaire
        let azimuth = Math.atan2(
            Math.sin(hourRad),
            Math.cos(hourRad) * Math.sin(latRad) - Math.tan(declRad) * Math.cos(latRad)
        ) * 180 / Math.PI;
        
        azimuth = (azimuth + 180) % 360; // Ajuster pour avoir 0° = Nord
        
        return { azimuth, elevation, declination };
    }
    
    updateSunPosition() {
        if (!this.sunPosition || !this.sunDiagram) return;
        
        const solar = this.calculateSolarPosition(this.currentMonth, this.currentHour);
        
        // Convertir les coordonnées polaires en coordonnées cartésiennes pour le diagramme
        const centerX = 90; // Centre du diagramme (50%)
        const centerY = 90; // Centre du diagramme (50%)
        const radius = 80; // Rayon maximum
        
        // Ajuster l'azimut avec l'orientation du Nord
        const adjustedAzimuth = (solar.azimuth + this.northAngle) % 360;
        const azimuthRad = (adjustedAzimuth - 90) * Math.PI / 180; // -90 pour que 0° soit en haut
        
        // Position dans le diagramme (élévation détermine la distance au centre)
        const elevationFactor = Math.max(0, solar.elevation) / 90; // 0 à 1
        const diagramRadius = radius * (1 - elevationFactor * 0.8); // Plus haut = plus près du centre
        
        const x = centerX + diagramRadius * Math.cos(azimuthRad);
        const y = centerY + diagramRadius * Math.sin(azimuthRad);
        
        this.sunPosition.style.left = `${x}px`;
        this.sunPosition.style.top = `${y}px`;
        
        // Si le soleil est sous l'horizon, le cacher partiellement
        if (solar.elevation < 0) {
            this.sunPosition.style.opacity = '0.3';
            this.sunPosition.style.transform = 'translate(-50%, -50%) scale(0.5)';
        } else {
            this.sunPosition.style.opacity = '1';
            this.sunPosition.style.transform = 'translate(-50%, -50%) scale(1)';
        }
        
        // Mettre à jour les informations affichées
        this.updateSolarInfo(solar);
    }
    
    updateSolarInfo(solar) {
        if (this.solarAzimuthSpan) {
            this.solarAzimuthSpan.textContent = `${Math.round(solar.azimuth)}°`;
        }
        
        if (this.solarElevationSpan) {
            this.solarElevationSpan.textContent = `${Math.round(solar.elevation)}°`;
        }
        
        // Calculer la durée du jour (approximation)
        const dayLength = this.calculateDayLength(this.currentMonth);
        if (this.dayLengthSpan) {
            this.dayLengthSpan.textContent = dayLength;
        }
        
        // Calculer les heures de lever/coucher
        const { sunrise, sunset } = this.calculateSunriseSunset(this.currentMonth);
        if (this.sunriseSunsetSpan) {
            this.sunriseSunsetSpan.textContent = `${sunrise} - ${sunset}`;
        }
    }
    
    calculateDayLength(month) {
        // Approximation de la durée du jour selon le mois (latitude Lyon)
        const dayLengths = {
            1: "9h15", 2: "10h30", 3: "12h00", 4: "13h30", 5: "15h00", 6: "15h30",
            7: "15h15", 8: "14h00", 9: "12h30", 10: "11h00", 11: "9h45", 12: "8h45"
        };
        return dayLengths[month] || "12h00";
    }
    
    calculateSunriseSunset(month) {
        // Approximation des heures de lever/coucher (latitude Lyon)
        const times = {
            1: { sunrise: "8h15", sunset: "17h30" },
            2: { sunrise: "7h45", sunset: "18h15" },
            3: { sunrise: "7h00", sunset: "19h00" },
            4: { sunrise: "6h15", sunset: "19h45" },
            5: { sunrise: "5h45", sunset: "20h30" },
            6: { sunrise: "5h30", sunset: "21h00" },
            7: { sunrise: "5h45", sunset: "20h45" },
            8: { sunrise: "6h15", sunset: "20h15" },
            9: { sunrise: "7h00", sunset: "19h30" },
            10: { sunrise: "7h45", sunset: "18h45" },
            11: { sunrise: "8h30", sunset: "17h15" },
            12: { sunrise: "8h45", sunset: "17h00" }
        };
        return times[month] || { sunrise: "6h00", sunset: "18h00" };
    }
    
    formatHour(hour) {
        const h = Math.floor(hour);
        const m = Math.round((hour - h) * 60);
        return `${h}h${m.toString().padStart(2, '0')}`;
    }
}

// Fonction globale pour toggle la boîte pédagogique
function togglePedagogyBox() {
    const content = document.getElementById('pedagogyContent');
    const header = document.querySelector('.pedagogy-header');
    const icon = header?.querySelector('.toggle-icon');
    
    if (content && header && icon) {
        const isCollapsed = content.classList.contains('collapsed');
        
        if (isCollapsed) {
            content.classList.remove('collapsed');
            header.classList.remove('collapsed');
        } else {
            content.classList.add('collapsed');
            header.classList.add('collapsed');
        }
    }
}

// Initialisation quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si nous sommes dans l'application principale (avec le panneau soleil)
    if (document.getElementById('sunlight-panel')) {
        // Attendre un peu pour que les autres scripts se chargent
        setTimeout(() => {
            window.sunlightPedagogicalInterface = new SunlightPedagogicalInterface();
        }, 500);
    }
});

// Export pour utilisation éventuelle dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SunlightPedagogicalInterface;
}
