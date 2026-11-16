<script setup lang="ts">
// 登录页组件
// 这里目前是基础占位，后续可以在这里加表单校验、调用登录接口等逻辑
</script>

<template>
  <div class="login">
    <h1>登录</h1>

    <!-- 基础登录表单，目前只是静态占位，还没绑定任何逻辑 -->
    <form>
      <input type="text" placeholder="用户名" />
      <input type="password" placeholder="密码" />
      <button type="submit">登录</button>
    </form>

    <!-- router-link 是声明式跳转，等价于 <a>，但不会整页刷新 -->
    <router-link to="/home">返回首页</router-link>
  </div>
</template>

<style scoped>
.login {
  max-width: 320px;
  margin: 0 auto;
  padding: 40px 20px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: #42b883;
  color: #fff;
  cursor: pointer;
}
</style>
