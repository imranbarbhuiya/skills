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
const empty = () =>
	({ name: '' }) satisfies Partial<FormValues> as unknown as FormValues;
```

```ts
type FormInput = z.input<typeof schema>;
const empty = (): FormInput => ({ name: '' });
```

## Copy-pasted helper

Same `mapStatus` in three screens → one `utils/status.ts` (or the repo's existing mapper). Do not add `lib/helpers/status-utils.ts` if `utils/` already exists.

## One-use split (inline)

```ts
const isLoading = loading;
const handlePress = () => onPress();
```

```ts
<Button disabled={loading} onPress={onPress} />
```

## Hardcoded color

```tsx
<IconCrossMedium color="#737373" />
<View style={{ backgroundColor: '#111' }} />
```

```tsx
const secondaryText = useCSSVariable('--color-secondary-text');
<IconCrossMedium color={secondaryText} />
<View className="bg-background" />
```

Use the repo's tokens (`global.css`, Tailwind theme, `var(--*)`). Do not invent a parallel palette.

## Heavy validation

```ts
function isDeepForm(value: unknown): value is FormState {
	return isRecord(value) && everyFieldRecursively(value);
}
```

```ts
const parsed = JSON.parse(raw);
const form = isRecord(parsed) ? parsed : {};
```

Then check individual fields where they are used. Do not walk a tree the screen already owns.

## Dead leftover

```ts
const [draft, setDraft] = useState(value);
useEffect(() => setDraft(value), [value]);
export const oldFormatDate = formatDate;
```

```ts
// use `value` directly; delete `oldFormatDate` if nothing imports it
```

## Native mutable clone (keep)

```ts
<SegmentedControl values={[...values]} />
```

Not a cast. Keep it when the native API wants a mutable `string[]`.

## Leave generated mismatch

```ts
return res.data as unknown as ILead[];
```

If the OpenAPI spec is wrong, report it. Do not edit generated files by hand.
