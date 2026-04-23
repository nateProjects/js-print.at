/*!
 * print.At v0.8.0
 * BASIC-style PRINT AT for HTML5 canvas, with retro color palettes.
 * https://github.com/nate2squared/print.At
 *
 * Exposes `pbasic` on the global object. Alias locally for BASIC-like terseness:
 *     var screen = pbasic.screen, print = pbasic.print;
 */
(function (global) {
	"use strict";

	// --- color palettes --------------------------------------------------
	// Each profile: { name, colors: [css strings indexed by color number],
	//                 defaults: { ink, paper } }
	// Add or override profiles via pbasic.palettes.<name> = {...}
	var palettes = {
		spectrum: {
			name: 'ZX Spectrum',
			colors: ['#000000', '#0000FF', '#FF0000', '#FF00FF',
			         '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF'],
			defaults: { ink: 0, paper: 7 }
		},
		c64: {
			name: 'Commodore 64',
			colors: ['#000000', '#FFFFFF', '#9F4E44', '#6ABFC6',
			         '#A057A3', '#5CAB5E', '#50459B', '#C9D487',
			         '#A1683C', '#6D5412', '#CB7E75', '#626262',
			         '#898989', '#9AE29B', '#887ECB', '#ADADAD'],
			defaults: { ink: 14, paper: 6 }
		},
		cga: {
			name: 'CGA',
			colors: ['#000000', '#0000AA', '#00AA00', '#00AAAA',
			         '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
			         '#555555', '#5555FF', '#55FF55', '#55FFFF',
			         '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF'],
			defaults: { ink: 7, paper: 0 }
		},
		bbc: {
			name: 'BBC Micro',
			colors: ['#000000', '#FF0000', '#00FF00', '#FFFF00',
			         '#0000FF', '#FF00FF', '#00FFFF', '#FFFFFF'],
			defaults: { ink: 7, paper: 0 }
		},
		msx: {
			name: 'MSX',
			colors: ['#000000', '#000000', '#3EB849', '#74D07D',
			         '#5955E0', '#8076F1', '#B95E51', '#65DBEF',
			         '#DB6559', '#FF897D', '#CCC35E', '#DED087',
			         '#3AA241', '#B766B5', '#CCCCCC', '#FFFFFF'],
			defaults: { ink: 15, paper: 4 }
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
			defaults: { ink: 26, paper: 1 }
		}
	};

	// --- private state ---------------------------------------------------
	var _canvas = null;
	var _ctx = null;
	var _fontStr = "14px Courier";
	var _fontSize = 14;
	var _fontPadding = 4;
	var _cellW = 8.4;        // measured per font (px)
	var _cellH = 18;         // font size + padding (px)
	var _cursorX = 1;
	var _cursorY = 1;

	var _palette     = palettes.spectrum;
	var _screenInk   = _palette.defaults.ink;
	var _screenPaper = _palette.defaults.paper;
	var _printInk    = _palette.defaults.ink;
	var _printPaper  = _palette.defaults.paper;

	// --- public objects --------------------------------------------------
	var screen = {};
	var print  = {};

	// Resolve a color value: integer indexes into the active palette,
	// strings (e.g. '#FF8000' or 'red') pass through as raw CSS colors.
	function _resolveColor(n) {
		if (typeof n === 'string') { return n; }
		var len = _palette.colors.length;
		if (n < 0 || n >= len) {
			if (typeof console !== 'undefined' && console.warn) {
				console.warn('pbasic: color ' + n + ' out of range for palette "' +
				             _palette.name + '" (0-' + (len - 1) + '), clamping');
			}
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

	// screen.font(family, size, padding)
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

		// kept for backward compat with 0.6.0 callers
		screen.cellSize = _cellH;
	};
	screen.font();

	// screen.palette(name | profile object | color array)
	// No args: returns the active profile.
	// Switching auto-applies the new palette's defaults and clears the screen.
	screen.palette = function (profile) {
		if (typeof profile === 'undefined') { return _palette; }

		var p;
		if (typeof profile === 'string') {
			p = palettes[profile];
			if (!p) {
				if (typeof console !== 'undefined' && console.warn) {
					console.warn('pbasic: unknown palette "' + profile + '"');
				}
				return _palette;
			}
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
				defaults: profile.defaults || { ink: 0, paper: 0 }
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

	// screen.color(ink, paper) - set the screen-default colors.
	// Takes effect on the next screen.clear().
	screen.color = function (ink, paper) {
		if (typeof ink   !== 'undefined') { _screenInk   = ink; }
		if (typeof paper !== 'undefined') { _screenPaper = paper; }
	};

	// print.color(ink, paper) - set colors for subsequent print.at / print.line.
	// Persists until changed or until screen.clear() resets to screen-defaults.
	print.color = function (ink, paper) {
		if (typeof ink   !== 'undefined') { _printInk   = ink; }
		if (typeof paper !== 'undefined') { _printPaper = paper; }
	};

	// screen.size(width, height) - create the canvas
	screen.size = function (screenWidth, screenHeight) {
		screenWidth  = typeof screenWidth  !== 'undefined' ? screenWidth  : 640;
		screenHeight = typeof screenHeight !== 'undefined' ? screenHeight : 480;

		_canvas = document.createElement('canvas');
		_canvas.id     = "screenCanvas";
		_canvas.width  = screenWidth;
		_canvas.height = screenHeight;
		_canvas.style.position = "absolute";
		document.body.appendChild(_canvas);

		_ctx = _canvas.getContext('2d');
		_ctx.font         = _fontStr;
		_ctx.textBaseline = "top";
		_measureCellW();

		screen.canvas  = _canvas;
		screen.context = _ctx;

		screen.clear();
	};

	// screen.clear() - paint the canvas with the screen paper, reset cursor,
	// and reset print-state colors back to the screen defaults.
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

	// print.at(x, y, text) - draw text at cell (x, y); 1-indexed, (1,1) = top-left
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
