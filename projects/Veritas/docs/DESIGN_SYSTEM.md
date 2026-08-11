# VERITAS Design System · FROZEN

**Status: LOCKED FOREVER**

This visual language is permanent. Do not redesign, soften, recolor, or round it.
New modules must inherit these tokens exactly. No alternate themes without an explicit product decision to unfreeze (never expected).

## Brand

| Token | Value |
| --- | --- |
| Name | VERITAS |
| Palette | Rose Petal |
| Geometry | Sharp only · zero radius |
| Density | Minimal chrome · help for depth |

## Rose Petal tokens

```css
:root {
  --color-1: #FE4365;
  --color-2: #FC9D9A;
  --color-3: #F9CDAD;
  --color-4: #C8C8A9;
  --color-5: #83AF9B;
}
```

| Role | Token |
| --- | --- |
| Primary signal / CTA / incident | `--color-1` |
| Soft accent / secondary text pop | `--color-2` |
| High emphasis numbers / warm light | `--color-3` |
| Neutral sage sand / muted structure | `--color-4` |
| Healthy / ok / savings | `--color-5` |

Surfaces stay deep rose void (`#14080c` family). Never pure corporate navy or gray beige.

## Geometry (non negotiable)

- `border-radius: 0` on every element
- No pills, no rounded modals, no soft cards
- Square help button, square badges, square inputs
- 2px top edge accent on cards using the Rose Petal gradient

## Typography and chrome

- Titles only on pages · no subtitle paragraphs under H1
- Help `?` opens topic modal for all explanatory copy
- No hyphen character `-` in chrome labels and help prose
- Prefer middle dots `·` and arrows `→` for separators
- Monospace for IDs, scores, evidence

## Motion

- Subtle only (help fade, bar width)
- No bouncy or playful easing
- Pulse on live incident indicators only

## Help modal

- Sharp panel, Rose Petal bar on top
- Kicker · title · blocks with uppercase headings
- Esc and outside click to close
- Never dump walls of text on the main canvas

## Enforcement

1. Source of truth: `ui/src/index.css` header `FROZEN · ROSE PETAL`
2. This document
3. PR reviews reject radius, palette drift, and subtitle reintroduction

**If in doubt: sharper, quieter, more Rose Petal.**
