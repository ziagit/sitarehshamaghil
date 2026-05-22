<template>
    <main class="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <section class="rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-10">
            <div class="max-w-3xl">
                <p class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
                    Privacy and data handling
                </p>
                <h1 class="mt-5 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                    Privacy Policy
                </h1>
                <p class="mt-4 text-lg leading-8 text-slate-600">
                    <strong>SitarehShamAghil</strong> respects your privacy and is committed to protecting your personal
                    information. This page explains how we collect, use, and store data when you interact with our app or
                    visit our pages.
                </p>
            </div>

            <div class="mt-8 grid gap-4 sm:grid-cols-3">
                <div class="policy-stat">
                    <span>Messages</span>
                    <strong>Used for replies</strong>
                </div>
                <div class="policy-stat">
                    <span>Access</span>
                    <strong>Admins only</strong>
                </div>
                <div class="policy-stat">
                    <span>Sharing</span>
                    <strong>Not sold</strong>
                </div>
            </div>
        </section>

        <section class="mt-8 grid gap-6 lg:grid-cols-2">
            <article class="policy-card">
                <h2>Information We Collect</h2>
                <ul>
                    <li>Messages you send to our Facebook Page so the bot can respond.</li>
                    <li>Anonymous analytics data to improve our content and services.</li>
                </ul>
            </article>

            <article class="policy-card">
                <h2>How We Use Your Information</h2>
                <ul>
                    <li>To provide chatbot responses and support via Messenger.</li>
                    <li>To improve content and understand our audience.</li>
                </ul>
            </article>

            <article class="policy-card">
                <h2>Data Sharing</h2>
                <p>
                    We <strong>do not sell or share personal data</strong> with third parties. Only authorized admins or
                    developers of the app have access to messages for testing and bot functionality.
                </p>
            </article>

            <article class="policy-card">
                <h2>Your Choices</h2>
                <ul>
                    <li>You can stop interacting with the bot at any time.</li>
                    <li>
                        You can request deletion of any personal data by contacting
                        <a href="mailto:zia.csco@gmail.com">zia.csco@gmail.com</a>.
                    </li>
                </ul>
            </article>

            <article class="policy-card">
                <h2>Security</h2>
                <p>We take reasonable measures to protect data from unauthorized access.</p>
            </article>

            <article class="policy-card">
                <h2>Changes to this Policy</h2>
                <p>We may update this Privacy Policy occasionally. Updates will be posted on this page.</p>
            </article>
        </section>

        <section class="mt-8 overflow-hidden rounded-[2rem] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.15)] sm:p-8">
            <div class="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                    <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Contact</p>
                    <h2 class="mt-2 text-2xl font-bold sm:text-3xl">Questions about your data?</h2>
                    <p class="mt-3 max-w-2xl text-slate-300">
                        If you want to request deletion or ask about how data is handled, please contact us by email.
                    </p>
                </div>
                <a href="mailto:zia.csco@gmail.com" class="privacy-contact">
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
.policy-card {
    border-radius: 1.75rem;
    border: 1px solid rgba(255, 255, 255, 0.75);
    background: rgba(255, 255, 255, 0.82);
    padding: 1.5rem;
    box-shadow: 0 18px 60px rgba(15, 23, 42, 0.06);
}

.policy-card h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;
}

.policy-card p,
.policy-card li {
    margin-top: 0.85rem;
    line-height: 1.75;
    color: #64748b;
}

.policy-card ul {
    margin-top: 0.5rem;
    padding-left: 1.2rem;
}

.policy-card a {
    color: #1d4ed8;
    font-weight: 600;
    text-decoration: none;
}

.policy-card a:hover {
    text-decoration: underline;
}

.policy-stat {
    border-radius: 1.4rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(255, 255, 255, 0.8));
    padding: 1rem 1.1rem;
}

.policy-stat span {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #64748b;
}

.policy-stat strong {
    display: block;
    margin-top: 0.35rem;
    font-size: 1rem;
    color: #0f172a;
}

.privacy-contact {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    padding: 1rem 1.4rem;
    color: white;
    font-weight: 600;
    text-decoration: none;
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.2);
    transition: transform 0.2s ease, background-color 0.2s ease;
}

.privacy-contact:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.14);
}
</style>
