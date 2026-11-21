import type { AiAttachment, CheckDetail, TaskDef, TaskProgress } from '@shared/types'

export const MAX_CODE_CHARS = 4_000
export const MAX_OUTPUT_CHARS = 1_500

/** What the tutor is looking at, shown as one line at the top of the chat. */
export interface TutorFocus {
  task: number
  check?: string
}

export function clipText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}\n...` : text
}

export function codeAttachment(
  path: string,
  code: string,
  startLine: number,
  endLine: number
): AiAttachment {
  const lines = startLine === endLine ? `line ${startLine}` : `lines ${startLine} to ${endLine}`
  const extension = path.includes('.') ? path.split('.').pop()?.toLowerCase() : undefined
  return {
    kind: 'code',
    label: `${path}, ${lines}`,
    text: clipText(code.replace(/\s+$/, ''), MAX_CODE_CHARS),
    language: extension
  }
}

export function checkAttachment(detail: CheckDetail): AiAttachment {
  const parts = [
    detail.message,
    detail.output && `What the code produced:\n${clipText(detail.output, MAX_OUTPUT_CHARS)}`
  ]
  return {
    kind: 'check',
    label: `Check: ${detail.name}`,
    text: parts.filter(Boolean).join('\n\n') || 'This check did not pass.'
  }
}

export function hintAttachment(hint: string, number: number): AiAttachment {
  return { kind: 'hint', label: `Hint ${number}`, text: clipText(hint.trim(), MAX_CODE_CHARS) }
}

export function focusLine(focus: TutorFocus): string {
  return focus.check
    ? `Looking at task ${focus.task}, check "${focus.check}"`
    : `Looking at task ${focus.task}`
}

/** The task a snippet from this file most likely belongs to: the first one not passed yet. */
export function taskForFile(
  tasks: TaskDef[],
  progress: Record<string, TaskProgress>,
  path: string,
  onlyFailed = false
): { task: TaskDef; number: number } | null {
  const candidates = tasks
    .map((task, i) => ({ task, number: i + 1, progress: progress[task.id] }))
    .filter((t) => (onlyFailed ? t.progress?.lastResult?.passed === false : !t.progress?.passed))
  const match = candidates.find((t) => t.task.file === path) ?? (onlyFailed ? candidates[0] : null)
  return match ? { task: match.task, number: match.number } : null
}
