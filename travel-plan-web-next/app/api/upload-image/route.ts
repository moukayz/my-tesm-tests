import { auth } from '../../../auth'
import { getImageStore } from '../../lib/imageStore'
import type { HandleUploadBody } from '@vercel/blob/client'

export async function POST(request: Request): Promise<Response> {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const store = getImageStore()
    const jsonResponse = await store.handleUploadRequest(body, request)
    return Response.json(jsonResponse)
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}
