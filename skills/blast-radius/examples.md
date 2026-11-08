# Blast radius examples

Read this only when unsure what a proof or a reply should look like. TypeScript examples; translate to the host language.

## A level-4 proof

Claim: "switching `formatPrice` to `Intl.NumberFormat` keeps the output for every currency we store."

```ts
// /tmp/blast-format-price.ts — run with: bun /tmp/blast-format-price.ts
import { formatPrice } from '../src/utils/price';

const cases = [
	[0, 'USD', '$0.00'],
	[1999, 'USD', '$19.99'],
	[1999, 'JPY', '¥1,999'],
	[-500, 'EUR', '-€5.00'],
] as const;

for (const [amount, currency, expected] of cases) {
	const actual = formatPrice(amount, currency);
	if (actual !== expected) throw new Error(`${amount} ${currency}: ${actual} !== ${expected}`);
}
console.log(`ok, ${cases.length} cases`);
```

The currencies come from the data (`SELECT DISTINCT currency FROM orders`), not from memory. Paste the command and its output into the reply.

## Deleted lines in a "move" commit

```
- import { withSession } from '../db/session';
...
- } catch (error) {
-   if (isDuplicateKey(error)) return existing;
-   throw error;
- }
```

The commit moved the cache logic to Redis. For each removed line, find where its behavior lives now:

- `withSession`: is the write still in a transaction? Search the new file for `session`.
- The `isDuplicateKey` branch: is a second concurrent insert now an unhandled error? Walk the path (level 3) or race two calls in a script (level 4).

## Reply

```
Not safe: one break.

What it does: moves profile caching from memory to Redis and drops the
local fallback when Redis is down.

Safe because: every reader goes through getProfile (src/profile/get.ts:12);
no other file reads profileCache. Level 2, `rg profileCache` finds only get.ts.

Breaks:
- Redis down now throws on every profile read instead of serving from memory
  (src/profile/get.ts:30). Likely during deploys; costs the whole profile
  screen. Fix: catch the connection error at get.ts:30 and read from the DB.

Outcomes: design unchanged (no UI files). Logic moved only in the break
above. Perf: one extra round trip on a cache miss, level 1. CI unchanged.

Cleared: duplicate-key branch now lives in upsertProfile (src/profile/upsert.ts:44).

Before merge: stop Redis locally, open a profile; it should still load.
```
