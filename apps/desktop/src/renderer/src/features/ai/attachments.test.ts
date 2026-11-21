import { describe, expect, it } from 'vitest'
import type { TaskDef } from '@shared/types'
import {
  checkAttachment,
  clipText,
  codeAttachment,
  focusLine,
  hintAttachment,
  MAX_CODE_CHARS,
  MAX_OUTPUT_CHARS,
  taskForFile
} from './attachments'

const task = (id: string, file: string): TaskDef => ({
  id,
  title: id,
  file,
  description: '',
  nextSteps: [],
  hints: [],
  points: 10
})

describe('codeAttachment', () => {
  it('labels the file and lines and fences by extension', () => {
    expect(codeAttachment('src/orders.js', 'const a = 1\n\n', 3, 3)).toEqual({
      kind: 'code',
      label: 'src/orders.js, line 3',
      text: 'const a = 1',
      language: 'js'
    })
    expect(codeAttachment('query.SQL', 'select 1', 2, 5).label).toBe('query.SQL, lines 2 to 5')
    expect(codeAttachment('query.SQL', 'select 1', 2, 5).language).toBe('sql')
    expect(codeAttachment('Makefile', 'all:', 1, 1).language).toBeUndefined()
  })

  it('cuts very long code', () => {
    const text = codeAttachment('a.ts', 'x'.repeat(MAX_CODE_CHARS * 2), 1, 400).text
    expect(text.length).toBeLessThanOrEqual(MAX_CODE_CHARS + 4)
    expect(text.endsWith('\n...')).toBe(true)
  })
})

describe('checkAttachment', () => {
  it('holds the message and a cut copy of the output', () => {
    const attachment = checkAttachment({
      name: 'sorts by units',
      passed: false,
      message: 'Look at the order.',
      output: 'y'.repeat(MAX_OUTPUT_CHARS + 50)
    })
    expect(attachment.kind).toBe('check')
    expect(attachment.label).toBe('Check: sorts by units')
    expect(attachment.text.startsWith('Look at the order.\n\nWhat the code produced:\n')).toBe(true)
    expect(attachment.text.endsWith('\n...')).toBe(true)
  })

  it('still says something for a check with no message or output', () => {
    expect(checkAttachment({ name: 'runs', passed: false }).text).toBe('This check did not pass.')
  })
})

describe('hints, focus and clipping', () => {
  it('labels a hint by its number', () => {
    expect(hintAttachment('  Think about order.  ', 2)).toEqual({
      kind: 'hint',
      label: 'Hint 2',
      text: 'Think about order.'
    })
  })

  it('writes the focus line', () => {
    expect(focusLine({ task: 2 })).toBe('Looking at task 2')
    expect(focusLine({ task: 2, check: 'sorts by units' })).toBe(
      'Looking at task 2, check "sorts by units"'
    )
  })

  it('leaves short text alone', () => {
    expect(clipText('abc', 3)).toBe('abc')
  })
})

describe('taskForFile', () => {
  const tasks = [task('a', 'one.js'), task('b', 'two.js'), task('c', 'two.js')]

  it('picks the first task of the file that has not passed', () => {
    const progress = { b: { passed: true, pointsEarned: 10, failedChecks: 0 } }
    expect(taskForFile(tasks, progress as never, 'two.js')?.task.id).toBe('c')
    expect(taskForFile(tasks, {}, 'other.js')).toBeNull()
  })

  it('for a failure, prefers a failed task of the file, then any failed task', () => {
    const failed = { passed: false, details: [], durationMs: 1, at: '', taskId: 'x' }
    const progress = { a: { lastResult: failed }, c: { lastResult: failed } }
    expect(taskForFile(tasks, progress as never, 'two.js', true)?.number).toBe(3)
    expect(taskForFile(tasks, progress as never, 'other.js', true)?.number).toBe(1)
    expect(taskForFile(tasks, {}, 'two.js', true)).toBeNull()
  })
})
