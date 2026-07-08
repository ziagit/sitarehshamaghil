export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const id = typeof query.id === 'string' ? query.id : ''

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing image id' })
  }

  const targetUrl = `https://drive.google.com/uc?export=view&id=${id}`

  const response = await $fetch.raw(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
    responseType: 'arrayBuffer',
  })

  const body = Buffer.from(response._data as ArrayBuffer)
  const contentType = response.headers.get('content-type') || 'image/jpeg'

  setHeader(event, 'content-type', contentType)
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return body
})
