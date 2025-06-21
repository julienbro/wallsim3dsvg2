<template>
  <div class="cad-viewer">
    <!-- CAD Viewer Template -->
  </div>
</template>

<script>
export default {
  name: "CADViewer",
  props: {
    // Component props
  },
  data() {
    return {
      // Component data
    };
  },
  methods: {
    addObjectToScene(object) {
      if (object) {
        // S'assurer que l'objet est orienté correctement dans le plan XY
        object.rotation.x = 0;
        object.rotation.y = 0;
        // La rotation Z est préservée depuis l'import

        this.scene.add(object);
        // ...existing code...
      }
    },
    // ...existing methods...
  },
  mounted() {
    // Component mounted logic
  },
};
</script>

<style scoped>
.cad-viewer {
  /* CAD Viewer styles */
}
</style>