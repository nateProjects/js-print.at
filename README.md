# print.At

Basic Canvas Text Print Library

Adds BASIC-style `print.at` / `print.line` / `screen` commands to JavaScript, drawing to an HTML5 canvas, with swappable retro color palettes (ZX Spectrum, C64, CGA, BBC, MSX, Amstrad CPC) and matching pseudo-resolutions.

For a future Pseudo-Basic project.

**Usage:**
*(Within a HTML web page)*

```html
<script src="printAt.1.0.0.min.js"></script>
<script>
    // Alias the namespace for BASIC-style terseness
    var screen = pbasic.screen, print = pbasic.print;

    screen.font    ("Monaco", 12, 4);   // family, size (px), padding (ignored in preset mode)
    screen.palette ('spectrum');         // pick a color profile
    screen.scale   (3);                  // backbuffer multiplier (default 2)
    screen.size    ('spectrum');         // 256x192 native, 32x24 cells -> auto-fit font
    // or screen.size(640, 480) for an explicit pixel size

    screen.color  (0, 7);               // screen ink, screen paper -> applied on next clear
    screen.border (1, 8);               // border color, thickness (native px per side)
    screen.clear  ();                   // paint canvas with screen paper, reset cursor
    // or screen.cls(0, 7);             // shortcut: set ink/paper and clear

    screen.grid   ();                   // toggle a cell-grid overlay on/off

    print.color (2, 6);                 // ink, paper for subsequent prints
    print.at    (x, y, "text");         // cell coords (1-indexed, 1,1 = top-left)
    print.at    (x, y, "text", 7, 1);   // one-shot ink/paper, persistent state untouched
    print.line  ("text");               // draw at cursor, advance a row
    print.line  ("text", 7, 1);         // one-shot ink/paper

    // Spectrum BASIC-style coords: y first, 0-indexed (for line-by-line ports)
    print.basicAt (5, 9, "Q - Up", 0, 7);   // PRINT AT 5, 9 ; INK 0 ; PAPER 7 ; "Q - Up"
</script>
```

The library lives under the `pbasic` namespace so it doesn't clobber the built-in `window.screen` and `window.print`.

**Color palettes**

Bundled profiles in `pbasic.palettes`:

| Name | Colors | Native res | Cells |
| --- | --- | --- | --- |
| `spectrum` | 8 | 256x192 | 32x24 |
| `c64` | 16 | 320x200 | 40x25 |
| `cga` | 16 | 640x200 | 80x25 |
| `bbc` | 8 | 640x256 | 80x32 |
| `msx` | 16 | 256x192 | 32x24 |
| `cpc` | 27 | 320x200 | 40x25 |

Switch palette (auto-clears with that machine's boot defaults):

```js
screen.palette ('c64');
```

`screen.palette` only changes colors. To also change resolution call `screen.size('c64')`.

Add your own — anything assigned to `pbasic.palettes` works:

```js
pbasic.palettes.amiga = {
    name: 'Amiga workbench',
    colors: ['#0055AA', '#000000', '#FFFFFF', '#FF8800'],
    defaults:   { ink: 1, paper: 0 },
    resolution: { width: 640, height: 256, cols: 80, rows: 32 }   // optional
};
screen.palette ('amiga');
screen.size    ('amiga');
```

A flat array form is also accepted for ad-hoc colors: `screen.palette(['#000','#0F0'])`.

Color values in `screen.color` and `print.color` are integer indices into the active palette, so the language stays profile-agnostic. Strings starting with anything non-numeric pass through as raw CSS colors, e.g. `print.color('#FF8000', '#000')`, as an escape hatch.

**Scale and dimensions**

`screen.scale(n)` multiplies the canvas backbuffer so retro presets stay readable on modern displays. Default scale is `2`; calling `screen.scale(3)` gives a Spectrum a 768x576 canvas. The cell grid is unchanged — `print.at(1, 1, ...)` still hits the top-left character cell regardless of scale.

After sizing, the screen exposes:

```js
screen.cols          // character columns
screen.rows          // character rows
screen.nativeWidth   // pre-scale pixel width
screen.nativeHeight  // pre-scale pixel height
screen.canvas        // the <canvas> DOM element
screen.context       // the 2D context
```

Preset mode auto-overrides `screen.font` size and padding so each character fills one cell. Explicit `screen.size(w, h)` keeps your chosen font and just sizes the canvas to `w*scale` x `h*scale`.

**Border, grid, cls (1.0.0)**

```js
screen.cls    (0, 7);            // shortcut: set screen ink/paper, then clear
screen.grid   ();                // toggle a 1px overlay on the cell grid
screen.grid   (true, '#888');    // turn on with a specific color
screen.border (1, 8);            // border color, thickness in NATIVE pixels per side
screen.border (2);               // change just the color (no resize)
```

`screen.border` thickness is in *native* (pre-scale) pixels, so a thickness of `8` on a Spectrum at scale 3 paints 24 device pixels of border on each side. Changing the thickness resizes the canvas (which clears its contents — repaint after); color-only changes just repaint the border strips and leave the print area untouched.

The grid overlay is repainted after every `print.at` / `print.line` / `clear` while it's on. Turning it off doesn't erase already-drawn lines — call `screen.clear` (or repaint over them) to remove. The grid is purely a visual aid for laying out cells.

`screen.cls(ink, paper)` is just `screen.color(ink, paper)` followed by `screen.clear()`, matching the BASIC `CLS` idiom. Both args are optional — `screen.cls()` clears with the current screen colors.

**Inline ink / paper on `print.at` and `print.line` (1.1.0)**

The 4th and 5th args of `print.at` / `print.line` apply ink and paper for that draw only — they do *not* modify the persistent `print.color` state. This mirrors Spectrum BASIC's per-statement attributes (`PRINT AT y, x ; PAPER p ; INK i ; "text"`), where inline colors are local to the statement and the running defaults stay put.

```js
print.color (0, 7);                       // persistent default
print.at    (1, 1, "normal");             // ink 0 on paper 7
print.at    (1, 2, "highlight", 7, 1);    // one-shot: ink 7 on paper 1
print.at    (1, 3, "still normal");       // back to ink 0 on paper 7 - state preserved
```

To change the running defaults, keep using `print.color(ink, paper)`.

**`print.basicAt` (1.1.0)**

```js
print.basicAt (y, x, "text");             // PRINT AT y, x ; "text"
print.basicAt (y, x, "text", ink, paper); // PRINT AT y, x ; INK i ; PAPER p ; "text"
```

Convenience alias for line-by-line ports of Spectrum BASIC source: `y` first, 0-indexed. Internally it just calls `print.at(x + 1, y + 1, text, ink, paper)`. New code should prefer `print.at`; `basicAt` exists so a port can keep its coordinates and ordering identical to the BASIC original for diffing.

**Bitmap glyphs / UDG (1.1.0)**

```js
screen.glyph (144, [60, 66, 129, 129, 129, 129, 66, 60]);   // Spectrum-style 8x8 sprite
screen.glyph ('@',  [/* ... */]);                            // string codes work too

var S = String.fromCharCode(144);
print.at (10, 5, S, 0, 7);                // draws the bitmap in ink 0 on paper 7

screen.glyph (144);                        // -> bytes array, or undefined
screen.glyph ();                           // -> array of every registered code
screen.glyph (144, null);                  // remove a registration
```

`screen.glyph(code, bytes)` registers a bitmap for a character. `bytes` is an array of integers — one byte per row, MSB = leftmost pixel — the Spectrum UDG byte format (`POKE UINTEGER 23675, @udg(0,0)`). The glyph kicks in any time that character appears in a `print.at` / `print.line` run, drawn in the current ink over the current paper, scaled to the active cell size. Mix freely with regular font characters in the same string.

The bitmap is N rows by 8 columns — typically 8x8, but other row counts work (e.g. 16-row tall sprites if your cell height accommodates them).

---

## inputKey (companion library)

Keyboard input to sit alongside print output. Drop it in next to `printAt` — it extends the same `pbasic` namespace with a third object, `pbasic.input`, and has no hard dependency on `printAt` so it can be loaded on its own.

```html
<script src="printAt.1.0.0.min.js"></script>
<script src="inputKey.0.9.0.min.js"></script>
<script>
    var input = pbasic.input;

    // INKEY$ analogue - non-blocking. Returns the character of the key
    // currently held, or "" if nothing is held.
    if (input.inkey() === 'q') { /* ... */ }

    // GetKey analogue - async wait for the next key press.
    // Promise form:
    var k = await input.getkey();   // { key: "Enter", code: "Enter" }
    // Callback form:
    input.getkey(function (k) { console.log(k.key, k.code); });

    // MultiKeys analogue - snapshot of whether specific keys are held.
    var m = input.multikeys('ArrowUp', 'Space');
    if (m.ArrowUp && m.Space) { /* ... */ }
    // m.mask is a bitmask (bit N set if the Nth argument is held).
    // m.any / m.all are booleans over the requested set.

    // No-args form returns an array of every currently-held event.code.
    input.multikeys();   // e.g. ["KeyW", "ShiftLeft"]

    // Named constants (event.code values, layout-independent):
    var K = input.keys;
    input.multikeys(K.UP, K.A, K.SPACE);
    // K.SHIFT / K.CTRL / K.ALT / K.META match either left or right.

    // PAUSE n analogue - returns a Promise that resolves after `ms` ms.
    // Designed for use with await inside async game loops:
    await input.pause(80);

    // Single-key boolean shortcut (1.0).
    if (input.held('Space')) { /* ... */ }

    // INPUT a$ / INPUT a analogue (1.0). Renders prompt + field via printAt,
    // resolves on Enter. Supports backspace, length cap, numeric mode.
    var name  = await input.line('Name? ');
    var score = await input.line({prompt: 'Score? ', numeric: true, length: 6});

    // Edge-trigger keydown handler (1.0). Returns an unsubscribe function.
    var off = input.onkey(K.SPACE, function (k) { fire(); });
    var off = input.onkey(function (k) { ... }, {repeat: true});  // include OS auto-repeat
    off();                                                         // stop listening

    // Scope listeners to a specific element instead of window (1.0).
    input.attach(document.getElementById('screenCanvas'));
</script>
```

**Design notes**

* `inkey` reports `event.key` (character-like, e.g. `"a"`, `"ArrowUp"`) to stay faithful to BASIC's `INKEY$`.
* `getkey`, `onkey` and `multikeys` report `event.code` (physical-key, layout-independent, e.g. `"KeyA"`, `"Space"`). Good for games where the positions matter more than the label. `onkey` also accepts an `event.key` value (e.g. `'a'`, `'Enter'`) as the filter.
* Listeners attach lazily on the first `input.*` call, scoped to `window`. Use `input.attach(element)` to scope them to a specific DOM node instead — a `tabindex` is added automatically if the element doesn't already have one. Focus the page (click anywhere) before expecting keys. A `blur` handler clears held state so keys don't "stick" when the tab loses focus.
* `onkey` is **edge-only by default** — OS auto-repeat does not fire it. Pass `{repeat: true}` to opt in (e.g. for typing-style input). `event.repeat` is exposed on the handler payload.
* `input.line` is modal — only one may be active at a time, and while one is in flight all other key handling is suppressed. It depends on `printAt` being loaded for rendering.

[inputKey 1.0.0 source](https://raw.githack.com/nate2squared/print.At/master/inputKey.1.0.0.js)

[1.0.0 interactive demo](https://raw.githack.com/nate2squared/print.At/master/printAt.1.0.0.min.example.html)

---

## dimArray (companion library)

ZX Spectrum-style `DIM` arrays for JavaScript: 1-indexed numeric arrays and fixed-length string arrays, with the Spectrum's Procrustean string semantics. Independent of `printAt` and `inputKey`, just attaches to the same `pbasic` namespace.

```html
<script src="dimArray.1.0.0.min.js"></script>
<script>
    var dim = pbasic.dim, dimString = pbasic.dimString;

    // Numeric: DIM A(12)
    var A = dim([12]);
    A.set([5], 42);                  // LET A(5) = 42  (array form)
    A.set(5, 42);                    // LET A(5) = 42  (varargs form)
    A.get([5]);                      // 42             (array form)
    A.get(5);                        // 42             (varargs form)
    A.get([1]);                      // 0   (default)
    A.get([0]);                      // throws - 1-indexed
    A.get([13]);                     // throws

    // 2D numeric: DIM B(3,6)
    var B = dim([3, 6]);
    B.set([2, 4], 99);               // array form
    B.set(2, 4, 99);                 // varargs form - reads like LET B(2,4) = 99

    // Whole-array operations (1.0):
    A.fill(0);                       // set every cell to 0
    A.forEach(function (v, subs) {   // iterate in subscript order
        console.log(subs, '=', v);   // subs is e.g. [5] or [2, 4]
    });
    var Ac = A.copy();               // deep clone, same dims & type

    // Typed declaration (1.0): faithful "AS UBYTE" - overflows throw
    var P = dim([23, 34], { type: 'UBYTE', fill: 4 });
    P.set(1, 1, 255);                // ok
    P.set(1, 1, 256);                // throws - out of range for UBYTE
    // Available types: UBYTE, BYTE, UINT, INT, ULONG, LONG, FLOAT (default = unbounded)

    // Single fixed string: DIM S$(10)
    var S = dimString([10]);
    S.set([], 'hello');              // LET S$ = "hello"      -> "hello     "
    S.set('hello');                  //                       (varargs form, 1.0)
    S.get([]);                       // "hello     "  (Procrustean pad)
    S.get();                         //               (varargs form, 1.0)
    S.get([3]);                      // "l"           (S$(3),     1-indexed char)
    S.get(3);                        //               (varargs form, 1.0)
    S.get([[3, 5]]);                 // "llo"         (S$(3 TO 5), inclusive slice)

    // String array: DIM A$(5,10)  (5 strings, each 10 chars)
    var AS = dimString([5, 10]);
    AS.set([2], '1234567890');       // LET A$(2) = "1234567890"      (array form)
    AS.set(2, '1234567890');         //                                (varargs, 1.0)
    AS.get([2, 7]);                  // "7"           (A$(2,7), single char)
    AS.get(2, 7);                    //                                (varargs, 1.0)
    AS.get([2, [4, 8]]);             // "45678"       (A$(2)(4 TO 8), slice)
    AS.get(2, [4, 8]);               //                                (varargs, 1.0)
    AS.set([2, [3, 5]], 'XYZ');      // partial replace, A$(2)(3 TO 5) = "XYZ"
    AS.set(2, [3, 5], 'XYZ');        //                                (varargs, 1.0)
    AS.set(2, 4, 'Q');               // single char, A$(2,4) = "Q"    (varargs, 1.0)

    AS.fill('---');                  // 1.0: pad-fit and copy into every slot
    AS.forEach(function (s, subs) { /* ... */ });
    var ASc = AS.copy();

    AS.dims;                         // [5, 10]
    AS.length;                       // 10  (declared char length)
</script>
```

**Design notes**

* Both `dim` and `dimString` are strictly 1-indexed - subscript 0 throws, as does anything past the declared dimension. Storage allocates `N+1` slots per dimension under the hood so the user-visible math stays clean.
* Strings are *Procrustean*: assigning a value shorter than the declared length pads with spaces, longer truncates. This matches Spectrum BASIC's behaviour for fixed-length strings.
* Slice subscripts use `[from, to]` (inclusive, 1-indexed) to mirror BASIC's `A$(from TO to)`.
* For string arrays the **last** entry of `dims` is always the per-string char length - same convention as `DIM A$(5,10)` in BASIC.
* `dim` exposes `.raw` (the underlying nested array; index 0 unused) for places where you want to iterate without the get/set overhead. Mutating it bypasses bounds checking *and* the type clamp, so prefer `set` / `get` / `fill` / `forEach` outside hot loops.
* For numeric `dim`, `type` enforces a BASIC-flavoured value range — out-of-range writes throw, integer types reject non-integers. This is the faithful translation of `AS UBYTE` and friends; without `type`, values are unbounded as in plain JS.
* `dimString` varargs note: a slice on a single string `S$(3 TO 5)` still requires the explicit array form `S.get([[3, 5]])` — the bare `S.get([3, 5])` is interpreted as the array form (which then errors as "too many subscripts"). For array-string slices `AS.get(2, [4, 8])` works in either form.

[dimArray 1.0.0 source](https://raw.githack.com/nate2squared/print.At/master/dimArray.1.0.0.js)


**What's new in inputKey 1.0.0**

* Added `input.line([prompt], [opts])` — the missing `INPUT a$` / `INPUT a` statement; renders prompt + field via printAt, supports backspace, length cap and numeric mode, resolves on Enter
* Added `input.onkey([target], handler, [opts])` — edge-trigger keydown handler returning an unsubscribe function; opt-in to OS auto-repeat via `{repeat: true}`
* Added `input.held(code)` — single-key boolean shortcut (`input.held('Space')`)
* Added `input.attach(element)` — scope listeners to a specific DOM element instead of `window`; auto-adds `tabindex` if missing
* Key-repeat handling: `event.repeat` is exposed on every onkey payload; edge-only by default
* Wider test pass — 13 behaviours covered headlessly

**What's new in dimArray 1.0.0**

* Added `.fill(value)` — set every cell / string slot in one call (collapses init loops)
* Added `.forEach(fn)` — iterate every cell in subscript order, callback receives `(value, subs)`
* Added `.copy()` — deep clone with same dimensions, type and values
* Added typed numeric dims via `dim(dims, {type: 'UBYTE'})` — out-of-range writes throw; faithful to BASIC's `AS UBYTE / BYTE / UINT / INT / ULONG / LONG`. `FLOAT` / no-type = unbounded as before
* Added constructor `{fill}` option for both `dim` and `dimString` — initial value at construction
* Added varargs form on `dimString.set` / `dimString.get` — `AS.set(2, 4, 'Q')`, `AS.get(2, [4, 8])` now match the numeric-dim varargs ergonomics
* Wider test pass — 14 behaviours covered

**What was new in printAt 1.1.0**

* Added `print.at(x, y, text, ink, paper)` and `print.line(text, ink, paper)` overloads — one-shot ink/paper that doesn't disturb the persistent `print.color` defaults; collapses every `print.color(...)` + `print.at(...)` pair into a single statement
* Added `print.basicAt(y, x, text, [ink], [paper])` — Spectrum-style alias (y first, 0-indexed) for line-by-line BASIC ports
* Added `screen.glyph(code, bytes)` — register N x 8 bitmap characters in Spectrum UDG byte format; closes the gap that previously had no workaround
* `inputKey` 0.9.x — added `input.pause(ms)`, a promise-returning `PAUSE n` analogue for use with `await` inside async game loops
* `dimArray` 0.9.x — added varargs form on numeric `set` / `get`: `A.set(5, 42)` / `B.set(2, 4, 99)` alongside the array form, mirroring BASIC's `LET A(5) = 42` / `LET B(2,4) = 99`

**What was new in 1.0.0**

* Added `screen.cls(ink, paper)` — ink/paper-aware clear shortcut
* Added `screen.grid(on, color)` — 1-pixel cell-grid overlay
* Added `screen.border(color, thickness)` — surrounding border area; canvas grows to accommodate, print coords stay 1-indexed inside the border
* `screen.clear` paints the border first, then the print area
* All 1.0 plan items shipped (cls, grid, border)

**What was new in 0.9.0**

* Added `resolution` to each profile and a `screen.size('preset')` lookup
* Added `screen.scale(n)` for backbuffer multiplication (default 2)
* `screen.size` in preset mode auto-fits the font to the cell grid
* Exposed `screen.cols`, `screen.rows`, `screen.nativeWidth`, `screen.nativeHeight`
* `screen.size()` with no args re-applies the active palette's resolution if any

**What was new in 0.8.0**

* Added `screen.palette` and a registry of bundled retro profiles
* Added `screen.color` (screen-default ink/paper, applied on clear)
* Added `print.color` (ink/paper for subsequent prints)
* `screen.clear` paints with the screen paper instead of `clearRect`
* `print.at` / `print.line` paint a paper rect behind text
* Coordinates are now true 1-indexed cells; `(1,1)` is the top-left character cell

**What was new in 0.6.0**

* Fixed `screen.clear()` - canvas & context now held in module scope
* Fixed canvas font string - includes `"px"` so font size actually applies
* Fixed `print.line()` - draws on the canvas (no more `document.write`)
* Moved off the `screen` / `print` browser globals onto a `pbasic` namespace
* Cached the 2D context once in `screen.size()`
* `screen.size()` accepts defaults of 640x480

**Plans**

* printAt 1.0 - DONE: `screen.cls` (ink/paper args), `screen.grid` (cell overlay), `screen.border` (configurable surround)
* printAt 1.1 - DONE: inline ink/paper on `print.at` / `print.line`, `print.basicAt` Spectrum-coord alias, `screen.glyph` bitmap UDGs, `input.pause`, numeric `dim.set` / `dim.get` varargs
* inputKey 1.0 - DONE: `input.line` (INPUT analogue), `input.onkey` (edge-trigger), `input.held`, `input.attach` (element scoping), key-repeat opt-in, test pass
* dimArray 1.0 - DONE: `.fill` / `.forEach` / `.copy`, typed numeric dims (`AS UBYTE` faithful), constructor `{fill}`, dimString varargs, test pass
* printAt 1.2 - "BASIC verbs that are still missing": `print.tab`, `print.cr`, `print.cursor`, `print.repeat`, `print.fill`, `print.clearLine`, `print.padRight` / `padLeft`, `print.style({...}, fn)` scoped block, `print.color()` getter; small `pbasic.sound` (BEEP) module
* printAt 1.3 - "Stateful screen": `screen.charAt` / `screen.attrAt` (read back), `screen.attr` (color-only), `screen.snapshot` / `screen.restore`
* printAt 1.4 - Bundled bitmap fonts (Spectrum / C64 / CGA ROM) for true-pixel `screen.scale(1)` rendering; Spectrum text attributes (`print.invert` / `flash` / `bright` / `over`); multi-mode resolutions per palette
* Future modules - `pbasic.data` (READ/DATA/RESTORE), `pbasic.format` (rnd/int/str$ helpers), `pbasic.store` (SAVE/LOAD via localStorage), `pbasic.loop` (game-loop helper); `pbasic.gfx` (PLOT/DRAW/CIRCLE pixel primitives) as a separate module when a port asks for it

**Acknowledgements**

Claude Code helped squash long-standing bugs in the original 0.4.0 source and extend the library with the palette system, pseudo-resolutions, scaling, border, grid and `cls` features that landed across 0.6.0 → 1.0.0, and drafted the companion `inputKey` library.
