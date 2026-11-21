import { create } from 'zustand'
import type { AiAttachment, AiChatEvent, AiMessage, CheckResult } from '@shared/types'
import { chapterKey } from '@shared/rules'
import { api } from '@/lib/api'
import { track } from '@/lib/telemetry'
import { useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { useWorkspace } from '@/stores/workspace'
import { activeProvider, useAi } from './aiStore'
import type { TutorFocus } from './attachments'

/** Learner messages per chapter per app session; enforced only for API-key providers. */
export const MESSAGE_BUDGET = 10

interface ChatStore {
  /** Kept in memory for the app session, keyed by `${labId}/${chapterId}`. */
  threads: Record<string, AiMessage[]>
  sent: Record<string, number>
  focuses: Record<string, TutorFocus | null>
  /** The open chapter's thread. */
  messages: AiMessage[]
  /** A reply is streaming. */
  busy: boolean
  error: string | null
  /** Messages left this session for the open chapter. */
  remaining: number
  /** The task and check the open chapter's thread is about. */
  focus: TutorFocus | null
  send(text: string, context?: AskContext): Promise<void>
  stop(): void
  /** Opens the chat panel and sends the question, e.g. "Why did task 2 fail?". */
  ask(question: string, context?: AskContext): void
}

/** What a question is about; a question asked with a context replaces the thread's focus. */
export interface AskContext {
  attachment?: AiAttachment
  focus?: TutorFocus
}

let requestId: string | null = null
let early: AiChatEvent[] = []
let turn = 0

function currentKey(): string | null {
  const chapter = useWorkspace.getState().chapter
  return chapter ? chapterKey(chapter.labId, chapter.id) : null
}

function isBudgeted(): boolean {
  return activeProvider(useAi.getState().config)?.kind === 'api'
}

export const useChat = create<ChatStore>()((set, get) => {
  const setThread = (key: string, update: (messages: AiMessage[]) => AiMessage[]): void => {
    set((s) => {
      const thread = update(s.threads[key] ?? [])
      return {
        threads: { ...s.threads, [key]: thread },
        ...(key === currentKey() ? { messages: thread } : {})
      }
    })
  }

  /** Drops the reply placeholder if nothing arrived. */
  const finish = (key: string, error: string | null): void => {
    requestId = null
    setThread(key, (thread) => {
      const last = thread[thread.length - 1]
      return last?.role === 'assistant' && !last.content ? thread.slice(0, -1) : thread
    })
    set({ busy: false, error })
  }

  let streamingKey = ''

  const onEvent = (event: AiChatEvent): void => {
    if (event.requestId !== requestId) {
      if (get().busy && requestId === null) early.push(event)
      return
    }
    if (event.type === 'delta') {
      setThread(streamingKey, (thread) => {
        const last = thread[thread.length - 1]
        return [...thread.slice(0, -1), { ...last, content: last.content + event.text }]
      })
    } else {
      finish(streamingKey, event.type === 'error' ? event.message : null)
    }
  }
  api.ai.onChatEvent(onEvent)

  return {
    threads: {},
    sent: {},
    focuses: {},
    messages: [],
    busy: false,
    error: null,
    remaining: MESSAGE_BUDGET,
    focus: null,

    send: async (text, context) => {
      const question = text.trim()
      const { chapter, files, activePath } = useWorkspace.getState()
      if (!question || !chapter || get().busy) return
      const key = chapterKey(chapter.labId, chapter.id)
      if (isBudgeted() && get().remaining <= 0) return

      track('tutor_asked', { repo: chapter.labId, issue: chapter.id })
      const message: AiMessage = { role: 'user', content: question }
      if (context?.attachment) message.attachment = context.attachment
      const history = [...(get().threads[key] ?? []), message]
      const sent = (get().sent[key] ?? 0) + 1
      set((s) => ({
        sent: { ...s.sent, [key]: sent },
        ...(context
          ? {
              focuses: { ...s.focuses, [key]: context.focus ?? null },
              focus: context.focus ?? null
            }
          : {}),
        remaining: Math.max(0, MESSAGE_BUDGET - sent),
        busy: true,
        error: null
      }))
      setThread(key, () => [...history, { role: 'assistant', content: '' }])
      streamingKey = key
      const thisTurn = ++turn
      requestId = null
      early = []

      const tasks = useProgress.getState().progress?.chapters[key]?.tasks ?? {}
      const lastCheck = Object.values(tasks).flatMap((t): CheckResult[] =>
        t.lastResult ? [t.lastResult] : []
      )
      try {
        const id = await api.ai.chat({
          labId: chapter.labId,
          chapterId: chapter.id,
          messages: history,
          activeFile: files.find((f) => f.path === activePath),
          lastCheck
        })
        // Stopped while the request was starting.
        if (!get().busy || thisTurn !== turn) return api.ai.cancel(id)
        requestId = id
        const pending = early
        early = []
        for (const event of pending) onEvent(event)
      } catch (error) {
        if (thisTurn === turn) finish(key, error instanceof Error ? error.message : String(error))
      }
    },

    stop: () => {
      if (requestId) api.ai.cancel(requestId)
      if (get().busy) finish(streamingKey, null)
    },

    ask: (question, context) => {
      if (!useAi.getState().config?.enabled) return
      useSettings.getState().setPanel('chat', true)
      void get().send(question, context)
    }
  }
})

useWorkspace.subscribe((state, previous) => {
  if (state.chapter === previous.chapter) return
  useChat.getState().stop()
  const key = currentKey()
  const { threads, sent, focuses } = useChat.getState()
  useChat.setState({
    messages: key ? (threads[key] ?? []) : [],
    focus: key ? (focuses[key] ?? null) : null,
    remaining: Math.max(0, MESSAGE_BUDGET - (key ? (sent[key] ?? 0) : 0)),
    error: null
  })
})
