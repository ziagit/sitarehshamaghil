<template>
  <div class="site-shell min-h-screen text-slate-900">
    <header class="sticky top-0 z-20 border-b border-white/40 bg-white/70 backdrop-blur-xl">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <NuxtLink href="/" class="brand-mark flex items-center gap-3">
          <span class="brand-orb flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold text-white">
            S
          </span>
          <div>
            <p class="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">SitarehShamAghil</p>
            <p class="text-xs text-slate-500">Hazaragi culture and chat</p>
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

    <footer class="border-t border-white/40 bg-white/70 backdrop-blur-xl">
      <div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
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
  background:
    radial-gradient(circle at top left, rgba(255, 184, 145, 0.45), transparent 30%),
    radial-gradient(circle at top right, rgba(168, 85, 247, 0.18), transparent 25%),
    linear-gradient(180deg, #fffaf6 0%, #f7f5f1 48%, #f4f7fb 100%);
}

.brand-mark {
  text-decoration: none;
}

.brand-orb {
  background: linear-gradient(135deg, #ea580c 0%, #c2410c 55%, #7c2d12 100%);
  box-shadow: 0 16px 32px rgba(194, 65, 12, 0.25);
}

.nav-link,
.footer-link {
  border-radius: 999px;
  padding: 0.55rem 0.9rem;
  text-decoration: none;
  color: #475569;
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.nav-link:hover,
.footer-link:hover {
  background: rgba(255, 255, 255, 0.8);
  color: #0f172a;
  transform: translateY(-1px);
}

:global(body) {
  margin: 0;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}
</style>
