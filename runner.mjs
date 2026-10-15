// runner.mjs — the public conformance runner
//
// Reads cases from cases/<family>/<name>.json, computes the closure root
// and the fold for each, and asserts the case's expected output.
//
// Usage: node runner.mjs <path-to-gitpp> [case-pattern]
//   e.g. node runner.mjs ../gitpp-js/src/gitpp.js
//        node runner.mjs ../gitpp-js/src/gitpp.js L1/*
//        node runner.mjs ../gitpp-js/src/gitpp.js L2/pinned-poc-quilt-1

import { readdir, readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const portPath = process.argv[2];
const casePattern = process.argv[3] || "*";

if (!portPath) {
  console.error("usage: node runner.mjs <path-to-gitpp-port> [case-pattern]");
  process.exit(1);
}

const port = await import(pathToFileURL(resolve(portPath)).href);
const required = ["closureRoot", "derive", "recordLeaf"];
for (const fn of required) {
  if (typeof port[fn] !== "function") {
    console.error(`port at ${portPath} does not export ${fn}()`);
    process.exit(2);
  }
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith(".json")) yield full;
  }
}

const cases = [];
for await (const file of walk(join(__dirname, "cases"))) {
  if (casePattern !== "*" && !file.includes(casePattern)) continue;
  const c = JSON.parse(await readFile(file, "utf8"));
  c._file = file;
  cases.push(c);
}

let pass = 0, fail = 0;
const failures = [];
for (const c of cases) {
  try {
    // If the case provides input_tampered, use it (for V1 tests).
    let records = c.input_tampered || c.input;
    // Otherwise, if the case references the live deployment, fetch the records.
    if (!records && c.input_source && c.input_source.startsWith("https://")) {
      const r = await fetch(c.input_source);
      if (r.ok) {
        const j = await r.json();
        records = j.records;
      }
    }
    // Apply input_modification if present (a small DSL for common tweaks)
    if (c.input_modification && records) {
      // Patterns: "change X.Y to Z", "add record A with parent B", etc.
      // Not yet implemented; case authors should provide input_tampered instead.
    }
    if (!records) {
      // No input, no live source — skip
      continue;
    }
    const root = await port.closureRoot(records, c.at);
    const d = port.derive(records);
    // Compare state
    const stateOk = c.expected_state
      ? Object.keys(c.expected_state).every(k => JSON.stringify(d.state[k]) === JSON.stringify(c.expected_state[k]))
      : c.expected_state_subset
      ? Object.keys(c.expected_state_subset).every(k => JSON.stringify(d.state[k]) === JSON.stringify(c.expected_state_subset[k]))
      : true;
    // Compare root. The case's expected_closure_root is one of:
    //   "computed"          — we don't care, just that the root is a non-null hex
    //   "differs-from-pinned" — root should be different from any pinned value
    //   null                — root should be null
    //   <hex>               — root should match exactly
    // If the field is absent, treat as "computed".
    const expRoot = c.expected_closure_root;
    let rootOk;
    if (expRoot === undefined || expRoot === "computed") {
      rootOk = typeof root === "string" && /^[a-f0-9]{64}$/.test(root);
    } else if (expRoot === "differs-from-pinned") {
      rootOk = typeof root === "string" && root !== c.pinned_root && root !== c.pinned_root_against_live;
    } else if (expRoot === null) {
      rootOk = root === null;
    } else {
      rootOk = root === expRoot;
    }
    // Compare conflicts
    let conflictsOk = true;
    if (c.expected_conflicts || c.expected_conflicts_subset) {
      const want = c.expected_conflicts || c.expected_conflicts_subset;
      const got = d.conflicts.map(x => ({ key: x.key, winner: x.winner, losers: [...x.losers].sort() }));
      const expected = want.map(x => ({ key: x.key, winner: x.winner, losers: [...x.losers].sort() }));
      if (JSON.stringify(got.sort((a, b) => a.key < b.key ? -1 : 1)) !== JSON.stringify(expected.sort((a, b) => a.key < b.key ? -1 : 1))) {
        conflictsOk = false;
      }
    }
    if (stateOk && rootOk && conflictsOk) {
      pass++;
    } else {
      fail++;
      failures.push({ name: c.name, stateOk, rootOk, conflictsOk });
    }
  } catch (e) {
    fail++;
    failures.push({ name: c.name, error: e.message });
  }
}

console.log(`\n${pass} pass, ${fail} fail (out of ${pass + fail})`);
if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log("  -", f.name, f);
  process.exit(1);
}
