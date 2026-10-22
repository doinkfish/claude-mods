import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMeasureInput, SessionUsage } from 'claude-code'

import type { Snapshot, Totals, TurnRow } from '../types'

const snapshot = atom({ plugin: 'token-meter', key: 'snapshot' } as const, null)
const totals = atom({ plugin: 'token-meter', key: 'totals' } as const, {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
})
const turns = atom({ plugin: 'token-meter', key: 'turns' } as const, [])
const model = atom({ plugin: 'token-meter', key: 'model' } as const, null)
const draftTokens = atom({ plugin: 'token-meter', key: 'draftTokens' } as const, 0)
const isExpanded = atom({ plugin: 'token-meter', key: 'isExpanded' } as const, false)
const isHidden = atom({ plugin: 'token-meter', key: 'isHidden' } as const, false)

const MAX_TURNS = 8
const PANE = 'token-meter'

export function fmt(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1)}M`
}

export function money(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 10) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(0)}`
}

export function prettyModel(id: string): string {
  const parts = id.replace(/^claude-/, '').replace(/\[.*\]$/, '').split('-')
  const name = parts[0] ?? id
  const version = parts.slice(1).filter(p => /^\d+$/.test(p)).join('.')
  const title = name.charAt(0).toUpperCase() + name.slice(1)
  return version ? `${title} ${version}` : title
}

export function bar(percent: number, cells = 10): string {
  const filled = Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)))
  return '▰'.repeat(filled) + '▱'.repeat(cells - filled)
}

// Rough count for unsent text: newer Claude tokenizers average ~3.2 chars/token.
export function estimateTokens(text: string): number {
  return text.trim() === '' ? 0 : Math.ceil(text.length / 3.2)
}

function limitLabel(kind: string): string {
  if (kind === 'five_hour') return '5-hour limit'
  if (kind === 'seven_day') return 'Weekly limit'
  if (kind === 'spend_limit') return 'Spend limit'
  return kind.replace(/_/g, ' ')
}

function toSnapshot(u: SessionUsage | SessionMeasureInput): Snapshot {
  return {
    contextTokens: u.context.tokens ?? null,
    contextWindow: u.context.window,
    contextPercent: u.context.percent ?? null,
    costUsd: u.cost?.usd ?? null,
    rateLimits: u.rateLimits.map(r => ({
      kind: r.kind,
      percentUsed: r.percentUsed,
      resetsAt: r.resetsAt,
    })),
  }
}

type Lines = { head: string; cost: string; tail: string; isTight: boolean; details: { text: string; isBold: boolean }[] }

async function gather($: EngineInterface): Promise<Lines> {
  const snap = await read($, snapshot)
  const t = await read($, totals)
  const rows = await read($, turns)
  const modelId = await read($, model)
  const draft = await read($, draftTokens)

  const inputAll = t.input + t.cacheRead + t.cacheWrite
  const last = rows.length > 0 ? rows[rows.length - 1] : undefined
  const percent = snap?.contextPercent ?? null

  const head: string[] = []
  if (modelId) head.push(prettyModel(modelId))
  if (snap) {
    const used = snap.contextTokens !== null ? fmt(snap.contextTokens) : '–'
    const pct = percent !== null ? ` (${percent}%)` : ''
    head.push(`${bar(percent ?? 0)} ${used} / ${fmt(snap.contextWindow)}${pct}`)
  }
  head.push(`In ${fmt(inputAll)}`)
  head.push(`Out ${fmt(t.output)}`)
  if (inputAll > 0) head.push(`Cached ${Math.round((t.cacheRead / inputAll) * 100)}%`)

  const tail: string[] = []
  if (last?.costUsd != null) tail.push(`last ${money(last.costUsd)}`)
  if (draft > 0) tail.push(`✎ ~${fmt(draft)}`)

  const details: { text: string; isBold: boolean }[] = []
  if (rows.length === 0) details.push({ text: 'No turns yet in this session.', isBold: false })
  for (const r of rows.slice().reverse()) {
    details.push({
      text: `Turn ${r.index} · ${prettyModel(r.model)} · ${r.seconds}s · in ${fmt(r.input)} (cache read ${fmt(r.cacheRead)}, write ${fmt(r.cacheWrite)}) · out ${fmt(r.output)}${r.costUsd != null ? ` · ${money(r.costUsd)}` : ''}`,
      isBold: false,
    })
  }
  for (const r of snap?.rateLimits ?? []) {
    details.push({
      text: `${limitLabel(r.kind)} ${bar(r.percentUsed)} ${r.percentUsed}%${r.resetsAt ? ` · resets ${new Date(r.resetsAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}`,
      isBold: r.percentUsed >= 80,
    })
  }

  return {
    head: head.join(' · '),
    cost: snap?.costUsd != null ? money(snap.costUsd) : '$–',
    tail: tail.length > 0 ? ` · ${tail.join(' · ')}` : '',
    isTight: percent !== null && percent >= 80,
    details,
  }
}

async function refreshStatus($: EngineInterface): Promise<void> {
  if (await read($, isHidden)) {
    $.ui.status(undefined)
    return
  }
  const l = await gather($)
  $.ui.status(`${l.head} · ${l.cost}${l.tail}`)
}

export const register: Register = on => {
  let costAtSubmit: number | null = null

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tokens',
      description: 'Show token usage and cost for this chat (add hide or show to toggle the live meter)',
      argumentHint: '[hide|show]',
    })
    const started = await next(e)
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage))
    if (!(await read($, isHidden))) void $.ui.open({ id: PANE, title: 'Token meter' })
    await refreshStatus($)

    return started
  })

  on('command.run', { command: 'tokens' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'hide' || arg === 'off' || arg === 'show' || arg === 'on') {
      const hide = arg === 'hide' || arg === 'off'
      await update($, isHidden, () => hide)
      if (!hide) await $.ui.open({ id: PANE, title: 'Token meter' })
      await refreshStatus($)
      return { text: hide ? 'Token meter hidden. /tokens show brings it back.' : 'Token meter shown.' }
    }

    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage))
    const l = await gather($)
    const lines = [
      `${l.cost} this session${l.tail}`,
      l.head,
      '',
      ...l.details.map(d => d.text),
      '',
      'Cost is API list price; on Pro or Max it is not a charge. /tokens hide or /tokens show toggles the live meter.',
    ]
    return { text: lines.join('\n') }
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e))
    await refreshStatus($)

    return next(e)
  })

  on('prompt.change', async ($, e, next) => {
    await update($, draftTokens, () => estimateTokens(e.text))

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      costAtSubmit = (await $.session.usage()).cost?.usd ?? null
      await update($, draftTokens, () => 0)
    } catch {
      costAtSubmit = null
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const u = e.usage
    if (!u) return done

    await update($, totals, (t): Totals => ({
      input: t.input + u.input_tokens,
      output: t.output + u.output_tokens,
      cacheRead: t.cacheRead + u.cache_read_input_tokens,
      cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
    }))

    // Subagent turns count toward totals but not the per-turn list.
    if (e.agentId) return done

    const usage = await $.session.usage()
    const costNow = usage.cost?.usd ?? null
    const turnCost = costNow !== null && costAtSubmit !== null ? Math.max(0, costNow - costAtSubmit) : null
    costAtSubmit = costNow

    const prior = await read($, turns)
    const turnIndex = (prior.length > 0 ? prior[prior.length - 1]!.index : 0) + 1
    const row: TurnRow = {
      index: turnIndex,
      model: u.model,
      seconds: Math.round(e.durationMs / 1000),
      input: u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens,
      output: u.output_tokens,
      cacheRead: u.cache_read_input_tokens,
      cacheWrite: u.cache_creation_input_tokens,
      costUsd: turnCost,
    }
    await update($, turns, list => [...list, row].slice(-MAX_TURNS))
    await update($, model, () => u.model)
    await update($, snapshot, () => toSnapshot(usage))
    await refreshStatus($)

    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const l = await gather($)

    return (
      <Box flexDirection="column">
        <Text bold>{l.cost} this session</Text>
        <Text dimColor={!l.isTight} bold={l.isTight}>{l.head}</Text>
        {l.tail !== '' && <Text dimColor>{l.tail.slice(3)}</Text>}
        <Text> </Text>
        {l.details.map(d => (
          <Text dimColor={!d.isBold} bold={d.isBold}>{d.text}</Text>
        ))}
        <Text> </Text>
        <Text dimColor>Cost is API list price. ✎ estimates your unsent draft. /tokens toggles the meter.</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const l = await gather($)
    const expanded = await read($, isExpanded)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor={!l.isTight} bold={l.isTight}>
            {l.head}
            {' · '}
          </Text>
          <Text bold>{l.cost}</Text>
          {l.tail !== '' && <Text dimColor>{l.tail}</Text>}
          <Text> </Text>
          <Button
            key="details"
            label={expanded ? 'Less' : 'Details'}
            onPress={() => update($, isExpanded, v => !v)}
          />
          <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
        </Box>
        {expanded &&
          l.details.map(d => (
            <Text dimColor={!d.isBold} bold={d.isBold}>{d.text}</Text>
          ))}
        {expanded && <Text dimColor>Cost is API list price. ✎ estimates your unsent draft. /tokens toggles the meter.</Text>}
      </Box>
    )
  })
}
