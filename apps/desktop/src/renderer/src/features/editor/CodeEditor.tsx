import { useEffect, useRef } from 'react'
import { fontStack } from '@/lib/fonts'
import { monacoShortcut } from '@/lib/shortcuts'
import { useSettings, type Typography } from '@/stores/settings'
import { useWorkspace } from '@/stores/workspace'
import { bindSuggestShortcut } from '@/features/ai/inlineSuggestions'
import { bindTutorActions } from '@/features/ai/tutorActions'
import { TOUR } from '@/features/tour/anchors'
import { languageFor, monaco, pathOf, themeName, uriFor } from './monaco'

const fontOptions = (t: Typography, scale: number): monaco.editor.IEditorOptions => ({
  fontFamily: fontStack(t.monoFont, 'mono'),
  fontSize: Math.round(t.monoSize * scale),
  lineHeight: t.lineHeight,
  fontLigatures: t.ligatures
})

interface Props {
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>
  onEdit(): void
  onCheck(): void
}

export function CodeEditor({ editorRef, onEdit, onCheck }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewStates = useRef(new Map<string, monaco.editor.ICodeEditorViewState | null>())
  const applyingExternal = useRef(false)
  const files = useWorkspace((s) => s.files)
  const activePath = useWorkspace((s) => s.activePath)
  const theme = useSettings((s) => s.theme)
  const codeTheme = useSettings((s) => s.codeTheme)
  const options = useSettings((s) => s.editor)
  const editorScale = useSettings((s) => s.textScale.editor)
  const typography = useSettings((s) => s.typography)

  useEffect(() => {
    const { theme, codeTheme, textScale, typography } = useSettings.getState()
    const editor = monaco.editor.create(hostRef.current!, {
      model: null,
      theme: themeName(codeTheme, theme),
      ...fontOptions(typography, textScale.editor),
      folding: true,
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      overviewRulerBorder: false,
      smoothScrolling: true,
      automaticLayout: true,
      padding: { top: 12 },
      scrollBeyondLastLine: false,
      tabSize: 2,
      inlineSuggest: { enabled: true },
      bracketPairColorization: { enabled: false },
      renderLineHighlight: 'line'
    })
    editorRef.current = editor
    editor.addCommand(monacoShortcut('save', monaco), () => {
      void useWorkspace.getState().flush()
    })
    editor.addCommand(monacoShortcut('check', monaco), onCheck)
    editor.addCommand(monacoShortcut('closeFile', monaco), () => {
      const { activePath, closeFile } = useWorkspace.getState()
      if (activePath) closeFile(activePath)
    })
    bindSuggestShortcut(monaco, editor)
    bindTutorActions(monaco, editor)
    return () => {
      editor.dispose()
      editorRef.current = null
    }
  }, [editorRef, onCheck])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const listener = editor.onDidChangeModelContent(() => {
      const model = editor.getModel()
      if (applyingExternal.current || !model) return
      useWorkspace.getState().edit(pathOf(model.uri), model.getValue())
      onEdit()
    })
    return () => listener.dispose()
  }, [editorRef, onEdit])

  useEffect(() => {
    const wanted = new Set<string>()
    for (const file of files) {
      const uri = uriFor(file.path)
      wanted.add(uri.toString())
      const model = monaco.editor.getModel(uri)
      if (!model) {
        monaco.editor.createModel(file.content, languageFor(file.path), uri)
      } else if (model.getValue() !== file.content) {
        // Changed on disk (terminal, reset): replace as one undoable edit and do not echo it back.
        applyingExternal.current = true
        model.pushEditOperations(
          [],
          [{ range: model.getFullModelRange(), text: file.content }],
          () => null
        )
        applyingExternal.current = false
      }
    }
    for (const model of monaco.editor.getModels()) {
      const key = model.uri.toString()
      if (model.uri.scheme === 'file' && !wanted.has(key)) {
        viewStates.current.delete(key)
        model.dispose()
      }
    }
  }, [files])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const next = activePath ? monaco.editor.getModel(uriFor(activePath)) : null
    const current = editor.getModel()
    if (current === next) return
    if (current) viewStates.current.set(current.uri.toString(), editor.saveViewState())
    editor.setModel(next)
    const saved = next && viewStates.current.get(next.uri.toString())
    if (saved) editor.restoreViewState(saved)
  }, [activePath, files, editorRef])

  useEffect(() => {
    monaco.editor.setTheme(themeName(codeTheme, theme))
  }, [codeTheme, theme])

  useEffect(() => {
    editorRef.current?.updateOptions({
      wordWrap: options.wordWrap ? 'on' : 'off',
      lineNumbers: options.lineNumbers ? 'on' : 'off',
      minimap: { enabled: options.minimap }
    })
  }, [options, editorRef])

  useEffect(() => {
    editorRef.current?.updateOptions(fontOptions(typography, editorScale))
    // Monaco caches glyph widths per font; a new font needs them measured again.
    monaco.editor.remeasureFonts()
  }, [typography, editorScale, editorRef])

  return <div ref={hostRef} data-tour={TOUR.editor} className="h-full min-w-0 flex-1" />
}
