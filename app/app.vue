<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- Optional header -->
    <header class="bg-white shadow p-4">
      <h1 class="text-xl font-bold text-center">SitarehShamAghil</h1>
    </header>

    <!-- Page content -->
    <NuxtPage />

    <!-- Optional footer -->
    <footer class="bg-white shadow-inner p-4 mt-8 text-center text-sm text-gray-500">
      © 2026 SitarehShamAghil. All rights reserved.
      <NuxtLink href="/privacy" class="text-blue-600 underline">Privacy Policy</NuxtLink>
    </footer>
  </div>
</template>

<script setup lang="ts">
// No script needed for static layout
</script>

<style scoped>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
</style>