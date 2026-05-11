// ─── Token format ────────────────────────────────────────────────────────────
// Mentions : @[Full Name](uuid)
// Refs     : /[WO-REF](id)
// ─────────────────────────────────────────────────────────────────────────────

export type MessageSegment =
  | { type: "text";    value: string }
  | { type: "mention"; name: string; userId: string }
  | { type: "ref";     refNo: string; refId: string }

const MENTION_RE  = /@\[([^\]]+)\]\(([^)]+)\)/g
const REF_RE      = /\/\[([^\]]+)\]\(([^)]+)\)/g
const COMBINED_RE = /@\[([^\]]+)\]\(([^)]+)\)|\/\[([^\]]+)\]\(([^)]+)\)/g

export function parseMessageForSend(content: string): {
  mentions: string[]
  enquiry_refs: string[]
} {
  const mentions: string[] = []
  const enquiry_refs: string[] = []

  let m: RegExpExecArray | null
  const mr = new RegExp(MENTION_RE.source, "g")
  while ((m = mr.exec(content)) !== null) mentions.push(m[2])

  const er = new RegExp(REF_RE.source, "g")
  while ((m = er.exec(content)) !== null) enquiry_refs.push(m[1])

  return {
    mentions:     [...new Set(mentions)],
    enquiry_refs: [...new Set(enquiry_refs)],
  }
}

export function parseMessageContent(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  const re = new RegExp(COMBINED_RE.source, "g")
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) })
    }
    if (match[0].startsWith("@")) {
      segments.push({ type: "mention", name: match[1], userId: match[2] })
    } else {
      segments.push({ type: "ref", refNo: match[3], refId: match[4] })
    }
    lastIndex = re.lastIndex
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) })
  }

  return segments
}

export function detectTrigger(
  value: string,
  cursorPos: number
): { type: "mention" | "ref"; search: string } | null {
  const textUpToCursor = value.slice(0, cursorPos)
  const mentionMatch = textUpToCursor.match(/@([a-zA-Z\s]*)$/)
  if (mentionMatch) return { type: "mention", search: mentionMatch[1].trim() }
  return null
}

export function insertMentionToken(
  value: string,
  cursorPos: number,
  name: string,
  userId: string
): { newValue: string; newCursor: number } {
  const before = value.slice(0, cursorPos)
  const after  = value.slice(cursorPos)
  const token  = `@[${name}](${userId}) `
  const newBefore = before.replace(/@([a-zA-Z\s]*)$/, token)
  return { newValue: newBefore + after, newCursor: newBefore.length }
}
