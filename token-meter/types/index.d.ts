export type Snapshot = {
  contextTokens: number | null
  contextWindow: number
  contextPercent: number | null
  costUsd: number | null
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
}

export type Totals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type TurnRow = {
  index: number
  model: string
  seconds: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  costUsd: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'token-meter': {
      snapshot: Snapshot | null
      totals: Totals
      turns: TurnRow[]
      model: string | null
      draftTokens: number
      isExpanded: boolean
      isHidden: boolean
    }
  }
}
