// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tailwind.css'],
  
  runtimeConfig: {
    FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN,
    FACEBOOK_PAGE_TOKEN: process.env.FACEBOOK_PAGE_TOKEN,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
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
