import type * as Monaco from 'monaco-editor'
import type { TaskProgress } from '@shared/types'
import { chapterKey } from '@shared/rules'
import { monacoShortcut } from '@/lib/shortcuts'
import { useProgress } from '@/stores/progress'
import { useWorkspace } from '@/stores/workspace'
import { useAi } from './aiStore'
import { codeAttachment, taskForFile } from './attachments'
import { useChat } from './chatStore'

function chapterTasks(): Record<string, TaskProgress> {
  const chapter = useWorkspace.getState().chapter
  if (!chapter) return {}
  return (
    useProgress.getState().progress?.chapters[chapterKey(chapter.labId, chapter.id)]?.tasks ?? {}
  )
}

/** The selection, or the line under the cursor when nothing is selected. */
function selectedCode(
  editor: Monaco.editor.ICodeEditor
): { path: string; code: string; start: number; end: number } | null {
  const model = editor.getModel()
  const selection = editor.getSelection()
  if (!model || !selection) return null
  const path = model.uri.path.slice(1)
  if (selection.isEmpty()) {
    const line = selection.startLineNumber
    const code = model.getLineContent(line)
    return code.trim() ? { path, code, start: line, end: line } : null
  }
  // A selection that ends at column 1 does not include that last line.
  const end =
    selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber
      ? selection.endLineNumber - 1
      : selection.endLineNumber
  const code = model.getValueInRange(selection)
  return code.trim() ? { path, code, start: selection.startLineNumber, end } : null
}

function explain(editor: Monaco.editor.ICodeEditor): void {
  const picked = selectedCode(editor)
  const chapter = useWorkspace.getState().chapter
  if (!picked || !chapter) return
  const task = taskForFile(chapter.tasks, chapterTasks(), picked.path)
  useChat.getState().ask('Explain this code.', {
    attachment: codeAttachment(picked.path, picked.code, picked.start, picked.end),
    focus: task ? { task: task.number } : undefined
  })
}

function whyFails(editor: Monaco.editor.ICodeEditor): void {
  const picked = selectedCode(editor)
  const chapter = useWorkspace.getState().chapter
  if (!picked || !chapter) return
  const task = taskForFile(chapter.tasks, chapterTasks(), picked.path, true)
  if (!task) return
  const failing = chapterTasks()[task.task.id]?.lastResult?.details.find((d) => !d.passed)
  useChat.getState().ask(`Why does this fail task ${task.number}, "${task.task.title}"?`, {
    attachment: codeAttachment(picked.path, picked.code, picked.start, picked.end),
    focus: { task: task.number, check: failing?.name }
  })
}

/** Adds "Explain this" and "Why does this fail?" to the editor's menu while the tutor is on. */
export function bindTutorActions(
  monaco: typeof Monaco,
  editor: Monaco.editor.IStandaloneCodeEditor
): void {
  const tutorOn = editor.createContextKey<boolean>('tutorOn', false)
  const hasFailure = editor.createContextKey<boolean>('tutorHasFailure', false)
  const sync = (): void => {
    const { config } = useAi.getState()
    tutorOn.set(!!config?.enabled && !!config.provider)
    hasFailure.set(Object.values(chapterTasks()).some((t) => t.lastResult?.passed === false))
  }
  sync()
  editor.onDidDispose(useAi.subscribe(sync))
  editor.onDidDispose(useProgress.subscribe(sync))
  editor.onDidDispose(
    useWorkspace.subscribe((s, previous) => s.chapter !== previous.chapter && sync())
  )

  editor.addAction({
    id: 'indent.tutor.explain',
    label: 'Explain this',
    precondition: 'tutorOn',
    keybindings: [monacoShortcut('explainCode', monaco)],
    contextMenuGroupId: 'tutor',
    contextMenuOrder: 1,
    run: explain
  })
  editor.addAction({
    id: 'indent.tutor.whyFails',
    label: 'Why does this fail?',
    precondition: 'tutorOn && tutorHasFailure',
    contextMenuGroupId: 'tutor',
    contextMenuOrder: 2,
    run: whyFails
  })
}
