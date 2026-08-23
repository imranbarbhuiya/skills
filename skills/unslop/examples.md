# Unslop examples

Read this only when a fix is ambiguous.

## Chained assertion

```ts
const timeout = setTimeout(fn, 0) as unknown as number;
```

```ts
const timeout: ReturnType<typeof setTimeout> = setTimeout(fn, 0);
```

## Satisfy then assert

```ts
const emptyFest = () =>
	({ name: '', brands: [] }) satisfies Partial<FestValues> as unknown as FestValues;
```

```ts
type FormInput = z.input<typeof schema>;
type FestInput = FormInput['fests'][number];

const emptyFest = (): FestInput => ({
	name: '',
	eventTypes: [],
	venuePhotos: [],
	brands: [],
	socialHandle: '',
});
```

## Widen then assert

```ts
const stored: unknown = user;
return stored as User;
```

```ts
return user;
```

## Known-value widening

```ts
const handlers: Record<string, Handler> = { start: startHandler };
```

```ts
const handlers = { start: startHandler } satisfies Record<string, Handler>;
```

## Ad hoc typeof vs predicate

Reject mid-feature:

```ts
if (typeof payload.name === 'string') save(payload.name);
```

Allow at the boundary:

```ts
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
```

Keep field checks next to the code that uses those fields. Do not recurse the whole tree.

## Native mutable clone (keep)

```ts
<SegmentedControl values={[...values]} />
```

Expo wants `string[]`. Cloning also stops the native control mutating the caller's array. Do not replace this with `as string[]`.

## Leave generated mismatch

```ts
return res.data as unknown as ILead[];
```

If `openapi/*.ts` is wrong, report it. Do not pile more casts into app code, and do not edit the generated file by hand.
