/** Vue Router — 桌宠应用路由配置 */

import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomePage.vue')
  },
  {
    path: '/model',
    name: 'model',
    component: () => import('../views/ModelPanel.vue')
  },
  {
    path: '/voice',
    name: 'voice',
    component: () => import('../views/VoicePanel.vue')
  },
  {
    path: '/expression',
    name: 'expression',
    component: () => import('../views/ExpressionPanel.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
