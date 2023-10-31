import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/About.vue')
  },
  {
    path: '/tools/rune-force-calculator',
    name: 'RuneForce',
    meta: { title: '符文力量計算機' },
    component: () => import('../views/rune_force.vue')
  },
  {
    path: '/tools/star-reel-calculator',
    name: 'StarReel',
    meta: { title: '星力卷軸計算機' },
    component: () => import('../views/star_reel.vue')
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  window.document.title = to.meta.title + ' - 楓之谷工具箱'
  next()
})

export default router
