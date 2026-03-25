import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import AttractionImageViewer from '../../components/AttractionImageViewer'

const images = [
  'https://blob.vercel.com/a.jpg',
  'https://blob.vercel.com/b.jpg',
  'https://blob.vercel.com/c.jpg',
]

const mockRect = { top: 200, left: 50, bottom: 230, right: 250 } as DOMRect

function renderViewer(imgs = images, onDeleteImage = jest.fn(), onThumbnailClick = jest.fn()) {
  return render(
    <AttractionImageViewer
      images={imgs}
      anchorRect={mockRect}
      onDeleteImage={onDeleteImage}
      onThumbnailClick={onThumbnailClick}
      onMouseEnter={jest.fn()}
      onMouseLeave={jest.fn()}
    />
  )
}

describe('AttractionImageViewer', () => {
  it('renders nothing when images array is empty', () => {
    const { container } = render(
      <AttractionImageViewer
        images={[]}
        anchorRect={mockRect}
        onDeleteImage={jest.fn()}
        onThumbnailClick={jest.fn()}
        onMouseEnter={jest.fn()}
        onMouseLeave={jest.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders all images', () => {
    renderViewer()
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('renders all images when there are more than 3', () => {
    const many = Array.from({ length: 5 }, (_, i) => `https://blob.vercel.com/${i}.jpg`)
    renderViewer(many)
    expect(screen.getAllByRole('img')).toHaveLength(5)
  })

  it('images container is scrollable', () => {
    renderViewer()
    expect(document.querySelector('[data-testid="image-scroll"]')).toHaveClass('overflow-x-auto')
  })

  it('renders a delete button for each image', () => {
    renderViewer()
    expect(screen.getAllByRole('button', { name: /delete image/i })).toHaveLength(3)
  })

  it('calls onDeleteImage with the correct index when a delete button is clicked', () => {
    const onDeleteImage = jest.fn()
    renderViewer(images, onDeleteImage)
    fireEvent.click(screen.getAllByRole('button', { name: /delete image/i })[1])
    expect(onDeleteImage).toHaveBeenCalledWith(1)
  })

  it('calls onThumbnailClick with the correct index when a thumbnail is clicked', () => {
    const onThumbnailClick = jest.fn()
    renderViewer(images, jest.fn(), onThumbnailClick)
    fireEvent.click(screen.getAllByRole('img')[1])
    expect(onThumbnailClick).toHaveBeenCalledWith(1)
  })

  it('outer wrapper has bottom padding to bridge the hover gap between viewer and tag', () => {
    renderViewer()
    const scroll = document.querySelector('[data-testid="image-scroll"]')!
    // Walk up to the outermost portal div (the one with inline style + pb-*)
    const outerWrapper = scroll.closest('[data-testid="viewer-outer"]')
    expect(outerWrapper).toHaveClass('pb-1.5')
  })
})
