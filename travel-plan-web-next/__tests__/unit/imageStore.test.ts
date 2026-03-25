/**
 * @jest-environment node
 */

const mockHandleUpload = jest.fn()

jest.mock('@vercel/blob/client', () => ({
  handleUpload: mockHandleUpload,
}))

describe('imageStore', () => {
  beforeEach(() => {
    jest.resetModules()
    mockHandleUpload.mockReset()
  })

  it('getImageStore returns a VercelBlobImageStore instance', async () => {
    const { getImageStore, VercelBlobImageStore } = await import('../../app/lib/imageStore')
    const store = getImageStore()
    expect(store).toBeInstanceOf(VercelBlobImageStore)
  })

  it('VercelBlobImageStore.handleUploadRequest delegates to @vercel/blob/server handleUpload', async () => {
    const fakeResponse = { type: 'blob.generate-client-token', clientToken: 'tok' }
    mockHandleUpload.mockResolvedValue(fakeResponse)

    const { VercelBlobImageStore } = await import('../../app/lib/imageStore')
    const store = new VercelBlobImageStore()
    const fakeBody = { type: 'blob.generate-client-token' } as Parameters<typeof store.handleUploadRequest>[0]
    const fakeRequest = new Request('http://localhost/api/upload-image', { method: 'POST' })

    const result = await store.handleUploadRequest(fakeBody, fakeRequest)

    expect(mockHandleUpload).toHaveBeenCalledTimes(1)
    expect(result).toBe(fakeResponse)
  })
})
