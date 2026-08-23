---
name: unslop
description: >-
  Removes low-evidence TypeScript and JavaScript patterns without installing
  anti-slop. Rejects chained assertions, widen-then-assert, unknown/any/object
  contracts, and unsafe dictionaries. Use when the user says unslop, anti-slop,
  tighten types, kill type slop, or scan TS/JS for fabricated evidence. Works
  across NestJS, Next.js, TanStack, Expo, React Native, and similar TypeScript
  apps.
disable-model-invocation: true
---

# Unslop

Opinionated pass for TypeScript and JavaScript that follows [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop): do not fabricate type evidence. Parse untrusted input at the boundary. Keep known types known. Do not install the anti-slop package, Oxlint plugin, or vendor its `src/`.

This is a surgical cleanup, not a rewrite. Leave valid current code alone.

## Workflow

1. Detect the stack from the repo (`package.json`, `nest-cli.json`, `app.json`, `expo`, `@tanstack/*`). Follow that project's package manager and typecheck command.
2. Scope:
   - Default: unstaged and untracked source the user is working on, or files they named.
   - Whole-repo scan only if they asked.
   - Never edit staged files unless they explicitly said to.
   - Never edit generated output (`openapi/`, `*.gen.ts`, Prisma client, route types, lockfiles).
3. Search for the patterns below. Fix only places that fabricate evidence or hide a weak contract.
4. Prefer the smallest real type over a heavy runtime validator. If the value is already known (form state, OpenAPI field, branded ID the caller passed), do not add recursive guards "for TypeScript."
5. Run the project's typecheck. Do not run the full test suite unless the change is in shared primitives or `utils/` (or the user asked).
6. Do not write a summary document. Explain the pass in the conversation only.

## Hard constraints

- Do not add comments, including `SAFETY:` comments. If an assertion still needs a paragraph of justification, the assertion is the wrong fix.
- Do not add blank lines between JSX siblings or between a parent and its children.
- Do not introduce dynamic `import()` inside a component. Imports stay at the top of the file.
- Do not "fix" import order, className order, or indentation.
- Do not mass-rename `*Shape` types.
- Do not rewrite existing Jest/Vitest `jest.mock` / `vi.mock` unless asked.
- Do not chase every `{...(cond ? { x } : {})}` spread. Leave it unless it is hiding a typing lie.

## What to reject

Treat these as errors in **application** code. Generated files and third-party `.d.ts` are out of scope.

| Pattern | Reject | Prefer |
| --- | --- | --- |
| Chained assertions | `as X as Y`, `as unknown as T` | Parse, narrow, or a single justified boundary assertion |
| Widen then assert | annotate as `unknown` / `any` / `object`, then `as T` | Keep the original type through the flow |
| Known-value widening | `const m: Record<string, T> = { start: fn }` | Infer, `satisfies`, or a const map |
| `object` parameters | `fn(value: object)` | A real type or generic |
| `unknown` / `any` in app contracts | `fn(input: unknown): unknown`, `type Foo = unknown` | Typed input/output. `unknown` belongs at a parse boundary, then disappears |
| Unsafe dictionaries | `Record<string, any \| unknown \| object \| {}>` | `Record<K, Specific>` or a named type |
| `Reflect.apply` / `Reflect.get` | dynamic call/get | Typed call or parsed property |
| Ad hoc `typeof` in business logic | `if (typeof x === 'string')` mid-feature | Schema / DTO parse at the edge. `typeof` is fine **inside** a type predicate |
| Satisfy-then-assert | `({ ... }) satisfies Partial<T> as T` | `z.input` empty values + `useForm<Input, unknown, Output>` or a typed factory |

`any` in production is always in scope. `unknown` is only for the first line after JSON, `catch`, or an untyped library, and must be narrowed before use.

## What to leave

- Generated OpenAPI / Prisma mismatches. Do not double-cast to paper over a bad schema; leave a short note in chat if the generator is the real bug.
- Library generics that require `unknown` as a slot (`useForm<TField, unknown, TOutput>`, React Query context).
- `catch (error)` then a project error helper (`ApiError`, `toUserMessage`). Do not type the catch as `any`.
- Existing test mocks and optional object spreads, as above.
- Platform mutations that need a shallow clone (`[...readonlyValues]` for Expo `string[]`) — that is not a cast, keep it.

## Fix recipes

**Timeout IDs:** `ReturnType<typeof setTimeout>`, never `as unknown as number`.

**JSON / MMKV / `searchParams` / request bodies:** one `isRecord` (or Zod / class-validator / Nest DTO) at the boundary, then field checks where those fields are used. No recursive tree walk of an already-owned form.

**Zod + RHF:** `type FormInput = z.input<typeof schema>`; `type FormValues = z.output<typeof schema>`; empty rows are `FormInput`. Submit handlers take `FormValues`.

**IDs in `queryFn`:** if missing, throw the project's error type (`ApiError`, `BadRequestException`, typed `Error` subclass) — not a raw `new Error` unless that is the repo convention.

**Non-null `!`:** replace with a guard or by threading `string | undefined` until the call site that already has `enabled: Boolean(id)`.

**Discriminated unions:** model the variants; do not `as` between them.

**Sets of known strings:** `Set` + `.has`, not a boolean table plus assertions.

## Stack notes

Use the repo's existing validation and error types. Do not invent a new parsing library.

| Stack | Boundary | Interior |
| --- | --- | --- |
| NestJS | DTO / Zod / `ValidationPipe` on controllers | Services and repos take typed args, never `any` body leftovers |
| Next.js | `searchParams`, route handlers, `JSON.parse`, formData | Page/components consume parsed types |
| TanStack Query / Router | `queryFn` return type is the resource; parse errors to the project's error class | No `data as T` after a typed client |
| Expo / RN | route params (`useLocalSearchParams<{ id: string }>()`), MMKV/JSON, native callbacks | Screens use the parsed type; clone when a native API needs mutable arrays |
| OpenAPI clients | trust generated response types when they match; do not invent `as unknown as Entity[]` | If the spec is wrong, say so — do not "fix" generated files |

## Done when

- No new chained assertions, `any` production contracts, or widen-then-assert in the files you touched.
- Typecheck passes for those files (or the project's typecheck; ignore failures in files you were told not to touch).
- The diff is smaller than a clever type system. If a workaround needs a long explanation, find a simpler one.

Concrete before/after snippets: [examples.md](examples.md).
