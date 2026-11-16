import { createRouter, createWebHistory } from 'vue-router'

import Home from '../components/home/index.vue'
import Login from '../components/login/index.vue'

/**
 * 路由表
 * 每个对象是一条路由规则：
 *   path      → 浏览器地址栏的路径
 *   component → 匹配到这个路径时，渲染哪个组件
 *   redirect  → 访问某个路径时自动跳转到另一个路径
 */
const router = createRouter({
  // createWebHistory：使用 HTML5 History 模式，URL 是干净的 /login、/home（不带 #）
  // 另一种 createWebHashHistory：URL 是 /#/login 这种带 # 的，部署时不需要服务器额外配置
  history: createWebHistory(),

  routes: [
    // 访问根路径 / 时，自动跳到 /home
    { path: '/', redirect: '/home' },
    { path: '/home', component: Home },
    { path: '/login', component: Login },
  ],
})

export default router
