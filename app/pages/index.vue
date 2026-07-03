<template>
  <main class="relative isolate overflow-hidden">
    <div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(248,113,113,0.16),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#07111f_45%,_#0f172a_100%)]"></div>
    <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]"></div>

    <section class="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
      <div class="grid gap-12 lg:grid-cols-[1.06fr_0.94fr] lg:items-center">
        <div class="max-w-2xl">
          <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 shadow-lg shadow-black/10 backdrop-blur">
            <span class="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.9)]"></span>
            Facebook Messenger assistant for practical everyday help
          </div>

          <h1 class="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-7xl">
            ستاره شام آغیل
          </h1>

          <p class="mt-5 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            A warm, natural Messenger assistant that helps people with daily life, work ideas, simple guidance, and
            clear next steps. Short replies. Logical answers. No robotic looping.
          </p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <NuxtLink
              href="/privacy"
              class="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100"
            >
              Privacy Policy
            </NuxtLink>

            <NuxtLink
              href="/image-generator"
              class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
            >
              Image Generator
            </NuxtLink>

            <NuxtLink
              href="/text-to-speech"
              class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
            >
              Text to Speech
            </NuxtLink>

            <a
              href="https://www.facebook.com/sitarehshamaghil"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10"
            >
              Facebook Page
            </a>
          </div>

          <div class="mt-10 grid gap-4 sm:grid-cols-3">
            <div class="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/10 backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Tone</p>
              <p class="mt-3 text-sm leading-6 text-slate-200">Natural, calm, and helpful</p>
            </div>
            <div class="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/10 backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Focus</p>
              <p class="mt-3 text-sm leading-6 text-slate-200">Life, work, support, and clarity</p>
            </div>
            <div class="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/10 backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Style</p>
              <p class="mt-3 text-sm leading-6 text-slate-200">Short replies that feel human</p>
            </div>
          </div>
        </div>

        <div class="relative">
          <div class="absolute -left-8 top-8 h-28 w-28 rounded-full bg-amber-400/20 blur-3xl"></div>
          <div class="absolute -right-4 bottom-6 h-32 w-32 rounded-full bg-rose-400/20 blur-3xl"></div>

          <div class="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-[0_32px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-6">
            <div class="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Messenger preview</p>
                <p class="mt-1 text-lg font-bold text-white">Natural conversation</p>
              </div>
              <div class="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                Ready
              </div>
            </div>

            <div class="mt-6 space-y-3">
              <div class="flex justify-start">
                <div class="max-w-[82%] rounded-2xl rounded-tl-md bg-white/[0.08] px-4 py-3 text-sm leading-6 text-slate-100 ring-1 ring-white/10">
                  سلام، من دنبال یک کار ساده و مفید هستم.
                </div>
              </div>
              <div class="flex justify-end">
                <div class="max-w-[82%] rounded-2xl rounded-tr-md bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm leading-6 text-slate-950 shadow-lg shadow-amber-500/20">
                  خوب است. اول بگو چه مهارت‌هایی داری و روزانه چقدر وقت می‌گذاری.
                </div>
              </div>
              <div class="flex justify-start">
                <div class="max-w-[82%] rounded-2xl rounded-tl-md bg-white/[0.08] px-4 py-3 text-sm leading-6 text-slate-100 ring-1 ring-white/10">
                  نوشتن، پاسخ‌گویی، و کار با موبایل را بلدم.
                </div>
              </div>
              <div class="flex justify-end">
                <div class="max-w-[82%] rounded-2xl rounded-tr-md bg-slate-800 px-4 py-3 text-sm leading-6 text-slate-100 ring-1 ring-white/10">
                  عالی. پس می‌توانیم سراغ کارهای آنلاین سبک، مدیریت صفحه، یا متن‌نویسی ساده برویم.
                </div>
              </div>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">What it does</p>
                <p class="mt-2 text-sm leading-6 text-slate-200">
                  Gives practical advice, clear steps, and friendly support without overdoing the same words.
                </p>
              </div>
              <div class="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Best for</p>
                <p class="mt-2 text-sm leading-6 text-slate-200">
                  People who want help with life, work, local ideas, or simple daily questions.
                </p>
              </div>
            </div>

            <div class="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Built for</p>
                <p class="mt-1 text-sm text-slate-200">Messenger conversations that feel natural</p>
              </div>
              <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                Human first
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
      <div class="grid gap-5 md:grid-cols-3">
        <article class="rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/10 backdrop-blur transition duration-200 hover:-translate-y-1 hover:bg-white/[0.08]">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-sm font-bold text-amber-300 ring-1 ring-amber-400/20">01</div>
          <h2 class="mt-5 text-xl font-bold text-white">Practical guidance</h2>
          <p class="mt-3 text-sm leading-7 text-slate-300">
            Helpful answers for work, routines, decisions, and the next step a person can actually take today.
          </p>
        </article>

        <article class="rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/10 backdrop-blur transition duration-200 hover:-translate-y-1 hover:bg-white/[0.08]">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/15 text-sm font-bold text-rose-300 ring-1 ring-rose-400/20">02</div>
          <h2 class="mt-5 text-xl font-bold text-white">Natural conversation</h2>
          <p class="mt-3 text-sm leading-7 text-slate-300">
            Replies stay calm, human, and logical instead of repeating the same filler or chant-like phrases.
          </p>
        </article>

        <article class="rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/10 backdrop-blur transition duration-200 hover:-translate-y-1 hover:bg-white/[0.08]">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sm font-bold text-sky-300 ring-1 ring-sky-400/20">03</div>
          <h2 class="mt-5 text-xl font-bold text-white">Built for people</h2>
          <p class="mt-3 text-sm leading-7 text-slate-300">
            The assistant is meant to support users in real life with clear help, not just mirror their wording.
          </p>
        </article>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
      <div class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div class="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.05] p-6 shadow-xl shadow-black/10 backdrop-blur sm:p-8">
          <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">How it should feel</p>
          <h2 class="mt-3 text-3xl font-black tracking-tight text-white">Warm, useful, and steady</h2>
          <p class="mt-4 text-base leading-8 text-slate-300">
            When a person writes something short, emotional, or unclear, the assistant should reply in a way that moves
            the conversation forward. It should ask a helpful question, give a simple idea, or offer a clear next step.
          </p>
          <div class="mt-6 flex flex-wrap gap-2">
            <span class="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-sm text-slate-200">Short</span>
            <span class="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-sm text-slate-200">Logical</span>
            <span class="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-sm text-slate-200">Friendly</span>
            <span class="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-sm text-slate-200">Human</span>
          </div>
        </div>

        <div class="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
          <div class="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div class="p-6 sm:p-8">
              <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Contact</p>
              <h3 class="mt-3 text-2xl font-bold text-white">Need collaboration or feedback?</h3>
              <p class="mt-4 text-sm leading-7 text-slate-300">
                If you want to improve the assistant further or test a new reply style, use email to reach the project.
              </p>

              <a
                href="https://www.facebook.com/sitarehshamaghil"
                target="_blank"
                rel="noreferrer"
                class="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 sm:w-auto"
              >
                facebook.com/sitarehshamaghil
              </a>
            </div>

            <div class="border-t border-white/10 bg-white/5 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Assistant identity</p>
              <ul class="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <li>• Name: ستاره / ستاره شام آغیل</li>
                <li>• Community: Hazara / هزاره</li>
                <li>• Location: دشت برچی کابل</li>
                <li>• Goal: help people in life with practical support</li>
                <li>• Tone: natural, respectful, and not repetitive</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
// Static landing page
</script>
