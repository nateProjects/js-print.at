# Changelog

## format 1.0.0

* New companion module (`format.js`), independent of printAt/inputKey/dimArray/data
* Added `format.rnd([n])` — bare `RND` (Sinclair/CPC: float in `[0,1)`) with no args; `RND(n)` (BBC: random integer `1..n`) with a positive `n`. Sinclair has no bounded RND of its own — a die roll there is `INT (RND*6)+1` — so `format.rnd(6)` borrows the BBC form, the same cross-dialect pattern as `print.fill`/`print.repeat`
* Added `format.int(n)` — `INT`, floor (not truncate-toward-zero); matches Math.floor exactly, both Sinclair and BBC define it this way
* Added `format.str(n)` — `STR$`, number-to-string conversion using JS's own Number-to-string rules rather than replicating any dialect's exact ROM float formatting (scientific-notation thresholds, digit precision) — faithful for what a ported program actually prints, not a full float-to-ASCII emulation

## data 1.0.0

* New companion module (`data.js`), independent of printAt/inputKey/dimArray/format
* Added `data(...)` — `DATA` statement analogue; appends every argument to a shared pool in call order
* Added `data.read([n])` — `READ` statement analogue; pulls the next value (or `n` values as an array, since JS has no multi-variable assignment for `READ a, b, c`) and advances the cursor. Warns and returns `undefined` (or fewer values than asked for) on running out, rather than the runtime error real BASIC raises — consistent with how this library degrades elsewhere
* Added `data.restore([index])` — `RESTORE` statement analogue; resets the cursor to the start, or to a specific absolute position (the nearest analogue to `RESTORE line`, which real line numbers made possible and this doesn't have)
* Added `data.remaining()` — count of unread values left in the pool; not a BASIC statement (real BASIC has no built-in "is there more DATA" check) but useful enough in a `while (data.remaining())` loop to include

## printAt 1.7.0

* Added the `'c64'` bitmap font — Commodore 64 character ROM ("901225-01"), charset 2 (the mixed-case set at ROM offset 0x0800; charset 1 is upper-case-only with PETSCII graphics where lowercase would be). Sourced from the raw ROM binary at [zimmers.net](http://www.zimmers.net/anonftp/pub/cbm/firmware/characters/c64.bin) and verified by rendering every glyph as ASCII art and reading the shapes back — which caught a real mapping bug (`@` sits at screen code 0, not 64) before it shipped. Covers space, digits, standard punctuation, and upper/lowercase letters (0x20-0x40, 0x41-0x5A, 0x61-0x7A); `` [ \ ] ^ _ ` `` have no PETSCII equivalent (those screen codes hold line-drawing graphics instead) and fall back to the canvas font
* Added the `'cga'` bitmap font — the IBM PC/CGA 8x8 BIOS font (CP437), a full contiguous ASCII range (0x20-0x7E, no gaps — CP437 is ASCII-compatible here, unlike PETSCII). Sourced from the raw binary `CGA.F08` in [viler-int10h/vga-text-mode-fonts](https://github.com/viler-int10h/vga-text-mode-fonts), a font-preservation project cataloguing original IBM/OEM ROM fonts
* `screen.palette(name)` now auto-selects that machine's own bitmap font via a palette's new optional `font` field, the same way it already selects the machine's default ink/paper. `spectrum`, `c64`, and `cga` each declare their own `font`; `bbc`/`msx`/`cpc` have none yet, so selecting them turns the bitmap font off. An explicit `screen.bitmapFont()` call still overrides it, and re-selecting a palette re-applies its font even over a manual override
* `_bitmapFonts` entries may now have `null` gaps for code points a real charset has no glyph for (used by `c64`); `_glyphFor` already treated a missing glyph as "fall back to the canvas font", so no lookup changes were needed

## printAt 1.6.0

* Added `screen.bitmapFont(name)` — activates a bundled 8x8 bitmap ROM font so text renders as a true pixel bitmap instead of the canvas's own font, especially crisp at `screen.scale(1)`; user `screen.glyph()` registrations still take priority. Bundled: `'spectrum'`, the full ZX Spectrum ROM character set (96 chars, codes 0x20-0x7F), extracted from the character table at ROM address 3D00 via a public disassembly ([skoolkid.github.io/rom](https://skoolkid.github.io/rom/asm/3D00.html)) and verified against the font's well-known "slashed zero"
* `screen.palette(name)` now also auto-selects that machine's own bitmap font via a palette's new optional `font` field, the same way it already selects the machine's default ink/paper. The `spectrum` palette declares `font: 'spectrum'`, so it's on by default; an explicit `screen.bitmapFont()` call still overrides it, and re-selecting a palette re-applies its font even over a manual override
* Added `print.invert([bool])` — INVERSE: swaps ink/paper for the draw
* Added `print.bright([bool])` — BRIGHT: the Spectrum's two-tier color intensity; defaults `true` so existing content keeps its pre-1.6 full-intensity look, `false` dims ink/paper by the ROM's normal/bright ratio (0xCD / 0xFF)
* Added `print.over([bool])` — OVER: skips the paper fill so text draws onto the existing background instead of erasing it first (a practical approximation of the real per-pixel XOR)
* Added `print.flash([bool])` — FLASH: periodically swaps ink/paper (~320ms, shared timer, started lazily) until the cell is redrawn without it
* `print.style` now also scopes `invert` / `bright` / `over` / `flash`; `screen.attrAt` now also reports them; `screen.snapshot` / `screen.restore` now also carry them
* Added multi-mode `resolutions` per palette for machines that had more than one real video mode — `screen.size(paletteName, modeName)`. Bundled: BBC (`mode0`/`mode1`/`mode2`/`mode7`), CGA (`hires`/`lores`), CPC (`mode0`/`mode1`/`mode2`); existing single-`resolution` palettes and `screen.size(paletteName)` calls are unaffected
* INVERSE/OVER have no persistent form in real Sinclair BASIC (PRINT-item only) — making them persistent getters/setters here is a deliberate convenience, consistent with how this library already treats ink/paper

## printAt 1.5.0

* Added `screen.charAt(x, y)` — the character currently occupying a cell, or `undefined` out of bounds
* Added `screen.attrAt(x, y)` — the `{ink, paper}` last used to draw a cell
* Added `screen.attr(x, y, ink, paper)` — recolor a cell in place, keeping whatever character is already there
* Added `screen.snapshot()` / `screen.restore(snapshot)` — capture and restore the full visible screen (pixels, char/attr buffer, cursor, persistent print colors); restore skips with a warning if the canvas was resized since the snapshot
* Backed by a new parallel char/attr buffer that `print.at` / `print.line` / `print.tab` / `print.fill` / `print.repeat` all write through to as they draw — no bundled dialect has these as statements (Spectrum BASIC's nearest equivalent is PEEKing screen/attribute memory directly)

## printAt 1.4.0

* Added `print.cursor([x], [y])` — BBC BASIC `POS`/`VPOS` analogue, merged into one getter/setter (the originals are read-only and separate); no args reads `{x, y}`, args move the cursor without drawing
* Added `pbasic.sound(duration, pitch)` — Sinclair BASIC `BEEP duration, pitch` analogue; plays a square-wave tone via Web Audio (pitch in semitones from middle C, matching the Spectrum ROM), no envelope shaping to stay faithful to the beeper's hard on/off click; returns a promise resolving after `duration`, composable with `await` like `input.pause`
* Both have real BASIC ancestors but were split out of 1.3 (which is JS-ergonomics-with-no-ancestor) into their own stage

## printAt 1.3.0

* Added `print.cr([n])` — advance the cursor n rows (default 1), column reset to 1, no drawing; the nearest BASIC has is the implicit newline at the end of a plain PRINT statement
* Added `print.clearLine([y], [paper])` — repaint row y (default: cursor's row) with paper (default: persistent print paper) across the full width, cursor moves to column 1
* Added `print.padRight(text, width, [char])` / `print.padLeft(text, width, [char])` — pure string helpers, pad to width with char (default space)
* Added `print.style({ink, paper}, fn)` — scoped callback; every print.* call inside `fn` uses the overridden ink/paper, restored once `fn` returns
* Added `print.color()` getter — returns `{ink, paper}` with no args, unchanged setter behaviour otherwise
* All five are JS ergonomics with no BASIC ancestor — ports live in [1.2.0](#printat-120). `print.cursor` and `pbasic.sound` (BEEP) do have real ancestors (BBC `POS`/`VPOS`, Sinclair `BEEP`) and were pulled out of this stage into their own

## printAt 1.2.0

* Added `print.tab(n, [ink], [paper])` — Sinclair BASIC `PRINT TAB n`; pads with spaces from the cursor to an absolute column on the current row
* Added `print.fill(n, [char], [ink], [paper])` — BBC BASIC / Amstrad CPC `SPC(n)`; draws n cells relative to the cursor, wrapping to the next row, with an optional fill character beyond BASIC's plain-space original
* Added `print.repeat(text, count)` — BBC BASIC / Amstrad CPC `STRING$(count, char$)`; a pure string helper (not a drawing verb) for composing with `print.at` / `print.line` / `print.fill`
* These three are genuine cross-dialect ports (Sinclair's `TAB` is column-only — the Spectrum has no `SPC`/`STRING$` — so the relative-space and repeat-string verbs come from the BBC/CPC side of the bundled palettes); `print.cr`, `print.clearLine`, `print.padRight`/`padLeft`, `print.style`, `print.color()` getter have no BASIC ancestor and are deferred to 1.3

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
* printAt 1.2 - DONE: `print.tab` (Sinclair `PRINT TAB n`), `print.fill` (BBC/CPC `SPC(n)`), `print.repeat` (BBC/CPC `STRING$`) — genuine cross-dialect ports, split out from the rest of the "missing BASIC verbs" list below
* printAt 1.3 - DONE: `print.cr`, `print.clearLine`, `print.padRight` / `padLeft`, `print.style({...}, fn)` scoped block, `print.color()` getter — JS ergonomics with no BASIC ancestor
* printAt 1.4 - DONE: `print.cursor` (BBC `POS`/`VPOS`, but set-able) and `pbasic.sound` (Sinclair `BEEP`) — real ancestors, pulled out of 1.3 into their own stage
* printAt 1.5 - DONE: "Stateful screen": `screen.charAt` / `screen.attrAt` (read back), `screen.attr` (color-only), `screen.snapshot` / `screen.restore`
* printAt 1.6 - DONE: `screen.bitmapFont` (Spectrum ROM font bundled, full charset, verified against a public disassembly); Spectrum text attributes (`print.invert` / `bright` / `over` / `flash`); multi-mode `resolutions` per palette (BBC, CGA, CPC)
* printAt 1.7 - DONE: C64 and CGA ROM bitmap fonts for `screen.bitmapFont`, plus palette-driven auto font selection
* data 1.0 - DONE: `data` (DATA), `data.read` (READ), `data.restore` (RESTORE), `data.remaining` (JS convenience, not from BASIC)
* format 1.0 - DONE: `format.rnd` (RND, Sinclair/CPC bare + BBC bounded), `format.int` (INT), `format.str` (STR$)
* Future modules - `pbasic.store` (SAVE/LOAD via localStorage), `pbasic.loop` (game-loop helper); `pbasic.gfx` (PLOT/DRAW/CIRCLE pixel primitives) as a separate module when a port asks for it
