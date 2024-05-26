<template>
  <Navbar />
  <div class="container content">
    <router-view />
  </div>
  <Footer />
</template>

<script setup>
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'
</script>

<style lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300&display=swap');

html {
  height: 100%;
  margin: 0;
}

body {
  height: 100%;
  background: linear-gradient(270deg, rgb(240, 245, 250), rgb(186, 200, 222));
}

select {
  appearance: none;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='50' fill='gray'><polygon points='0,0 100,0 50,50'/></svg>") no-repeat;

  background: {
    size: 10px;
    position: calc(100% - 4px) center;
    repeat: no-repeat;
    color: white;
  }
}

#app {
  height: 100%;
  font-size: 16px;
  font-family: 'Noto Sans TC', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.container {
  max-width: 1600px;

  &.content {
    padding-top: 70px;
    min-height: 88%;
  }
}

.card {
  &.custom-card {
    background-color: transparent;
    border: 0;
  }

}

.card-content {
  padding: 1rem 1.5rem;
  background-color: rgb(249, 251, 255);

  &.mid {
    padding: 0.7rem 1.5rem;
  }

  >hr {
    margin: .5rem 0;
  }
}
</style>
