export default defineEventHandler(async () => {
  const storage = useStorage('chat')
  await storage.clear()

  return {
    ok: true,
    message: 'Chat storage cleared',
  }
})
