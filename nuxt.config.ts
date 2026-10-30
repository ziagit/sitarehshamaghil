// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tailwind.css'],
  
  runtimeConfig: {
    FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN,
    FACEBOOK_PAGE_TOKEN: process.env.FACEBOOK_PAGE_TOKEN,
    AI_GATEWAY_URL: process.env.AI_GATEWAY_URL,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    AI_GATEWAY_MODEL: process.env.AI_GATEWAY_MODEL,
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
