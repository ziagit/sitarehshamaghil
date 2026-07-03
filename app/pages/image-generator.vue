<template>
  <main class="relative isolate overflow-hidden">
    <div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(56,189,248,0.16),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#07111f_50%,_#0f172a_100%)]"></div>
    <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]"></div>

    <section class="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
      <div class="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div class="max-w-2xl">
          <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 shadow-lg shadow-black/10 backdrop-blur">
            <span class="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.9)]"></span>
            Image generation with Pollinations
          </div>

          <h1 class="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            Turn a prompt into an image
          </h1>

          <p class="mt-5 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            Type a short description, hit generate, and this page will load an AI image using Pollinations.
            It is intentionally simple so we can expand it later without touching unrelated parts of the app.
          </p>

          <div class="mt-8 grid gap-4 sm:grid-cols-3">
            <div class="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/10 backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Step 1</p>
              <p class="mt-3 text-sm leading-6 text-slate-200">Enter a prompt</p>
            </div>
            <div class="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/10 backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Step 2</p>
              <p class="mt-3 text-sm leading-6 text-slate-200">Generate the image</p>
            </div>
            <div class="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/10 backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Step 3</p>
              <p class="mt-3 text-sm leading-6 text-slate-200">Preview the result</p>
            </div>
          </div>

          <div class="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/10 backdrop-blur sm:p-8">
            <form class="space-y-4" @submit.prevent="generateImage">
              <label for="prompt" class="block text-sm font-semibold text-slate-200">Prompt</label>
              <textarea
                id="prompt"
                v-model="prompt"
                rows="5"
                class="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 text-base leading-7 text-white placeholder:text-slate-500 shadow-inner shadow-black/20 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="Example: a cinematic fox walking through a neon forest at night, highly detailed"
              />

              <div class="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  :disabled="!prompt.trim() || isGenerating"
                  class="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-300 disabled:hover:translate-y-0"
                >
                  {{ isGenerating ? 'Generating...' : 'Generate image' }}
                </button>

                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
                  @click="loadExample('a glossy product photo of a futuristic desk lamp, studio lighting, dark background')"
                >
                  Use example
                </button>
              </div>
            </form>

            <div class="mt-6">
              <p v-if="errorMessage" class="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">
                {{ errorMessage }}
              </p>
              <p v-else class="text-sm leading-6 text-slate-400">
                The image is fetched directly from Pollinations once you submit a prompt.
              </p>
            </div>
          </div>
        </div>

        <div class="relative lg:pt-2">
          <div class="absolute -left-6 top-10 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl"></div>
          <div class="absolute -right-2 bottom-12 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl"></div>

          <div class="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-[0_32px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <div class="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Preview</p>
                <p class="mt-1 text-lg font-bold text-white">Generated image</p>
              </div>
              <div class="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                {{ hasGenerated ? 'Ready' : 'Idle' }}
              </div>
            </div>

            <div class="p-6">
              <div class="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/70">
                <div v-if="!imageUrl" class="flex min-h-[24rem] items-center justify-center px-6 py-10 text-center">
                  <div class="max-w-sm">
                    <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
                      <span class="text-2xl">✦</span>
                    </div>
                    <p class="mt-5 text-lg font-semibold text-white">Your image will appear here</p>
                    <p class="mt-2 text-sm leading-6 text-slate-400">
                      Enter a prompt on the left and generate to see the result.
                    </p>
                  </div>
                </div>

                <div v-else class="bg-slate-950/70 p-3">
                  <img
                    :key="imageUrl"
                    :src="imageUrl"
                    :alt="prompt"
                    class="h-auto w-full rounded-[1.15rem] object-cover"
                    @load="isGenerating = false"
                    @error="handleImageError"
                  />
                </div>
              </div>

              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                <div class="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Current prompt</p>
                  <p class="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">
                    {{ prompt || 'No prompt yet' }}
                  </p>
                </div>
                <div class="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Endpoint</p>
                  <p class="mt-2 text-sm leading-6 text-slate-200">
                    Pollinations image generation URL
                  </p>
                </div>
              </div>

              <div class="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 transition hover:bg-white/10"
                  @click="loadExample('an abstract gold and teal poster with flowing shapes, modern, high contrast')"
                >
                  Abstract poster
                </button>
                <button
                  type="button"
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 transition hover:bg-white/10"
                  @click="loadExample('a cozy reading nook by a rainy window, moody light, realistic')"
                >
                  Cozy scene
                </button>
                <button
                  type="button"
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 transition hover:bg-white/10"
                  @click="loadExample('a futuristic motorcycle parked under neon signs in the rain, ultra detailed')"
                >
                  Neon bike
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
const prompt = ref('')
const imageUrl = ref('')
const isGenerating = ref(false)
const hasGenerated = ref(false)
const errorMessage = ref('')

function buildImageUrl(text: string) {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(text)}`)
  url.searchParams.set('t', Date.now().toString())
  return url.toString()
}

function generateImage() {
  const trimmedPrompt = prompt.value.trim()

  if (!trimmedPrompt) {
    errorMessage.value = 'Please enter a prompt first.'
    return
  }

  errorMessage.value = ''
  hasGenerated.value = true
  isGenerating.value = true
  imageUrl.value = buildImageUrl(trimmedPrompt)
}

function loadExample(examplePrompt: string) {
  prompt.value = examplePrompt
  generateImage()
}

function handleImageError() {
  isGenerating.value = false
  errorMessage.value = 'The image could not be loaded. Please try another prompt.'
}
</script>
