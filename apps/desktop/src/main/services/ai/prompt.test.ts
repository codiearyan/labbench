import { describe, expect, it } from 'vitest'
import type { ChapterDef } from '@shared/types'
import { cliInvocation } from './cli'
import {
  cleanCompletion,
  cleanTip,
  maskKey,
  tipPrompt,
  transcript,
  trimHistory,
  tutorSystemPrompt,
  withAttachment
} from './prompt'

const chapter: ChapterDef = {
  id: 'ch1',
  title: 'A reply cut short',
  files: ['notice.ts'],
  terminal: { description: 'shell' },
  tasks: [
    {
      id: 'fix',
      title: 'Never send a cut notice',
      file: 'notice.ts',
      description: 'Read finish_reason.',
      nextSteps: ['Log the reply'],
      hints: ['SECRET HINT'],
      points: 10
    }
  ]
}

describe('tutorSystemPrompt', () => {
  it('includes lesson, tasks, open file and checks, but not hints', () => {
    const prompt = tutorSystemPrompt({
      chapter,
      lesson: '## Why replies stop\nThey hit max_tokens.',
      activeFile: { path: 'notice.ts', content: 'export const x = 1' },
      lastCheck: [
        {
          taskId: 'fix',
          passed: false,
          durationMs: 1,
          at: '',
          details: [
            {
              name: 'long notice',
              passed: false,
              message: 'Look at finish_reason',
              output: 'length'
            }
          ]
        }
      ]
    })
    expect(prompt).toContain('Why replies stop')
    expect(prompt).toContain('Never send a cut notice')
    expect(prompt).toContain('export const x = 1')
    expect(prompt).toContain('Look at finish_reason')
    expect(prompt).not.toContain('SECRET HINT')
  })

  it("lists each task's docs and how its checks went", () => {
    const withDocs: ChapterDef = {
      ...chapter,
      tasks: [{ ...chapter.tasks[0], docs: [{ title: 'Finish reason', url: 'https://x.dev/f' }] }]
    }
    const prompt = tutorSystemPrompt({
      chapter: withDocs,
      lesson: '',
      progress: {
        nonGreenChecks: 3,
        startedAt: '',
        lastOpenedAt: '',
        tasks: {
          fix: {
            passed: false,
            pointsEarned: 0,
            failedChecks: 3,
            failedNames: { 'short notice': 1, 'long notice': 3 }
          }
        }
      }
    })
    expect(prompt).toContain('[Finish reason](https://x.dev/f)')
    expect(prompt).toContain(
      'fix: failed 3 checks; failing most: long notice (3), short notice (1)'
    )
  })

  it('says when no check ran yet', () => {
    expect(tutorSystemPrompt({ chapter, lesson: '' })).toContain('has not run a check yet')
  })
})

describe('tip', () => {
  it('gives the task, its docs, its history and the file, and keeps the reply short', () => {
    const task = { ...chapter.tasks[0], docs: [{ title: 'Finish reason', url: 'https://x.dev/f' }] }
    const prompt = tipPrompt(
      task,
      { passed: false, pointsEarned: 0, failedChecks: 3, failedNames: { 'long notice': 3 } },
      { path: 'notice.ts', content: 'export const x = 1' }
    )
    expect(prompt).toContain('Read finish_reason.')
    expect(prompt).toContain('Finish reason')
    expect(prompt).toContain('long notice (3)')
    expect(prompt).toContain('export const x = 1')
    expect(cleanTip('  ok  ')).toBe('ok')
    expect(cleanTip('a'.repeat(700))).toHaveLength(603)
  })
})

describe('history', () => {
  it('drops empty and leading assistant turns', () => {
    expect(
      trimHistory([
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'why?' },
        { role: 'assistant', content: '' }
      ])
    ).toEqual([{ role: 'user', content: 'why?' }])
  })

  it('writes earlier turns as a transcript for CLIs', () => {
    expect(transcript([{ role: 'user', content: 'q' }])).toBe('q')
    const text = transcript([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' }
    ])
    expect(text).toContain('Learner: q1')
    expect(text).toContain('Tutor: a1')
    expect(text.endsWith('q2')).toBe(true)
  })
})

describe('attachments', () => {
  it('folds an attached snippet above the question and drops the field', () => {
    const [message] = trimHistory([
      {
        role: 'user',
        content: 'Explain this code.',
        attachment: {
          kind: 'code',
          label: 'orders.js, line 3',
          text: 'const a = 1',
          language: 'js'
        }
      }
    ])
    expect(message).toEqual({
      role: 'user',
      content: 'Attached code (orders.js, line 3):\n\n```js\nconst a = 1\n```\n\nExplain this code.'
    })
  })

  it('uses a longer fence when the text holds backticks', () => {
    const text = withAttachment('Why?', { kind: 'check', label: 'Check: md', text: 'a ``` b' })
    expect(text).toContain('````\na ``` b\n````')
  })

  it('cuts very long text and ignores a malformed attachment', () => {
    const long = withAttachment('q', { kind: 'code', label: 'x', text: 'a'.repeat(10_000) })
    expect(long.length).toBeLessThan(6_200)
    expect(long).toContain('[... cut ...]')
    const bad = { kind: 'file', label: 'x', text: 'y' } as unknown as Parameters<
      typeof withAttachment
    >[1]
    expect(withAttachment('q', bad)).toBe('q')
    expect(withAttachment('q', { kind: 'hint', label: 'x', text: '  ' })).toBe('q')
  })

  it('drops a language that is not a plain name', () => {
    const text = withAttachment('q', { kind: 'code', label: 'x', text: 'y', language: 'js\n# x' })
    expect(text.startsWith('Attached code (x):\n\n```\ny')).toBe(true)
  })
})

describe('completions', () => {
  it('strips fences and keeps a few lines', () => {
    expect(cleanCompletion('```ts\nconst a = 1\n```')).toBe('const a = 1')
    expect(cleanCompletion('   \n')).toBe('')
    expect(
      cleanCompletion(Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n')).split('\n')
    ).toHaveLength(6)
  })
})

describe('maskKey', () => {
  it('never shows the middle of a key', () => {
    expect(maskKey('sk-ant-api03-abcdefghijklmnop-WXYZ')).toBe('sk-••••WXYZ')
    expect(maskKey('short')).toBe('••••')
  })
})

describe('cliInvocation', () => {
  const run = { model: null, system: 'SYS', prompt: 'hello' }

  it('runs Claude Code with no tools and its own system prompt, prompt on stdin', () => {
    const { args, stdin } = cliInvocation('claude-code', run, '/tmp/x')
    expect(args).toEqual(expect.arrayContaining(['-p', '--tools', '', '--system-prompt', 'SYS']))
    expect(args[args.indexOf('--tools') + 1]).toBe('')
    expect(stdin).toBe('hello')
  })

  it('runs Codex read-only outside a git repo, prompt on stdin', () => {
    const { args, stdin } = cliInvocation('codex', { ...run, model: 'm' }, '/tmp/x')
    expect(args).toEqual(
      expect.arrayContaining([
        'exec',
        '--json',
        'read-only',
        '--skip-git-repo-check',
        '--model',
        'm'
      ])
    )
    expect(args.at(-1)).toBe('-')
    expect(stdin).toContain('SYS')
  })

  it('runs OpenCode with every permission denied', () => {
    const { args, env } = cliInvocation('opencode', run, '/tmp/x')
    expect(args.slice(0, 5)).toEqual(['run', '--format', 'json', '--dir', '/tmp/x'])
    expect(JSON.parse(env!.OPENCODE_CONFIG_CONTENT)).toEqual({ permission: { '*': 'deny' } })
  })
})
