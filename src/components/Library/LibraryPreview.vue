<template>
  <div class="library-preview">
    <img v-if="!show3D" :src="previewSrc" class="static-preview" @mouseenter="show3DPreview" />
    <div v-else class="model-viewer" ref="modelViewerRef" @mouseleave="hide3DPreview"></div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

export default {
  name: 'LibraryPreview',
  props: {
    modelPath: {
      type: String,
      required: true,
    },
    previewSrc: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const modelViewerRef = ref(null);
    const show3D = ref(false);
    let viewer = null;
    let scene = null;
    let camera = null;
    let animateId = null;
    let modelRef = null;

    const show3DPreview = () => {
      show3D.value = true;
      // Initialisation du visualiseur de modèle
      viewer = new window.THREE.WebGLRenderer({ antialias: true });
      viewer.setSize(200, 200); // Taille fixe ou dynamique selon besoin
      modelViewerRef.value.appendChild(viewer.domElement);

      scene = new window.THREE.Scene();
      camera = new window.THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      camera.position.z = 5;

      const light = new window.THREE.DirectionalLight(0xffffff, 1);
      light.position.set(0, 1, 1).normalize();
      scene.add(light);

      const loader = new window.THREE.GLTFLoader();
      loader.load(
        props.modelPath,
        (gltf) => {
          modelRef = gltf.scene;
          scene.add(modelRef);
          animate();
        },
        undefined,
        (error) => {
          console.error('Erreur lors du chargement du modèle GLB.', error);
        }
      );

      const animate = () => {
        if (modelRef) {
          modelRef.rotation.z += 0.01;
        }
        viewer.render(scene, camera);
        animateId = requestAnimationFrame(animate);
      };
    };

    const hide3DPreview = () => {
      show3D.value = false;
      if (animateId) cancelAnimationFrame(animateId);
      if (viewer && viewer.domElement && modelViewerRef.value) {
        modelViewerRef.value.removeChild(viewer.domElement);
      }
      viewer = null;
      scene = null;
      camera = null;
      modelRef = null;
      animateId = null;
    };

    onBeforeUnmount(() => {
      hide3DPreview();
    });

    return {
      modelViewerRef,
      show3D,
      show3DPreview,
      hide3DPreview,
    };
  },
};
</script>

<style scoped>
.library-preview {
  width: 100%;
  height: 100%;
  position: relative;
}
.static-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
}
.model-viewer {
  width: 100%;
  height: 100%;
}
</style>