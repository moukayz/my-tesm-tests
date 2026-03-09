import React from 'react'

// Inline patterns — longer tokens (bold, strike) before shorter ones (italic)
const INLINE_REGEX = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|~~[^~\n]+~~)/

function parseInline(text: string): React.ReactNode[] {
  return text.split(INLINE_REGEX).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i}>{part.slice(1, -1)}</code>
    if (part.startsWith('~~') && part.endsWith('~~'))
      return <del key={i}>{part.slice(2, -2)}</del>
    return part
  })
}

type Block =
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'text'; lines: string[] }

const UL_RE = /^[-*] /
const OL_RE = /^\d+\. /

function buildBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    if (UL_RE.test(lines[i])) {
      const items: string[] = []
      while (i < lines.length && UL_RE.test(lines[i]))
        items.push(lines[i++].replace(UL_RE, ''))
      blocks.push({ type: 'ul', items })
    } else if (OL_RE.test(lines[i])) {
      const items: string[] = []
      while (i < lines.length && OL_RE.test(lines[i]))
        items.push(lines[i++].replace(OL_RE, ''))
      blocks.push({ type: 'ol', items })
    } else {
      const textLines: string[] = []
      while (i < lines.length && !UL_RE.test(lines[i]) && !OL_RE.test(lines[i]))
        textLines.push(lines[i++])
      blocks.push({ type: 'text', lines: textLines })
    }
  }
  return blocks
}

export function renderMarkdown(text: string): React.ReactNode {
  const blocks = buildBlocks(text.split('\n'))
  return (
    <>
      {blocks.map((block, bi) => {
        if (block.type === 'ul') {
          return (
            <ul key={bi} className="list-disc pl-4">
              {block.items.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={bi} className="list-decimal pl-4">
              {block.items.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
            </ol>
          )
        }
        return (
          <React.Fragment key={bi}>
            {block.lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {parseInline(line)}
              </React.Fragment>
            ))}
          </React.Fragment>
        )
      })}
    </>
  )
}
