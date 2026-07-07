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

  if (!config.POLLINATIONS_API_KEY) {
    throw createError({
      statusCode: 500,
      statusMessage: 'POLLINATIONS_API_KEY is missing',
      data: 'Set a Pollinations secret key from enter.pollinations.ai in your server environment before using text-to-speech.',
    })
  }

  const baseUrl = (config.POLLINATIONS_BASE_URL || 'https://gen.pollinations.ai').replace(/\/$/, '')
  const endpoint = `${baseUrl}/v1/audio/speech`
  const model = body?.model || (hasPersianText(text) ? 'qwen-tts' : 'eleven-multilingual-v2')
  const voice = body?.voice || 'alloy'

  const requestBody = JSON.stringify({
    model,
    voice,
    input: text,
  })

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'audio/mpeg',
    Authorization: `Bearer ${config.POLLINATIONS_API_KEY}`,
  }

  let response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: requestBody,
  })

  if (response.status === 404) {
    const fallbackEndpoint = `${baseUrl}/audio/${encodeURIComponent(text)}?voice=${encodeURIComponent(voice)}&model=${encodeURIComponent(model)}`
    response = await fetch(fallbackEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'audio/mpeg',
        Authorization: `Bearer ${config.POLLINATIONS_API_KEY}`,
      },
    })
  }

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
