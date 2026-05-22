<template>
  <main class="relative isolate overflow-hidden">
    <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div class="absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl"></div>
      <div class="absolute right-0 top-24 h-80 w-80 rounded-full bg-rose-300/20 blur-3xl"></div>
      <div class="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-300/15 blur-3xl"></div>
    </div>

    <section class="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      <div class="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div class="max-w-2xl">
          <div class="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm backdrop-blur">
            <span class="h-2 w-2 rounded-full bg-amber-500"></span>
            Hazaragi culture, heritage, and Messenger chat
          </div>

          <h1 class="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-7xl">
            SitarehShamAghil
          </h1>

          <p class="mt-5 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
            A beautiful cultural home for Hazara stories, songs, poetry, and warm Messenger conversations.
          </p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <NuxtLink
              href="/privacy"
              class="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Read Privacy Policy
            </NuxtLink>

            <a
              href="mailto:zia.csco@gmail.com"
              class="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            >
              Contact Us
            </a>
          </div>

          <div class="mt-10 grid gap-3 sm:grid-cols-3">
            <div class="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Culture</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">Songs, poetry, and traditional music</p>
            </div>
            <div class="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Community</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">Stories, identity, and local pride</p>
            </div>
            <div class="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Messenger</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">Friendly AI replies for users</p>
            </div>
          </div>
        </div>

        <div class="relative">
          <div class="absolute -left-6 top-10 h-24 w-24 rounded-full bg-amber-200/50 blur-3xl"></div>
          <div class="absolute -right-6 bottom-10 h-24 w-24 rounded-full bg-rose-200/50 blur-3xl"></div>

          <div class="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_30px_90px_rgba(15,23,42,0.25)]">
            <div class="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Page preview</p>
                <p class="mt-1 text-lg font-bold">SitarehShamAghil</p>
              </div>
              <div class="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                Online
              </div>
            </div>

            <div class="mt-6 space-y-3">
              <div class="flex justify-start">
                <div class="max-w-[85%] rounded-2xl rounded-tl-md bg-white/10 px-4 py-3 text-sm leading-6 text-slate-100 ring-1 ring-white/10">
                  سلام قربانت، چطورین؟
                </div>
              </div>
              <div class="flex justify-end">
                <div class="max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 text-sm leading-6 text-white shadow-lg shadow-amber-500/20">
                  تشکر، یک آهنگ یا قصه بفرست.
                </div>
              </div>
              <div class="flex justify-start">
                <div class="max-w-[85%] rounded-2xl rounded-tl-md bg-white/10 px-4 py-3 text-sm leading-6 text-slate-100 ring-1 ring-white/10">
                  حتما، بگو اسمش چی است؟
                </div>
              </div>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">What we share</p>
                <p class="mt-2 text-sm leading-6 text-slate-200">
                  Traditional dress, local stories, poems, and cultural memory.
                </p>
              </div>
              <div class="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Our mission</p>
                <p class="mt-2 text-sm leading-6 text-slate-200">
                  Preserve heritage and make the conversation feel human.
                </p>
              </div>
            </div>

            <div class="mt-6 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <span class="text-sm text-slate-200">Connected through culture</span>
              <span class="text-sm font-semibold text-white">2026</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="grid gap-5 md:grid-cols-3">
        <article class="group rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-sm font-bold text-amber-700">01</div>
          <h2 class="mt-5 text-xl font-bold text-slate-950">Shared heritage</h2>
          <p class="mt-3 text-sm leading-7 text-slate-600">
            Songs, poetry, and traditional music in Dari, Hazaragi, and Persian.
          </p>
        </article>

        <article class="group rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-sm font-bold text-rose-700">02</div>
          <h2 class="mt-5 text-xl font-bold text-slate-950">Local identity</h2>
          <p class="mt-3 text-sm leading-7 text-slate-600">
            Traditional dresses, fashion, and stories from Hazara communities.
          </p>
        </article>

        <article class="group rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sm font-bold text-sky-700">03</div>
          <h2 class="mt-5 text-xl font-bold text-slate-950">Open conversation</h2>
          <p class="mt-3 text-sm leading-7 text-slate-600">
            Daily life, history, and the questions people actually care about.
          </p>
        </article>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/85 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur">
        <div class="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div class="p-6 sm:p-8 lg:p-10">
            <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">About the page</p>
            <h2 class="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              A cultural page with a friendly digital voice
            </h2>
            <p class="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              The project celebrates Hazara culture and creates a warm space for Messenger conversations, while keeping
              the public site simple, clear, and welcoming.
            </p>
          </div>

          <div class="border-t border-slate-200/70 bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white sm:p-8 lg:border-l lg:border-t-0">
            <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Contact</p>
            <h3 class="mt-3 text-2xl font-bold">Need collaboration or have a question?</h3>
            <p class="mt-4 text-sm leading-7 text-slate-300">
              Reach out by email for page inquiries, partnerships, or anything related to the project.
            </p>

            <a
              href="mailto:zia.csco@gmail.com"
              class="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-slate-100 sm:w-auto"
            >
              zia.csco@gmail.com
            </a>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
// Static landing page
</script>
