import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

// use(router) 把路由注入整个应用，之后所有组件里都能用 <router-view> / <router-link>
createApp(App).use(router).mount('#app')
