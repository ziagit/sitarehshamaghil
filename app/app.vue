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

        <div class="flex items-center gap-2">
          <nav class="hidden items-center gap-3 md:flex">
            <NuxtLink href="/" class="nav-link">Home</NuxtLink>
            <NuxtLink href="/gallery" class="nav-link">Gallery</NuxtLink>
            <NuxtLink href="/image-generator" class="nav-link">Image Generator</NuxtLink>
            <NuxtLink href="/text-to-speech" class="nav-link">Text to Speech</NuxtLink>
            <NuxtLink href="/privacy" class="nav-link">Privacy</NuxtLink>
          </nav>

          <button
            type="button"
            class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2.5 text-slate-100 transition hover:bg-white/10 md:hidden"
            :aria-expanded="isMenuOpen"
            aria-label="Toggle navigation"
            @click="isMenuOpen = !isMenuOpen"
          >
            <svg v-if="!isMenuOpen" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="isMenuOpen" class="border-t border-white/10 bg-slate-950/95 px-4 py-4 md:hidden">
        <nav class="flex flex-col gap-2">
          <NuxtLink href="/" class="mobile-nav-link" @click="isMenuOpen = false">Home</NuxtLink>
          <NuxtLink href="/gallery" class="mobile-nav-link" @click="isMenuOpen = false">Gallery</NuxtLink>
          <NuxtLink href="/image-generator" class="mobile-nav-link" @click="isMenuOpen = false">Image Generator</NuxtLink>
          <NuxtLink href="/text-to-speech" class="mobile-nav-link" @click="isMenuOpen = false">Text to Speech</NuxtLink>
          <NuxtLink href="/privacy" class="mobile-nav-link" @click="isMenuOpen = false">Privacy</NuxtLink>
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
          <NuxtLink href="/image-generator" class="footer-link">Image Generator</NuxtLink>
          <NuxtLink href="/text-to-speech" class="footer-link">Text to Speech</NuxtLink>
          <NuxtLink href="/" class="footer-link">Home</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const isMenuOpen = ref(false)
const route = useRoute()

watch(() => route.fullPath, () => {
  isMenuOpen.value = false
})
</script>

<style scoped>
.site-shell {
  background: #020617;
}

.brand-mark {
  text-decoration: none;
}

.nav-link,
.mobile-nav-link,
.footer-link {
  border-radius: 999px;
  padding: 0.55rem 0.9rem;
  text-decoration: none;
  color: #cbd5e1;
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.nav-link:hover,
.mobile-nav-link:hover,
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
