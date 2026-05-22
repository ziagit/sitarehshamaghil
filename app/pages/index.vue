<template>
    <main class="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <section class="hero-card overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-10 lg:p-14">
            <div class="grid gap-10 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
                <div class="space-y-6">
                    <div class="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
                        <span class="h-2 w-2 rounded-full bg-amber-500"></span>
                        Hazaragi culture, stories, and conversation
                    </div>

                    <div class="space-y-4">
                        <h1 class="max-w-2xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                            SitarehShamAghil
                        </h1>
                        <p class="max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
                            A warm cultural home for Hazaragi heritage, creative expression, and meaningful Messenger conversations.
                        </p>
                    </div>

                    <div class="flex flex-wrap gap-3">
                        <NuxtLink href="/privacy" class="primary-btn">Privacy Policy</NuxtLink>
                        <a href="mailto:zia.csco@gmail.com" class="secondary-btn">Contact Us</a>
                    </div>

                    <div class="grid gap-3 sm:grid-cols-3">
                        <div class="info-chip">
                            <span class="chip-value">Culture</span>
                            <span class="chip-label">Songs, poetry, and history</span>
                        </div>
                        <div class="info-chip">
                            <span class="chip-value">Community</span>
                            <span class="chip-label">Stories and shared identity</span>
                        </div>
                        <div class="info-chip">
                            <span class="chip-value">Messenger</span>
                            <span class="chip-label">Friendly AI replies</span>
                        </div>
                    </div>
                </div>

                <div class="relative">
                    <div class="absolute -left-4 -top-4 h-24 w-24 rounded-full bg-amber-300/30 blur-3xl"></div>
                    <div class="absolute -bottom-6 -right-2 h-24 w-24 rounded-full bg-rose-300/30 blur-3xl"></div>

                    <div class="relative rounded-[1.75rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-2xl">
                        <p class="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">About the page</p>
                        <div class="mt-5 space-y-4">
                            <div class="rounded-2xl bg-white/6 p-4 ring-1 ring-white/10">
                                <p class="text-sm text-slate-300">What we share</p>
                                <p class="mt-2 text-base leading-7 text-white">
                                    Songs, poetry, traditional dress, local stories, and conversations about Hazara life.
                                </p>
                            </div>
                            <div class="rounded-2xl bg-white/6 p-4 ring-1 ring-white/10">
                                <p class="text-sm text-slate-300">Our mission</p>
                                <p class="mt-2 text-base leading-7 text-white">
                                    Share knowledge, preserve culture, and inspire pride in Hazaragi heritage.
                                </p>
                            </div>
                        </div>

                        <div class="mt-6 flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 text-sm font-medium text-white">
                            <span>Connected through culture</span>
                            <span>2026</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="mt-8 grid gap-6 lg:grid-cols-3">
            <article class="content-card">
                <div class="card-icon bg-amber-100 text-amber-700">01</div>
                <h2>Shared heritage</h2>
                <p>Songs, poetry, and traditional music in Dari, Hazaragi, and Persian.</p>
            </article>

            <article class="content-card">
                <div class="card-icon bg-rose-100 text-rose-700">02</div>
                <h2>Local identity</h2>
                <p>Traditional dresses, fashion, and stories from Hazara communities.</p>
            </article>

            <article class="content-card">
                <div class="card-icon bg-sky-100 text-sky-700">03</div>
                <h2>Open conversation</h2>
                <p>Discussion about daily life, history, and the challenges people care about.</p>
            </article>
        </section>

        <section class="mt-8 overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8">
            <div class="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                    <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Contact</p>
                    <h2 class="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Need collaboration or have a question?</h2>
                    <p class="mt-3 max-w-2xl text-slate-600">
                        Reach out by email for page inquiries, partnerships, or anything related to the project.
                    </p>
                </div>
                <a href="mailto:zia.csco@gmail.com" class="contact-pill">
                    zia.csco@gmail.com
                </a>
            </div>
        </section>
    </main>
</template>

<script setup lang="ts">
// No script needed for static content
</script>

<style scoped>
.hero-card,
.content-card,
.contact-pill,
.primary-btn,
.secondary-btn {
    transition:
        transform 0.2s ease,
        box-shadow 0.2s ease,
        background-color 0.2s ease,
        border-color 0.2s ease;
}

.hero-card:hover,
.content-card:hover {
    transform: translateY(-2px);
}

.primary-btn,
.secondary-btn,
.contact-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    border-radius: 999px;
    font-weight: 600;
}

.primary-btn {
    background: linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%);
    color: white;
    padding: 0.9rem 1.35rem;
    box-shadow: 0 14px 28px rgba(29, 78, 216, 0.22);
}

.primary-btn:hover {
    box-shadow: 0 18px 32px rgba(29, 78, 216, 0.3);
    transform: translateY(-1px);
}

.secondary-btn {
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(255, 255, 255, 0.7);
    color: #0f172a;
    padding: 0.9rem 1.35rem;
}

.secondary-btn:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-1px);
}

.info-chip {
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 1.2rem;
    background: rgba(255, 255, 255, 0.7);
    padding: 1rem;
}

.chip-value {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #334155;
}

.chip-label {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.95rem;
    color: #64748b;
}

.content-card {
    border-radius: 1.75rem;
    border: 1px solid rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.8);
    padding: 1.5rem;
    box-shadow: 0 18px 60px rgba(15, 23, 42, 0.06);
}

.content-card h2 {
    margin-top: 1rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;
}

.content-card p {
    margin-top: 0.6rem;
    line-height: 1.7;
    color: #64748b;
}

.card-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 3rem;
    width: 3rem;
    border-radius: 1rem;
    font-size: 0.9rem;
    font-weight: 800;
}

.contact-pill {
    border: 1px solid rgba(148, 163, 184, 0.28);
    background: white;
    padding: 1rem 1.4rem;
    color: #0f172a;
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
}

.contact-pill:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
}
</style>
