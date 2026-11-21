import { useEffect } from 'react'
import { Code, Info, Palette, Shield, Sparkles, Wrench, type LucideIcon } from 'lucide-react'
import SiGithub from '@icons-pack/react-simple-icons/icons/SiGithub'
import { REPO_URL } from '@shared/repo'
import {
  CODE_THEMES,
  codePalette,
  type CodePalette,
  type CodeThemeId
} from '@indent/design/code-palette'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AiSettings, AiSwitch } from '@/features/ai/AiMenu'
import { useAi } from '@/features/ai/aiStore'
import { UpdateCard } from '@/features/updates/UpdateCard'
import { FolderNote, MoveFolderDialog } from '@/features/workspace/FolderMove'
import { useWorkspaceRoot } from '@/features/workspace/useWorkspaceRoot'
import { isShortcut } from '@/lib/shortcuts'
import { viewTransition } from '@/lib/viewTransition'
import { useSettings, type EditorOption } from '@/stores/settings'
import { Group, LayoutControls, Row, card } from './controls'
import { useSettingsDialog, type SettingsSection } from './dialogStore'
import { ThemeCards } from './ThemeCards'
import { ToolsSection } from './ToolsSection'
import { Typography } from './Typography'

const SECTIONS: {
  id: SettingsSection
  label: string
  icon: LucideIcon
  view: () => React.JSX.Element
}[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette, view: AppearanceSection },
  { id: 'editor', label: 'Editor', icon: Code, view: EditorSection },
  { id: 'ai', label: 'AI', icon: Sparkles, view: AiSection },
  { id: 'tools', label: 'Tools', icon: Wrench, view: ToolsSection },
  { id: 'privacy', label: 'Privacy', icon: Shield, view: PrivacySection },
  { id: 'about', label: 'About', icon: Info, view: AboutSection }
]

/** Every setting in one window. Opens from the sidebar, the View menu, or with Cmd or Ctrl and comma. */
export function SettingsDialog(): React.JSX.Element {
  const { open, section, setOpen, setSection } = useSettingsDialog()

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!isShortcut(event, 'openSettings')) return
      event.preventDefault()
      useSettingsDialog.getState().show()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="h-[min(620px,calc(100vh-4rem))] grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[840px]"
      >
        <Tabs
          orientation="vertical"
          value={section}
          onValueChange={(value) => setSection(value as SettingsSection)}
          className="min-h-0 min-w-0 gap-0"
        >
          <div className="flex w-48 shrink-0 flex-col border-r border-rule p-3">
            <DialogTitle className="px-2.5 pt-1.5 pb-3 text-sm font-semibold">Settings</DialogTitle>
            <TabsList
              aria-label="Settings sections"
              className="h-auto w-full items-stretch gap-0.5 bg-transparent p-0"
            >
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="h-8 flex-none gap-2.5 border-0 px-2.5 font-normal text-muted-foreground transition-none hover:bg-accent/60 data-[state=active]:bg-accent! data-[state=active]:text-foreground data-[state=active]:shadow-none!"
                >
                  <Icon strokeWidth={1.5} />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <p className="mt-auto px-2.5 text-xs text-muted-foreground select-text">
              Version <span className="font-mono">{__APP_VERSION__}</span>
            </p>
          </div>
          {SECTIONS.map(({ id, label, view: View }) => (
            <TabsContent key={id} value={id} className="min-w-0 overflow-y-auto px-8 pt-6 pb-8">
              <h2 className="text-base font-semibold">{label}</h2>
              <View />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function AppearanceSection(): React.JSX.Element {
  const theme = useSettings((s) => s.theme)
  const codeTheme = useSettings((s) => s.codeTheme)
  const setCodeTheme = useSettings((s) => s.setCodeTheme)

  return (
    <>
      <Group title="App theme">
        <ThemeCards />
      </Group>

      <Group title="Code theme">
        <RadioGroup
          aria-label="Code theme"
          value={codeTheme}
          onValueChange={(value) => setCodeTheme(value as CodeThemeId)}
          className="grid-cols-2"
        >
          {CODE_THEMES.map(({ id, label, hint }) => (
            <label
              key={id}
              htmlFor={`code-theme-${id}`}
              className="flex cursor-pointer flex-col gap-2.5 rounded-lg border border-border p-3 hover:border-input has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 has-[[data-state=checked]]:border-foreground"
            >
              <span className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium">{label}</span>
                <RadioGroupItem
                  id={`code-theme-${id}`}
                  value={id}
                  className="focus-visible:ring-0"
                />
              </span>
              <CodeSample palette={codePalette(id, theme)} />
              <span className="text-[13px] text-muted-foreground">{hint}</span>
            </label>
          ))}
        </RadioGroup>
      </Group>

      <Group title="Typography">
        <Typography />
      </Group>
    </>
  )
}

/** Three lines that use every colour of a code theme. */
function CodeSample({ palette: p }: { palette: CodePalette }): React.JSX.Element {
  const part = (color: string, text: string): React.JSX.Element => (
    <span style={{ color }}>{text}</span>
  )
  return (
    <pre
      aria-hidden
      className="overflow-hidden rounded-md border border-rule bg-editor px-3 py-2 font-mono text-[11px] leading-5"
      style={{ color: p.foreground }}
    >
      <span className="italic" style={{ color: p.comment }}>
        {'// add up the paid orders\n'}
      </span>
      {part(p.keyword, 'const ')}
      {part(p.variable, 'total')}
      {' = '}
      {part(p.function, 'Sum')}
      {'.of('}
      {part(p.variable, 'orders')}
      {', '}
      {part(p.number, '0')}
      {')\n'}
      {part(p.keyword, 'return ')}
      {part(p.string, "'Total: '")}
      {' + '}
      {part(p.variable, 'total')}
    </pre>
  )
}

const EDITOR_OPTIONS: { option: EditorOption; label: string; hint: string }[] = [
  { option: 'lineNumbers', label: 'Line numbers', hint: 'Numbers in the left margin.' },
  { option: 'minimap', label: 'Minimap', hint: 'A small overview of the file on the right.' }
]

function EditorSection(): React.JSX.Element {
  const editor = useSettings((s) => s.editor)
  const setEditorOption = useSettings((s) => s.setEditorOption)
  const resetLayout = useSettings((s) => s.resetLayout)

  return (
    <>
      <Group title="Code editor">
        <div className={card}>
          {EDITOR_OPTIONS.map(({ option, label, hint }) => (
            <Row key={option} id={`editor-${option}`} label={label} hint={hint}>
              <Switch
                id={`editor-${option}`}
                checked={editor[option]}
                onCheckedChange={(on) => setEditorOption(option, on)}
              />
            </Row>
          ))}
        </div>
      </Group>

      <Group title="Your work">
        <WorkspaceFolder />
      </Group>

      <Group
        title="Layout of an issue"
        action={
          <Button variant="ghost" size="xs" onClick={resetLayout}>
            Reset
          </Button>
        }
      >
        <div className="space-y-3 rounded-lg border border-border px-4 py-3.5">
          <LayoutControls browser />
        </div>
      </Group>
    </>
  )
}

function PrivacySection(): React.JSX.Element {
  const telemetry = useSettings((s) => s.telemetry)
  const setTelemetry = useSettings((s) => s.setTelemetry)

  return (
    <Group title="Usage stats">
      <div className={card}>
        <Row
          id="privacy-telemetry"
          label="Share anonymous usage stats"
          hint="Counts like repos started, checks run and issues finished, with the app version and system. Never your code, files, chats or keys."
        >
          <Switch id="privacy-telemetry" checked={telemetry} onCheckedChange={setTelemetry} />
        </Row>
      </div>
    </Group>
  )
}

function WorkspaceFolder(): React.JSX.Element {
  const folder = useWorkspaceRoot()
  return (
    <div className={card}>
      <div className="flex min-h-14 items-center justify-between gap-6 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm">Folder for your work</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{folder.root}</p>
          <FolderNote folder={folder} className="mt-1" />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={folder.moving}
          onClick={() => void folder.change()}
        >
          Change
        </Button>
      </div>
      <MoveFolderDialog folder={folder} />
    </div>
  )
}

function AiSection(): React.JSX.Element {
  const enabled = useAi((s) => s.config?.enabled)
  const load = useAi((s) => s.load)

  // Looks for installed CLIs again, so one installed a minute ago shows up.
  useEffect(() => void load(), [load])

  return (
    <div className="mt-6 flex max-w-[440px] flex-col gap-4">
      <AiSwitch />
      {enabled !== false && <AiSettings />}
      <Separator />
      <Button
        variant="link"
        size="sm"
        className="h-auto self-start p-0 text-xs font-normal text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        onClick={() => {
          useSettingsDialog.getState().setOpen(false)
          viewTransition('onboarding-finish', () => useSettings.getState().setOnboarded(false))
        }}
      >
        Run setup again
      </Button>
    </div>
  )
}

function AboutSection(): React.JSX.Element {
  const autoUpdate = useSettings((s) => s.autoUpdate)
  const setAutoUpdate = useSettings((s) => s.setAutoUpdate)

  return (
    <Group title="Version">
      <div className={card}>
        <div className="space-y-3 px-4 py-3.5">
          <p className="text-sm">
            Indent <span className="font-mono">{__APP_VERSION__}</span>
          </p>
          <UpdateCard />
        </div>
        <Row
          id="auto-update"
          label="Check for updates automatically"
          hint="When the app opens, and every few hours."
        >
          <Switch id="auto-update" checked={autoUpdate} onCheckedChange={setAutoUpdate} />
        </Row>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="border-input bg-transparent shadow-none dark:bg-transparent dark:hover:bg-accent"
          asChild
        >
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            <SiGithub aria-hidden />
            GitHub
          </a>
        </Button>
        <a
          href={`${REPO_URL}/releases`}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] text-muted-foreground hover:text-foreground"
        >
          All releases
        </a>
      </div>
    </Group>
  )
}
