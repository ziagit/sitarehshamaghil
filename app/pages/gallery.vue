<template>
  <main class="min-h-screen bg-slate-950 text-white">
    <section class="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="max-w-3xl">
          <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 shadow-lg shadow-black/10 backdrop-blur">
            <span class="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]"></span>
            Public gallery from Google Drive
          </div>

          <h1 class="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Gallery
          </h1>

          <p class="mt-5 text-lg leading-8 text-slate-300 sm:text-xl">
            Browse the latest images from your public Google Drive folder and download them directly.
          </p>
        </div>

        <NuxtLink
          href="/"
          class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
        >
          Back home
        </NuxtLink>
      </div>

      <div v-if="pending" class="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center text-slate-300 shadow-xl shadow-black/10 backdrop-blur">
        Loading gallery images...
      </div>

      <div v-else-if="error" class="mt-10 rounded-[2rem] border border-rose-400/20 bg-rose-400/10 p-8 text-slate-100 shadow-xl shadow-black/10">
        <p class="text-lg font-semibold">The gallery could not be loaded right now.</p>
        <p class="mt-2 text-sm leading-7 text-rose-100">
          {{ errorMessage }}
        </p>
      </div>

      <div v-else-if="!images.length" class="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center text-slate-300 shadow-xl shadow-black/10 backdrop-blur">
        No images are available yet. Share a Google Drive folder publicly and add its folder ID or link in your environment to populate this page.
      </div>

      <div v-else class="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="image in visibleImages"
          :key="image.id"
          class="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.06] shadow-xl shadow-black/10 backdrop-blur"
        >
          <img
            :src="image.thumbnailUrl || image.previewUrl || image.downloadUrl"
            :alt="image.name || 'Gallery image'"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-contain bg-slate-900/40"
          />

          <a
            v-if="image.downloadUrl"
            :href="image.downloadUrl"
            target="_blank"
            rel="noreferrer"
            class="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center justify-center rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 backdrop-blur-sm transition hover:bg-white/85"
          >
            Download
          </a>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
interface GalleryImage {
  id: string
  name: string
  thumbnailUrl?: string
  downloadUrl?: string
  previewUrl?: string
  updatedAt?: string
  size?: string
}

interface GalleryResponse {
  images: GalleryImage[]
  message?: string
}

const { data, pending, error } = await useFetch<GalleryResponse>('/api/gallery')

const images = computed(() => data.value?.images ?? [])
const errorMessage = computed(() => data.value?.message ?? 'Please check your Google Drive configuration.')
const batchSize = 12
const displayedCount = ref(batchSize)
const visibleImages = computed(() => images.value.slice(0, displayedCount.value))

function loadMoreImages() {
  if (displayedCount.value >= images.value.length) return

  const nextCount = Math.min(displayedCount.value + batchSize, images.value.length)
  displayedCount.value = nextCount
}

function handleScroll() {
  const scrollPosition = window.innerHeight + window.scrollY
  const pageHeight = document.documentElement.scrollHeight

  if (scrollPosition >= pageHeight - 400) {
    loadMoreImages()
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)
})

watch(images, () => {
  displayedCount.value = Math.min(batchSize, images.value.length)
})

useHead({
  title: 'Gallery | Sitara',
})
</script>
