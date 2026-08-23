# unslop

Agent skill that removes low-evidence TypeScript and JavaScript patterns.

Parse at the boundary. Keep known types known. Do not fabricate evidence with `as unknown as T`.

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

Install globally (all projects):

```bash
npx skills add imranbarbhuiya/unslop -g
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

Invoke it explicitly: `/unslop`, or ask the agent to unslop / anti-slop / tighten types.

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
