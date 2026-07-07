type TtsRequestBody = {
  text?: string
  voice?: string
  model?: string
}

function hasPersianText(text: string) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<TtsRequestBody>(event)
  const text = body?.text?.trim()

  if (!text) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Text is required',
    })
  }

  const baseUrl = (config.POLLINATIONS_BASE_URL || 'https://text.pollinations.ai/v1').replace(/\/$/, '')
  const endpoint = `${baseUrl}/audio/speech`
  const model = body?.model || (hasPersianText(text) ? 'qwen-tts' : 'eleven-multilingual-v2')
  const voice = body?.voice || 'alloy'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
      ...(config.POLLINATIONS_API_KEY
        ? { Authorization: `Bearer ${config.POLLINATIONS_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
    }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw createError({
      statusCode: response.status,
      statusMessage: 'Pollinations TTS request failed',
      data: details,
    })
  }

  const audio = await response.arrayBuffer()
  return new Response(audio, {
    headers: {
      'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
})
