import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      meta: { title: '首頁' },
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/tools/rune-force-calculator',
      name: 'RuneForce',
      meta: { title: '符文力量計算機' },
      component: () => import('@/views/ToolView/RuneForceView.vue')
    }
  ]
})

router.beforeEach((to, from, next) => {
  window.document.title = to.meta.title + ' - 楓之谷工具箱'
  next()
})

export default router
