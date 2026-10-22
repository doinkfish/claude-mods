import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'token-meter',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 160,
    scroll: { offset: 0, bodyRows: 11 },
  },
} as const

test('the band shows real usage after a turn, on terminal and desktop', async ($, on) => {
  let cost = 0.5
  const usage = () => ({
    startedAt: 0,
    context: { tokens: 42_000, window: 1_000_000, percent: 4 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 23 }],
    cost: { usd: cost },
  })

  // These hooks stand for the engine.
  on('command.register', () => ({ value: { command: 'tokens' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: {} }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: usage() }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('prompt.change', (_, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'hello' } as never)
  cost = 0.62
  await $.turn.complete({
    answer: 'hi',
    durationMs: 4_200,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      model: 'claude-opus-5-5',
      input_tokens: 1_200,
      output_tokens: 900,
      cache_read_input_tokens: 30_000,
      cache_creation_input_tokens: 2_000,
    },
  } as never)
  await $.prompt.change({ text: 'a'.repeat(320), cursor: 320, origin: { kind: 'keyboard' } } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface } as never)

    const line = await ui.find({ type: 'Text', text: /Opus 5\.5/ })
    expect(line?.text).toContain('42k / 1.00M (4%)')
    expect(line?.text).toContain('In 33k')
    expect(line?.text).toContain('Out 900')
    expect((await ui.find({ type: 'Text', text: /^\$0\.62$/ }))?.text).toBe('$0.62')
    expect((await ui.find({ type: 'Text', text: /last \$0\.12/ }))?.text).toContain('last $0.12')
    expect((await ui.find({ type: 'Text', text: /✎ ~100/ }))?.text).toContain('~100')

    await ui.press({ key: 'details' })
    expect((await ui.find({ type: 'Text', text: /Turn 1/ }))?.text).toContain('4s')
    expect((await ui.find({ type: 'Text', text: /5-hour limit/ }))?.text).toContain('23%')
    await ui.press({ key: 'details' })

    await ui.unmount()
  }
})

test('/tokens hides and shows the band', async ($, on) => {
  on('command.register', () => ({ value: { command: 'tokens' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: {} }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] },
  }))

  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.command.run({ command: 'tokens', args: 'hide' } as never)
  expect(JSON.stringify(r)).toContain('hidden')

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' } as never)
  expect(await ui.find({ type: 'Text', text: /In / })).toBe(undefined)
  await ui.unmount()
})

test('the side panel draws on desktop', async ($, on) => {
  on('command.register', () => ({ value: { command: 'tokens' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: {} }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 5_000, window: 1_000_000, percent: 1 }, rateLimits: [], cost: { usd: 0.03 } },
  }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({
    plugin: 'token-meter',
    component: 'Pane',
    requestId: 'token-meter',
    surface: 'desktop',
    props: { title: 'Token meter', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  } as never)
  expect((await ui.find({ type: 'Text', text: /this session/ }))?.text).toBe('$0.03 this session')
  await ui.unmount()
})

test('/tokens with no argument prints the readout', async ($, on) => {
  on('command.register', () => ({ value: { command: 'tokens' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: {} }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 42_000, window: 1_000_000, percent: 4 }, rateLimits: [{ kind: 'seven_day', percentUsed: 12 }], cost: { usd: 1.17 } },
  }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = JSON.stringify(await $.command.run({ command: 'tokens', args: '' } as never))
  expect(r).toContain('$1.17 this session')
  expect(r).toContain('42k / 1.00M (4%)')
  expect(r).toContain('Weekly limit')
})
