# Design standard

Visual and interaction standard for the SCCTLM Vector panel. It is derived from the
**Offset Lab** section (`src/app/index.html` section `.offset-lab-card`, styles in
`src/app/panel.css`), which is the reference implementation. New UI and any rework of an existing
tab should match this file; when they disagree, update this file in the same change.

Source of truth for values is `src/app/panel.css`. This file explains the intent and the rules;
it does not replace the stylesheet.

## Principles

1. **Pill-shaped, flat, dark.** Controls are fully rounded (`999px`), flat fills, no gradients.
2. **One accent per meaning.** Blue marks *selection* (the active segment), green marks *commit*
   (the primary action and checked boxes). Never swap them.
3. **State by colour, not by weight.** An active control changes fill and text colour; its font
   weight and size stay the same so the layout never shifts.
4. **Short copy.** Labels are one or two words. No trailing colons, no "thành công!", no full
   sentences in buttons. Put detail in `title` tooltips.
5. **Preview what will happen.** Where a control changes geometry or colour, show it live.

## Typography

Font family is inherited from `body` and is not set per component:
`-apple-system, "Segoe UI", Roboto, sans-serif`. Base size `12px`, line height `1.45`.
Do not add `@font-face` or per-component families.

Tokens (`:root`):

| Token | Value | Use |
|---|---|---|
| `--fs-sm` | 11.5px | Secondary text: units, checkbox labels, hints |
| `--fs-md` | 13px | Default control text: labels, inputs, buttons, segments |
| `--fs-lg` | 15px | Section title, primary action button |
| `--fw-regular` | 400 | Secondary text and light labels |
| `--fw-strong` | 600 | Labels, values, buttons, active segments |
| `--fw-bold` | 700 | Primary action button only |

Rules:

- Use only these sizes and weights. Segoe UI has no 500 weight, so 500 silently renders as 400.
- Never raise weight to show an active state (see principle 3).
- Letter spacing: `.02em` on segmented buttons, `.01em` on the primary button, `.03em` on HEX text.
  Nothing else.

## Colour

Theme tokens come from Illustrator at runtime (`Theme` in `panel.js` overwrites `--bg`, `--fg`,
`--field`, `--btn`). Prefer them wherever a value should follow the host theme.

| Token | Default | Use |
|---|---|---|
| `--bg` | `#323232` | Panel background |
| `--fg` | `#ddd` | Primary text |
| `--muted` | `rgba(238,238,238,.8)` | Secondary text, inactive segments |
| `--field` | `#232323` | Track behind segmented toggles |
| `--surface` | `rgba(128,128,128,.10)` | Card background |
| `--surface-hover` | `rgba(128,128,128,.20)` | Hover on inactive segments |
| `--line` | `rgba(128,128,128,.28)` | Card and toggle borders |

Control tokens (`:root`, defined for Offset Lab; they are fixed values and do not follow the Illustrator theme yet):

| Token | Value | Use |
|---|---|---|
| `--control` | `#3f3f3f` | Fill of every text, number, HEX input and the eyedropper button; unchecked checkbox |
| `--control-hover` | `#4a4a4a` | Hover on `--control` buttons; slider track |
| `--control-line` | `rgba(255,255,255,.08)` | Border of `--control` inputs |
| `--select` | `#378EF0` | Active segment (selection). Text `#ffffff` |
| `--select-focus` | `#4A87C7` | Focus border on number inputs |
| `--commit` | `#44BA76` | Primary action, checked checkbox |
| `--commit-hover` | `#4ed487` | Hover on the primary action |
| `--commit-ink` | `#04301a` | Text on `--commit` |

Still literal in Offset Lab: `#1FC8FF` (default offset colour and HEX focus border).

## Shape and spacing

- Cards: `--radius` (10px), `1px --line` border, `10px 12px 11px` padding (`10px 12px` for Align), `7px` between cards.
- Controls: fully rounded (`999px`); checkbox `5px`; swatch circle.
- Vertical rhythm between rows: `7px` (`9px` after swatches, `8px` before the primary button). Gap between controls in a row: `8–10px`; between segments: `3px`.
- Heights: input / value pill `26px`; colour and HEX row `32px`; segmented join `29px`;
  segmented mode `28px`; primary button `38px`.
- Toggle track: `--field` background, `1px --line` border, `2px` padding.

## Components

**Section title.** `--fs-lg`, `--fw-strong`, `--fg`, `0 0 6px` margin. One per card.

**Label.** `--fs-md`, `--fw-strong` for field names; `--fw-regular` for descriptive labels.
No trailing colon.

**Slider with value pill.** 4px track `#4a4a4a`, 15px white thumb with soft shadow, hover scale
1.15. The value is an editable number in a `26px` pill with its unit (`--fs-sm`, `--muted`).
Number inputs hide the browser spin buttons; the slider is the stepper.

**Segmented toggle** (`.offset-joins-toggle`, `.offset-mode-toggle`). Track in `--field`, pill
segments. Inactive: transparent, `--muted`; hover `--surface-hover` + `--fg`. Active: `#378EF0`,
white text, `0 1px 4px rgba(0,0,0,.28)` shadow, same weight as inactive. Use `role="radiogroup"`
with `role="radio"` and `aria-checked`. Use it for 2–3 mutually exclusive options.

**Text and number input.** `#3f3f3f`, `.08` white border, pill, centred, `--fs-md` /
`--fw-strong`, no outline, focus recolours the border only.

**Icon button.** Pill, `#3f3f3f` (or the live colour for the colour well), icon in
`currentColor`, hover `#4a4a4a` and `#ffffff`, active `translateY(1px)`.

**Icons.** Inline SVG, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`,
`stroke-width="1.75"`, round caps and joins, `aria-hidden="true"`. Size is set in CSS, not in the
element: 19px inside a 32px button, 18px in an icon-only button. Source set: the
`SCCTLM_Foto_Icons` pack (`controls/`, `retouch/` folders).

**Colour swatch.** 22px circle. Hover scale 1.22. Active: `0 0 0 2px --bg, 0 0 0 4px #fff` ring
and scale 1.15.

**Checkbox.** Custom: 16px, `5px` radius, `#3f3f3f` with `.14` white border; checked `#44BA76`
with a white 3.5px round-cap tick (inline data-URI SVG). Label `--fs-sm` / `--fw-regular`,
`--muted`, becoming `--fg` on hover or when checked. Keyboard focus: `2px` green ring at 50%.

**Primary button.** Full width, `38px`, pill, `#44BA76`, `#04301a` text, `--fs-lg` /
`--fw-bold`. One per card. Disabled while its action runs.

**Preview box.** No background or border; the artwork sits directly on the card. Artwork uses
`--fg`; the effect uses the chosen colour. Falls back to a sample shape when there is no
selection.

## Interaction

- Hover and active feedback is mandatory on every clickable control: colour or brightness change
  on hover, `translateY(1px)` on press.
- Transitions: `.15s` for colour, `.18s` for segment changes, `.05s` for the press nudge. No
  longer, no bounce except the swatch hover.
- Focus-visible must be visible: segments use a `2px` blue ring at 40%, checkboxes a green ring.
- Operations that call Illustrator disable their trigger until the result returns and report the
  outcome through the in-panel notice (`Notice.show`), falling back to `#status`.

## Copy

- Vietnamese, sentence case, one or two words where possible: "Độ rộng", "Bo tròn", "Giữ gốc".
- Keep Adobe terms that users know in English: "Offset Path", "Sticker".
- Progress: "Đang tạo viền 20px…". Success: "Đã tạo viền 20px". Error: "Lỗi: <short reason>".
- Tooltips (`title`) carry the explanation that does not fit the label.

## Known gaps

These are inconsistencies between Offset Lab and the rest of the panel. They are recorded here
rather than fixed so each can be adopted deliberately.

1. **Two greens.** Offset Lab uses `#44BA76` for commit actions; the rest of the panel uses
   `--green` (`#15C671`, `.primary`). Offset Lab now uses `--commit`; choosing one green for the whole panel is still open.
2. **Control tokens are fixed.** `--control*`, `--select*` and `--commit*` exist, but they are
   dark-theme literals, so they ignore the Illustrator light theme that `--bg` / `--field` follow.
   Other tabs still hard-code `#378EF0` (doc size, orientation, colour mode). Derive the tokens from
   the host theme, then migrate those tabs.
3. **Other tabs still use their own sizes.** Grid, Colour and the export tabs use the older
   `10 / 11 / 12 / 13 / 13.5 / 16px` sizes and 500/600/700 weights. They should migrate to the type
   scale above.
4. **Older controls use `--radius-sm` (7px) and `--btn` / `--field` fills** rather than pills.
   Align when those tabs are reworked (the PDF tab already follows the pill standard).
5. **Offset width is labelled px but applied in pt** (see `offset-lab.md`); equal only when the
   document uses px.

## Changing this file

Update it in the same change that alters a token, component or rule it describes, and keep
`src/app/panel.css` the single place where values are defined.
