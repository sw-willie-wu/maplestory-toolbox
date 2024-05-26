<script setup lang="ts">
import Navbar from './components/Navbar.vue'
import Footer from './components/Footer.vue'
</script>

<template>
  <div class="wrapper">
    <Navbar />
    <div class="container-lg content">
      <RouterView />
    </div>
    <Footer class="stick-bottom"></Footer>
  </div>
</template>

<style lang="scss" scoped>
.wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.content {
  margin-top: 60px;
}
.stick-bottom {
  margin-top: auto;
}
</style>