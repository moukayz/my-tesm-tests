import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@vercel/blob/client', () => ({
  upload: jest.fn(),
  handleUpload: jest.fn(),
}))

import AttractionImageModal from '../../components/AttractionImageModal'
import * as blobClient from '@vercel/blob/client'

const mockUpload = blobClient.upload as jest.Mock

function makePasteEvent(files: File[]) {
  const items = files.map((file) => ({
    type: file.type,
    getAsFile: () => file,
  }))
  return {
    clipboardData: { items },
    preventDefault: jest.fn(),
  }
}

describe('AttractionImageModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = jest.fn()
  })

  it('renders paste instruction and disabled upload button', () => {
    render(
      <AttractionImageModal
        attractionLabel="Eiffel Tower"
        onUploadComplete={jest.fn()}
        onClose={jest.fn()}
      />
    )

    expect(screen.getByText(/paste/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
  })

  it('shows image preview after pasting an image', () => {
    render(
      <AttractionImageModal
        attractionLabel="Eiffel Tower"
        onUploadComplete={jest.fn()}
        onClose={jest.fn()}
      />
    )

    const pasteArea = screen.getByTestId('paste-area')
    const file = new File(['img'], 'photo.png', { type: 'image/png' })
    fireEvent.paste(pasteArea, makePasteEvent([file]))

    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload/i })).not.toBeDisabled()
  })

  it('ignores non-image paste items', () => {
    render(
      <AttractionImageModal
        attractionLabel="Eiffel Tower"
        onUploadComplete={jest.fn()}
        onClose={jest.fn()}
      />
    )

    const pasteArea = screen.getByTestId('paste-area')
    fireEvent.paste(pasteArea, {
      clipboardData: {
        items: [{ type: 'text/plain', getAsFile: () => null }],
      },
      preventDefault: jest.fn(),
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
  })

  it('calls upload and onUploadComplete with blob URLs on success', async () => {
    const onUploadComplete = jest.fn()
    mockUpload.mockResolvedValue({ url: 'https://blob.vercel.com/photo.png' })

    render(
      <AttractionImageModal
        attractionLabel="Eiffel Tower"
        onUploadComplete={onUploadComplete}
        onClose={jest.fn()}
      />
    )

    const pasteArea = screen.getByTestId('paste-area')
    const file = new File(['img'], 'photo.png', { type: 'image/png' })
    fireEvent.paste(pasteArea, makePasteEvent([file]))

    await userEvent.click(screen.getByRole('button', { name: /upload/i }))

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining('photo.png'),
        file,
        expect.objectContaining({ access: 'public', handleUploadUrl: '/api/upload-image' })
      )
      expect(onUploadComplete).toHaveBeenCalledWith(['https://blob.vercel.com/photo.png'])
    })
  })

  it('shows error message when upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('Network error'))

    render(
      <AttractionImageModal
        attractionLabel="Eiffel Tower"
        onUploadComplete={jest.fn()}
        onClose={jest.fn()}
      />
    )

    const pasteArea = screen.getByTestId('paste-area')
    const file = new File(['img'], 'photo.png', { type: 'image/png' })
    fireEvent.paste(pasteArea, makePasteEvent([file]))

    await userEvent.click(screen.getByRole('button', { name: /upload/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent('Upload failed. Please try again.')
    })
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = jest.fn()
    render(
      <AttractionImageModal
        attractionLabel="Eiffel Tower"
        onUploadComplete={jest.fn()}
        onClose={onClose}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('allows removing a pasted image before upload', async () => {
    render(
      <AttractionImageModal
        attractionLabel="Eiffel Tower"
        onUploadComplete={jest.fn()}
        onClose={jest.fn()}
      />
    )

    const pasteArea = screen.getByTestId('paste-area')
    const file = new File(['img'], 'photo.png', { type: 'image/png' })
    fireEvent.paste(pasteArea, makePasteEvent([file]))

    expect(screen.getByRole('img')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /remove/i }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
  })
})
