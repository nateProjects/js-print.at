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
    print.line  ("text");               // draw at cursor, advance a row
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
</script>
```

**Design notes**

* `inkey` reports `event.key` (character-like, e.g. `"a"`, `"ArrowUp"`) to stay faithful to BASIC's `INKEY$`.
* `getkey` and `multikeys` report `event.code` (physical-key, layout-independent, e.g. `"KeyA"`, `"Space"`). Good for games where the positions matter more than the label.
* Listeners attach lazily on the first `input.*` call, scoped to `window`. Focus the page (click anywhere) before expecting keys. A `blur` handler clears held state so keys don't "stick" when the tab loses focus.
* Starts at 0.9.0 — earns a 1.0 after testing. 1.0 targets: key-repeat handling, an `onkey` edge-trigger helper, optional scoping to a specific element instead of `window`.

[inputKey 0.9.0 demo](https://raw.githack.com/nate2squared/print.At/master/inputKey.0.9.0.min.example.html)

[1.0.0 interactive demo](https://raw.githack.com/nate2squared/print.At/master/printAt.1.0.0.min.example.html)


**What's new in 1.0.0**

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

* 1.0 - DONE: `screen.cls` (ink/paper args), `screen.grid` (cell overlay), `screen.border` (configurable surround)
* 1.1+ - Bitmap fonts (Spectrum ROM 8x8 etc.) for true-pixel `screen.scale(1)` rendering, multi-mode resolutions per machine, JSLint pass

**Acknowledgements**

Claude Code helped squash long-standing bugs in the original 0.4.0 source and extend the library with the palette system, pseudo-resolutions, scaling, border, grid and `cls` features that landed across 0.6.0 → 1.0.0, and drafted the companion `inputKey` library.
