<template>
  <div>
    <!-- <nav class="navbar navbar-expand-xl fixed-up">
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
    </nav> -->
    <nav class="navbar navbar-expand-lg fixed-top">
      <div class="container-lg">
        <a class="navbar-brand" href="#">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="currentColor"
            class="bi bi-house-fill"
            viewBox="0 0 16 16"
          >
            <path
              d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L8 2.207l6.646 6.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293z"
            />
            <path
              d="m8 3.293 6 6V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V9.293z"
            />
          </svg>
        </a>
        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <a class="nav-link active" aria-current="page" href="#">Home</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#">Link</a>
            </li>
            <li class="nav-item dropdown">
              <a
                class="nav-link dropdown-toggle"
                href="#"
                id="navbarDropdown"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                小工具
              </a>
              <ul class="dropdown-menu" aria-labelledby="navbarDropdown">
                <li><a class="dropdown-item" href="#">Action</a></li>
                <li><a class="dropdown-item" href="#">Another action</a></li>
                <li><hr class="dropdown-divider" /></li>
                <li>
                  <a class="dropdown-item" href="#">Something else here</a>
                </li>
              </ul>
            </li>
            <li class="nav-item">
              <a
                class="nav-link disabled"
                href="#"
                tabindex="-1"
                aria-disabled="true"
                >Disabled</a
              >
            </li>
          </ul>
          <form class="d-flex">
            <input
              class="form-control me-2"
              type="search"
              placeholder="輸入關鍵字以搜尋"
              aria-label="Search"
            />
            <button class="btn btn-info" type="submit">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                class="bi bi-search"
                viewBox="0 0 16 16"
              >
                <path
                  d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"
                />
              </svg>
              搜尋
            </button>
          </form>
        </div>
      </div>
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
.navbar-brand {
  color: rgb(220, 220, 220);
}
.nav-link {
  color: rgb(220, 220, 220);
}
</style>
