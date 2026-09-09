# skills

Agent skills for TypeScript and JavaScript work: cleaning up slop, and turning a rough brief into a plan folder.

[![skills.sh](https://skills.sh/b/imranbarbhuiya/skills)](https://skills.sh/imranbarbhuiya/skills)

| Skill | What it does | Folder |
| --- | --- | --- |
| `unslop` | Removes low-evidence TypeScript, over-engineering, duplication, dead leftovers, and hardcoded theme values. | [`skills/unslop`](skills/unslop) |
| `grill-to-plan` | Grills you round by round, then writes a plan folder with a numbered decision log, one file per task, and a status board. | [`skills/grill-to-plan`](skills/grill-to-plan) |

## Install

Uses the [skills](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add imranbarbhuiya/skills
```

List first:

```bash
npx skills add imranbarbhuiya/skills --list
```

Install one skill, skip prompts:

```bash
npx skills add imranbarbhuiya/skills --skill unslop -y
```

Use once without installing:

```bash
npx skills use imranbarbhuiya/skills@unslop
```

Other source forms:

```bash
npx skills add https://github.com/imranbarbhuiya/skills
npx skills add https://github.com/imranbarbhuiya/skills/tree/main/skills/unslop
```

Both skills set `disable-model-invocation: true`, so the agent will not reach for them on its own. Invoke them by name.

## unslop

[![unslop](https://skills.sh/b/imranbarbhuiya/skills?label=unslop)](https://skills.sh/imranbarbhuiya/skills/unslop)

Parse at the boundary. Keep known types known. Inline one-use wrappers. Use design tokens. Delete leftovers.

Works with NestJS, Next.js, TanStack, Expo, React Native, and similar TypeScript apps.

Invoke it explicitly: `/unslop`, or ask the agent to unslop, tighten types, inline splits, or remove dead code.

It will not rewrite valid code, generated OpenAPI, or staged files unless you say so.

```
skills/unslop/SKILL.md
skills/unslop/examples.md
skills/unslop/agents/openai.yaml
```

Type evidence rules follow [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop).

## grill-to-plan

[![grill-to-plan](https://skills.sh/b/imranbarbhuiya/skills?label=grill-to-plan)](https://skills.sh/imranbarbhuiya/skills/grill-to-plan)

Three phases: **learn** the current state before asking, **grill** in rounds until nothing is silently assumed, **write** the plan folder. Then it keeps the plan alive while work runs.

Facts come from the codebase, decisions come from you. The output is an overview with a numbered decision log, one file per task with frontmatter, and a status board that parallel agents can claim work from.

Invoke it explicitly: `/grill-to-plan`, or say grill me into a plan, plan this by asking me questions, write a plan folder, or split this into tasks.

```
skills/grill-to-plan/SKILL.md
skills/grill-to-plan/templates.md
skills/grill-to-plan/agents/openai.yaml
```

## Layout

```
skills/<name>/SKILL.md
```

This is the catalog layout the skills CLI discovers under `skills/`.

## License

MIT
