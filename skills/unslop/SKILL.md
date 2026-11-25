---
name: unslop
description: >-
  Rules for writing clean application code and cleaning up what you touched:
  honest types, no hidden failures or special-case patches, no
  over-engineering, duplication, or dead leftovers, parsers and shared
  formatters instead of hand-rolled string handling, and tests that can fail.
  Examples are TypeScript and JavaScript; apply the same philosophy in other
  languages. Use while writing or editing application code and on the files
  you touched afterwards, not a repo sweep. Also use when the user says
  unslop, anti-slop, clean this up, tighten types, kill slop, or inline this.
  Skip planning, research, and questions that do not change code.
---

# Unslop

Opinionated rules for writing application code and for the cleanup pass after it. Examples are TypeScript and JavaScript. Apply the same philosophy in other languages. This is not a linter install: do not add Oxlint plugins or vendor extra lint rules for this pass.

Do not fabricate type evidence. Do not patch symptoms or hide failures. Do not over-build. Do not leave leftovers. This is a surgical cleanup, not a rewrite. Leave valid current code alone.

## Before writing

Before adding code, take the first of these that covers the need:

1. It does not need to exist: a hypothetical need, a "for later" option, an abstraction with one user. Skip it.
2. The repo already has it: a helper, hook, component, type, schema, formatter, or pattern. Search for it, then reuse it.
3. The project's design system or an installed dependency covers it. Use it; this wins over a native element or hand-rolled code the project does not use. Do not add a second library for something the repo already does.
4. The language, standard library, or platform covers it (a native input, CSS instead of JS, a DB constraint, a URL parser), and the project has no library or design-system component for it. Use it.
5. Only then write new code, the smallest that does the full job.

Less code is the tiebreaker between options that do the same thing, never a reason to drop behavior. Keep every feature, edge case, error path, accessibility detail, and boundary validation the task needs. Do not add a dependency for something a few lines cover.

Fixing a bug: find every caller of the code you are about to change, and fix it where they all route through, not with a guard on the one path the report names.

## Special cases

A special case is code that exists for one situation instead of following from how the system works. Each one points at a requirement the design missed. Do not write them as fixes, and treat them as slop in the code you touch:

- An `if` for one specific value, ID, route, or caller
- A parameter or flag only one caller understands, on a function others share
- A `catch` that returns a default to make an error go away (see Errors and fallbacks)
- A `setTimeout`, sleep, retry, or `requestAnimationFrame` that waits and hopes something is ready
- A disabled, skipped, or loosened test to get green

Before removing one, read its callers and `git blame` to learn why it exists; the reason may be an external constraint the code cannot show. Then fix the cause in the shared code so the special case is unnecessary. Moving the special case inward, as a branch or flag only one caller understands, is not a fix. If the cause is outside your scope, keep the special case, give it the one-line comment that names the external reason, and report it.

## Errors and fallbacks

- Catch only the errors you expect and can handle. A broad `catch` around a block also hides the failures you did not think of; narrow it or let it throw.
- No `catch` that only rethrows, and no empty `catch {}`.
- No fallback the spec did not ask for. A default, empty, or cached value returned on failure hides the failure. Never fall back to a mock, stub, or fake outside tests.
- Do not let failures pass quietly: `?.` over a call that must run, a `catch` that only logs and continues, retries that run out without surfacing the error.
- An error the user sees says what failed and what they can do next, through the project's error type.
- Do not add try/catch where the surrounding code has none.

## Workflow

1. Detect the stack from the project (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`). Use that project's package manager, design tokens, and check command.
2. Scope: files you just wrote or edited this turn, named files, or unstaged/untracked work. Do not expand to siblings. If invoked by name with a clean tree and no files named, ask for a scope; do not sweep the repo. Whole-repo only if asked. Never edit staged files unless asked. Never edit generated output (OpenAPI clients, `*.gen.ts`, Prisma client, route types, lockfiles, protobuf stubs); if it is wrong, say so.
3. Fix only what the sections below call out. Do not restyle or reorganize for taste; structural problems in existing code are reported, not reorganized (see Structure). In the touched files, search for string methods (`includes`, `indexOf`, `startsWith`, `split`, `replace`) on values that look like URLs, hosts, paths, queries, or emails, and for inline formatting of money or dates.
4. Check what you touched with that repo's command (typecheck, `cargo check`, package tests). Do not run the full test suite unless shared primitives / `utils/` changed, or the user asked. If a cleanup makes a test fail, the cleanup changed behavior: revert it or report it, do not edit the test to match.
5. Explain in the conversation. If a fix is risky or you cannot prove it safe, report it instead of applying it. Do not write a summary document.

## Hard constraints

- No comments. The only exception is something outside the code that the code cannot show, such as a non-obvious workaround or an external constraint (`// the proxy drops websockets, so we poll`); then one short line. A comment that explains the implementation is restating it, even when phrased as a why. `SAFETY:` comments are never the exception. If a workaround needs a paragraph, it is the wrong workaround.
- When you change code, update or delete every comment the change makes wrong.
- Do not "fix" import order, className order, or indentation.
- Do not add blank lines between JSX siblings or between a parent and its children.
- Do not introduce dynamic `import()` inside a component. Imports stay at the top of the file.

## Types

Treat these as errors in **application** code. Generated files and third-party stubs are out of scope. The table is TypeScript; in other languages reject the equivalent (silencing the checker, `Any` / `object` / `dyn`, force-unwrap to make it compile).

| Reject | Prefer |
| --- | --- |
| `as X as Y`, `as unknown as T` | Parse, narrow, or one real boundary type |
| Widen to `unknown` / `any` / `object`, then `as T`; `data as T` after a typed client | Keep the original type through the flow |
| `const m: Record<string, T> = { start: fn }` | Infer, `satisfies`, or a const map |
| `fn(value: object)` / `Record<string, any \| unknown \| object>` | A named type or generic |
| `fn(input: unknown): unknown`, `type Foo = unknown` | Typed contracts. `unknown` only at JSON / `catch` / untyped lib, then disappear |
| `Reflect.apply` / `Reflect.get` | Typed call or parsed property |
| Ad hoc `typeof` mid-feature | Schema / DTO at the edge. `typeof` is fine **inside** a type predicate |
| `({ ... }) satisfies Partial<T> as T` | The schema's input type or a typed factory |
| `@ts-ignore` / broad `eslint-disable` over a fixable error | Fix the cause. `@ts-expect-error` only at a real boundary |
| `setTimeout(...) as unknown as number` | `ReturnType<typeof setTimeout>` |
| Non-null `!` | A guard, or thread `T \| undefined` to where it is checked |

`any` in production is always in scope. Leave library generic slots, `catch (error)` into the project error helper, and mutable clones for native APIs (`[...values]`).

## Validation weight

Parse untrusted input once at the boundary (HTTP body, `searchParams`, `JSON.parse`, local storage, route params, native callbacks) with the repo's existing validation library. After that, trust the typed value.

Reject recursive tree-walks, duplicate schemas for the same payload, refinements that repeat built-in checks, and field-by-field `typeof` after a schema already ran. Do not re-validate a branded ID or parsed form output as `unknown`, and do not add `?.` or `?? fallback` on values the types already guarantee.

## Duplication

Same non-trivial function, mapper, error throw, or fetch wrapper in two or more files → one shared helper in the place this repo already uses (`utils/`, `lib/`, a module). Do not invent a new folder.

Values and lists count too. The same constant, enum, or list of things (actions, routes, statuses, feature flags) kept in two places drifts: a keymap switch, a menu array, and a command palette list that each name the same actions. Derive them from one source. The same `switch` or if-chain on the same type in two places is the same problem: one map or model both read.

Short rules count too. A one-line normalisation, comparison, or format (`x.toLowerCase().includes(q.toLowerCase())`, `` `$${n}` ``) repeated across screens drifts: one copy trims and the next doesn't. When the same rule appears in three or more places, or must behave identically everywhere, make it one helper.

Do not "DRY" JSX that is similar but not the same. Two screens sharing a card is a component; two screens sharing a `<View className="gap-3">` is not.

## Tokens, not literals

Hardcoded theme values are slop when the repo already has tokens.

- Colors: no hex / `rgb()` / `rgba()` / named CSS colors in app UI. Use the theme's CSS variables, theme classes (`bg-card`, `text-primary`), or the project's JS token hook. Icons and native props that need a string color go through the hook too.
- Same for radius, spacing, and font size when tokens exist. Do not sprinkle `14`, `#111`, or `borderRadius: 8` next to a tokenized system.
- A brand color the theme lacks: add a token if the design system expects it; do not invent a parallel palette.

## Strings and user-facing values

URLs, paths, query strings, emails, dates, versions, MIME types, JSON, HTML, and CSV have parsers. Use the platform's or the project's, not `includes`, `indexOf`, `startsWith`, `split`, or `replace` on the raw string.

- Check a host by comparing the parsed `hostname` to the domain or a `.domain` suffix. `link.includes('x.com')` also matches `netflix.com`.
- Read and write queries with `URLSearchParams` or the language's URI type. Hand-splitting skips percent-decoding and loses the `#fragment`.
- A "stays in the app" check goes through the repo's existing guard. `startsWith('/')` lets `//host` through.
- Match a link or ID format you generate yourself with an anchored pattern of its exact shape.
- Splitting is fine when the input is not always the structured type (a file name, a value that may be a bare path or a full URL). Give it a one-line comment naming why.

Human data does not follow the shape of your test data. Do not split a full name into first and last (a one-word name is valid), and do not slice phone numbers or addresses by position. Trim and ignore case when matching what a user typed.

Money, counts, dates, durations, and file sizes shown to users go through one formatter per kind with an explicit locale. No inline `${symbol}${amount}`, and no bare `toLocaleString()` for anything that must look the same on every device.

## Readable code

- No nested ternaries. Use early returns, a `switch`, or a lookup map.
- Return early instead of nesting three levels deep.
- Return the condition: `return isValid`, not `if (isValid) return true; return false`.
- A new name says what it holds or does: not `data`, `result`, `temp`, `handle`, or an abbreviation, and never misleading (a `get` that also writes). If no honest name comes, the code is doing too many things. This applies to names you introduce; do not rename existing ones for taste.
- New code follows the style and patterns of the file it lands in.

## Splitting

Deletion test: imagine inlining the function, component, or module into its callers. If the complexity disappears, it was a pass-through; inline it. If the same complexity reappears in every caller, it is earning its place; keep it.

Inline when a name adds no information:

- `const isLoading = loading`
- `const onPress = () => props.onPress()`
- A helper used once, especially a 3-line one in the same file
- A new file for a component used once by one parent
- `useMemo` / `useCallback` around a cheap value or a callback passed to a DOM node

Keep a split when it is a real boundary: a repeated card, a schema module the form already uses, a hook with its own state/subscriptions. Do not inline a shared helper that is already the project convention, or one whose name explains a concept the caller would otherwise have to work out.

Prefer one 40-line function over four 8-line functions that only exist to call each other. The reverse is not simpler either: do not merge unrelated logic into one function.

## Structure

Apply these to code you write. In existing code you touch, fix a violation only when your change already crosses it; otherwise report it instead of reorganizing.

- Put new code next to the feature it serves. Do not spread one feature across `components/`, `hooks/`, `types/`, and `utils/` by layer unless that is the repo's layout.
- Keep feature logic out of shared modules. A shared helper takes general inputs; a branch or flag only one feature understands stays in that feature.
- Pass values in. A module does not read a global, singleton, or file that another module sets. On the server, no mutable module-level state that holds request data.
- Make the wrong order impossible. No API where callers must know to call `init()` first or `a()` before `b()`; use a constructor, one function, or types.
- Use a module's public interface. No deep imports into another module's internals; extend its interface instead.
- Depend on what changes less. Shared and domain code does not import a screen, a route, or a vendor SDK.
- Parameters that always travel together become one type.
- A refactor reduces what a reader has to hold (concepts, modes, branches); it does not move them to another file.

## Dead leftovers

Delete what the compiler and the product no longer use:

- Unused imports, variables, exports, props, state, effects, query results
- Commented-out code, `TODO` that is already done, `FIXME` with a working path beside it, stray debug `console.log`
- Always-true / always-false flags, dead branches, old and new implementations kept "just in case"
- Deprecated wrappers that only call the new function, and backwards-compatibility shims nothing calls
- Traces of the change itself: `// new implementation`, `// changed from X`, variables renamed to `_unused` instead of deleted
- Unreachable defaults after a union is already exhaustive

Before deleting an export, search the repo for the identifier — tests, native code, and string references (DI tokens, route names, dynamic keys) count, not just TS imports. Public APIs and fixtures stay unless proven dead.

## Other over-engineering

- Config objects for two options. Pass the two args.
- Boolean mode props (`isThread`, `isEditing`, `isCompactDenseAlt`). Each one doubles the states. Use explicit variants (`<ThreadComposer />`), a variant union, or composition with `children` instead of `renderX` props. Compound components sharing one context are fine.
- `return Promise.resolve(x)` inside `async`, `new Promise` wrapping an existing promise, `await` on a non-promise, `return await` in an `async` function that only forwards the promise.
- Independent `await`s run one after another. Start them together with `Promise.all`.
- Extra context/provider for a value used in one tree.
- Pass-through components that add no markup, state, or behavior.
- Abstractions for a hypothetical future use. An interface, abstract class, port, or DI token with one implementation is a hypothetical seam; with two (a test double counts), it is real.

## React

- Derive values during render. Do not copy props or other state into `useState` and sync it with `useEffect`; to reset state when an ID changes, give the component a `key`.
- A side effect caused by a user action runs in the event handler, not as state set in the handler and an effect that watches it.
- Do not define a component inside another component. It remounts on every render.
- `{count && <Badge />}` renders `0`. Use a ternary or a real boolean when the value can be `0` or `NaN`.

## Tests you write

A test should fail on a regression, and only then. Before adding or editing a test, read [tests.md](tests.md). Existing tests and mocks stay as they are unless you were asked to fix them.

## Done when

- Every section above holds for the touched files, and new tests follow [tests.md](tests.md).
- The repo's check command passes for those files (ignore failures in files you were told not to touch).
- The diff is smaller than the clever version.

Concrete snippets: [examples.md](examples.md).
