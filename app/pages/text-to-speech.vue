<template>
  <main class="relative isolate overflow-hidden">
    <div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(168,85,247,0.16),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#07111f_50%,_#0f172a_100%)]"></div>
    <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]"></div>

    <section class="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
      <div class="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div class="max-w-2xl">
          <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 shadow-lg shadow-black/10 backdrop-blur">
            <span class="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.9)]"></span>
            Text to speech
          </div>

          <h1 class="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            Turn text into spoken audio
          </h1>

          <p class="mt-5 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            Paste text, pick a voice, and let Pollinations generate the audio. This version uses the
            OpenAI-compatible Pollinations TTS API, so Persian can work through the service instead of depending on
            the browser.
          </p>

          <div class="mt-8 grid gap-4 sm:grid-cols-3">
            <div class="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/10 backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Step 1</p>
              <p class="mt-3 text-sm leading-6 text-slate-200">Enter text</p>
            </div>
            <div class="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/10 backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Step 2</p>
              <p class="mt-3 text-sm leading-6 text-slate-200">Choose a voice</p>
            </div>
            <div class="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/10 backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Step 3</p>
              <p class="mt-3 text-sm leading-6 text-slate-200">Press speak</p>
            </div>
          </div>

          <div class="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/10 backdrop-blur sm:p-8">
            <form class="space-y-4" @submit.prevent="speak">
              <label for="tts-text" class="block text-sm font-semibold text-slate-200">Text</label>
              <textarea
                id="tts-text"
                v-model="text"
                rows="7"
                class="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 text-base leading-7 text-white placeholder:text-slate-500 shadow-inner shadow-black/20 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
                placeholder="Paste or type the text you want spoken aloud"
              />

              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label for="voice" class="block text-sm font-semibold text-slate-200">Voice</label>
                  <select
                    id="voice"
                    v-model="selectedVoiceName"
                    class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
                  >
                    <option value="">Default voice</option>
                    <option v-for="voice in voices" :key="voice.name" :value="voice.name">
                      {{ voice.label }}
                    </option>
                  </select>
                </div>

                <div>
                  <label for="rate" class="block text-sm font-semibold text-slate-200">Speed</label>
                  <input
                    id="rate"
                    v-model.number="rate"
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    class="mt-5 w-full accent-sky-400"
                  />
                  <div class="mt-2 flex justify-between text-xs text-slate-400">
                    <span>Slower</span>
                    <span>{{ rate.toFixed(2) }}x</span>
                    <span>Faster</span>
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  :disabled="!text.trim()"
                  class="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-300 disabled:hover:translate-y-0"
                >
                  Speak
                </button>

                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
                  @click="stopSpeaking"
                >
                  Stop
                </button>

                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
                  @click="loadExample"
                >
                  Use example
                </button>
              </div>
            </form>

            <div class="mt-6">
              <p v-if="statusMessage" class="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm leading-6 text-sky-100">
                {{ statusMessage }}
              </p>
              <p v-else class="text-sm leading-6 text-slate-400">
                Speech is generated by Pollinations and played back in your browser.
              </p>
            </div>
          </div>
        </div>

        <div class="relative lg:pt-2">
          <div class="absolute -left-6 top-10 h-28 w-28 rounded-full bg-sky-400/20 blur-3xl"></div>
          <div class="absolute -right-2 bottom-12 h-32 w-32 rounded-full bg-violet-400/20 blur-3xl"></div>

          <div class="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-[0_32px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <div class="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Preview</p>
                <p class="mt-1 text-lg font-bold text-white">Speaking status</p>
              </div>
              <div class="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                {{ isSpeaking ? 'Speaking' : 'Ready' }}
              </div>
            </div>

            <div class="space-y-4 p-6">
              <div class="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Current text</p>
                <p class="mt-3 max-h-[18rem] overflow-auto text-sm leading-7 text-slate-200 whitespace-pre-wrap">
                  {{ text || 'No text entered yet' }}
                </p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Voice</p>
                  <p class="mt-2 text-sm leading-6 text-slate-200">
                    {{ selectedVoiceLabel || 'Default voice' }}
                  </p>
                </div>
                <div class="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Rate</p>
                  <p class="mt-2 text-sm leading-6 text-slate-200">
                    {{ rate.toFixed(2) }}x
                  </p>
                </div>
              </div>

              <button
                type="button"
                class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                @click="fillSampleLongText"
              >
                Load longer sample
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
type VoiceOption = {
  name: string
  label: string
}

const pollinationsVoiceOptions: VoiceOption[] = [
  { name: 'alloy', label: 'Alloy' },
  { name: 'echo', label: 'Echo' },
  { name: 'fable', label: 'Fable' },
  { name: 'onyx', label: 'Onyx' },
  { name: 'nova', label: 'Nova' },
  { name: 'shimmer', label: 'Shimmer' },
  { name: 'ash', label: 'Ash' },
  { name: 'ballad', label: 'Ballad' },
  { name: 'coral', label: 'Coral' },
  { name: 'sage', label: 'Sage' },
  { name: 'verse', label: 'Verse' },
  { name: 'rachel', label: 'Rachel' },
  { name: 'domi', label: 'Domi' },
  { name: 'bella', label: 'Bella' },
  { name: 'elli', label: 'Elli' },
  { name: 'charlotte', label: 'Charlotte' },
  { name: 'dorothy', label: 'Dorothy' },
  { name: 'sarah', label: 'Sarah' },
  { name: 'emily', label: 'Emily' },
  { name: 'lily', label: 'Lily' },
  { name: 'matilda', label: 'Matilda' },
  { name: 'adam', label: 'Adam' },
  { name: 'antoni', label: 'Antoni' },
  { name: 'arnold', label: 'Arnold' },
  { name: 'josh', label: 'Josh' },
  { name: 'sam', label: 'Sam' },
  { name: 'daniel', label: 'Daniel' },
  { name: 'charlie', label: 'Charlie' },
  { name: 'james', label: 'James' },
  { name: 'fin', label: 'Fin' },
  { name: 'callum', label: 'Callum' },
  { name: 'liam', label: 'Liam' },
  { name: 'george', label: 'George' },
  { name: 'brian', label: 'Brian' },
  { name: 'bill', label: 'Bill' },
]

const text = ref('سلام عزیز دل')
const selectedVoiceName = ref('alloy')
const rate = ref(1)
const isSpeaking = ref(false)
const statusMessage = ref('')
const voices = ref<VoiceOption[]>(pollinationsVoiceOptions)

let activeAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null

const selectedVoiceLabel = computed(() => {
  return voices.value.find((voice) => voice.name === selectedVoiceName.value)?.label ?? ''
})

const hasPersianText = computed(() => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text.value))
const selectedModel = computed(() => (hasPersianText.value ? 'qwen-tts' : 'eleven-multilingual-v2'))

function cleanupAudio() {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.src = ''
    activeAudio = null
  }

  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

function stopSpeaking() {
  cleanupAudio()
  isSpeaking.value = false
  statusMessage.value = 'Playback stopped.'
}

async function speak() {
  const trimmedText = text.value.trim()
  if (!trimmedText) {
    statusMessage.value = 'Please enter some text first.'
    return
  }

  stopSpeaking()
  isSpeaking.value = true
  statusMessage.value = 'Generating audio with Pollinations...'

  try {
    const response = await $fetch('/api/text-to-speech', {
      method: 'POST',
      responseType: 'blob',
      body: {
        text: trimmedText,
        voice: selectedVoiceName.value,
        model: selectedModel.value,
      },
    })

    const blob = response as Blob
    activeObjectUrl = URL.createObjectURL(blob)
    activeAudio = new Audio(activeObjectUrl)
    activeAudio.playbackRate = rate.value
    activeAudio.onended = () => {
      isSpeaking.value = false
      statusMessage.value = 'Playback finished.'
      cleanupAudio()
    }
    activeAudio.onerror = () => {
      isSpeaking.value = false
      statusMessage.value = 'The generated audio could not be played.'
      cleanupAudio()
    }

    await activeAudio.play()
    statusMessage.value = hasPersianText.value
      ? 'Persian audio generated by Pollinations.'
      : 'Audio generated by Pollinations.'
  } catch (error) {
    console.error(error)
    isSpeaking.value = false
    cleanupAudio()
    const detail =
      typeof error === 'object' && error && 'data' in error && typeof (error as { data?: unknown }).data === 'string'
        ? (error as { data?: string }).data
        : ''

    statusMessage.value = detail || 'Pollinations audio generation failed.'
  }
}

function loadExample() {
  text.value = 'This is a sample sentence for the text to speech page. You can replace it with your own content and choose a different voice or speed.'
  statusMessage.value = 'Example text loaded.'
}

function fillSampleLongText() {
  text.value = [
    'Welcome to the text to speech page.',
    'This feature sends the text to Pollinations using the OpenAI-compatible audio speech endpoint.',
    'You can use it for reading notes, short scripts, or quick accessibility previews.',
    'Later we can add language selection, downloadable audio, and pitch controls.',
  ].join(' ')
  statusMessage.value = 'Longer sample loaded.'
}

onBeforeUnmount(() => {
  cleanupAudio()
})
</script>
