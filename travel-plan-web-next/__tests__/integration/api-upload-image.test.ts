/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
const mockGetImageStore = jest.fn()
const mockImageStore = {
  handleUploadRequest: jest.fn(),
}

jest.mock('../../auth', () => ({ auth: mockAuth }))
jest.mock('../../app/lib/imageStore', () => ({
  getImageStore: mockGetImageStore,
}))

describe('POST /api/upload-image', () => {
  async function getHandler() {
    const mod = await import('../../app/api/upload-image/route')
    return mod.POST
  }

  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/upload-image', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  beforeEach(() => {
    jest.resetModules()
    mockAuth.mockReset()
    mockGetImageStore.mockReset()
    mockImageStore.handleUploadRequest.mockReset()

    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })
    mockGetImageStore.mockReturnValue(mockImageStore)
  })

  it.each([null, {}])('returns 401 when session is not usable (%p)', async (session) => {
    mockAuth.mockResolvedValue(session)
    const handler = await getHandler()
    const res = await handler(makeRequest({ type: 'blob.generate-client-token' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it('delegates to imageStore and returns 200 with JSON response', async () => {
    const storeResponse = { clientToken: 'abc123' }
    mockImageStore.handleUploadRequest.mockResolvedValue(storeResponse)

    const handler = await getHandler()
    const body = { type: 'blob.generate-client-token', payload: { pathname: 'test.png' } }
    const res = await handler(makeRequest(body))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(storeResponse)
    expect(mockImageStore.handleUploadRequest).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when imageStore throws', async () => {
    mockImageStore.handleUploadRequest.mockRejectedValue(new Error('invalid token'))

    const handler = await getHandler()
    const res = await handler(makeRequest({ type: 'blob.generate-client-token' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid token')
  })

  it('returns 400 on invalid JSON body', async () => {
    const handler = await getHandler()
    const req = new NextRequest('http://localhost/api/upload-image', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })
})
