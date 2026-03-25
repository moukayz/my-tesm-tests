import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import AttractionImageLightbox from '../../components/AttractionImageLightbox'

const images = [
  'https://blob.vercel.com/a.jpg',
  'https://blob.vercel.com/b.jpg',
  'https://blob.vercel.com/c.jpg',
]

function renderLightbox(initialIndex = 0, onClose = jest.fn()) {
  return render(
    <AttractionImageLightbox images={images} initialIndex={initialIndex} onClose={onClose} />
  )
}

describe('AttractionImageLightbox', () => {
  it('renders as a dialog with the initial image', () => {
    renderLightbox(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
  })

  it('shows the correct image when initialIndex is non-zero', () => {
    renderLightbox(1)
    expect(screen.getByRole('img')).toHaveAttribute('src', images[1])
  })

  it('navigates to next image', () => {
    renderLightbox(0)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('img')).toHaveAttribute('src', images[1])
  })

  it('navigates to previous image', () => {
    renderLightbox(1)
    fireEvent.click(screen.getByRole('button', { name: /previous/i }))
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
  })

  it('does not show prev button on first image', () => {
    renderLightbox(0)
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument()
  })

  it('does not show next button on last image', () => {
    renderLightbox(2)
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('zoom in button increases the zoom level indicator', () => {
    renderLightbox(0)
    const zoomIn = screen.getByRole('button', { name: /zoom in/i })
    const before = screen.getByTestId('zoom-level').textContent
    fireEvent.click(zoomIn)
    expect(screen.getByTestId('zoom-level').textContent).not.toBe(before)
  })

  it('zoom out button decreases the zoom level indicator', () => {
    renderLightbox(0)
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }))
    const after = screen.getByTestId('zoom-level').textContent
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }))
    expect(screen.getByTestId('zoom-level').textContent).not.toBe(after)
  })

  it('zoom out is disabled at minimum zoom', () => {
    renderLightbox(0)
    // Zoom out should be disabled at 1× (initial)
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeDisabled()
  })

  it('zoom in is disabled at maximum zoom', () => {
    renderLightbox(0)
    const zoomIn = screen.getByRole('button', { name: /zoom in/i })
    // Click until disabled
    for (let i = 0; i < 10; i++) {
      if ((zoomIn as HTMLButtonElement).disabled) break
      fireEvent.click(zoomIn)
    }
    expect(zoomIn).toBeDisabled()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    renderLightbox(0, onClose)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    renderLightbox(0, onClose)
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = jest.fn()
    renderLightbox(0, onClose)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
