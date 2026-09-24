# `src/directives/`

Global Vue directives, registered once in `main.ts` and usable in any
component template without an import.

| File | Directive | Usage |
| --- | --- | --- |
| `reveal.ts` | `v-reveal` | `<div v-reveal>` or `<div v-reveal="{ delay: 120 }">` fades and slides an element up 24px the first time it scrolls into view, then never animates it again. No-ops entirely under `prefers-reduced-motion: reduce`. See the doc comment at the top of `reveal.ts` for the exact timing and the shared-`IntersectionObserver` implementation. |

## Adding a new directive

1. Create `src/directives/<name>.ts` exporting a `v<Name>` object typed as
   `Directive<ElementType, ValueType>`.
2. Register it in `main.ts`: `.directive('<name>', v<Name>)`.
3. Add a row to the table above.
