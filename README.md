# Claude mods

Mods that change how Claude looks and works, built for my own workflow.

| Mod | What it does |
| --- | --- |
| [token-meter](./token-meter) | Shows tokens, context fill, session cost and plan limits. `/tokens` prints a full readout. |

## Install a mod

In a Claude Code terminal session:

```
/plugin install token-meter --marketplace doinkfish/claude-mods
```

Answer `y` to add the marketplace, then pick the user scope so it loads in every session.

From a shell instead:

```
claude plugin install token-meter --marketplace doinkfish/claude-mods
```

In the desktop app, where `/plugin` doesn't run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `doinkfish/claude-mods`, then **Add plugin**.

## Layout

```
claude-mods/
├── .claude-plugin/marketplace.json   lists every mod in this repo
└── token-meter/                      one folder per mod
```

To add a mod later, give it its own folder and an entry in `marketplace.json`.
