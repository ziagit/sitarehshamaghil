<template>
  <div class="site-shell min-h-screen text-slate-100">
    <header class="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <NuxtLink href="/" class="brand-mark flex items-center gap-3">
          <img
            src="/sitara.jpg"
            alt="Sitara logo"
            class="h-10 w-10 rounded-2xl object-cover ring-1 ring-white/10"
          />
          <div>
            <p class="text-sm font-semibold tracking-[0.24em] text-slate-200 uppercase">SitarehShamAghil</p>
            <p class="text-xs text-slate-400">Messenger assistant and helpful replies</p>
          </div>
        </NuxtLink>

        <nav class="hidden items-center gap-3 sm:flex">
          <NuxtLink href="/" class="nav-link">Home</NuxtLink>
          <NuxtLink href="/privacy" class="nav-link">Privacy</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="relative">
      <NuxtPage />
    </main>

    <footer class="border-t border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 SitarehShamAghil. All rights reserved.</p>
        <div class="flex items-center gap-4">
          <NuxtLink href="/privacy" class="footer-link">Privacy Policy</NuxtLink>
          <NuxtLink href="/" class="footer-link">Home</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// No script needed for static layout
</script>

<style scoped>
.site-shell {
  background: #020617;
}

.brand-mark {
  text-decoration: none;
}

.nav-link,
.footer-link {
  border-radius: 999px;
  padding: 0.55rem 0.9rem;
  text-decoration: none;
  color: #cbd5e1;
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.nav-link:hover,
.footer-link:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  transform: translateY(-1px);
}

:global(body) {
  margin: 0;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}
</style>
