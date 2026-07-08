export default defineEventHandler(async () => {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL

  if (!scriptUrl) {
    return {
      images: [],
      message: 'Please set GOOGLE_SCRIPT_URL in your environment.',
    }
  }

  try {
    const payload = await $fetch(scriptUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    })

    const getTimestamp = (item: any) => {
      const candidates = [
        item?.updatedAt,
        item?.updated_at,
        item?.modifiedTime,
        item?.modified_time,
        item?.createdTime,
        item?.created_at,
        item?.date,
        item?.timestamp,
        item?.time,
        item?.mtime,
      ]

      for (const candidate of candidates) {
        if (candidate === undefined || candidate === null || candidate === '') continue

        const timestamp = typeof candidate === 'number'
          ? candidate
          : new Date(candidate).getTime()

        if (!Number.isNaN(timestamp)) {
          return timestamp
        }
      }

      return undefined
    }

    const normalizeImage = (item: any, index: number) => {
      const id = item?.id || item?.fileId || item?.file_id || `${index}`
      const name = item?.name || item?.fileName || `Image ${index + 1}`
      const directUrl = item?.thumbnailUrl || item?.url || item?.imageUrl || item?.downloadUrl || item?.previewUrl
      const hasUsableDirectUrl = typeof directUrl === 'string' && /^https?:\/\//.test(directUrl) && !directUrl.includes('{') && !directUrl.includes('getId()')

      const previewUrl = hasUsableDirectUrl
        ? directUrl
        : `/api/gallery/proxy?id=${id}`

      const thumbnailUrl = hasUsableDirectUrl
        ? `${directUrl}&sz=w400`
        : `/api/gallery/proxy?id=${id}`

      const downloadUrl = hasUsableDirectUrl
        ? directUrl
        : `https://drive.google.com/uc?export=download&id=${id}`

      return {
        id,
        name,
        thumbnailUrl,
        downloadUrl,
        previewUrl,
      }
    }

    const rawItems = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as any)?.images)
        ? (payload as any).images
        : []

    const images = rawItems
      .map((item: any, index: number) => ({ item, index, timestamp: getTimestamp(item) }))
      .sort((a, b) => {
        if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp
        if (a.timestamp) return -1
        if (b.timestamp) return 1
        return a.index - b.index
      })
      .map(({ item, index }) => normalizeImage(item, index))
      .reverse()

    return { images }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      images: [],
      message: `Could not load the Google Apps Script payload. ${message}`,
    }
  }
})
