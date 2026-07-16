# Markdoc Guidance

Scope: everything under `packages/markdoc-md`. Root rules still apply.

- Repeated `info`, `switch`, or named `score` tags represent one logical value. Validate their shared contract through `validateMarkdocTagContracts`; do not add caller-specific duplicate handling.
- Compatible repeated tags may contribute optional Info metadata, switch cases, and nested inputs. Conflicting input types, non-empty Info metadata, tag kinds, or named-score formulas block template saves.
- Presentation settings such as `renderUnit` remain local to each tag occurrence and must not determine the shared input contract.
- Parsing stays tolerant for existing stored templates. Validation is enforced at editor and mutation boundaries rather than by throwing from render paths.
- Formula-only score tags are supported; `formula` is required and `primary` is optional.
