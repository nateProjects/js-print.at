# print.At

Basic Canvas Text Print Library

Adds BASIC-style `print.at` / `print.line` / `screen` commands to JavaScript, drawing to an HTML5 canvas, with swappable retro color palettes (ZX Spectrum, C64, CGA, BBC, MSX, Amstrad CPC) and matching pseudo-resolutions.

For a future Pseudo-Basic project.

**Usage:**
*(Within a HTML web page)*

```html
<script src="printAt.min.js"></script>
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

**`print.tab` / `print.fill` / `print.repeat` (1.2.0)**

Genuine cross-dialect ports rather than invented verbs. Sinclair BASIC's `TAB` is column-only — the Spectrum has no `SPC` or `STRING$` — so the relative-space and repeat-string verbs are borrowed from the BBC / Amstrad CPC side of the bundled palettes.

```js
print.at  (1, 1, "Score");
print.tab (11);                    // PRINT TAB n (Sinclair) - pad to an absolute column
print.line("9001");

print.at  (1, 3, "Fuel ");
print.fill(10, "#");               // SPC(n) (BBC/CPC) - draw n cells relative to the cursor

print.line(print.repeat("=", 20)); // STRING$(n, char$) (BBC/CPC) - pure string helper
```

`print.tab(n, [ink], [paper])` pads with spaces from the cursor's current column out to column `n` on the current row (1-indexed, matching `print.at`). It's a no-op if the cursor is already at or past `n`, and clamps (with a warning) if `n` is beyond `screen.cols`.

`print.fill(n, [char], [ink], [paper])` draws `n` cells of `char` (default space) starting at the cursor and advances the cursor by `n`, wrapping to the next row if it runs past `screen.cols`. Unlike `tab` (an absolute column), `fill` is relative to wherever the cursor already sits — the `SPC(n)` role in BBC/CPC BASIC.

`print.repeat(text, count)` is a pure string helper — like `STRING$`, it produces a string rather than drawing anything, meant to be composed with `print.at` / `print.line` / `print.fill`.

**`print.cr` / `print.clearLine` / `print.padRight` / `print.padLeft` / `print.style` / `print.color()` getter (1.3.0)**

JS ergonomics with no BASIC ancestor — gaps none of the bundled 8-bit dialects needed a verb for, filled with idioms native to JS (a getter, a scoped callback) rather than invented statement syntax.

```js
print.line ("row one");
print.cr   ();                              // blank line, no drawing
print.line ("row three");

print.at   (1, 5, "Score: 9001");
print.clearLine();                          // repaint that row, cursor back to col 1

var row = print.padRight("HP", 6) + print.padRight("42", 4);
print.line(row);                            // "HP    42  "

print.style({ink: 2, paper: 0}, function () {
    print.line("danger");                   // both lines drawn ink 2 on paper 0
    print.line("zone");
});                                          // persistent color restored here

print.color();                              // -> { ink: 0, paper: 7 } (or whatever's current)
```

`print.cr([n])` moves the cursor to column 1, `n` rows down (default 1) — no drawing, just cursor movement, for inserting blank lines.

`print.clearLine([y], [paper])` repaints row `y` (default: the cursor's row) with `paper` (default: the persistent print paper) across the full screen width, and resets the cursor to column 1 of that row.

`print.padRight(text, width, [char])` / `print.padLeft(text, width, [char])` are pure string helpers — pad `text` out to `width` with `char` (default space), unchanged if already at or past `width`.

`print.style({ink, paper}, fn)` runs `fn` with the persistent print colors temporarily overridden, restoring them once `fn` returns. Unlike the inline ink/paper args on `print.at` / `print.line` (which apply to a single draw), this scopes every `print.*` call inside `fn`.

`print.color()` with no arguments now returns the current `{ink, paper}`; calling it with arguments still sets them as before.

**`print.cursor` / `pbasic.sound` (1.4.0)**

Both have real ancestors — BBC BASIC's `POS`/`VPOS` and Sinclair BASIC's `BEEP` — but were split out of 1.3 into their own stage rather than lumped in with the JS-only ergonomics.

```js
print.at(5, 3, "x");
print.cursor();              // -> { x: 6, y: 3 } (read, like POS/VPOS)
print.cursor(1, 1);          // move without drawing (POS/VPOS are read-only on the BBC; this adds a setter)

await pbasic.sound(0.5, 0);  // BEEP 0.5, 0 - half a second at middle C
await pbasic.sound(0.15, 12); // BEEP 0.15, 12 - a short beep an octave up
```

`print.cursor([x], [y])` merges BBC's two separate read-only functions into one getter/setter, following the same call-with-no-args-to-read pattern as `print.color` / `screen.palette`.

`pbasic.sound(duration, pitch)` plays a square-wave tone through the Web Audio API — `duration` in seconds, `pitch` in semitones relative to middle C (0 = C4), matching the Spectrum ROM's own convention. No envelope shaping; the real one-bit beeper clicked hard on and off too. Returns a promise that resolves once `duration` has elapsed, so it composes with `await` inside an async game loop the same way `input.pause` does — without actually blocking the JS thread the way real `BEEP` blocks BASIC.

**Stateful screen: `charAt` / `attrAt` / `attr` / `snapshot` / `restore` (1.5.0)**

No bundled BASIC dialect has these as statements — Spectrum BASIC's nearest equivalent is PEEKing screen and attribute memory directly. Backing them is a parallel char/attr buffer that `print.at` / `print.line` / `print.tab` / `print.fill` / `print.repeat` all write through to as they draw.

```js
print.at(5, 3, "X", 2, 0);
screen.charAt(5, 3);              // -> "X"
screen.attrAt(5, 3);              // -> { ink: 2, paper: 0 }
screen.attr(5, 3, 6, 1);          // recolor that cell -- still "X", now ink 6 on paper 1

var saved = screen.snapshot();    // pixels + char/attr buffer + cursor + print color
print.style({ink: 7, paper: 0}, function () {
    screen.clear();
    print.at(1, 1, "PAUSED");     // draw a menu over the game screen
});
screen.restore(saved);            // back to exactly how it was
```

`screen.charAt(x, y)` / `screen.attrAt(x, y)` read back whatever the last `print.*` call left at a cell (1-indexed, matching `print.at`), or `undefined` out of bounds.

`screen.attr(x, y, ink, paper)` recolors a single cell in place without touching its character — the color-only counterpart to `print.at`'s inline ink/paper args.

`screen.snapshot()` / `screen.restore(snapshot)` capture and restore the full visible screen — pixels, the char/attr buffer, cursor position, and the persistent print colors. `restore` skips (with a warning) if the canvas has been resized since the snapshot was taken, since the pixel buffer wouldn't line up.

**Bitmap fonts, Spectrum text attributes, multi-mode resolutions (1.6.0 - 1.7.0)**

```js
screen.palette('spectrum');       // auto-selects the spectrum bitmap font
screen.scale(1);                  // one source pixel per device pixel -- crispest here
screen.size('spectrum');
print.at(1, 1, "TRUE PIXEL TEXT");

screen.palette('c64');            // auto-selects the c64 font instead
screen.palette('cga');            // auto-selects the cga font instead
screen.bitmapFont(null);          // override: back to the canvas font

print.invert(true);               // INVERSE: swap ink/paper for the draw
print.bright(false);              // BRIGHT off: dims ink/paper (0xCD / 0xFF ratio)
print.over(true);                 // OVER: draw onto the existing background, no paper fill
print.flash(true);                // FLASH: periodic ink/paper swap (~320ms) until redrawn

screen.size('bbc', 'mode1');      // multi-mode resolutions: named mode per palette
screen.size('cga', 'lores');
```

`screen.bitmapFont(name)` activates a bundled 8x8 bitmap ROM font — registered characters render as true pixel bitmaps instead of the canvas's own font, especially crisp at `screen.scale(1)` where it works out to one source pixel per device pixel. Individual `screen.glyph()` registrations still take priority, so custom UDGs override specific characters even with a bitmap font active. `screen.bitmapFont(null)` turns it off; `screen.bitmapFont()` with no args returns the active font name.

`screen.palette(name)` auto-selects that machine's own bitmap font via the palette's `font` field, the same way it already selects the default ink/paper — no separate `screen.bitmapFont()` call needed. `spectrum`, `c64`, and `cga` each have one; `bbc`/`msx`/`cpc` don't yet, so selecting them turns the bitmap font off. An explicit `screen.bitmapFont()` call overrides the palette's choice, and re-selecting a palette re-applies its own font even over that override.

Bundled fonts:
- **`'spectrum'`** — the full ZX Spectrum ROM character set (96 chars, codes 0x20-0x7F), extracted from the ROM's character table and verified against the font's well-known "slashed zero."
- **`'c64'`** — the Commodore 64 character ROM, the mixed-case charset (uppercase A-Z, lowercase a-z, digits, standard punctuation). PETSCII has no equivalent for `` [ \ ] ^ _ ` `` — those fall back to the canvas font rather than showing the wrong glyph.
- **`'cga'`** — the IBM PC/CGA 8x8 BIOS font (CP437), the full ASCII printable range with no gaps.

All three were verified the same way: render every glyph as ASCII art and read the pixel shapes back before trusting them — which caught a real bug in the C64 data (`@` sits at screen code 0, not 64) before it shipped.

`print.invert` / `print.bright` / `print.over` / `print.flash` are persistent getter/setters, call-with-no-args-to-read like `print.color`, and all four compose with `print.style({...}, fn)` for a scoped one-off. Real Sinclair BASIC only offers `INVERSE` and `OVER` as per-statement PRINT items — never a persistent default — so making them persistent here is a deliberate convenience, consistent with how this library already treats ink/paper. `bright` defaults to `true` so existing `print.At` content keeps its pre-1.6 full-intensity look; `print.bright(false)` is the opt-in dim mode. `over` is a practical approximation of real OVER's per-pixel XOR (skip the paper fill, draw ink on top) rather than true XOR compositing. `screen.attrAt` now also reports all four; `screen.snapshot`/`restore` now carry them too.

Palettes can now declare a `resolutions` map of named video modes alongside the single default `resolution` — for the machines that actually had more than one (BBC MODE 0/1/2/7, CGA's 40/80-column text, CPC MODE 0/1/2). Select one with `screen.size(paletteName, modeName)`; `screen.size(paletteName)` alone still applies the default mode, unchanged from before 1.6.

---

## inputKey (companion library)

Keyboard input to sit alongside print output. Drop it in next to `printAt` — it extends the same `pbasic` namespace with a third object, `pbasic.input`, and has no hard dependency on `printAt` so it can be loaded on its own.

```html
<script src="printAt.min.js"></script>
<script src="inputKey.js"></script>
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

[inputKey source](https://raw.githack.com/nate2squared/print.At/master/inputKey.js)

[interactive demo](https://raw.githack.com/nate2squared/print.At/master/printAt.min.example.html)

---

## dimArray (companion library)

ZX Spectrum-style `DIM` arrays for JavaScript: 1-indexed numeric arrays and fixed-length string arrays, with the Spectrum's Procrustean string semantics. Independent of `printAt` and `inputKey`, just attaches to the same `pbasic` namespace.

```html
<script src="dimArray.js"></script>
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

[dimArray source](https://raw.githack.com/nate2squared/print.At/master/dimArray.js)

---

## data (companion module)

`DATA` / `READ` / `RESTORE` for JavaScript. Extends the same `pbasic` namespace with a `pbasic.data` function (itself the `DATA` analogue, carrying `.read` / `.restore` / `.remaining` as methods). No dependency on `printAt` or any other module.

```html
<script src="data.js"></script>
<script>
    var data = pbasic.data;

    // DATA 1, 2, 3, "hello"
    data(1, 2, 3, "hello");
    data(4, 5, 6);

    // READ a
    var a = data.read();             // 1

    // READ a, b, c  -- JS has no multi-variable assignment, so a count
    // reads that many values back as an array instead
    var abc = data.read(3);          // [2, 3, "hello"]

    data.remaining();                // 2  (not from BASIC -- a JS convenience)

    // RESTORE
    data.restore();
    data.read();                     // 1 again

    // RESTORE to a specific position (the nearest analogue to `RESTORE line`,
    // which real line numbers made possible and this doesn't have)
    data.restore(3);
    data.read();                     // "hello"
</script>
```

Reading past the end of the pool warns and returns `undefined` (or fewer values than asked for, from `read(n)`) rather than raising the runtime error real BASIC's "Out of DATA" does — consistent with how the rest of this library degrades rather than throws.

[data source](https://raw.githack.com/nate2squared/print.At/master/data.js)

---

## format (companion module)

`RND` / `INT` / `STR$` for JavaScript. Extends the same `pbasic` namespace with a `pbasic.format` object. No dependency on `printAt` or any other module.

```html
<script src="format.js"></script>
<script>
    var format = pbasic.format;

    format.rnd();                    // RND (Sinclair/CPC)  -- float in [0, 1)
    format.rnd(6);                   // RND(6) (BBC)        -- random integer 1..6

    format.int(4.7);                 // INT  -- 4
    format.int(-4.7);                // INT  -- -5 (floor, not truncate-toward-zero)

    format.str(42);                  // STR$ -- "42"
</script>
```

`format.rnd([n])` blends two dialects the same way `print.fill`/`print.repeat` did: bare `RND` (no args, or `n <= 0`) is Sinclair/CPC's float in `[0, 1)`; `RND(n)` with a positive `n` is BBC's bounded random integer. Sinclair has no bounded RND of its own — a die roll there is written `INT (RND*6)+1` — so `format.rnd(6)` borrows the BBC form instead.

`format.str(n)` uses JavaScript's own Number-to-string rules rather than replicating any dialect's exact ROM floating-point formatting (scientific-notation thresholds, digit precision) — faithful for the integer/simple-decimal values a ported program actually prints, not a full float-to-ASCII emulation of the original hardware.

[format source](https://raw.githack.com/nate2squared/print.At/master/format.js)

---

See [CHANGELOG.md](CHANGELOG.md) for release history and the roadmap.

**Acknowledgements**

Claude Code helped squash long-standing bugs in the original 0.4.0 source and extend the library with the palette system, pseudo-resolutions, scaling, border, grid and `cls` features that landed across 0.6.0 → 1.0.0, and drafted the companion `inputKey` library.
