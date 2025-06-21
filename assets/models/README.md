# Bibliothèque de modèles 3D

Ce dossier contient tous les modèles 3D au format GLB utilisés dans la bibliothèque d'éléments de construction.

## Structure des dossiers

- **briques/** - Modèles de briques (M50, M57, M65, M90, WF, WFD, etc.)
- **blocs/** - Modèles de blocs (B9, B14, B19, B29, Argex, béton cellulaire, etc.)
- **linteaux/** - Modèles de linteaux béton (L100 à L500)
- **isolants/** - Modèles d'isolants (PUR5, PUR6, PUR7, etc.)
- **planchers/** - Modèles de planchers et hourdis
- **autres/** - Autres éléments (profils, vides, etc.)

## Convention de nommage

Les fichiers GLB doivent suivre cette convention :
- Nom en minuscules
- Remplacer les espaces par des tirets
- Inclure les dimensions si pertinent

Exemples :
- `brique-m50.glb`
- `bloc-b14.glb`
- `linteau-l120.glb`
- `isolant-pur5.glb`

## Ajout de nouveaux modèles

1. Créer ou exporter votre modèle au format GLB
2. Nommer le fichier selon la convention
3. Placer le fichier dans le dossier de catégorie approprié
4. Mettre à jour la configuration dans `ElementsLibrary.js`

## Optimisation des modèles

Pour de meilleures performances :
- Taille recommandée : < 1MB par modèle
- Utiliser la compression GLB (binaire)
- Réduire le nombre de polygones si possible
- Optimiser les textures (max 1024x1024)
