import { createRouteHandler } from 'uploadthing/next'

import { ourFileRouter } from './core'

const handler = createRouteHandler({
  router: ourFileRouter,
})

export const GET = handler.GET

export async function POST(request: Request) {
  const hook = request.headers.get('uploadthing-hook')

  if (hook) {
    console.info('[UPLOADTHING] Hook received', hook)
    // Forward to UploadThing handler so dev callbacks are processed correctly
  }

  return handler.POST(request)
}
