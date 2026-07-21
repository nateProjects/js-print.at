# Changelog

## inputKey 1.0.0

* Added `input.line([prompt], [opts])` — the missing `INPUT a$` / `INPUT a` statement; renders prompt + field via printAt, supports backspace, length cap and numeric mode, resolves on Enter
* Added `input.onkey([target], handler, [opts])` — edge-trigger keydown handler returning an unsubscribe function; opt-in to OS auto-repeat via `{repeat: true}`
* Added `input.held(code)` — single-key boolean shortcut (`input.held('Space')`)
* Added `input.attach(element)` — scope listeners to a specific DOM element instead of `window`; auto-adds `tabindex` if missing
* Key-repeat handling: `event.repeat` is exposed on every onkey payload; edge-only by default
* Wider test pass — 13 behaviours covered headlessly

## dimArray 1.0.0

* Added `.fill(value)` — set every cell / string slot in one call (collapses init loops)
* Added `.forEach(fn)` — iterate every cell in subscript order, callback receives `(value, subs)`
* Added `.copy()` — deep clone with same dimensions, type and values
* Added typed numeric dims via `dim(dims, {type: 'UBYTE'})` — out-of-range writes throw; faithful to BASIC's `AS UBYTE / BYTE / UINT / INT / ULONG / LONG`. `FLOAT` / no-type = unbounded as before
* Added constructor `{fill}` option for both `dim` and `dimString` — initial value at construction
* Added varargs form on `dimString.set` / `dimString.get` — `AS.set(2, 4, 'Q')`, `AS.get(2, [4, 8])` now match the numeric-dim varargs ergonomics
* Wider test pass — 14 behaviours covered

## printAt 1.1.0

* Added `print.at(x, y, text, ink, paper)` and `print.line(text, ink, paper)` overloads — one-shot ink/paper that doesn't disturb the persistent `print.color` defaults; collapses every `print.color(...)` + `print.at(...)` pair into a single statement
* Added `print.basicAt(y, x, text, [ink], [paper])` — Spectrum-style alias (y first, 0-indexed) for line-by-line BASIC ports
* Added `screen.glyph(code, bytes)` — register N x 8 bitmap characters in Spectrum UDG byte format; closes the gap that previously had no workaround
* `inputKey` 0.9.x — added `input.pause(ms)`, a promise-returning `PAUSE n` analogue for use with `await` inside async game loops
* `dimArray` 0.9.x — added varargs form on numeric `set` / `get`: `A.set(5, 42)` / `B.set(2, 4, 99)` alongside the array form, mirroring BASIC's `LET A(5) = 42` / `LET B(2,4) = 99`

## printAt 1.0.0

* Added `screen.cls(ink, paper)` — ink/paper-aware clear shortcut
* Added `screen.grid(on, color)` — 1-pixel cell-grid overlay
* Added `screen.border(color, thickness)` — surrounding border area; canvas grows to accommodate, print coords stay 1-indexed inside the border
* `screen.clear` paints the border first, then the print area
* All 1.0 plan items shipped (cls, grid, border)

## printAt 0.9.0

* Added `resolution` to each profile and a `screen.size('preset')` lookup
* Added `screen.scale(n)` for backbuffer multiplication (default 2)
* `screen.size` in preset mode auto-fits the font to the cell grid
* Exposed `screen.cols`, `screen.rows`, `screen.nativeWidth`, `screen.nativeHeight`
* `screen.size()` with no args re-applies the active palette's resolution if any

## printAt 0.8.0

* Added `screen.palette` and a registry of bundled retro profiles
* Added `screen.color` (screen-default ink/paper, applied on clear)
* Added `print.color` (ink/paper for subsequent prints)
* `screen.clear` paints with the screen paper instead of `clearRect`
* `print.at` / `print.line` paint a paper rect behind text
* Coordinates are now true 1-indexed cells; `(1,1)` is the top-left character cell

## printAt 0.6.0

* Fixed `screen.clear()` - canvas & context now held in module scope
* Fixed canvas font string - includes `"px"` so font size actually applies
* Fixed `print.line()` - draws on the canvas (no more `document.write`)
* Moved off the `screen` / `print` browser globals onto a `pbasic` namespace
* Cached the 2D context once in `screen.size()`
* `screen.size()` accepts defaults of 640x480

## Roadmap

* printAt 1.0 - DONE: `screen.cls` (ink/paper args), `screen.grid` (cell overlay), `screen.border` (configurable surround)
* printAt 1.1 - DONE: inline ink/paper on `print.at` / `print.line`, `print.basicAt` Spectrum-coord alias, `screen.glyph` bitmap UDGs, `input.pause`, numeric `dim.set` / `dim.get` varargs
* inputKey 1.0 - DONE: `input.line` (INPUT analogue), `input.onkey` (edge-trigger), `input.held`, `input.attach` (element scoping), key-repeat opt-in, test pass
* dimArray 1.0 - DONE: `.fill` / `.forEach` / `.copy`, typed numeric dims (`AS UBYTE` faithful), constructor `{fill}`, dimString varargs, test pass
* printAt 1.2 - "BASIC verbs that are still missing": `print.tab`, `print.cr`, `print.cursor`, `print.repeat`, `print.fill`, `print.clearLine`, `print.padRight` / `padLeft`, `print.style({...}, fn)` scoped block, `print.color()` getter; small `pbasic.sound` (BEEP) module
* printAt 1.3 - "Stateful screen": `screen.charAt` / `screen.attrAt` (read back), `screen.attr` (color-only), `screen.snapshot` / `screen.restore`
* printAt 1.4 - Bundled bitmap fonts (Spectrum / C64 / CGA ROM) for true-pixel `screen.scale(1)` rendering; Spectrum text attributes (`print.invert` / `flash` / `bright` / `over`); multi-mode resolutions per palette
* Future modules - `pbasic.data` (READ/DATA/RESTORE), `pbasic.format` (rnd/int/str$ helpers), `pbasic.store` (SAVE/LOAD via localStorage), `pbasic.loop` (game-loop helper); `pbasic.gfx` (PLOT/DRAW/CIRCLE pixel primitives) as a separate module when a port asks for it
