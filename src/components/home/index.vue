<script setup lang="ts">
// 首页组件
// 项目默认入口，展示欢迎信息并提供到登录页的跳转
</script>

<template>
  <div class="home">
    <h1>首页</h1>
    <p>欢迎来到 Vue3 + Vite + TS 项目</p>

    <!-- router-link 声明式跳转到登录页 -->
    <router-link to="/login">去登录</router-link>
  </div>
</template>

<style scoped>
.home {
  text-align: center;
  padding: 60px 20px;
}
</style>
