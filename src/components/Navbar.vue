<script setup lang="ts">
import SearchIcon from './icons/IconSearch.vue'
import CaretDownIcon from './icons/IconCaretDown.vue'
</script>

<template>
  <div>
    <nav class="navbar navbar-expand-lg fixed-top navbar-dark">
      <div class="container-lg">
        <a class="navbar-brand" href="/"><img class="icon-brand" src="@/assets/img/brand.png" /></a>
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
            <li class="nav-item dropdown me-2">
              <a
                class="nav-link dropdown-toggle underline"
                href="#"
                id="navbarDropdown"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                實用工具 <CaretDownIcon />
              </a>
              <ul class="dropdown-menu" aria-labelledby="navbarDropdown">
                <li>
                  <a class="dropdown-item" href="/tools/rune-force-calculator">符文力量計算機</a>
                </li>
                <li><a class="dropdown-item" href="#">裝備強化計算機</a></li>
                <li><a class="dropdown-item" href="#">六轉矩陣計算機</a></li>
              </ul>
            </li>
            <li class="nav-item dropdown me-2">
              <a
                class="nav-link dropdown-toggle underline"
                href="#"
                id="navbarDropdown"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                最新活動 <CaretDownIcon />
              </a>
              <ul class="dropdown-menu" aria-labelledby="navbarDropdown">
                <li><a class="dropdown-item" href="#">黃金蘋果</a></li>
                <li><a class="dropdown-item" href="#">皇家美容院</a></li>
                <li><a class="dropdown-item" href="#">時尚隨機箱</a></li>
                <li><a class="dropdown-item" href="#">萌獸卡牌包</a></li>
                <li><a class="dropdown-item" href="#">寵物隨機箱</a></li>
                <li><hr class="dropdown-divider" /></li>
                <li>
                  <a class="dropdown-item" href="#">當期活動</a>
                </li>
              </ul>
            </li>
            <li class="nav-item dropdown me-2">
              <a
                class="nav-link dropdown-toggle underline"
                href="#"
                id="navbarDropdown"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                相關連結 <CaretDownIcon />
              </a>
              <ul class="dropdown-menu" aria-labelledby="navbarDropdown">
                <li>
                  <a
                    class="dropdown-item"
                    href="https://maplestory.beanfun.com/main"
                    target="_blank"
                  >
                    遊戲官網
                  </a>
                </li>
                <li>
                  <a
                    class="dropdown-item"
                    href="https://www.facebook.com/www.maplestory.msfans.com.tw"
                    target="_blank"
                  >
                    FB粉絲團
                  </a>
                </li>
                <li>
                  <a
                    class="dropdown-item"
                    href="https://forum.gamer.com.tw/B.php?bsn=7650"
                    target="_blank"
                  >
                    巴哈討論區
                  </a>
                </li>
              </ul>
            </li>
          </ul>
          <form class="d-flex">
            <input
              class="form-control me-2 input-search"
              type="search"
              placeholder="輸入關鍵字以搜尋"
              aria-label="Search"
            />
            <button class="btn btn-search text-nowrap" type="submit"><SearchIcon /> 搜尋</button>
          </form>
        </div>
      </div>
    </nav>
  </div>
</template>

<style lang="scss" scoped>
.input-search {
  min-width: 230px;
}

.icon-brand {
  max-height: 23px;
  margin-bottom: 0.2em;
}

nav {
  &.navbar {
    background-color: var(--color-navbar);
    min-height: 42px;
    padding: 0;
    box-shadow: 0 4px 8px 0 var(--color-shadow);
  }

  li {
    &.nav-item {
      cursor: pointer;
      &:hover,
      &:focus,
      &:active {
        .nav-link {
          color: var(--color-white);
        }
      }
    }

    a {
      &.nav-link {
        color: var(--color-white-soft);
        font-weight: bold;
      }
      &.dropdown-item {
        &:hover {
          color: var(--color-white);
          background-color: var(--color-navbar-soft);
        }
      }
      &.underline {
      position: relative;

        &:after {
          transition: all .3s;
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          margin: auto;
          width: 0%;
          border: none;
          content: '';
          color: transparent;
          background: white;
          height: .15rem;
        }
      }
    }
  }
}

.btn-search {
  color: var(--color-white-soft);
  font-weight: bold;
  background-color: rgb(33, 155, 166);
  border: none;
  &:hover {
    background-color: rgb(44, 174, 186);
  }
  &:focus {
    color: var(--color-white-soft);
    background-color: rgb(39, 148, 158);
  }
}

.navbar-toggler {
  color: var(--color-white-soft);
  box-shadow: none;
  border: none;
  margin-right: -1rem;
}

@media (min-width: 992px) {
  a {
    &.nav-link {
      pointer-events: none;
    }
  }
  
  .dropdown {
    &:hover {
      .dropdown-menu {
        display: block;
        margin-top: 1px;
        margin-left: -2rem;
        padding: 0.2rem 0;
        border-radius: 0;
        border: 0;
        box-shadow: 4px 4px 8px var(--color-shadow);
      }
      .underline {
        &:after {
          width: 100%;
        }
      }
    }
  }
}

@media (max-width: 992px) {
  form {
    margin-bottom: .3rem;
  }
  .dropdown-menu {
    margin-right: -0.5rem;
    // border-radius: 0;
    border: 0;
  }
}
</style>