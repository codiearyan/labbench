import { describe, expect, it } from 'vitest'
import type * as Monaco from 'monaco-editor'
import { formatKeys, matchesKeys, SHORTCUTS, toMonacoKeys } from './shortcuts'

const KeyMod = { CtrlCmd: 2048, Shift: 1024, Alt: 512, WinCtrl: 256 }
const KeyCode = {
  Enter: 3,
  Escape: 9,
  Space: 10,
  Comma: 87,
  Backslash: 93,
  KeyE: 35,
  KeyS: 49,
  Digit1: 22
}
const monaco = { KeyMod, KeyCode } as unknown as Pick<typeof Monaco, 'KeyMod' | 'KeyCode'>

const press = (
  key: string,
  mods: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}
): Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'> => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods
})

describe('formatKeys', () => {
  it('writes symbols on macOS, in the order the system uses', () => {
    expect(formatKeys('Mod+Enter', 'darwin')).toBe('⌘↵')
    expect(formatKeys('Alt+\\', 'darwin')).toBe('⌥\\')
    expect(formatKeys('Mod+,', 'darwin')).toBe('⌘,')
    expect(formatKeys('Mod+Shift+Alt+k', 'darwin')).toBe('⌥⇧⌘K')
    expect(formatKeys('ArrowLeft', 'darwin')).toBe('←')
  })

  it('writes names joined by + elsewhere', () => {
    for (const platform of ['win32', 'linux']) {
      expect(formatKeys('Mod+Enter', platform)).toBe('Ctrl+Enter')
      expect(formatKeys('Alt+\\', platform)).toBe('Alt+\\')
      expect(formatKeys('Mod+Shift+Alt+k', platform)).toBe('Ctrl+Alt+Shift+K')
      expect(formatKeys('Escape', platform)).toBe('Esc')
    }
  })
})

describe('matchesKeys', () => {
  it('takes Cmd or Ctrl for Mod, as the app always has on every platform', () => {
    expect(matchesKeys(press(',', { metaKey: true }), 'Mod+,')).toBe(true)
    expect(matchesKeys(press(',', { ctrlKey: true }), 'Mod+,')).toBe(true)
    expect(matchesKeys(press(','), 'Mod+,')).toBe(false)
    expect(matchesKeys(press('.', { metaKey: true }), 'Mod+,')).toBe(false)
  })

  it('needs every modifier it names and leaves the others to the caller', () => {
    expect(matchesKeys(press('Enter', { altKey: true }), 'Alt+Enter')).toBe(true)
    expect(matchesKeys(press('Enter'), 'Alt+Enter')).toBe(false)
    expect(matchesKeys(press('Enter', { shiftKey: true }), 'Enter')).toBe(true)
    expect(matchesKeys(press('S', { shiftKey: true, metaKey: true }), 'Mod+Shift+S')).toBe(true)
  })

  it('reads the space bar and letters in either case', () => {
    expect(matchesKeys(press(' '), 'Space')).toBe(true)
    expect(matchesKeys(press('s', { ctrlKey: true }), 'Mod+S')).toBe(true)
    expect(matchesKeys(press('ArrowRight'), 'ArrowLeft')).toBe(false)
  })
})

describe('toMonacoKeys', () => {
  it('maps the editor shortcuts', () => {
    expect(toMonacoKeys(SHORTCUTS.save.keys, monaco)).toBe(KeyMod.CtrlCmd | KeyCode.KeyS)
    expect(toMonacoKeys(SHORTCUTS.check.keys, monaco)).toBe(KeyMod.CtrlCmd | KeyCode.Enter)
    expect(toMonacoKeys(SHORTCUTS.suggest.keys, monaco)).toBe(KeyMod.Alt | KeyCode.Backslash)
    expect(toMonacoKeys(SHORTCUTS.explainCode.keys, monaco)).toBe(
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE
    )
  })

  it('maps digits, Shift and named keys', () => {
    expect(toMonacoKeys('Mod+Shift+1', monaco)).toBe(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Digit1)
    expect(toMonacoKeys('Escape', monaco)).toBe(KeyCode.Escape)
  })

  it('refuses a key it has no code for', () => {
    expect(() => toMonacoKeys('Mod+ArrowUp', monaco)).toThrow()
  })
})
