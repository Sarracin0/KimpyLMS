import OpenAI from 'openai'

let cachedClient: OpenAI | null = null

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey })
  }

  return cachedClient
}
