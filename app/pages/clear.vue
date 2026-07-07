<template>
  <main class="min-h-screen overflow-hidden bg-[#0e1020] text-white">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.28),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_35%)]"></div>
    <div class="relative mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <div class="w-full rounded-3xl border border-white/10 bg-white/6 p-8 shadow-2xl backdrop-blur-xl md:p-12">
        <p class="text-sm uppercase tracking-[0.35em] text-sky-200/70">Reset Console</p>
        <h1 class="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          Clearing chat state...
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-white/75 md:text-lg">
          This page wipes all stored chat history, moderation flags, and cooldowns.
          Anyone who was blocked will be able to chat again after the reset finishes.
        </p>

        <div class="mt-10 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div class="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div class="flex items-center gap-3">
              <span
                class="inline-flex h-3 w-3 rounded-full"
                :class="statusDotClass"
              ></span>
              <span class="text-sm font-medium uppercase tracking-[0.25em] text-white/60">
                {{ statusLabel }}
              </span>
            </div>
            <p class="mt-4 text-lg leading-7 text-white/90">
              {{ statusMessage }}
            </p>
          </div>

          <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p class="text-sm text-white/60">What gets cleared</p>
            <ul class="mt-3 space-y-2 text-sm leading-6 text-white/80">
              <li>Chat history for every user</li>
              <li>Moderation warnings and blocks</li>
              <li>Error cooldown state</li>
            </ul>
          </div>
        </div>

        <div class="mt-8 flex flex-wrap gap-3">
          <button
            class="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loading"
            @click="runClear"
          >
            {{ loading ? 'Clearing...' : 'Run reset again' }}
          </button>
          <RouterLink
            to="/"
            class="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Back home
          </RouterLink>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
const loading = ref(false)
const done = ref(false)
const failed = ref(false)

const statusLabel = computed(() => {
  if (loading.value) return 'Working'
  if (failed.value) return 'Reset failed'
  if (done.value) return 'Reset complete'
  return 'Ready'
})

const statusMessage = computed(() => {
  if (loading.value) return 'Please wait a moment while I clear the stored state.'
  if (failed.value) return 'I could not clear the storage. Check the server logs and try again.'
  if (done.value) return 'All stored chat state has been cleared successfully.'
  return 'Visiting this page will clear the stored chat state automatically.'
})

const statusDotClass = computed(() => {
  if (loading.value) return 'bg-amber-300'
  if (failed.value) return 'bg-rose-400'
  if (done.value) return 'bg-emerald-400'
  return 'bg-sky-400'
})

async function runClear() {
  loading.value = true
  failed.value = false

  try {
    await $fetch('/api/clear', { method: 'POST' })
    done.value = true
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  runClear()
})

useHead({
  title: 'Clear Chat State',
})
</script>
