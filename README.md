# skills

Agent skills for cleaning up slop in application code, and turning a rough brief into a plan folder.

[![skills.sh](https://skills.sh/b/imranbarbhuiya/skills)](https://skills.sh/imranbarbhuiya/skills)

| Skill | What it does | Folder |
| --- | --- | --- |
| `unslop` | Removes low-evidence types, over-engineering, duplication, dead leftovers, and hardcoded theme values. | [`skills/unslop`](skills/unslop) |
| `grill-to-plan` | Grills you round by round, writes a plan folder with a numbered decision log and one file per task, then orchestrates subagents through it when you say start. | [`skills/grill-to-plan`](skills/grill-to-plan) |

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

`unslop` is available for the agent to apply on its own while it writes and edits application code. `grill-to-plan` is explicit-only (`disable-model-invocation: true`); invoke it by name.

## unslop

[![unslop](https://skills.sh/b/imranbarbhuiya/skills?label=unslop)](https://skills.sh/imranbarbhuiya/skills/unslop)

Reuse what the repo and its design system already have. Parse at the boundary. Keep known types known. Inline one-use wrappers. Use design tokens. Delete leftovers.

Examples and stack notes are TypeScript (NestJS, Next.js, TanStack, Expo, React Native). The same philosophy applies in other languages.

The agent should follow it while writing code and run the cleanup on files it just wrote or edited. You can still invoke `/unslop`, or ask it to unslop, tighten types, inline splits, or remove dead code.

It will not rewrite valid code, generated OpenAPI, or staged files unless you say so.

```
skills/unslop/SKILL.md
skills/unslop/examples.md
skills/unslop/tests.md
skills/unslop/agents/openai.yaml
```

Type evidence rules follow [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop).

## grill-to-plan

[![grill-to-plan](https://skills.sh/b/imranbarbhuiya/skills?label=grill-to-plan)](https://skills.sh/imranbarbhuiya/skills/grill-to-plan)

Five phases: **learn** the current state before asking, **grill** in rounds until nothing is silently assumed, **write** the plan folder, **set up execution** (how many subagents run at once, whether they commit and push, and whether work lands on the default branch or as one PR per task, recommended from the repo's history), then wait for you to say start and **orchestrate** subagents through the tasks.

Facts come from the codebase, decisions come from you. The output is an overview with a numbered decision log and a status table the orchestrator keeps current, plus one file per task.

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
