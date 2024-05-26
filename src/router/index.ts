import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import RuneForceView from '@/views/ToolView/RuneForceView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      meta: { title: '首頁' },
      component: HomeView
    },
    {
      path: '/tools/rune-force-calculator',
      name: 'RuneForce',
      meta: { title: '符文力量計算機' },
      component: RuneForceView
    },
  ]
})

router.beforeEach((to, from, next) => {
  window.document.title = to.meta.title + ' - 楓之谷工具箱'
  next()
})

export default router
