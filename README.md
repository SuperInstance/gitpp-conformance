# quilt-conformance — a public, hand-curated conformance corpus for the git.pp fold

> The test suite any port author can use to verify their implementation. The answers are included; the spec is the source.

This is *not* the canonical corpus in `patchwork-quilt/git.pp-ng/conformance/` (that one has 1,151 cases, the answers are private, and the corpus NAMES are public but the answers aren't — this is the doc-only-discipline test). This is a **separate, public, hand-curated** set of cases designed to exercise the spec's load-bearing rules. Use it for fast feedback while porting.

## When to use this corpus

- **While porting.** Run the public corpus first; it covers the load-bearing rules. Green on this is necessary but not sufficient for conformance.
- **For pre-merge validation.** A new PR can run against this corpus in CI without needing the canonical corpus's private answers.
- **For teaching.** Each case has a name, a description, the input, and the expected output. The "why" is in the test name.

The canonical corpus (1,151 cases) is the receipt for "this port is conformant with the hub." This public corpus is the receipt for "this port implements the spec correctly per the load-bearing rules."

## What's in it

The corpus is split into **case families** that mirror the spec's structure:

- **L1 — leaf construction** (5 cases): integer encoding, signed zero, float scientific notation, non-BMP id sorting, malformed record handling.
- **L2 — closure root** (5 cases): simple closure, grown closure, shrunk closure, member re-versioned, incomplete closure.
- **F1 — fold resolution** (8 cases): class precedence, ancestry reduction, tie-break (intent count), tie-break (witness count), tie-break (id), conflict detection, orphan exclusion, cycle exclusion.
- **F2 — topo order** (4 cases): basic Kahn, smallest-id-first, cycle-affected exclusion, orphan exclusion.
- **S1 — state assertions** (5 cases): the 5 keys from `poc-quilt-1` re-derived and asserted.
- **V1 — three-way verdict** (4 cases): VERIFIED, STATE-ONLY (root differs, state matches), MISMATCH (state differs), missing root.

Total: **31 cases**, all named, all with the expected answer in the case file.

## How to use

Each case is a JSON file in `cases/<family>/<name>.json` with the input record set and the expected output. A port author writes a runner that:
1. Reads a case file
2. Computes `closure_root(records, at)` and the fold's `state`
3. Compares byte-for-byte to the case's expected output

A green run means the port implements the spec's load-bearing rules correctly. The runner is the port's responsibility; the corpus is the spec-as-test.

## Pass criterion

A port is conformant with this corpus when:
- All 31 cases produce the expected `closure_root` at the case's `at` record.
- All 31 cases produce the expected fold `state` (compared as a JSON object, key-order independent).
- All 31 cases produce the expected `conflicts` (compared as a sorted list of `{key, winner, sorted-losers}`).

The pinned closure root for `poc-quilt-1@task-c` is `60effe23970d8a5cc837636c44685502361288c1f00577e9addfa10cbd4fc91d` and is the **first** case in `cases/L2/` — run it before any others.

## Doc-only discipline

This corpus is derived from the public spec (`SuperInstance/git.pp-spec`) and the design docs (`DESIGN.md`, `docs/CHECKPOINT-V2.md`, `docs/FORMAT-V2.md` in `patchwork-quilt/git.pp-ng`). It is **not** derived from reading the canonical corpus or any port's source. The cases are designed to test the spec, not to match an existing implementation. A port that matches the canonical corpus and this public corpus has two independent receipts that the spec is correctly implemented.

## Comparison with the canonical corpus

| | Canonical (`conformance/` in the hub) | Public (this repo) |
|---|---|---|
| Size | 1,151 cases | 31 cases |
| Answers | Private (port authors derive from the spec) | Public |
| Purpose | Receipt for "conforms to the hub" | Receipt for "implements the spec's load-bearing rules" |
| Use during porting | Once you've read the spec | Continuously, as a feedback loop |
| License | (per the hub) | MIT |
