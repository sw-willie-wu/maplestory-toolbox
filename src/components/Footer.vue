<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <div>
    <footer class="text-center m-4">
      Copyright © 2024–{{ year }} MapleStoryToolbox
      <br>
      <small>Data based on NEXON Open API · 遊戲素材版權屬 © NEXON / 遊戲橘子所有</small>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
footer {
  font-size: 0.9rem;
  color: var(--color-black-soft);
}
</style>
