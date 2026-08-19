// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tailwind.css'],
  
  runtimeConfig: {
    FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN,
    FACEBOOK_PAGE_TOKEN: process.env.FACEBOOK_PAGE_TOKEN,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_SITE_URL: process.env.OPENROUTER_SITE_URL,
    OPENROUTER_SITE_NAME: process.env.OPENROUTER_SITE_NAME,
    POLLINATIONS_API_KEY: process.env.POLLINATIONS_API_KEY,
    POLLINATIONS_BASE_URL: process.env.POLLINATIONS_BASE_URL,
  },

  nitro: {
    storage: {
      chat: {
        driver: 'upstash',
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }
    }
  }
})
