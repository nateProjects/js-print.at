/*!
 * print.At v1.0.0
 * BASIC-style PRINT AT for HTML5 canvas.
 *  - retro color palettes (ZX Spectrum, C64, CGA, BBC, MSX, Amstrad CPC)
 *  - pseudo-resolutions matching 8-bit machines
 *  - grid overlay and configurable border area
 * https://github.com/nate2squared/print.At
 *
 * Exposes `pbasic` on the global object. Alias locally for BASIC-like terseness:
 *     var screen = pbasic.screen, print = pbasic.print;
 */
(function (global) {
	"use strict";

	// --- color palettes + resolutions ------------------------------------
	// Each profile: { name,
	//                 colors:     [css strings indexed by color number],
	//                 defaults:   { ink, paper },
	//                 resolution: { width, height, cols, rows }   // optional
	//               }
	var palettes = {
		spectrum: {
			name: 'ZX Spectrum',
			colors: ['#000000', '#0000FF', '#FF0000', '#FF00FF',
			         '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF'],
			defaults:   { ink: 0, paper: 7 },
			resolution: { width: 256, height: 192, cols: 32, rows: 24 }
		},
		c64: {
			name: 'Commodore 64',
			colors: ['#000000', '#FFFFFF', '#9F4E44', '#6ABFC6',
			         '#A057A3', '#5CAB5E', '#50459B', '#C9D487',
			         '#A1683C', '#6D5412', '#CB7E75', '#626262',
			         '#898989', '#9AE29B', '#887ECB', '#ADADAD'],
			defaults:   { ink: 14, paper: 6 },
			resolution: { width: 320, height: 200, cols: 40, rows: 25 }
		},
		cga: {
			name: 'CGA',
			colors: ['#000000', '#0000AA', '#00AA00', '#00AAAA',
			         '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
			         '#555555', '#5555FF', '#55FF55', '#55FFFF',
			         '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF'],
			defaults:   { ink: 7, paper: 0 },
			resolution: { width: 640, height: 200, cols: 80, rows: 25 }
		},
		bbc: {
			name: 'BBC Micro',
			colors: ['#000000', '#FF0000', '#00FF00', '#FFFF00',
			         '#0000FF', '#FF00FF', '#00FFFF', '#FFFFFF'],
			defaults:   { ink: 7, paper: 0 },
			resolution: { width: 640, height: 256, cols: 80, rows: 32 }
		},
		msx: {
			name: 'MSX',
			colors: ['#000000', '#000000', '#3EB849', '#74D07D',
			         '#5955E0', '#8076F1', '#B95E51', '#65DBEF',
			         '#DB6559', '#FF897D', '#CCC35E', '#DED087',
			         '#3AA241', '#B766B5', '#CCCCCC', '#FFFFFF'],
			defaults:   { ink: 15, paper: 4 },
			resolution: { width: 256, height: 192, cols: 32, rows: 24 }
		},
		cpc: {
			name: 'Amstrad CPC',
			colors: ['#000000', '#000080', '#0000FF', '#800000',
			         '#800080', '#8000FF', '#FF0000', '#FF0080',
			         '#FF00FF', '#008000', '#008080', '#0080FF',
			         '#808000', '#808080', '#8080FF', '#FF8000',
			         '#FF8080', '#FF80FF', '#00FF00', '#00FF80',
			         '#00FFFF', '#80FF00', '#80FF80', '#80FFFF',
			         '#FFFF00', '#FFFF80', '#FFFFFF'],
			defaults:   { ink: 26, paper: 1 },
			resolution: { width: 320, height: 200, cols: 40, rows: 25 }
		}
	};

	// --- private state ---------------------------------------------------
	var _canvas = null;
	var _ctx = null;
	var _scale = 2;
	var _fontStr = "14px Courier";
	var _fontSize = 14;
	var _fontPadding = 4;
	var _cellW = 8.4;
	var _cellH = 18;
	var _cursorX = 1;
	var _cursorY = 1;
	var _currentResolution = null;

	var _palette     = palettes.spectrum;
	var _screenInk   = _palette.defaults.ink;
	var _screenPaper = _palette.defaults.paper;
	var _printInk    = _palette.defaults.ink;
	var _printPaper  = _palette.defaults.paper;

	// 1.0 additions
	var _gridOn          = false;
	var _gridColor       = '#888888';
	var _borderThickness = 0;        // native pixels per side (pre-scale)
	var _borderColor     = 0;        // palette index or CSS string

	// 1.1 additions
	var _glyphs = {};                // map of character -> bitmap row bytes

	// --- public objects --------------------------------------------------
	var screen = {};
	var print  = {};

	function _warn(msg) {
		if (typeof console !== 'undefined' && console.warn) { console.warn(msg); }
	}

	function _resolveColor(n) {
		if (typeof n === 'string') { return n; }
		var len = _palette.colors.length;
		if (n < 0 || n >= len) {
			_warn('pbasic: color ' + n + ' out of range for palette "' +
			      _palette.name + '" (0-' + (len - 1) + '), clamping');
			n = Math.max(0, Math.min(n, len - 1));
		}
		return _palette.colors[n];
	}

	function _measureCellW() {
		if (_ctx) {
			_cellW = _ctx.measureText('M').width;
		} else {
			_cellW = _fontSize * 0.6;
		}
	}

	function _borderPx() { return _borderThickness * _scale; }

	// --- font ------------------------------------------------------------
	screen.font = function (family, size, padding) {
		family  = typeof family  !== 'undefined' ? family  : "Courier";
		size    = typeof size    !== 'undefined' ? size    : 14;
		padding = typeof padding !== 'undefined' ? padding : 4;

		screen.font.family  = family;
		screen.font.size    = size;
		screen.font.padding = padding;

		_fontSize    = size;
		_fontPadding = padding;
		_fontStr     = size + "px " + family;
		_cellH       = size + padding;

		if (_ctx) {
			_ctx.font = _fontStr;
			_ctx.textBaseline = "top";
		}
		_measureCellW();

		screen.cellSize = _cellH;
	};
	screen.font();

	// --- palette ---------------------------------------------------------
	screen.palette = function (profile) {
		if (typeof profile === 'undefined') { return _palette; }

		var p;
		if (typeof profile === 'string') {
			p = palettes[profile];
			if (!p) { _warn('pbasic: unknown palette "' + profile + '"'); return _palette; }
		} else if (Object.prototype.toString.call(profile) === '[object Array]') {
			p = {
				name:     'custom',
				colors:   profile.slice(),
				defaults: { ink: profile.length - 1, paper: 0 }
			};
		} else {
			p = {
				name:       profile.name     || 'custom',
				colors:     profile.colors   || [],
				defaults:   profile.defaults || { ink: 0, paper: 0 },
				resolution: profile.resolution
			};
		}

		_palette     = p;
		_screenInk   = p.defaults.ink;
		_screenPaper = p.defaults.paper;
		_printInk    = p.defaults.ink;
		_printPaper  = p.defaults.paper;

		if (_ctx) { screen.clear(); }
		return _palette;
	};

	// --- colors ----------------------------------------------------------
	screen.color = function (ink, paper) {
		if (typeof ink   !== 'undefined') { _screenInk   = ink; }
		if (typeof paper !== 'undefined') { _screenPaper = paper; }
	};

	print.color = function (ink, paper) {
		if (typeof ink   !== 'undefined') { _printInk   = ink; }
		if (typeof paper !== 'undefined') { _printPaper = paper; }
	};

	// --- scale / size ----------------------------------------------------
	screen.scale = function (n) {
		if (typeof n === 'undefined') { return _scale; }
		if (typeof n !== 'number' || !(n > 0)) {
			_warn('pbasic: screen.scale must be a positive number');
			return _scale;
		}
		_scale = n;
		if (_canvas && _currentResolution) { _applySize(); }
		return _scale;
	};

	screen.size = function (widthOrName, height) {
		var resolution;

		if (typeof widthOrName === 'string') {
			var profile = palettes[widthOrName];
			if (!profile || !profile.resolution) {
				_warn('pbasic: no resolution preset for "' + widthOrName + '"');
				return;
			}
			resolution = profile.resolution;
		} else if (typeof widthOrName === 'number' && typeof height === 'number') {
			resolution = { width: widthOrName, height: height };
		} else if (typeof widthOrName === 'undefined') {
			resolution = (_palette.resolution) || { width: 640, height: 480 };
		} else {
			_warn('pbasic: invalid screen.size arguments');
			return;
		}

		_currentResolution = resolution;
		_applySize();
	};

	function _applySize() {
		var res = _currentResolution;
		var border = _borderPx();
		var printAreaW = res.width  * _scale;
		var printAreaH = res.height * _scale;
		var bufferW = printAreaW + 2 * border;
		var bufferH = printAreaH + 2 * border;

		if (!_canvas) {
			_canvas = document.createElement('canvas');
			_canvas.id = "screenCanvas";
			document.body.appendChild(_canvas);
		}
		_canvas.width  = bufferW;
		_canvas.height = bufferH;

		_ctx = _canvas.getContext('2d');
		_ctx.textBaseline = "top";

		if (res.cols && res.rows) {
			_cellW = printAreaW / res.cols;
			_cellH = printAreaH / res.rows;
			_fontSize    = Math.floor(_cellH);
			_fontPadding = 0;
			_fontStr     = _fontSize + "px " + (screen.font.family || "Courier");
			screen.font.size    = _fontSize;
			screen.font.padding = 0;
			_ctx.font = _fontStr;
		} else {
			_ctx.font = _fontStr;
			_cellH = _fontSize + _fontPadding;
			_measureCellW();
		}

		screen.canvas        = _canvas;
		screen.context       = _ctx;
		screen.cellSize      = _cellH;
		screen.nativeWidth   = res.width;
		screen.nativeHeight  = res.height;
		screen.cols          = res.cols || Math.floor(printAreaW / _cellW);
		screen.rows          = res.rows || Math.floor(printAreaH / _cellH);

		screen.clear();
	}

	// --- clear / cls -----------------------------------------------------
	screen.clear = function () {
		if (!_ctx) { return; }
		var b = _borderPx();
		// fill border area with border color, then print area with paper
		if (b > 0) {
			_ctx.fillStyle = _resolveColor(_borderColor);
			_ctx.fillRect(0, 0, _canvas.width, _canvas.height);
		}
		_ctx.fillStyle = _resolveColor(_screenPaper);
		_ctx.fillRect(b, b, _canvas.width - 2 * b, _canvas.height - 2 * b);

		_printInk   = _screenInk;
		_printPaper = _screenPaper;
		_cursorX = 1;
		_cursorY = 1;

		if (_gridOn) { _drawGrid(); }
	};

	// screen.cls([ink, [paper]]) - shortcut for color + clear, BASIC-style.
	// Argument order matches screen.color / print.color (ink first, paper second).
	screen.cls = function (ink, paper) {
		if (typeof ink   !== 'undefined') { _screenInk   = ink; }
		if (typeof paper !== 'undefined') { _screenPaper = paper; }
		screen.clear();
	};

	// --- text drawing ----------------------------------------------------
	function _drawGlyph(px, py, bytes, inkCss) {
		// Bitmap glyph: array of N bytes, each byte = 8 horizontal pixels,
		// MSB = leftmost. Spectrum UDG convention. Pixel size derives from
		// the current cell size so glyphs scale with the active resolution.
		var rows = bytes.length;
		var pxw  = _cellW / 8;
		var pxh  = _cellH / rows;
		_ctx.fillStyle = inkCss;
		for (var r = 0; r < rows; r++) {
			var byte = bytes[r] | 0;
			for (var c = 0; c < 8; c++) {
				if (byte & (0x80 >> c)) {
					_ctx.fillRect(
						Math.floor(px + c * pxw),
						Math.floor(py + r * pxh),
						Math.ceil(pxw),
						Math.ceil(pxh)
					);
				}
			}
		}
	}

	function _drawText(x, y, text) {
		var b = _borderPx();
		var px = (x - 1) * _cellW + b;
		var py = (y - 1) * _cellH + b;
		_ctx.fillStyle = _resolveColor(_printPaper);
		_ctx.fillRect(px, py, _cellW * text.length, _cellH);

		var inkCss = _resolveColor(_printInk);
		// If any character in the run has a registered bitmap glyph,
		// draw cell-by-cell so glyphs and font characters can mix freely.
		var hasGlyph = false;
		for (var i = 0; i < text.length; i++) {
			if (_glyphs[text.charAt(i)]) { hasGlyph = true; break; }
		}
		if (hasGlyph) {
			_ctx.fillStyle = inkCss;
			for (var j = 0; j < text.length; j++) {
				var ch = text.charAt(j);
				var cx = px + j * _cellW;
				if (_glyphs[ch]) {
					_drawGlyph(cx, py, _glyphs[ch], inkCss);
				} else {
					_ctx.fillStyle = inkCss;
					_ctx.fillText(ch, cx, py);
				}
			}
		} else {
			_ctx.fillStyle = inkCss;
			_ctx.fillText(text, px, py);
		}
		if (_gridOn) { _drawGrid(); }
	}

	// Shared helper: temporarily override print ink/paper for one draw,
	// then restore. Matches Spectrum's per-statement PAPER/INK semantics
	// (inline color args don't stick — the persistent defaults stay put).
	function _withScopedColor(ink, paper, fn) {
		if (typeof ink === 'undefined' && typeof paper === 'undefined') {
			fn();
			return;
		}
		var savedInk   = _printInk;
		var savedPaper = _printPaper;
		if (typeof ink   !== 'undefined') { _printInk   = ink; }
		if (typeof paper !== 'undefined') { _printPaper = paper; }
		try { fn(); }
		finally {
			_printInk   = savedInk;
			_printPaper = savedPaper;
		}
	}

	// print.at(x, y, text)              - uses the persistent print ink/paper
	// print.at(x, y, text, ink)         - one-shot ink override
	// print.at(x, y, text, ink, paper)  - one-shot ink + paper override
	// The ink/paper args are local to this call — they do not modify the
	// persistent print.color state, mirroring BASIC's
	//     PRINT AT y, x ; PAPER p ; INK i ; "text"
	// behaviour (per-statement attributes).
	print.at = function (x, y, text, ink, paper) {
		if (!_ctx) { return; }
		text = (typeof text !== 'undefined') ? String(text) : "";
		_withScopedColor(ink, paper, function () { _drawText(x, y, text); });
		_cursorX = x + text.length;
		_cursorY = y;
	};

	// print.line(text)              - uses the persistent print ink/paper
	// print.line(text, ink)         - one-shot ink override
	// print.line(text, ink, paper)  - one-shot ink + paper override
	print.line = function (text, ink, paper) {
		if (!_ctx) { return; }
		text = (typeof text !== 'undefined') ? String(text) : "";
		var cx = _cursorX, cy = _cursorY;
		_withScopedColor(ink, paper, function () { _drawText(cx, cy, text); });
		_cursorX = 1;
		_cursorY += 1;
	};

	// print.basicAt(y, x, text, [ink], [paper])
	// Spectrum BASIC-style alias: y first, 0-indexed. Lets a line-by-line
	// port keep coordinates identical to the BASIC source. New code should
	// prefer print.at; basicAt exists purely for porting ergonomics.
	//     BASIC:  PRINT AT 5, 9 ; PAPER 7 ; INK 0 ; "Q - Up"
	//     pbasic: print.basicAt(5, 9, "Q - Up", 0, 7);
	print.basicAt = function (y, x, text, ink, paper) {
		print.at(x + 1, y + 1, text, ink, paper);
	};

	// --- grid overlay ----------------------------------------------------
	function _drawGrid() {
		if (!_ctx) { return; }
		var b = _borderPx();
		var w = screen.cols * _cellW;
		var h = screen.rows * _cellH;
		_ctx.strokeStyle = _resolveColor(_gridColor);
		_ctx.lineWidth = 1;
		_ctx.beginPath();
		var i, x, y;
		for (i = 0; i <= screen.cols; i++) {
			x = Math.round(b + i * _cellW) + 0.5;
			_ctx.moveTo(x, b);
			_ctx.lineTo(x, b + h);
		}
		for (i = 0; i <= screen.rows; i++) {
			y = Math.round(b + i * _cellH) + 0.5;
			_ctx.moveTo(b, y);
			_ctx.lineTo(b + w, y);
		}
		_ctx.stroke();
	}

	// screen.grid()                  - toggle on/off
	// screen.grid(true | false)      - explicit
	// screen.grid('on' | 'off')      - explicit
	// screen.grid(color)             - turn on with palette index or CSS color
	// screen.grid(true|'on', color)  - turn on with color
	// Returns the grid on/off state.
	// Note: turning the grid OFF doesn't erase already-painted lines —
	// call screen.clear() (or re-print over them) to remove.
	screen.grid = function (on, color) {
		if (typeof on === 'undefined') {
			_gridOn = !_gridOn;
		} else if (typeof on === 'boolean') {
			_gridOn = on;
		} else if (on === 'on') {
			_gridOn = true;
		} else if (on === 'off') {
			_gridOn = false;
		} else {
			// treated as a color
			_gridColor = on;
			_gridOn = true;
		}
		if (typeof color !== 'undefined') { _gridColor = color; }
		if (_gridOn && _ctx) { _drawGrid(); }
		return _gridOn;
	};

	// --- border ----------------------------------------------------------
	function _drawBorder() {
		if (!_ctx) { return; }
		var b = _borderPx();
		if (b <= 0) { return; }
		var w = _canvas.width, h = _canvas.height;
		_ctx.fillStyle = _resolveColor(_borderColor);
		_ctx.fillRect(0,     0,     w,         b);              // top
		_ctx.fillRect(0,     h - b, w,         b);              // bottom
		_ctx.fillRect(0,     b,     b,         h - 2 * b);      // left
		_ctx.fillRect(w - b, b,     b,         h - 2 * b);      // right
	}

	// screen.border(color, [thickness]) - configure the surrounding border.
	// Color is a palette index or CSS string. Thickness is in NATIVE pixels
	// (pre-scale) per side.
	// Changing thickness resizes the canvas (and clears its contents).
	// Color-only changes just repaint the border strips, leaving the print
	// area untouched.
	screen.border = function (color, thickness) {
		var thicknessChanged = false;
		if (typeof color !== 'undefined') { _borderColor = color; }
		if (typeof thickness !== 'undefined' && thickness !== _borderThickness) {
			_borderThickness = thickness;
			thicknessChanged = true;
		}
		if (thicknessChanged && _canvas && _currentResolution) {
			_applySize();
		} else if (_ctx) {
			_drawBorder();
		}
		return { color: _borderColor, thickness: _borderThickness };
	};

	// --- bitmap glyphs (UDG analogue) ------------------------------------
	// screen.glyph(code, bytes)  - register an N x 8 bitmap for `code`
	// screen.glyph(code, null)   - remove a previously registered glyph
	// screen.glyph(code)         - return the bytes registered for `code`,
	//                              or undefined
	// screen.glyph()             - return all registered codes
	//
	// `code` is either a single character string ("A", "@") or a numeric
	// codepoint (144 for the first Spectrum UDG, etc.). `bytes` is an
	// array of integers, one byte per row, MSB = leftmost pixel — the
	// Spectrum UDG convention. The glyph kicks in any time that character
	// appears in a print.at / print.line run, drawn in the current ink
	// over the current paper, scaled to the active cell size.
	//
	//     screen.glyph(144, [60, 66, 129, 129, 129, 129, 66, 60]);
	//     var S = String.fromCharCode(144);
	//     print.at(10, 5, S, 0, 7);
	function _glyphKey(code) {
		if (typeof code === 'number') { return String.fromCharCode(code); }
		if (typeof code === 'string' && code.length > 0) { return code.charAt(0); }
		return null;
	}

	screen.glyph = function (code, bytes) {
		if (arguments.length === 0) {
			var keys = [];
			for (var k in _glyphs) {
				if (Object.prototype.hasOwnProperty.call(_glyphs, k)) { keys.push(k); }
			}
			return keys;
		}
		var key = _glyphKey(code);
		if (key === null) {
			_warn('pbasic: screen.glyph code must be a character or codepoint');
			return;
		}
		if (arguments.length === 1) {
			return _glyphs[key] ? _glyphs[key].slice() : undefined;
		}
		if (bytes === null || typeof bytes === 'undefined') {
			delete _glyphs[key];
			return;
		}
		if (Object.prototype.toString.call(bytes) !== '[object Array]') {
			_warn('pbasic: screen.glyph bytes must be an array of integers');
			return;
		}
		_glyphs[key] = bytes.slice();
	};

	// --- export ----------------------------------------------------------
	global.pbasic = {
		screen:   screen,
		print:    print,
		palettes: palettes
	};

}(typeof window !== 'undefined' ? window : this));
