# Eight AI arms and MiniMax

## Roles

`WATCHER`, `CURRENT`, `DEPTH`, `CHORUS`, `AUDITOR`, `HUNTER`, `KEEPER`, and `ARCHIVE` are eight specialized voices with different emotional tones. Their personality affects wording and attention, not chain facts.

## ASK flow

```text
visitor question
  -> O8 router selects 2–4 relevant arms
  -> each arm receives role prompt + relevant evidence
  -> local interpretations are persisted
  -> ARCHIVE synthesizes agreement, dissent, confidence, and citations
  -> response is shown and remembered
```

Most visits do not invoke MiniMax. The terminal can display deterministic arm positions from lifecycle rules without pretending that eight model calls happened. MiniMax is only the provider adapter; O8's identity and memory live in the application and database.

## Required answer fields

Every factual answer should identify the arms involved, the evidence used, confidence where interpretation is involved, and explicit uncertainty or disagreement. Missing evidence must produce `insufficient chain evidence`, not a confident invention.

