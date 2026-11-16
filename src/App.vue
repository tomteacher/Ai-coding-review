<script setup lang="ts">
// 根组件只负责提供路由出口，具体渲染哪个页面由 router 决定
</script>

<template>
  <!-- router-view 是路由出口：当前匹配到哪个路由，就把哪个组件渲染在这里 -->
  <router-view />
</template>
