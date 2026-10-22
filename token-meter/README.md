# Token meter

A token and cost meter that shows what the current session is using and costing, updated after every turn.

```
Opus 5.5 · ▰▱▱▱▱▱▱▱▱▱ 42k / 1.00M (4%) · In 186k · Out 9.4k · Cached 88% · $1.17 · last $0.08 · ✎ ~85   [Details] [Hide]
```

| Piece | What it means | Source |
| --- | --- | --- |
| Model | Model that answered the last turn | Engine, exact |
| Bar and `42k / 1.00M` | How full the context window is | Engine, exact |
| In / Out | Session totals, input includes cached tokens | Engine, exact |
| Cached % | Share of input served from the prompt cache (cheaper) | Engine, exact |
| `$1.17` | Session cost at API list price | Engine's cost ledger |
| `last $0.08` | Cost of the most recent turn | Difference in the ledger |
| `✎ ~85` | Rough token count of your unsent draft | Estimate, ~3.2 chars/token |

**Details** expands the last 8 turns (time, tokens, cache reads and writes, cost) and your plan's rate-limit windows with reset times. **Hide** removes the band; type `/tokens` to bring it back.

The band turns bold when context passes 80%, a hint to start a fresh chat or compact.

## Install

```
/plugin install token-meter --marketplace doinkfish/claude-mods
```

In the desktop app: **+** next to the prompt box, **Plugins**, **Add marketplace** with `doinkfish/claude-mods`, then **Add plugin**.

## Commands

- `/tokens` prints the full readout as a reply. This works everywhere the mod loads, including chat views that don't draw panels.
- `/tokens hide` and `/tokens show` turn the live meter off and on.

## Notes

- On a Pro or Max plan the dollar figure is what the same usage would cost on the API, not a charge.
- Where it shows: a band above the prompt and a side panel in Claude Code's terminal and Code sessions, plus the status line. Chat views that don't draw mod panels still answer `/tokens`. The web and mobile apps don't show mods.

## Layout

```
token-meter/
├── .claude-plugin/plugin.json   manifest
├── hooks/hooks.json             points at the module
├── hooks/register.tsx           all hooks and the band drawing
├── types/index.d.ts             shape of the stored values
└── tests/band.test.tsx          `claude plugin test token-meter`
```
