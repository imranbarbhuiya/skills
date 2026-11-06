# Tests you write

Read this before adding or editing a test. A test should fail on a regression, and only then. Existing tests stay as they are unless you were asked to fix them.

## Before writing

Name the break: which production change should make this test fail, and is that change a bug or a deliberate decision? If you cannot name one, do not write the test. If the only break is a deliberate decision, the test pins a choice, not behavior.

## Reject

- A test that can't fail: asserting a mock returns what it was told to, or that a function was called with no check on the result.
- A test that repeats the implementation. Expected values are hand-checked literals or fixtures, never computed with the code under test or the helpers it uses.
- A change detector: `expect(MAX_RETRIES).toBe(5)`, exact error wording, private fields, or the order of internal calls. Test the behavior that depends on the value instead.
- A test of the framework or trivial code: constructors, getters, constants, and plain forwarding. They earn a test only when they validate, normalize, default, or derive something.
- A test-only method in production code. Setup and cleanup that only tests need live in test utilities.

## Prefer

- Test behavior through the public interface, not internals, so a refactor that keeps behavior does not break it.
- Mock only at system boundaries: network, database, time, randomness, the file system. Do not mock your own modules. A mock has the full shape of the real thing; a partial mock fails silently when code reads a field it left out.

## Check

Mutation check: flip one condition or return value in the code under test, mentally or for real. At least one test should fail. If none does, the tests do not cover that behavior.

```ts
expect(formatPrice(1999)).toBe(`$${(1999 / 100).toFixed(2)}`);
```

```ts
expect(formatPrice(1999)).toBe('$19.99');
```
