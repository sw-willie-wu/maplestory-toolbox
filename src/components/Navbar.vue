<template>
  <div>
    <nav class="navbar navbar-expand-xl fixed-up">
      <ul class="navbar-nav">
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">職業介紹</a>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" href="/jobs/冒險家">冒險家</a></li>
            <li><a class="dropdown-item" href="/jobs/英雄團">英雄團</a></li>
            <li><a class="dropdown-item" href="/jobs/末日反抗軍">末日反抗軍</a></li>
            <li><a class="dropdown-item" href="/jobs/皇家騎士團">皇家騎士團</a></li>
            <li><a class="dropdown-item" href="/jobs/雷普族">雷普族</a></li>
            <li><a class="dropdown-item" href="/jobs/超新星">超新星</a></li>
            <li><a class="dropdown-item" href="/jobs/曉之陣">曉之陣</a></li>
            <li><a class="dropdown-item" href="/jobs/好友世界">好友世界</a></li>
            <li><a class="dropdown-item" href="/jobs/登貝伊">登貝伊</a></li>
            <li><a class="dropdown-item" href="/jobs/時間超越者">時間超越者</a></li>
            <li><a class="dropdown-item" href="/jobs/阿尼瑪族">阿尼瑪族</a></li>
            <li><a class="dropdown-item" href="/jobs/武神">武神</a></li>
          </ul>
        </li>
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">各式工具</a>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" href="/tools/rune-force-calculator">符文力量計算機</a></li>
            <li><a class="dropdown-item" href="/tools/star-reel-calculator">星力卷軸計算機</a></li>
          </ul>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup>
</script>

<style lang="scss" scoped>
.navbar {
  background-color: rgb(40, 50, 65);
  min-height: 42px;
  z-index: 100;
  padding: 0;
}

.nav-link {
  color: rgb(220, 220, 220);
}
</style>
