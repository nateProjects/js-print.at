/*!
 * print.At v0.9.0
 * BASIC-style PRINT AT for HTML5 canvas, with retro color palettes
 * and pseudo-resolutions matching 8-bit machines.
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
	// Add or override profiles via pbasic.palettes.<name> = {...}
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
	var _scale = 2;          // backbuffer multiplier; default for readability
	var _fontStr = "14px Courier";
	var _fontSize = 14;
	var _fontPadding = 4;
	var _cellW = 8.4;
	var _cellH = 18;
	var _cursorX = 1;
	var _cursorY = 1;
	var _currentResolution = null;   // last applied {width, height, cols?, rows?}

	var _palette     = palettes.spectrum;
	var _screenInk   = _palette.defaults.ink;
	var _screenPaper = _palette.defaults.paper;
	var _printInk    = _palette.defaults.ink;
	var _printPaper  = _palette.defaults.paper;

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

	// screen.font(family, size, padding) - configure the canvas font.
	// In preset/grid mode, screen.size will override size+padding to fit cells.
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

	// screen.palette(name | profile object | color array) - select active profile.
	// Note: this only changes colors. Use screen.size(name) to also change resolution.
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
				name:     profile.name     || 'custom',
				colors:   profile.colors   || [],
				defaults: profile.defaults || { ink: 0, paper: 0 },
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

	// screen.color(ink, paper) - screen-default colors. Applied on next clear.
	screen.color = function (ink, paper) {
		if (typeof ink   !== 'undefined') { _screenInk   = ink; }
		if (typeof paper !== 'undefined') { _screenPaper = paper; }
	};

	// print.color(ink, paper) - colors for subsequent prints. Reset on clear.
	print.color = function (ink, paper) {
		if (typeof ink   !== 'undefined') { _printInk   = ink; }
		if (typeof paper !== 'undefined') { _printPaper = paper; }
	};

	// screen.scale(n) - backbuffer multiplier. No args returns current scale.
	// Re-applies the current resolution at the new scale if a canvas exists.
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

	// screen.size(width, height) - explicit pixel dimensions (no cell grid)
	// screen.size(name)          - look up that profile's resolution preset
	// screen.size()              - re-apply: active palette's resolution if any,
	//                              otherwise default 640x480
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
		var bufferW = res.width  * _scale;
		var bufferH = res.height * _scale;

		if (!_canvas) {
			_canvas = document.createElement('canvas');
			_canvas.id = "screenCanvas";
			_canvas.style.position = "absolute";
			document.body.appendChild(_canvas);
		}
		_canvas.width  = bufferW;
		_canvas.height = bufferH;

		_ctx = _canvas.getContext('2d');
		_ctx.textBaseline = "top";

		if (res.cols && res.rows) {
			// grid mode: cell size derived from the preset, font fits the cell
			_cellW = bufferW / res.cols;
			_cellH = bufferH / res.rows;
			_fontSize    = Math.floor(_cellH);
			_fontPadding = 0;
			_fontStr     = _fontSize + "px " + (screen.font.family || "Courier");
			screen.font.size    = _fontSize;
			screen.font.padding = 0;
			_ctx.font = _fontStr;
		} else {
			// freeform mode: cells from current font
			_ctx.font = _fontStr;
			_cellH = _fontSize + _fontPadding;
			_measureCellW();
		}

		screen.canvas        = _canvas;
		screen.context       = _ctx;
		screen.cellSize      = _cellH;
		screen.nativeWidth   = res.width;
		screen.nativeHeight  = res.height;
		screen.cols          = res.cols || Math.floor(bufferW / _cellW);
		screen.rows          = res.rows || Math.floor(bufferH / _cellH);

		screen.clear();
	}

	// screen.clear() - paint the canvas with screen paper, reset cursor + print state
	screen.clear = function () {
		if (!_ctx) { return; }
		_ctx.fillStyle = _resolveColor(_screenPaper);
		_ctx.fillRect(0, 0, _canvas.width, _canvas.height);
		_printInk   = _screenInk;
		_printPaper = _screenPaper;
		_cursorX = 1;
		_cursorY = 1;
	};

	function _drawText(x, y, text) {
		var px = (x - 1) * _cellW;
		var py = (y - 1) * _cellH;
		_ctx.fillStyle = _resolveColor(_printPaper);
		_ctx.fillRect(px, py, _cellW * text.length, _cellH);
		_ctx.fillStyle = _resolveColor(_printInk);
		_ctx.fillText(text, px, py);
	}

	// print.at(x, y, text) - draw at cell (x, y); 1-indexed, (1,1) = top-left
	print.at = function (x, y, text) {
		if (!_ctx) { return; }
		text = (typeof text !== 'undefined') ? String(text) : "";
		_drawText(x, y, text);
		_cursorX = x + text.length;
		_cursorY = y;
	};

	// print.line(text) - draw at cursor and advance one row
	print.line = function (text) {
		if (!_ctx) { return; }
		text = (typeof text !== 'undefined') ? String(text) : "";
		_drawText(_cursorX, _cursorY, text);
		_cursorX = 1;
		_cursorY += 1;
	};

	// --- export ----------------------------------------------------------
	global.pbasic = {
		screen:   screen,
		print:    print,
		palettes: palettes
	};

}(typeof window !== 'undefined' ? window : this));
