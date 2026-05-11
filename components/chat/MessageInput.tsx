"use client"

import { useRef, useState, useCallback } from "react"
import { SendHorizonal } from "lucide-react"
import { useSendMessage } from "@/lib/hooks/useChat"
import { MentionDropdown } from "@/components/chat/MentionDropdown"
import { cn } from "@/lib/utils"
import type { ChatMember } from "@/lib/types/chat"

interface TriggerState {
  type: "mention"
  search: string
  anchorRect: DOMRect
}

interface Props {
  roomId: string
  members: ChatMember[]
  currentUserId: string
}

function getTextBeforeCursor(): string {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return ""
  const range = sel.getRangeAt(0)
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return ""
  return (range.startContainer.textContent ?? "").slice(0, range.startOffset)
}

function getCursorRect(): DOMRect | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  return sel.getRangeAt(0).getBoundingClientRect()
}

function replaceTriggerWithPill(triggerType: "mention", pillEl: HTMLSpanElement) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range    = sel.getRangeAt(0)
  const textNode = range.startContainer
  if (textNode.nodeType !== Node.TEXT_NODE) return

  const text       = textNode.textContent ?? ""
  const cursorPos  = range.startOffset
  const textBefore = text.slice(0, cursorPos)

  const pattern = triggerType === "mention" ? /@([a-zA-Z\s]*)$/ : /\/([A-Za-z0-9/\-]*)$/
  const match   = textBefore.match(pattern)
  if (!match) return

  const triggerStart = cursorPos - match[0].length
  const before       = text.slice(0, triggerStart)
  const after        = text.slice(cursorPos)
  const parent       = textNode.parentNode!
  const beforeNode   = document.createTextNode(before)
  const spaceNode    = document.createTextNode(" ")
  const afterNode    = document.createTextNode(after)

  parent.replaceChild(afterNode, textNode)
  parent.insertBefore(spaceNode, afterNode)
  parent.insertBefore(pillEl, spaceNode)
  parent.insertBefore(beforeNode, pillEl)

  const newRange = document.createRange()
  newRange.setStart(spaceNode, spaceNode.length)
  newRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(newRange)
}

function extractContent(editor: HTMLDivElement): {
  content: string; mentions: string[]; enquiry_refs: string[]
} {
  const mentions: string[] = []
  const enquiry_refs: string[] = []
  let content = ""

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      content += (node.textContent ?? "").replace(/ /g, " ")
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.getAttribute("data-type") === "mention") {
        const userId = el.getAttribute("data-user-id") ?? ""
        const name   = el.getAttribute("data-name") ?? ""
        content += `@[${name}](${userId})`
        if (userId) mentions.push(userId)
      } else if (el.tagName === "BR") {
        content += "\n"
      } else {
        el.childNodes.forEach(walk)
        if (["DIV", "P"].includes(el.tagName)) content += "\n"
      }
    }
  }

  editor.childNodes.forEach(walk)
  return {
    content:      content.trim(),
    mentions:     [...new Set(mentions)],
    enquiry_refs: [...new Set(enquiry_refs)],
  }
}

function editorIsEmpty(editor: HTMLDivElement | null): boolean {
  if (!editor) return true
  const text  = (editor.textContent ?? "").replace(/ /g, "").trim()
  const pills = editor.querySelectorAll("[data-type]").length
  return text === "" && pills === 0
}

export function MessageInput({ roomId, members, currentUserId }: Props) {
  const editorRef                 = useRef<HTMLDivElement>(null)
  const [isEmpty, setIsEmpty]     = useState(true)
  const [trigger, setTrigger]     = useState<TriggerState | null>(null)

  const sendMessage = useSendMessage(roomId, currentUserId)

  const detectTrigger = useCallback(() => {
    const textBefore = getTextBeforeCursor()
    const rect       = getCursorRect()
    const mentionMatch = textBefore.match(/@([a-zA-Z\s]*)$/)
    if (mentionMatch && rect) {
      setTrigger({ type: "mention", search: mentionMatch[1].trim(), anchorRect: rect })
      return
    }
    setTrigger(null)
  }, [])

  function handleInput() {
    detectTrigger()
    setIsEmpty(editorIsEmpty(editorRef.current))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (trigger) return
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
  }

  function submitMessage() {
    const editor = editorRef.current
    if (!editor || editorIsEmpty(editor) || sendMessage.isPending) return
    const { content, mentions, enquiry_refs } = extractContent(editor)
    if (!content) return
    editor.innerHTML = ""
    setIsEmpty(true)
    setTrigger(null)
    editor.focus()
    sendMessage.mutate({ content, mentions, enquiry_refs })
  }

  function handleSelectMention(member: ChatMember) {
    const pill = document.createElement("span")
    pill.setAttribute("contenteditable", "false")
    pill.setAttribute("data-type", "mention")
    pill.setAttribute("data-user-id", member.user_id)
    pill.setAttribute("data-name", member.full_name ?? "")
    pill.className =
      "inline-flex items-center rounded px-1.5 py-0.5 text-sm font-semibold " +
      "bg-amber-100 text-amber-700 mx-0.5 cursor-default select-none align-baseline"
    pill.textContent = `@${member.full_name}`
    replaceTriggerWithPill("mention", pill)
    setTrigger(null)
    setIsEmpty(false)
    editorRef.current?.focus()
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    document.execCommand("insertText", false, text)
    detectTrigger()
    setIsEmpty(editorIsEmpty(editorRef.current))
  }

  function getAnchorRect(): DOMRect | null {
    return trigger?.anchorRect ?? editorRef.current?.getBoundingClientRect() ?? null
  }

  return (
    <div className="relative">
      {trigger?.type === "mention" && (
        <MentionDropdown
          search={trigger.search}
          members={members}
          onSelect={handleSelectMention}
          onClose={() => setTrigger(null)}
          anchorRect={getAnchorRect()}
        />
      )}

      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className={cn(
              "min-h-[40px] max-h-[160px] overflow-y-auto",
              "w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3.5 py-2.5",
              "text-sm leading-relaxed text-gray-800 dark:text-white/90",
              "focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300",
              "break-words whitespace-pre-wrap",
              "empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 dark:empty:before:text-white/25 empty:before:pointer-events-none"
            )}
            data-placeholder="Message… (@ to mention)"
          />
        </div>

        <button
          type="button"
          onClick={submitMessage}
          disabled={isEmpty || sendMessage.isPending}
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
            "bg-amber-500 text-white hover:bg-amber-600 active:scale-95",
            "disabled:opacity-35 disabled:cursor-not-allowed"
          )}
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>

      {sendMessage.isError && (
        <p className="text-[10px] text-red-500 mt-1 px-0.5">
          Failed to send — {sendMessage.error?.message}
        </p>
      )}
      <p className="text-[10px] text-gray-300 dark:text-white/25 mt-1 px-0.5">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
