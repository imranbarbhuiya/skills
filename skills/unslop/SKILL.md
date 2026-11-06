---
name: unslop
description: >-
  Removes low-evidence types, over-engineering, duplication, special-case
  patches, dead leftovers, hardcoded theme values, and heavy validation.
  Concrete examples are TypeScript and JavaScript (NestJS, Next.js, TanStack,
  Expo, React Native); apply the same
  philosophy in other languages. Use while writing or editing application code
  and on the files you touched afterwards, not a repo sweep. Also use when the
  user says unslop, anti-slop, tighten types, kill slop, inline this, or asks to scan for
  fabricated evidence, copy-pasted helpers, unused code, or token-less colors.
  Skip planning, research, and questions that do not change code.
---

# Unslop

Opinionated rules for writing application code and for the cleanup pass after it. Examples and stack notes are TypeScript and JavaScript. Apply the same philosophy in other languages. This is not a linter install: do not add Oxlint plugins or vendor extra lint rules for this pass.

Do not fabricate type evidence. Do not over-build. Do not leave leftovers. This is a surgical cleanup, not a rewrite. Leave valid current code alone.

## Before writing

Before adding code, take the first of these that covers the need:

1. It does not need to exist: a hypothetical need, a "for later" option, an abstraction with one user. Skip it.
2. The repo already has it: a helper, hook, component, type, schema, or pattern. Reuse it.
3. The project's design system or an installed dependency covers it. Use it; this wins over a native element or hand-rolled code the project does not use.
4. The language, standard library, or platform covers it (a native input, CSS instead of JS, a DB constraint), and the project has no library or design-system component for it. Use it.
5. Only then write new code, the smallest that does the full job.

Less code is the tiebreaker between options that do the same thing, never a reason to drop behavior. Keep every feature, edge case, error path, accessibility detail, and boundary validation the task needs. Do not add a dependency for something a few lines cover.

Fixing a bug: find every caller of the code you are about to change, and fix it where they all route through, not with a guard on the one path the report names.

## Special cases

A special case is code that exists for one situation instead of following from how the system works. Each one points at a requirement the design missed. Do not write them as fixes, and treat them as slop in the code you touch:

- An `if` for one specific value, ID, route, or caller
- A parameter or flag only one caller understands, on a function others share
- A swallowed exception, or a `catch` that returns a default to make an error go away
- A `setTimeout`, sleep, retry, or `requestAnimationFrame` that waits and hopes something is ready
- A disabled, skipped, or loosened test to get green

Fix the cause in the shared code so the special case is unnecessary. If the cause is outside your scope, keep the special case, give it the one-line comment that names the external reason, and report it.

## Workflow

1. Detect the stack from the project (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `app.json`, `expo`, `@tanstack/*`). Use that project's package manager, design tokens, and check command.
2. Scope: files you just wrote or edited this turn, named files, or unstaged/untracked work. Do not expand to siblings. If invoked by name with a clean tree and no files named, ask for a scope; do not sweep the repo. Whole-repo only if asked. Never edit staged files unless asked. Never edit generated output (`openapi/`, `*.gen.ts`, Prisma client, route types, lockfiles, protobuf stubs).
3. Fix only real slop: fabricated types, copy-paste, token-less colors, heavy validation, pointless splits, dead code. Do not restyle or reorganize for taste.
4. Prefer the smallest real contract. If a value is already known, do not add recursive guards for the typechecker.
5. Check what you touched with that repo's command (typecheck, `cargo check`, package tests). Do not run the full test suite unless shared primitives / `utils/` changed, or the user asked.
6. Explain in the conversation. If a fix is risky or you cannot prove it safe, report it instead of applying it. Do not write a summary document.

## Hard constraints

- No comments. The only exception is code a reader would otherwise break, such as a non-obvious workaround or an external constraint; then one short line. `SAFETY:` comments and comments that restate the code are never the exception. If a workaround needs a paragraph, it is the wrong workaround.
- A comment that explains the implementation is restating it, even when phrased as a why (`// sort first so the binary search works`). Keep only comments about something outside the code that the code cannot show (`// the proxy drops websockets, so we poll`).
- Do not add blank lines between JSX siblings or between a parent and its children.
- Do not introduce dynamic `import()` inside a component. Imports stay at the top of the file.
- Do not "fix" import order, className order, or indentation.
- Do not mass-rename `*Shape` types.
- Do not rewrite existing Jest/Vitest mocks unless asked.
- Do not chase every `{...(cond ? { x } : {})}` spread unless it is hiding a typing lie.
- Do not extract a helper that is used once. Do not inline a shared helper that is already the project convention.

JSX, `import()`, className, and `*Shape` bullets apply to JS/TS UI. Elsewhere keep no-comments, no one-use extract, no leftover rewrite; skip inapplicable bullets.

## Types

Treat these as errors in **application** code. Generated files and third-party stubs (`.d.ts`, protobuf, generated clients) are out of scope. The table is TypeScript; in other languages reject the equivalent (silencing the checker, `Any` / `object` / `dyn`, force-unwrap to make it compile).

| Reject | Prefer |
| --- | --- |
| `as X as Y`, `as unknown as T` | Parse, narrow, or one real boundary type |
| Widen to `unknown` / `any` / `object`, then `as T` | Keep the original type through the flow |
| `const m: Record<string, T> = { start: fn }` | Infer, `satisfies`, or a const map |
| `fn(value: object)` / `Record<string, any \| unknown \| object>` | A named type or generic |
| `fn(input: unknown): unknown`, `type Foo = unknown` | Typed contracts. `unknown` only at JSON / `catch` / untyped lib, then disappear |
| `Reflect.apply` / `Reflect.get` | Typed call or parsed property |
| Ad hoc `typeof` mid-feature | Schema / DTO at the edge. `typeof` is fine **inside** a type predicate |
| `({ ... }) satisfies Partial<T> as T` | `z.input` empty values + `useForm<Input, unknown, Output>` or a typed factory |
| `@ts-ignore` / broad `eslint-disable` over a fixable error | Fix the cause. `@ts-expect-error` only at a real boundary |

`any` in production is always in scope.

**Timeout IDs:** `ReturnType<typeof setTimeout>`, never `as unknown as number`.

**IDs in `queryFn`:** throw the project's error type, not a raw `new Error`, unless that is the repo convention.

**Non-null `!`:** guard, or thread `string | undefined` until `enabled: Boolean(id)`.

Leave: library generic slots (`useForm<TField, unknown, TOutput>`), `catch (error)` into the project error helper, mutable clones for native APIs (`[...values]`), generated OpenAPI mismatches (report in chat; do not edit generated files).

## Duplication

Same non-trivial function, mapper, error throw, or fetch wrapper in two or more files → one shared helper in the place this repo already uses (`utils/`, `lib/`, a module). Do not invent a new folder.

Values and lists count too. The same constant, enum, or list of things (actions, routes, statuses, feature flags) kept in two places drifts: a keymap switch, a menu array, and a command palette list that each name the same actions. Derive them from one source.

Do not copy a local helper that already exists. Search before writing `formatDate`, `isRecord`, `toUserMessage`, `getHeaders`, or the equivalent.

Do not "DRY" JSX that is similar but not the same. Two screens sharing a card is a component; two screens sharing a `<View className="gap-3">` is not.

## Tokens, not literals

Hardcoded theme values are slop when the repo already has tokens.

- Colors: no hex / `rgb()` / `rgba()` / named CSS colors in app UI. Use `global.css` variables, Tailwind/Uniwind theme classes (`bg-card`, `text-primary`), or the project's JS token hook (`useCSSVariable('--color-primary')`, `theme.colors`, CSS `var(--*)`).
- Same for radius, spacing, and font size when tokens exist (`rounded-xl`, `--radius-*`, `--text-2xs`). Do not sprinkle `14`, `#111`, or `borderRadius: 8` next to a tokenized system.
- Icons and native props that need a string color still go through the token hook, not `'#000'`.
- One-off brand colors in marketing that are not in the theme: add a token if the design system expects it; do not silently invent a new palette.

## Validation weight

Parse untrusted input once at the boundary (HTTP body, `searchParams`, `JSON.parse`, MMKV, route params). After that, trust the typed value.

Reject recursive tree-walks, duplicate Zod schemas for the same payload, `superRefine` that repeats `.min()`, and field-by-field `typeof` after a schema already ran.

If the caller already passed a branded ID or form `z.output`, do not re-validate it as `unknown`. Same for `?.` and `?? fallback` on values the types already guarantee — defensive chaining is validation slop.

## Splitting

Inline when a name adds no information:

- `const isLoading = loading`
- `const onPress = () => props.onPress()`
- A 3-line function used once in the same file
- A new file for a component used once by one parent
- `useMemo` / `useCallback` around a cheap value or a callback passed to a DOM node
- Derived state copied into `useState` + `useEffect`

Keep a split when it is a real boundary: a repeated card, a schema module the form already uses, a hook with its own state/subscriptions.

Prefer one 40-line function over four 8-line functions that only exist to call each other.

## Dead leftovers

Delete what the compiler and the product no longer use:

- Unused imports, variables, exports, props, state, effects, query results
- Commented-out code, `TODO` that is already done, `FIXME` with a working path beside it
- Stray debug `console.log`, comments that only restate the line below them
- Always-true / always-false flags, dead branches, old and new implementations kept "just in case"
- Deprecated wrappers that only call the new function
- Unreachable defaults after a union is already exhaustive

Before deleting an export, search the repo for the identifier — tests, native code, and string references (DI tokens, route names, dynamic keys) count, not just TS imports. Public APIs and fixtures stay unless proven dead.

## Other over-engineering

- Config objects for two options. Pass the two args.
- Boolean soup (`isCompactDenseAlt`). Two call sites or a variant union.
- Try/catch that only rethrows. Empty `catch {}`.
- `return Promise.resolve(x)` inside `async`, `new Promise` wrapping an existing promise, `await` on a non-promise.
- Extra context/provider for a value used in one tree.
- Pass-through components that add no markup, state, or behavior.
- Abstractions for a hypothetical third use. YAGNI.
- New libraries for something the repo already does (another schema lib, another date lib, another toast).
- Hand-rolled code for what the project's design system, an installed dependency, or the platform already does (a custom debounce, deep clone, or date math; a custom picker where the design system has one).

## Tests you write

A test should fail on a regression, and only then. When you add or edit tests:

- Do not write a test that can't fail: asserting a mock returns what it was told to, or that a function was called with no check on the result.
- Do not write a test that repeats the implementation, such as rebuilding the expected value with the same logic as the code under test.
- Test behavior through the public interface, not internals, so a refactor that keeps behavior does not break it.

Existing tests stay as they are unless you were asked to fix them.

## Stack notes

Use the repo's existing validation, tokens, and error types. Do not invent a new parsing library.

If the repo is not one of these, map the row: boundary = untrusted input, interior = already-typed values. Use that language's checker and the project's parse, theme, and error types.

| Stack | Boundary | Interior |
| --- | --- | --- |
| NestJS | DTO / Zod / `ValidationPipe` on controllers | Services take typed args. Share pipes/guards; do not copy them per module |
| Next.js | `searchParams`, route handlers, `JSON.parse`, formData | Pages consume parsed types. Colors via CSS variables / Tailwind theme |
| TanStack Query / Router | `queryFn` returns the resource; errors use the project error class | No `data as T` after a typed client. No duplicate query-key helpers |
| Expo / RN | route params, MMKV/JSON, native callbacks | `className` + `useCSSVariable` for colors. Clone when a native API needs mutable arrays |
| OpenAPI clients | trust generated types when they match | If the spec is wrong, say so — do not edit generated files |

## Done when

- Touched files have no new chained assertions, untyped contracts, copy-pasted helpers or lists, hardcoded theme literals, heavy validators, one-use wrappers, special cases you could fix at the cause, or dead leftovers you could prove unused.
- The repo's check command passes for those files (ignore failures in files you were told not to touch).
- The diff is smaller than the clever version.

Concrete snippets: [examples.md](examples.md).
