# unslop

Agent skill that removes low-evidence TypeScript, over-engineering, duplication, dead leftovers, and hardcoded theme values.

Parse at the boundary. Keep known types known. Inline one-use wrappers. Use design tokens. Delete leftovers.

Works with NestJS, Next.js, TanStack, Expo, React Native, and similar TypeScript apps.

[![skills.sh](https://skills.sh/b/imranbarbhuiya/unslop)](https://skills.sh/imranbarbhuiya/unslop)

## Install

Uses the [skills](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add imranbarbhuiya/unslop
```

List first:

```bash
npx skills add imranbarbhuiya/unslop --list
```

Install only this skill, skip prompts:

```bash
npx skills add imranbarbhuiya/unslop --skill unslop -y
```

Use once without installing:

```bash
npx skills use imranbarbhuiya/unslop@unslop
```

Other source forms:

```bash
npx skills add https://github.com/imranbarbhuiya/unslop
npx skills add https://github.com/imranbarbhuiya/unslop/tree/main/skills/unslop
```

## After install

Invoke it explicitly: `/unslop`, or ask the agent to unslop, tighten types, inline splits, or remove dead code.

It will not rewrite valid code, generated OpenAPI, or staged files unless you say so.

## Layout

```
skills/unslop/SKILL.md
skills/unslop/examples.md
skills/unslop/agents/openai.yaml
```

This is the catalog layout the skills CLI discovers under `skills/`.

## License

MIT

Type evidence rules follow [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop).
