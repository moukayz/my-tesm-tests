import React from 'react'
import { render } from '@testing-library/react'
import { renderMarkdown } from '../../app/lib/markdown'

function wrap(node: React.ReactNode) {
  return render(<div>{node}</div>).container.firstElementChild as HTMLElement
}

describe('renderMarkdown', () => {
  it('renders plain text as-is', () => {
    expect(wrap(renderMarkdown('hello world')).textContent).toBe('hello world')
  })

  it('renders **bold** as <strong>', () => {
    const el = wrap(renderMarkdown('**bold**'))
    expect(el.querySelector('strong')?.textContent).toBe('bold')
  })

  it('renders *italic* as <em>', () => {
    const el = wrap(renderMarkdown('*italic*'))
    expect(el.querySelector('em')?.textContent).toBe('italic')
  })

  it('renders `code` as <code>', () => {
    const el = wrap(renderMarkdown('`code`'))
    expect(el.querySelector('code')?.textContent).toBe('code')
  })

  it('renders ~~strike~~ as <del>', () => {
    const el = wrap(renderMarkdown('~~strike~~'))
    expect(el.querySelector('del')?.textContent).toBe('strike')
  })

  it('renders newlines as <br> in text blocks', () => {
    const el = wrap(renderMarkdown('line 1\nline 2'))
    expect(el.querySelector('br')).not.toBeNull()
    expect(el.textContent).toContain('line 1')
    expect(el.textContent).toContain('line 2')
  })

  it('renders - list items as <ul><li>', () => {
    const el = wrap(renderMarkdown('- item one\n- item two'))
    const ul = el.querySelector('ul')
    expect(ul).not.toBeNull()
    const lis = el.querySelectorAll('li')
    expect(lis).toHaveLength(2)
    expect(lis[0].textContent).toBe('item one')
    expect(lis[1].textContent).toBe('item two')
  })

  it('renders * list items as <ul><li>', () => {
    const el = wrap(renderMarkdown('* first\n* second'))
    expect(el.querySelector('ul')).not.toBeNull()
    expect(el.querySelectorAll('li')).toHaveLength(2)
  })

  it('renders numbered list as <ol><li>', () => {
    const el = wrap(renderMarkdown('1. alpha\n2. beta'))
    const ol = el.querySelector('ol')
    expect(ol).not.toBeNull()
    const lis = el.querySelectorAll('li')
    expect(lis).toHaveLength(2)
    expect(lis[0].textContent).toBe('alpha')
    expect(lis[1].textContent).toBe('beta')
  })

  it('applies inline markdown inside list items', () => {
    const el = wrap(renderMarkdown('- **bold item**'))
    expect(el.querySelector('li strong')?.textContent).toBe('bold item')
  })

  it('renders mixed text and list blocks', () => {
    const el = wrap(renderMarkdown('intro\n- item\noutro'))
    expect(el.querySelector('ul')).not.toBeNull()
    expect(el.textContent).toContain('intro')
    expect(el.textContent).toContain('outro')
  })
})
