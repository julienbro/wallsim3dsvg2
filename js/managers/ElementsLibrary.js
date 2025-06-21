import * as THREE from 'three';

export class ElementsLibrary {
    constructor(app) {
        this.app = app;
        this.modelCache = new Map();
        
        // Configuration des éléments de construction
        this.elementsConfig = {
            briques: {                'Brique M50': { 
                    dims: { x: 19, y: 9, z: 5 },
                    color: 0xB87333,
                    cuts: [1, 0.75, 0.5, 0.25],
                    preview: 'assets/previews/brique-m50.png',
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb'
                },                'Brique M57': { 
                    dims: { x: 19, y: 9, z: 5.7 },
                    color: 0xB87333,
                    cuts: [1, 0.75, 0.5, 0.25],
                    preview: 'assets/previews/brique-m57.png',
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb'
                },
                'Brique M60': { 
                    dims: { x: 19, y: 9, z: 6 },
                    color: 0xB87333,
                    cuts: [1, 0.75, 0.5, 0.25],
                    preview: 'assets/previews/brique-m60.png',
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb'
                },
                'Brique M65': { 
                    dims: { x: 19, y: 9, z: 6.5 },
                    color: 0xB87333,
                    cuts: [1, 0.75, 0.5, 0.25],
                    preview: 'assets/previews/brique-m65.png',
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb'
                },
                'Brique M90': { 
                    dims: { x: 19, y: 9, z: 9 },
                    color: 0xB87333,
                    cuts: [1, 0.75, 0.5, 0.25],
                    preview: 'assets/previews/brique-m90.png',
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb'
                },
                'Brique WF': { 
                    dims: { x: 21, y: 10, z: 5 },
                    color: 0xB87333,
                    cuts: [1, 0.75, 0.5, 0.25],
                    preview: 'assets/previews/brique-wf.png',
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb'
                },                'Brique WFD': { 
                    dims: { x: 21, y: 10, z: 6.5 },
                    color: 0xB87333,
                    cuts: [1, 0.75, 0.5, 0.25],
                    preview: 'assets/previews/brique-wfd.png',
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb'
                }
            },
            blocs: {
                'Stepoc® 15 A': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 50, y: 15, z: 20 },
                    color: 0xCCCCCC
                },                'Bloc B9': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 39, y: 9, z: 19 },
                    color: 0xCCCCCC
                },
                'Bloc B14': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 39, y: 14, z: 19 },
                    color: 0xCCCCCC
                },
                'Bloc B19': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 39, y: 19, z: 19 },
                    color: 0xCCCCCC
                },
                'Bloc B29': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 39, y: 29, z: 19 },
                    color: 0xCCCCCC
                },
                'Bloc Argex 39x9x19': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 39, y: 9, z: 19 },
                    color: 0x999999
                },
                'Bloc Argex 39x14x19': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 39, y: 14, z: 19 },
                    color: 0x999999
                },                'Bloc Argex 39x19x19': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 39, y: 19, z: 19 },
                    color: 0x999999
                },
                'Bloc béton cell. 5cm': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 5, z: 25 },
                    color: 0xF0F0F0
                },
                'Bloc béton cell. 7cm': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 7, z: 25 },
                    color: 0xF0F0F0
                },
                'Bloc béton cell. 10cm': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 10, z: 25 },
                    color: 0xF0F0F0
                },
                'Bloc béton cell. 15cm': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 15, z: 25 },
                    color: 0xF0F0F0
                },                'Bloc béton cell. 20cm': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 20, z: 25 },
                    color: 0xF0F0F0
                },                'Bloc béton cell.(60x24x25)': { 
                    type: 'glb',
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 24, z: 25 },
                    color: 0xFFFFFF,
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },                'Bloc béton cell.(60x30x25)': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 30, z: 25 },
                    color: 0xFFFFFF,
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },                'Bloc béton cell.(60x36x25)': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 36, z: 25 },
                    color: 0xFFFFFF,
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },
                // Blocs béton cellulaire d'assise hauteur 20cm
                'Béton cell. Assise (60x9x20)': { 
                    type: 'glb', 
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 9, z: 20 },
                    color: 0xFFFFFF,
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },
                'Béton cell. Assise (60x14x20)': { 
                    type: 'glb', 
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 14, z: 20 },
                    color: 0xFFFFFF,
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },
                'Béton cell. Assise (60x19x20)': { 
                    type: 'glb', 
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 19, z: 20 },
                    color: 0xFFFFFF,
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },
                // Blocs béton cellulaire d'assise hauteur 25cm
                'Béton cell. Assise (60x9x25)': { 
                    type: 'glb', 
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 9, z: 25 },
                    color: 0xFFFFFF,
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },
                'Béton cell. Assise (60x14x25)': { 
                    type: 'glb', 
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 14, z: 25 },
                    color: 0xFFFFFF,
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },
                'Béton cell. Assise (60x19x25)': {
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 60, y: 19, z: 25 },
                    color: 0xFFFFFF,
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },                // Blocs en terre cuite
                'Terre cuite (50x10x25)': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 50, y: 10, z: 25 },
                    color: 0xCC4500,  // Orange foncé/rouge brique
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },
                'Terre cuite (50x14x25)': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 50, y: 14, z: 25 },
                    color: 0xCC4500,  // Orange foncé/rouge brique
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },
                'Terre cuite (50x19x25)': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 50, y: 19, z: 25 },
                    color: 0xCC4500,  // Orange foncé/rouge brique
                    cuts: [1, 0.75, 0.5, 0.25, 'custom'],
                    customCut: true
                },
            },
            linteaux: {
                'Linteau L120_14': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 120, y: 14, z: 19 },
                    color: 0x808080
                },
                'Linteau L140_14': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 140, y: 14, z: 19 },
                    color: 0x808080
                },
                'Linteau L160_14': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 160, y: 14, z: 19 },
                    color: 0x808080
                },
                'Linteau L180_14': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 180, y: 14, z: 19 },
                    color: 0x808080
                },
                'Linteau L200_14': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 200, y: 14, z: 19 },
                    color: 0x808080
                }
            },
            isolants: {
                'Isolant PUR5': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 120, y: 5, z: 60 },
                    color: 0xF5F5DC // beige
                },
                'Isolant PUR6': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 120, y: 6, z: 60 },
                    color: 0xF5F5DC // beige
                },
                'Isolant PUR7': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 120, y: 7, z: 60 },
                    color: 0xF5F5DC // beige
                }
            },            planchers: {
                // Hourdis 13cm - ils font 1cm de profondeur dans le modèle, donc échelle selon la longueur désirée
                'Hourdis 13cm': {
                    type: 'glb',
                    path: 'planchers/hourdis_13_60.glb',
                    dims: { x: 60, y: 13, z: 25 }, // largeur 60cm, hauteur 13cm, profondeur par défaut 25cm
                    color: 0xCCCCCC,
                    scalable: true,
                    baseLength: 1, // Le modèle fait 1cm de profondeur (axe Z)
                    scaleAxis: 'z', // L'axe de profondeur à ajuster
                    minLength: 10, // Longueur minimale 10cm
                    maxLength: 800, // Longueur maximale 800cm
                    stepLength: 5 // Pas de 5cm
                },
                // Hourdis 16cm - ils font 1cm de profondeur dans le modèle, donc échelle selon la longueur désirée  
                'Hourdis 16cm': {
                    type: 'glb',
                    path: 'planchers/hourdis_16_60.glb',
                    dims: { x: 60, y: 16, z: 25 }, // largeur 60cm, hauteur 16cm, profondeur par défaut 25cm
                    color: 0xCCCCCC,
                    scalable: true,
                    baseLength: 1, // Le modèle fait 1cm de profondeur (axe Z)
                    scaleAxis: 'z', // L'axe de profondeur à ajuster
                    minLength: 10, // Longueur minimale 10cm
                    maxLength: 800, // Longueur maximale 800cm
                    stepLength: 5 // Pas de 5cm
                },
                // Poutrain béton 12cm - dimension variable sur la plus courte dimension
                'Poutrain béton 12cm': {
                    type: 'glb',
                    path: 'planchers/poutrain_beton_12.glb',
                    dims: { x: 60, y: 12, z: 25 }, // largeur 60cm, hauteur 12cm (la plus courte), profondeur 25cm
                    color: 0xCCCCCC,
                    scalable: true,
                    baseLength: 12, // Le modèle fait 12cm de hauteur (axe Y)
                    scaleAxis: 'y', // L'axe Y (hauteur) à ajuster - dimension la plus courte
                    minLength: 8, // Hauteur minimale 8cm
                    maxLength: 20, // Hauteur maximale 20cm
                    stepLength: 1 // Pas de 1cm
                },                // Claveau béton 12x53 - dimensions fixes du modèle GLB
                'Claveau béton 12x53': {
                    type: 'glb',
                    path: 'planchers/claveau_beton_12_53.glb',
                    dims: { x: 53, y: 12, z: 25 }, // Dimensions approximatives pour l'affichage
                    color: 0xCCCCCC,
                    scalable: false, // Pas de dimension personnalisable
                    preserveOriginalDimensions: true // Utiliser les dimensions originales du fichier GLB
                }
            },
            autres: {
                'Vide': { 
                    type: 'glb',                    path: '1_1_1.glb',
                    dims: { x: 10, y: 10, z: 10 },
                    color: 0xEEEEEE,
                    transparent: true,
                    opacity: 0.3
                }
            },
            outils: {
                'Profil': { 
                    type: 'glb',
                    path: '1_1_1.glb',
                    dims: { x: 10, y: 10, z: 100 }, // Longueur par défaut de 100cm en Z
                    color: 0x444444,
                    configurableLength: true, // Permettre la configuration de la longueur
                    minLength: 10,  // Longueur minimale en cm
                    maxLength: 500, // Longueur maximale en cm
                    defaultLength: 100 // Longueur par défaut en cm
                },
                'Bétonnière': {
                    type: 'glb',
                    modelPath: 'assets/models/outils/betonniere.glb',
                    dims: { x: 150, y: 120, z: 180 },
                    color: 0xFF6B35,
                    preserveMaterials: true,
                    preview: 'assets/previews/betonniere.png'
                },
                'Brouette': {
                    type: 'glb',
                    modelPath: 'assets/models/outils/brouette.glb',
                    dims: { x: 140, y: 60, z: 35 },
                    color: 0x2E8B57,
                    preserveMaterials: true,
                    preview: 'assets/previews/brouette.png'
                }
            },            poutres: {
                // Profils UPN - Utiliser UPN100 comme modèle de base pour l'aperçu
                'UPN': {
                    type: 'glb',
                    path: 'poutres/UPN/UPN100.glb',
                    dims: { x: 10, y: 100, z: 5.5 }, // Section approximative UPN100
                    color: 0x708090, // Gris acier
                    scalable: true,
                    baseLength: 100, // Longueur de base en cm
                    scaleAxis: 'y', // Axe Y pour la longueur
                    minLength: 50, // Longueur minimale 50cm
                    maxLength: 1200, // Longueur maximale 1200cm
                    stepLength: 10, // Pas de 10cm
                    profiles: ['UPN100', 'UPN120', 'UPN140', 'UPN160', 'UPN180', 'UPN200', 'UPN220', 'UPN240', 'UPN260', 'UPN280', 'UPN300', 'UPN320', 'UPN350', 'UPN380', 'UPN400'],
                    profilePaths: {
                        'UPN100': 'poutres/UPN/UPN100.glb',
                        'UPN120': 'poutres/UPN/UPN120.glb',
                        'UPN140': 'poutres/UPN/UPN140.glb',
                        'UPN160': 'poutres/UPN/UPN160.glb',
                        'UPN180': 'poutres/UPN/UPN180.glb',
                        'UPN200': 'poutres/UPN/UPN200.glb',
                        'UPN220': 'poutres/UPN/UPN220.glb',
                        'UPN240': 'poutres/UPN/UPN240.glb',
                        'UPN260': 'poutres/UPN/UPN260.glb',
                        'UPN280': 'poutres/UPN/UPN280.glb',
                        'UPN300': 'poutres/UPN/UPN300.glb',
                        'UPN320': 'poutres/UPN/UPN320.glb',
                        'UPN350': 'poutres/UPN/UPN350.glb',
                        'UPN380': 'poutres/UPN/UPN380.glb',
                        'UPN400': 'poutres/UPN/UPN400.glb'
                    }
                },                // Profils HEA - Utiliser HEA100 comme modèle de base pour l'aperçu
                'HEA': {
                    type: 'glb',
                    path: 'poutres/HEA/HEA100.glb',
                    dims: { x: 10, y: 100, z: 9.6 }, // Section approximative HEA100
                    color: 0x708090, // Gris acier
                    scalable: true,
                    baseLength: 100, // Longueur de base en cm
                    scaleAxis: 'y', // Axe Y pour la longueur
                    minLength: 50, // Longueur minimale 50cm
                    maxLength: 1200, // Longueur maximale 1200cm
                    stepLength: 10, // Pas de 10cm
                    profiles: ['HEA100', 'HEA120', 'HEA140', 'HEA160', 'HEA180', 'HEA200', 'HEA220', 'HEA240', 'HEA260', 'HEA280'],
                    profilePaths: {
                        'HEA100': 'poutres/HEA/HEA100.glb',
                        'HEA120': 'poutres/HEA/HEA120.glb',
                        'HEA140': 'poutres/HEA/HEA140.glb',
                        'HEA160': 'poutres/HEA/HEA160.glb',
                        'HEA180': 'poutres/HEA/HEA180.glb',
                        'HEA200': 'poutres/HEA/HEA200.glb',
                        'HEA220': 'poutres/HEA/HEA220.glb',
                        'HEA240': 'poutres/HEA/HEA240.glb',
                        'HEA260': 'poutres/HEA/HEA260.glb',
                        'HEA280': 'poutres/HEA/HEA280.glb'
                    }
                },                // Profils HEB - Utiliser HEB100 comme modèle de base pour l'aperçu
                'HEB': {
                    type: 'glb',
                    path: 'poutres/HEB/HEB100.glb',
                    dims: { x: 10, y: 100, z: 10 }, // Section approximative HEB100
                    color: 0x708090, // Gris acier
                    scalable: true,
                    baseLength: 100, // Longueur de base en cm
                    scaleAxis: 'y', // Axe Y pour la longueur
                    minLength: 50, // Longueur minimale 50cm
                    maxLength: 1200, // Longueur maximale 1200cm
                    stepLength: 10, // Pas de 10cm
                    profiles: ['HEB100', 'HEB120', 'HEB140', 'HEB160', 'HEB180', 'HEB200', 'HEB220', 'HEB240', 'HEB260', 'HEB280', 'HEB300', 'HEB320', 'HEB340', 'HEB360', 'HEB400'],
                    profilePaths: {
                        'HEB100': 'poutres/HEB/HEB100.glb',
                        'HEB120': 'poutres/HEB/HEB120.glb',
                        'HEB140': 'poutres/HEB/HEB140.glb',
                        'HEB160': 'poutres/HEB/HEB160.glb',
                        'HEB180': 'poutres/HEB/HEB180.glb',
                        'HEB200': 'poutres/HEB/HEB200.glb',
                        'HEB220': 'poutres/HEB/HEB220.glb',
                        'HEB240': 'poutres/HEB/HEB240.glb',
                        'HEB260': 'poutres/HEB/HEB260.glb',
                        'HEB280': 'poutres/HEB/HEB280.glb',
                        'HEB300': 'poutres/HEB/HEB300.glb',
                        'HEB320': 'poutres/HEB/HEB320.glb',
                        'HEB340': 'poutres/HEB/HEB340.glb',
                        'HEB360': 'poutres/HEB/HEB360.glb',
                        'HEB400': 'poutres/HEB/HEB400.glb'
                    }
                },                // Profils IPE - Utiliser IPE100 comme modèle de base pour l'aperçu
                'IPE': {
                    type: 'glb',
                    path: 'poutres/IPE/IPE100.glb',
                    dims: { x: 5.5, y: 100, z: 10 }, // Section approximative IPE100
                    color: 0x708090, // Gris acier
                    scalable: true,
                    baseLength: 100, // Longueur de base en cm
                    scaleAxis: 'y', // Axe Y pour la longueur
                    minLength: 50, // Longueur minimale 50cm
                    maxLength: 1200, // Longueur maximale 1200cm
                    stepLength: 10, // Pas de 10cm
                    profiles: ['IPE100', 'IPE120', 'IPE140', 'IPE160', 'IPE180', 'IPE200', 'IPE220', 'IPE240', 'IPE270', 'IPE300', 'IPE330', 'IPE360', 'IPE400', 'IPE500', 'IPE550'],
                    profilePaths: {
                        'IPE100': 'poutres/IPE/IPE100.glb',
                        'IPE120': 'poutres/IPE/IPE120.glb',
                        'IPE140': 'poutres/IPE/IPE140.glb',
                        'IPE160': 'poutres/IPE/IPE160.glb',
                        'IPE180': 'poutres/IPE/IPE180.glb',
                        'IPE200': 'poutres/IPE/IPE200.glb',
                        'IPE220': 'poutres/IPE/IPE220.glb',
                        'IPE240': 'poutres/IPE/IPE240.glb',
                        'IPE270': 'poutres/IPE/IPE270.glb',
                        'IPE300': 'poutres/IPE/IPE300.glb',
                        'IPE330': 'poutres/IPE/IPE330.glb',
                        'IPE360': 'poutres/IPE/IPE360.glb',
                        'IPE400': 'poutres/IPE/IPE400.glb',
                        'IPE500': 'poutres/IPE/IPE500.glb',
                        'IPE550': 'poutres/IPE/IPE550.glb'
                    }
                }
            },
        };
    }

    async loadModel(elementName, category) {
        const config = this.elementsConfig[category]?.[elementName];
        if (!config) {
            console.warn(`Configuration non trouvée pour: ${elementName} dans ${category}`);
            return this.createFallbackGeometry(elementName, category);
        }

        const cacheKey = `${category}/${elementName}`;
        
        // Vérifier le cache
        if (this.modelCache.has(cacheKey)) {
            return this.modelCache.get(cacheKey).clone();
        }        // Essayer d'abord GLB, puis STL si GLB non disponible
        const modelPath = config.modelPath || `assets/models/${config.path}`;
        const stlPath = modelPath.replace('.glb', '.stl');

        try {
            // Vérifier si le fichier GLB existe
            const response = await fetch(modelPath, { method: 'HEAD' });
            if (response.ok) {
                // Charger le modèle GLB (préféré)
                const model = await this.loadGLBModel(modelPath, config);
                this.modelCache.set(cacheKey, model);
                return model.clone();
            } else {
                // Si GLB n'existe pas, essayer STL
                const stlResponse = await fetch(stlPath, { method: 'HEAD' });
                if (stlResponse.ok) {
                    console.log(`GLB non trouvé, chargement du STL pour ${elementName}`);
                    const model = await this.loadSTLModel(stlPath, config);
                    this.modelCache.set(cacheKey, model);
                    return model.clone();
                } else {
                    // Ni GLB ni STL disponible
                    console.log(`Aucun modèle 3D trouvé pour ${elementName}, création d'une géométrie de substitution`);
                    return this.createFallbackGeometry(elementName, category);
                }
            }
        } catch (error) {
            console.warn(`Erreur lors du chargement du modèle:`, error);
            return this.createFallbackGeometry(elementName, category);
        }
    }    async loadGLBModel(path, config) {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const loader = new GLTFLoader();
        
        return new Promise((resolve, reject) => {
            // Essayer de charger le fichier comme ArrayBuffer pour plus de fiabilité
            fetch(path)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Impossible de charger ${path}: ${response.status}`);
                    }
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => {
                    console.log(`Chargement du modèle GLB depuis la bibliothèque: ${path}`);
                    console.log(`Taille du fichier: ${arrayBuffer.byteLength} bytes`);
                    
                    loader.parse(
                        arrayBuffer,                        '', // resource path
                        (gltf) => {
                            console.log('Modèle GLB chargé avec succès depuis la bibliothèque:', path);
                            const model = gltf.scene;
                            model.userData.elementConfig = config;
                            
                            // Log des matériaux si preserveMaterials est activé
                            if (config.preserveMaterials) {
                                console.log('🎨 PreserveMaterials activé pour', path);
                                model.traverse((child) => {
                                    if (child.isMesh && child.material) {
                                        console.log('- Matériau trouvé:', child.material.name || 'sans nom', child.material);
                                    }
                                });
                            }
                            
                            // Appliquer la même rotation que dans processGLTFScene (+90° sur l'axe X)
                            model.rotation.set(Math.PI / 2, 0, 0);
                            console.log('Rotation +90° sur l\'axe X appliquée au modèle de la bibliothèque');
                            
                            // Appliquer l'échelle correcte si nécessaire
                            const box = new THREE.Box3().setFromObject(model);
                            const size = box.getSize(new THREE.Vector3());
                            
                            // Si le modèle n'est pas à la bonne échelle, l'ajuster
                            const targetSize = new THREE.Vector3(config.dims.x, config.dims.y, config.dims.z);
                            const scaleX = targetSize.x / size.x;
                            const scaleY = targetSize.y / size.y;
                            const scaleZ = targetSize.z / size.z;
                            
                            // Utiliser l'échelle uniforme la plus petite pour préserver les proportions
                            const uniformScale = Math.min(scaleX, scaleY, scaleZ);
                            if (Math.abs(uniformScale - 1) > 0.01) {
                                model.scale.multiplyScalar(uniformScale);
                                console.log(`Échelle appliquée au modèle de la bibliothèque: ${uniformScale}`);
                            }
                            
                            resolve(model);
                        },
                        (error) => {
                            console.error(`Erreur lors du parsing du modèle GLB de la bibliothèque: ${path}`, error);
                            reject(error);
                        }
                    );
                })
                .catch(error => {
                    console.error(`Erreur lors du chargement du fichier GLB de la bibliothèque: ${path}`, error);
                    reject(error);
                });
        });
    }

    async loadSTLModel(path, config) {
        const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
        const loader = new STLLoader();
        
        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (geometry) => {                    // Créer un matériau avec la couleur de la configuration
                    // Déterminer l'émissivité en fonction de la couleur
                    let emissiveColor, emissiveIntensity;
                    
                    // Si la couleur est blanche ou proche du blanc
                    if (config.color === 0xFFFFFF || config.color === 0xFEFEFE || 
                        config.color === 0xF0F0F0 || config.color === 0xF5F5F5) {
                        emissiveColor = 0xFFFFFF;  // Émissivité blanche pour les éléments blancs
                        emissiveIntensity = 0.8;   // Intensité élevée pour un blanc éclatant
                    } else if (config.color === 0xCC4500) {
                        // Couleur terre cuite : orange-rouge
                        emissiveColor = 0x330000;  // Émissivité rouge sombre pour donner de la profondeur
                        emissiveIntensity = 0.2;
                    } else {
                        // Pour les autres couleurs, légère émissivité basée sur la couleur
                        emissiveColor = config.color;
                        emissiveIntensity = 0.2;
                    }
                    
                    const material = new THREE.MeshPhongMaterial({
                        color: config.color,
                        emissive: emissiveColor,
                        emissiveIntensity: emissiveIntensity,
                        shininess: 60,  // Augmentation de la brillance
                        side: THREE.DoubleSide
                    });
                    
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.userData.elementConfig = config;
                    
                    // Centrer et mettre à l'échelle
                    geometry.center();
                    const box = new THREE.Box3().setFromObject(mesh);
                    const size = box.getSize(new THREE.Vector3());
                    
                    const targetSize = new THREE.Vector3(config.dims.x, config.dims.y, config.dims.z);
                    const scaleX = targetSize.x / size.x;
                    const scaleY = targetSize.y / size.y;
                    const scaleZ = targetSize.z / size.z;
                    
                    const uniformScale = Math.min(scaleX, scaleY, scaleZ);
                    if (Math.abs(uniformScale - 1) > 0.01) {
                        mesh.scale.multiplyScalar(uniformScale);
                    }
                    
                    const group = new THREE.Group();
                    group.add(mesh);
                    group.userData.elementConfig = config;
                    group.userData.isSTLFallback = true;
                    
                    resolve(group);
                },
                (progress) => {
                    // Progress callback si besoin
                },
                reject
            );
        });
    }

    createFallbackGeometry(elementName, category) {
        const config = this.elementsConfig[category]?.[elementName];
        if (!config) {
            console.error(`Configuration non trouvée pour: ${elementName}`);
            return null;
        }

        // Créer une boîte simple comme géométrie de substitution
        const geometry = new THREE.BoxGeometry(
            config.dims.x,
            config.dims.z, // Z devient la hauteur en Three.js
            config.dims.y
        );        // Déterminer l'émissivité en fonction de la couleur
        let emissiveColor, emissiveIntensity;
        
        // Si la couleur est blanche ou proche du blanc
        if (config.color === 0xFFFFFF || config.color === 0xFEFEFE || 
            config.color === 0xF0F0F0 || config.color === 0xF5F5F5) {
            emissiveColor = 0xFFFFFF;  // Émissivité blanche pour les éléments blancs
            emissiveIntensity = 0.8;   // Intensité élevée pour un blanc éclatant
        } else if (config.color === 0xCC4500) {
            // Couleur terre cuite : orange-rouge
            emissiveColor = 0x330000;  // Émissivité rouge sombre pour donner de la profondeur
            emissiveIntensity = 0.2;
        } else {
            // Pour les autres couleurs, légère émissivité basée sur la couleur
            emissiveColor = config.color;
            emissiveIntensity = 0.2;
        }
        
        const material = new THREE.MeshPhongMaterial({
            color: config.color,
            emissive: emissiveColor,
            emissiveIntensity: emissiveIntensity,
            shininess: 60,  // Augmentation de la brillance
            transparent: config.transparent || false,
            opacity: config.opacity || 1.0,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.elementConfig = config;
        mesh.userData.isFallback = true; // Marquer comme géométrie de substitution

        const group = new THREE.Group();
        group.add(mesh);
        group.userData.elementConfig = config;

        return group;
    }

    getAllElements() {
        const elements = [];
        for (const [category, items] of Object.entries(this.elementsConfig)) {
            for (const [name, config] of Object.entries(items)) {
                elements.push({
                    name,
                    category,
                    ...config
                });
            }
        }
        return elements;
    }

    getElementsByCategory(category) {
        return this.elementsConfig[category] || {};
    }

        /**
     * Créer un élément de plancher avec longueur ajustable
     * @param {string} elementName - Nom de l'élément
     * @param {string} category - Catégorie de l'élément  
     * @param {number} customLength - Longueur personnalisée en cm (optionnel)
     * @returns {Promise<THREE.Object3D>} - Modèle 3D avec la longueur ajustée
     */
    async loadScalableModel(elementName, category, customLength = null) {
        const config = this.elementsConfig[category]?.[elementName];
        if (!config || !config.scalable) {
            return this.loadModel(elementName, category);
        }

        const targetLength = customLength || config.dims.x;
        
        // Vérifier que la longueur est dans les limites
        if (targetLength < config.minLength || targetLength > config.maxLength) {
            console.warn(`Longueur ${targetLength}cm hors limites pour ${elementName} (${config.minLength}-${config.maxLength}cm)`);
            return this.loadModel(elementName, category);
        }

        const cacheKey = `${category}/${elementName}_${targetLength}cm`;
        
        // Vérifier le cache pour cette longueur spécifique
        if (this.modelCache.has(cacheKey)) {
            return this.modelCache.get(cacheKey).clone();
        }

        try {
            // Charger le modèle de base
            const baseModel = await this.loadModel(elementName, category);
            
            // Calculer l'échelle nécessaire pour la longueur
            const scaleRatio = targetLength / config.baseLength;
            
            // Appliquer l'échelle sur l'axe spécifié
            switch (config.scaleAxis) {
                case 'x':
                    baseModel.scale.x = scaleRatio;
                    break;
                case 'y':
                    baseModel.scale.y = scaleRatio;
                    break;
                case 'z':
                    baseModel.scale.z = scaleRatio;
                    break;
            }
            
            // Mettre à jour les userData avec les nouvelles dimensions
            baseModel.userData.elementConfig = {...config};
            baseModel.userData.elementConfig.dims = {...config.dims};
            baseModel.userData.elementConfig.dims[config.scaleAxis] = targetLength;
            baseModel.userData.customLength = targetLength;
            
            console.log(`Hourdis ${elementName} mis à l'échelle: longueur ${targetLength}cm (échelle ${scaleRatio})`);
            
            // Mettre en cache pour cette longueur spécifique
            this.modelCache.set(cacheKey, baseModel);
            return baseModel.clone();
            
        } catch (error) {
            console.error(`Erreur lors de la création du modèle scalable ${elementName}:`, error);
            return this.loadModel(elementName, category);
        }
    }

    /**
     * Calcule le volume d'un élément en fonction de ses dimensions
     * @param {Object} dims - Dimensions de l'élément {x, y, z} en cm
     * @returns {Object} - Volume en cm³, dm³ et m³
     */
    calculateVolume(dims) {
        const volumeCm3 = dims.x * dims.y * dims.z;
        const volumeDm3 = volumeCm3 / 1000; // 1 dm³ = 1000 cm³
        const volumeM3 = volumeCm3 / 1000000; // 1 m³ = 1000000 cm³
        
        return {
            cm3: Math.round(volumeCm3 * 100) / 100,
            dm3: Math.round(volumeDm3 * 1000) / 1000,
            m3: Math.round(volumeM3 * 1000000) / 1000000,
            formatted: this.formatVolume(volumeCm3)
        };
    }

    /**
     * Calcule les surfaces d'un élément (surface totale et surfaces par face)
     * @param {Object} dims - Dimensions de l'élément {x, y, z} en cm
     * @returns {Object} - Surfaces en cm² et m²
     */
    calculateSurfaces(dims) {
        // Surfaces de chaque face
        const surfaceXY = dims.x * dims.y; // Face avant/arrière
        const surfaceXZ = dims.x * dims.z; // Face dessus/dessous
        const surfaceYZ = dims.y * dims.z; // Face gauche/droite
        
        // Surface totale (toutes les faces)
        const surfaceTotaleCm2 = 2 * (surfaceXY + surfaceXZ + surfaceYZ);
        const surfaceTotaleM2 = surfaceTotaleCm2 / 10000; // 1 m² = 10000 cm²
        
        return {
            faces: {
                xy: Math.round(surfaceXY * 100) / 100, // Face avant/arrière
                xz: Math.round(surfaceXZ * 100) / 100, // Face dessus/dessous
                yz: Math.round(surfaceYZ * 100) / 100  // Face gauche/droite
            },
            totale: {
                cm2: Math.round(surfaceTotaleCm2 * 100) / 100,
                m2: Math.round(surfaceTotaleM2 * 10000) / 10000
            },
            formatted: this.formatSurface(surfaceTotaleCm2)
        };
    }    /**
     * Formate le volume avec l'unité appropriée (privilégier m³)
     * @param {number} volumeCm3 - Volume en cm³
     * @returns {string} - Volume formaté avec unité
     */
    formatVolume(volumeCm3) {
        // Toujours afficher en m³ pour les éléments de construction
        const volumeM3 = volumeCm3 / 1000000;
        return `${Math.round(volumeM3 * 100000) / 100000} m³`;
    }

    /**
     * Formate la surface avec l'unité appropriée (privilégier m²)
     * @param {number} surfaceCm2 - Surface en cm²
     * @returns {string} - Surface formatée avec unité
     */
    formatSurface(surfaceCm2) {
        // Toujours afficher en m² pour les éléments de construction
        const surfaceM2 = surfaceCm2 / 10000;
        return `${Math.round(surfaceM2 * 10000) / 10000} m²`;
    }

    /**
     * Calcule les propriétés géométriques complètes d'un élément
     * @param {string} elementName - Nom de l'élément
     * @param {string} category - Catégorie de l'élément
     * @param {Object} customDims - Dimensions personnalisées (optionnel)
     * @returns {Object} - Propriétés géométriques complètes
     */
    calculateElementProperties(elementName, category, customDims = null) {
        const config = this.elementsConfig[category]?.[elementName];
        if (!config) {
            console.warn(`Configuration non trouvée pour: ${elementName} dans ${category}`);
            return null;
        }

        // Utiliser les dimensions personnalisées ou celles de la configuration
        const dims = customDims || config.dims;
        
        const volume = this.calculateVolume(dims);
        const surfaces = this.calculateSurfaces(dims);
        
        return {
            name: elementName,
            category: category,
            dimensions: {
                x: dims.x,
                y: dims.y,
                z: dims.z,
                formatted: `${dims.x}×${dims.y}×${dims.z} cm`
            },
            volume: volume,            surfaces: surfaces,
            isScalable: config.scalable || false,
            // Calculs spéciaux pour les éléments de construction
            utilisationTypique: this.getTypicalUsage(category, dims)
        };
    }    /**
     * Retourne l'utilisation typique d'un élément selon sa catégorie et ses dimensions
     * @param {string} category - Catégorie de l'élément
     * @param {Object} dims - Dimensions de l'élément
     * @param {number} selectedLength - Longueur sélectionnée par l'utilisateur (optionnel)
     * @returns {string} - Description de l'utilisation typique
     */    getTypicalUsage(category, dims, selectedLength = null) {        switch (category) {            case 'briques':
                return `Mur de parement - Épaisseur ${dims.y}cm`;
            case 'blocs':
                if (dims.y < 11) return `Mur de cloison - Épaisseur ${dims.y}cm`;
                return `Mur porteur - Épaisseur ${dims.y}cm`;            case 'planchers':
                // Pour les planchers, la longueur variable est sur l'axe Z (profondeur)
                // Utiliser la longueur sélectionnée si disponible, sinon la dimension Z par défaut
                const longueur = selectedLength !== null ? selectedLength : dims.z;
                return `Plancher béton - Longueur ${longueur}cm`;
            case 'poutres':
                // Pour les poutres, la longueur variable est sur l'axe Y
                const longueurPoutre = selectedLength !== null ? selectedLength : dims.y;
                return `Poutre métallique - Longueur ${longueurPoutre}cm`;
            case 'isolants':
                return `Isolation thermique - Épaisseur ${dims.y}cm`;
            case 'linteaux':
                return `Linteau porteur - Portée ${dims.x}cm`;
            default:
                return 'Élément de construction';
        }
    }
}

