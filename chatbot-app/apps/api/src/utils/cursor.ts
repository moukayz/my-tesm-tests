export type MessageCursor = { createdAt: Date; id: string }

export function encodeCursor(cursor: MessageCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`).toString('base64')
}

export function decodeCursor(cursor: string): MessageCursor | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    const [timestamp, id] = decoded.split('|')
    if (!timestamp || !id) {
      return null
    }
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    return { createdAt: date, id }
  } catch {
    return null
  }
}
