// The contract between content packs, the main process and the renderer.

// ---------- Content ----------

/** A development tool a repo can need on the learner's computer. */
export type ToolId = 'node' | 'git'
export const TOOL_IDS: ToolId[] = ['node', 'git']

/** content/labs/<labId>/lab.json */
/**
 * How much a repo asks. Easy keeps each issue in one file, medium spreads a change over a few
 * files, hard is a whole project laid out by its own conventions.
 */
export type Level = 'easy' | 'medium' | 'hard'

export interface LabMeta {
  id: string
  title: string
  description: string
  /** Shelf shown as a filter chip, e.g. "AI engineering". */
  category: string
  /** Lowercase language id, e.g. "typescript". Drives the card icon and editor language. */
  language: string
  /** Short labels on the card, e.g. ["TypeScript", "Interview"]. */
  tags: string[]
  /** Optional so a pack without one still loads; it then matches no level filter. */
  level?: Level
  /** What this repo needs from the app, compared with PACK_FORMAT; 1 when missing. */
  format?: number
  /** Tools it needs on the computer; Node alone when missing. */
  tools?: ToolId[]
  parts: { title: string; chapters: string[] }[]
}

export interface ChapterSummary {
  id: string
  number: number
  title: string
  part: string
  taskCount: number
  points: number
}

export interface LabSummary extends LabMeta {
  chapters: ChapterSummary[]
  /** The repo's own flow.json, on the repo page; missing when it has none or is not on disk. */
  scene?: FlowScene
  /** Missing when the repo is on disk: `download` when it is in the library, `app-update` when it needs a newer app. */
  availability?: 'download' | 'app-update'
}

/** One repo in the library's index.json. */
export interface PackEntry {
  id: string
  /** A hash of the repo's files. */
  version: string
  format: number
  /** The archive, relative to the index. */
  file: string
  size: number
  sha256: string
  /** The cover picture, relative to the index. */
  cover?: string
  summary: LabSummary
}

export interface PackIndex {
  paths: PathDef[]
  labs: PackEntry[]
}

export type InstallFailure = 'offline' | 'missing' | 'damaged' | 'no-space' | 'broken' | 'too-new'

export type InstallResult = { ok: true } | { ok: false; reason: InstallFailure; message: string }

export interface TaskDef {
  id: string
  title: string
  /** The file this task is mostly about. */
  file: string
  /** Markdown. */
  description: string
  /** "Next step": short ordered steps, no answers. */
  nextSteps: string[]
  /** Exactly three, from a light nudge to "almost there". */
  hints: string[]
  /** Official reference pages that explain what the task tests; shown after repeated fails. */
  docs?: DocLink[]
  points: number
}

export interface DocLink {
  title: string
  url: string
}

/** content/labs/<labId>/<chapterId>/chapter.json */
export interface ChapterDef {
  id: string
  title: string
  /** Editor tab order; paths relative to the workspace. */
  files: string[]
  terminal: { description: string; suggestedCommand?: string }
  /** A page of the workspace to show in the Browser panel, e.g. "index.html". */
  preview?: string
  tasks: TaskDef[]
}

export interface Chapter extends ChapterDef {
  labId: string
  labTitle: string
  number: number
  /** lesson.md. `##` headings split it into the parts the audio player reads. */
  lesson: string
  prevChapterId?: string
  nextChapterId?: string
  /** flow.json; missing when the issue has none or it does not pass the checks in flow.ts. */
  flow?: Flow
}

/** What a box in a flow stands for: a part of the story, a file, a function or a piece of data. */
export type FlowNodeKind = 'story' | 'file' | 'function' | 'data'

export interface FlowNode {
  id: string
  label: string
  kind: FlowNodeKind
  /** The learner's part, the one place a flow uses the brand colour. */
  mine?: boolean
}

export interface FlowEdge {
  from: string
  to: string
  label?: string
}

/** The parts of a system and what goes between them. */
export interface FlowScene {
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** One plain sentence about what this issue or repo changes in the system. */
  note: string
}

/** Example data shown at a step, in the shapes the Patterns views draw. */
export type FlowValue =
  | { kind: 'array'; label?: string; values: (number | string)[] }
  | { kind: 'map'; label?: string; entries: { key: string; value: number | string }[] }
  | {
      kind: 'grid'
      label?: string
      cells: (number | string)[][]
      rowLabels?: string[]
      colLabels?: string[]
    }

export interface FlowStep {
  /** Node ids, and edges written as `from->to`. */
  active: string[]
  value?: FlowValue
  /** What happens at this step, in the story's words; also what a screen reader reads. */
  note: string
}

/**
 * <issue>/flow.json, or labs/<labId>/flow.json with only a scene. Data only: it shows what goes
 * in and the shape of what comes out, never a task's answer.
 */
export interface Flow {
  scene: FlowScene
  /** Keyed by task id. */
  tasks?: Record<string, { steps: FlowStep[] }>
}

/** content/paths.json */
export interface PathDef {
  id: string
  title: string
  tagline: string
  description: string
  stages: { title: string; labs: string[] }[]
}

// ---------- Workspace ----------

export interface WorkspaceFile {
  path: string
  content: string
}

/** Where the work would move after a folder was picked. */
export interface FolderMove {
  from: string
  to: string
  /** The picked folder had files, so `to` is a new folder inside it. */
  inside: boolean
}

export interface WorkspaceSnapshot {
  /** Absolute folder on disk; the terminal opens here. */
  dir: string
  files: WorkspaceFile[]
  /**
   * The starter files this workspace was given, by path, to tell which files the learner has
   * changed. A workspace from before these were kept gets the issue's current starter.
   */
  starter: Record<string, string>
  /** Starter files the learner changed that a repo update changed too, waiting for a choice. */
  conflicts: string[]
  /** Files this open brought up to the repo's new version. */
  updated: string[]
  /**
   * The workspace knows which starter it was given, so Reset keeps the files the learner added.
   * False for a workspace from before that was kept: Reset empties it.
   */
  remembered: boolean
}

/** For a conflicted file: keep the learner's version, or replace it with the new one. */
export type ConflictChoice = 'mine' | 'new'

// ---------- Checks ----------

export interface CheckDetail {
  name: string
  passed: boolean
  /** Plain words: what to look at. Never the answer. */
  message?: string
  /** What the learner's code actually produced. */
  output?: string
}

export interface CheckResult {
  taskId: string
  passed: boolean
  details: CheckDetail[]
  durationMs: number
  at: string
  /** Set when the check could not run at all (Node missing, runtime install failed, timeout). */
  error?: string
}

export interface RuntimeStatus {
  /** Node version found on the machine, or null. */
  node: string | null
  /** Lab dependencies (vitest, typescript, openai) are installed. */
  ready: boolean
  /** They are being installed now. */
  installing?: boolean
  error?: string
  /** The end of the npm output when the install failed. */
  details?: string
}

/** Something the repos need on this computer, such as Node. */
export interface LabModelStatus {
  state: 'starting' | 'running' | 'failed'
  /** Why it is not running, in plain words. */
  reason?: string
  /** It cannot start until Node.js is there. */
  nodeMissing?: boolean
}

/** A Node.js found on the computer that the repos could run with. */
export interface NodeOption {
  bin: string
  version: string
  /** Where it comes from: "nvm", "Homebrew", "the app's copy", "on this computer". */
  source: string
  /** 22.18 or newer. */
  supported: boolean
}

/** Where the app's own update is. */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'current'; version: string }
  | { state: 'available'; version: string; notes: string[]; size: number }
  | { state: 'downloading'; version: string; done: number; size: number }
  | { state: 'ready'; version: string }
  | { state: 'failed'; message: string; version?: string }

export interface ToolInstallResult {
  tools: ToolStatus[]
  /** An installer opened in its own window; the person finishes it there, then checks again. */
  waiting?: boolean
  /** Nothing here can install it; the page to get it by hand. */
  url?: string
}

export interface ToolStatus {
  id: ToolId
  label: string
  /** The version found, or null when the tool is missing. */
  version: string | null
  /** Found, and new enough for the repos. */
  ok: boolean
  /** What it is for and what is wrong, in plain words. */
  note: string
  /** The app can install it here: its own download for Node, the system's installer for others. */
  installable: boolean
  /** Where to get it by hand when the app can't install it. */
  url?: string
}

// ---------- Progress ----------

export interface TaskProgress {
  passed: boolean
  pointsEarned: number
  passedAt?: string
  lastResult?: CheckResult
  /** Checks of this task that ran and failed. */
  failedChecks?: number
  /** How often each named check of the task failed. */
  failedNames?: Record<string, number>
  /** A short note from the AI after repeated fails; written once. */
  tip?: string
}

export interface ChapterProgress {
  /** Checks that were not all green. Drives hint unlocking. */
  nonGreenChecks: number
  tasks: Record<string, TaskProgress>
  startedAt: string
  lastOpenedAt: string
  completedAt?: string
}

export interface DayActivity {
  points: number
  checks: number
  tasksPassed: number
}

export interface ProgressState {
  /** Keyed by `${labId}/${chapterId}`. */
  chapters: Record<string, ChapterProgress>
  /** Keyed by local date, YYYY-MM-DD. */
  activity: Record<string, DayActivity>
  totalPoints: number
  lastOpened?: { labId: string; chapterId: string }
}

// ---------- AI ----------

/** CLI providers reuse a login the learner already has; API providers use a stored key. */
export type AiProviderId =
  'claude-code' | 'codex' | 'opencode' | 'gemini-cli' | 'anthropic' | 'openai' | 'gemini'

export interface AiProviderInfo {
  id: AiProviderId
  label: string
  kind: 'cli' | 'api'
  /** CLI found on this machine, or an API key is stored. */
  available: boolean
  /** Version or path for a CLI, masked key for an API provider, or why it is unavailable. */
  detail?: string
  models: string[]
}

export type SuggestionMode = 'off' | 'manual' | 'auto'

export interface AiConfig {
  /** Off means no AI anywhere: no tutor, no suggestions, and main refuses AI calls. */
  enabled: boolean
  provider: AiProviderId | null
  model: string | null
  /** Grey inline suggestions in the editor: never, when asked with a shortcut, or after a pause. */
  suggestions: SuggestionMode
  /** Offer the tutor right under a task whose check just failed. */
  nudge: boolean
  providers: AiProviderInfo[]
}

/** The parts of AiConfig the renderer may change. */
export type AiSettingsPatch = Partial<
  Pick<AiConfig, 'enabled' | 'provider' | 'model' | 'suggestions' | 'nudge'>
>

/** Code, a check or a hint the learner sends along with a question; shown in the chat as well. */
export interface AiAttachment {
  kind: 'code' | 'check' | 'hint'
  /** What it is, e.g. `orders.js, lines 3 to 7` or `Check: sorts by units`. */
  label: string
  text: string
  /** Fence language for code, e.g. `js`. */
  language?: string
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  attachment?: AiAttachment
}

export interface AiChatRequest {
  labId: string
  chapterId: string
  messages: AiMessage[]
  /** The main process adds the lesson and tasks itself. */
  activeFile?: WorkspaceFile
  lastCheck?: CheckResult[]
}

export type AiChatEvent =
  | { requestId: string; type: 'delta'; text: string }
  | { requestId: string; type: 'done' }
  | { requestId: string; type: 'error'; message: string }

export interface AiCompleteRequest {
  labId: string
  chapterId: string
  path: string
  prefix: string
  suffix: string
}

// ---------- IPC ----------

type Unsubscribe = () => void

// ---------- Usage stats ----------

/** Anonymous usage events. Not sent when usage stats are turned off in Settings. */
export type TelemetryEvent =
  | 'app_opened'
  | 'onboarding_step'
  | 'onboarding_finished'
  | 'repo_started'
  | 'repo_downloaded'
  | 'repo_download_failed'
  | 'check_run'
  | 'hints_unlocked'
  | 'issue_completed'
  | 'tutor_asked'
  | 'suggestion_requested'

/** Ids, counts and choices only: never code, file names, messages or keys. */
export type TelemetryProps = Record<string, string | number>

/** window.api. Channels are `${namespace}:${method}`. */
export interface Api {
  content: {
    listLabs(): Promise<LabSummary[]>
    getChapter(labId: string, chapterId: string): Promise<Chapter>
    listPaths(): Promise<PathDef[]>
    /** The recording of one lesson part, named by `narrationKey` of its text; null when there is none. */
    narration(labId: string, chapterId: string, key: string): Promise<Uint8Array | null>
    /** Downloads a repo from the library, or a newer version of it. */
    install(labId: string): Promise<InstallResult>
    /** Download progress of a repo, from 0 to 1. */
    onInstallProgress(listener: (labId: string, done: number) => void): Unsubscribe
    /** The list of repos or roadmaps changed: a newer index, an install or an update. */
    onChanged(listener: () => void): Unsubscribe
  }
  workspace: {
    /** Creates the folder from the starter files on first open; otherwise reads it from disk. */
    open(labId: string, chapterId: string): Promise<WorkspaceSnapshot>
    writeFile(labId: string, chapterId: string, path: string, content: string): Promise<void>
    /** Restores the starter files. Files the learner added and progress are kept. */
    reset(labId: string, chapterId: string): Promise<WorkspaceSnapshot>
    /** Settles one file listed in `conflicts`. */
    resolveConflict(
      labId: string,
      chapterId: string,
      path: string,
      choice: ConflictChoice
    ): Promise<WorkspaceSnapshot>
    /** The folder that holds every workspace. */
    getRoot(): Promise<string>
    /** Asks for a folder and says where the work would go; null when cancelled. */
    pickRoot(): Promise<FolderMove | null>
    /** Moves all work to the folder the last pickRoot approved. Returns the new root. */
    moveRoot(): Promise<string>
  }
  checks: {
    /** Runs the hidden tests for the given tasks (all when omitted) and records progress. */
    run(
      labId: string,
      chapterId: string,
      taskIds?: string[]
    ): Promise<{ results: CheckResult[]; progress: ProgressState }>
    runtimeStatus(): Promise<RuntimeStatus>
    /** Installs the lab dependencies if needed. */
    ensureRuntime(): Promise<RuntimeStatus>
    /** The runtime started or finished installing, or failed to. */
    onRuntime(listener: (status: RuntimeStatus) => void): Unsubscribe
  }
  progress: {
    get(): Promise<ProgressState>
    /** Records the chapter as opened, creating its progress entry. */
    touch(labId: string, chapterId: string): Promise<ProgressState>
  }
  terminal: {
    create(opts: { labId: string; chapterId: string; cols: number; rows: number }): Promise<string>
    write(id: string, data: string): void
    resize(id: string, cols: number, rows: number): void
    kill(id: string): void
    onData(listener: (id: string, data: string) => void): Unsubscribe
    onExit(listener: (id: string, exitCode: number) => void): Unsubscribe
  }
  updates: {
    status(): Promise<UpdateStatus>
    /** Looks for a newer release. */
    check(): Promise<UpdateStatus>
    /** Downloads the release file for this computer; progress comes through onStatus. */
    download(): Promise<UpdateStatus>
    cancel(): Promise<void>
    /** Quits, installs the update and opens the app again. A downloaded update also goes in on quit. */
    install(): Promise<UpdateStatus>
    onStatus(listener: (status: UpdateStatus) => void): Unsubscribe
  }
  tools: {
    status(): Promise<ToolStatus[]>
    /** Downloads Node into the app's own folder. Other programs do not see it. */
    /** Installs a missing tool for the learner. Node reports its download through onInstallProgress. */
    install(id: ToolId): Promise<ToolInstallResult>
    /** Stops the Node download. */
    cancelInstall(): Promise<void>
    onInstallProgress(listener: (id: ToolId, done: number) => void): Unsubscribe
    /** Every Node found, and the one picked; null picked means automatic. */
    nodeOptions(): Promise<{ options: NodeOption[]; picked: string | null }>
    /** Picks a Node from nodeOptions, or null for automatic. */
    pickNode(bin: string | null): Promise<ToolStatus[]>
    /** Whether the local model runs, and why not. */
    labModel(): Promise<LabModelStatus>
    /** Starts the local model again; resolves with its status a few seconds later at most. */
    restartLabModel(): Promise<LabModelStatus>
  }
  github: {
    /** Stars the app's repository with the person's own GitHub CLI. False when that is not possible. */
    star(): Promise<boolean>
  }
  ai: {
    getConfig(): Promise<AiConfig>
    setConfig(patch: AiSettingsPatch): Promise<AiConfig>
    /** Stores or (with null) removes an API key. */
    setKey(provider: AiProviderId, key: string | null): Promise<AiConfig>
    /** Starts a streamed reply; events arrive on onChatEvent with the returned request id. */
    chat(request: AiChatRequest): Promise<string>
    cancel(requestId: string): void
    onChatEvent(listener: (event: AiChatEvent) => void): Unsubscribe
    /** One inline suggestion for the cursor position; empty string when there is none. */
    complete(request: AiCompleteRequest): Promise<string>
    /** Sends one tiny fixed prompt through the chosen provider and model; resolves with the reply. */
    test(): Promise<string>
    /** Writes a tip for a task that keeps failing and saves it; resolves with the progress. */
    tip(labId: string, chapterId: string, taskId: string): Promise<ProgressState>
  }
  telemetry: {
    track(event: TelemetryEvent, props?: TelemetryProps): void
  }
}

/** Methods the preload bridges with ipcRenderer.invoke, per namespace. */
export const INVOKE_METHODS = {
  content: ['listLabs', 'getChapter', 'listPaths', 'narration', 'install'],
  workspace: ['open', 'writeFile', 'reset', 'resolveConflict', 'getRoot', 'pickRoot', 'moveRoot'],
  checks: ['run', 'runtimeStatus', 'ensureRuntime'],
  progress: ['get', 'touch'],
  terminal: ['create'],
  updates: ['status', 'check', 'download', 'cancel', 'install'],
  tools: [
    'status',
    'install',
    'cancelInstall',
    'nodeOptions',
    'pickNode',
    'labModel',
    'restartLabModel'
  ],
  github: ['star'],
  ai: ['getConfig', 'setConfig', 'setKey', 'chat', 'complete', 'test', 'tip']
} as const

/** Fire-and-forget renderer to main messages. */
export const SEND_METHODS = {
  terminal: ['write', 'resize', 'kill'],
  ai: ['cancel'],
  telemetry: ['track']
} as const

/** Main to renderer events. */
export const EVENTS = {
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
  aiChat: 'ai:chatEvent',
  contentInstall: 'content:installProgress',
  contentChanged: 'content:changed',
  runtime: 'checks:runtime',
  toolInstall: 'tools:installProgress',
  update: 'updates:status'
} as const
