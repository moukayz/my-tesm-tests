import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export interface ImageStore {
  handleUploadRequest(body: HandleUploadBody, request: Request): Promise<Record<string, unknown>>
}

export class VercelBlobImageStore implements ImageStore {
  async handleUploadRequest(body: HandleUploadBody, request: Request): Promise<Record<string, unknown>> {
    return handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname: string) => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
      }),
    })
  }
}

let _store: ImageStore | null = null

export function getImageStore(): ImageStore {
  if (!_store) _store = new VercelBlobImageStore()
  return _store
}
