# 0009. Each docs example is one file, shown as its own code

- **Date:** 2026-11-03
- **Status:** Active
- **Source:** Ben, in the project chat, 2026-11-03: "One file per example", on audit finding 6 of 2026-11-02.

## Decision

A live example on a docs page is one module under `apps/docs/examples/<slug>/`. The page imports it and writes `<Example of={Name} />`, and the build shows the file's own code above the demo it renders. The English and Korean pages import the same file. Translators change only prose and no longer copy code blocks. A fence stays on the page for code that has no demo.

## Why

Each example existed three times: the demo component, the English fence and a byte-identical Korean fence. Tests kept the two fences equal but nothing tied them to the demo, and they had drifted, for example the date-picker fence left out the `locale` its demo passes. With one file, the code a reader copies is the code that runs.
