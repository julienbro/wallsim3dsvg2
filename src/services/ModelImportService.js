import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const loader = new GLTFLoader();

export const importGLBModel = async (file) => {
  return new Promise((resolve, reject) => {
    loader.load(
      URL.createObjectURL(file),
      (gltf) => {
        // Ajuster l'orientation par défaut du modèle
        if (gltf.scene) {
          // Orienter le modèle pour qu'il soit dans le plan XY
          gltf.scene.rotation.x = 0;
          gltf.scene.rotation.y = 0;
          gltf.scene.rotation.z = 0;

          // Résoudre la promesse avec le modèle chargé
          resolve(gltf);
        } else {
          reject(new Error('Aucune scène trouvée dans le modèle GLB.'));
        }
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
};