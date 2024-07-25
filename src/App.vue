<script setup lang="ts">
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'
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

<style lang="scss">
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

.card {
  //box-shadow: 2px 2px 8px 0 var(--color-shadow);
  background-color: var(--color-card);
  border: 0;

  .card-content {
    padding: 1rem;

    .input-sm {
      width: 5rem;
      margin-left: -2rem;
    }

    .icon {
      height: 2rem;
      padding-right: .5rem;
      margin-top: -5px;
    }

    .label-text {
      padding-left: .5rem;
    }

    hr {
      margin: .5rem 0;
    }
  }
}
</style>