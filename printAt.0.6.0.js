/*!
 * print.At v0.6.0
 * A small canvas-backed library that mimics BASIC-style PRINT AT statements.
 * https://github.com/nate2squared/print.At
 *
 * Exposes `pbasic` on the global object. Alias locally for BASIC-like terseness:
 *     var screen = pbasic.screen, print = pbasic.print;
 */
(function (global) {
	"use strict";

	// --- private state ---------------------------------------------------
	var _canvas = null;
	var _ctx = null;
	var _fontStr = "14px Courier";
	var _cellSize = 18;   // font size + padding
	var _cursorX = 1;
	var _cursorY = 1;

	// --- public objects --------------------------------------------------
	var screen = {};
	var print = {};

	// screen.font(family, size, padding) - configure the canvas font.
	// All arguments are optional; defaults are Courier / 14px / 4px padding.
	screen.font = function (family, size, padding) {
		family  = typeof family  !== 'undefined' ? family  : "Courier";
		size    = typeof size    !== 'undefined' ? size    : 14;
		padding = typeof padding !== 'undefined' ? padding : 4;

		screen.font.family  = family;
		screen.font.size    = size;
		screen.font.padding = padding;

		_fontStr  = size + "px " + family;
		_cellSize = size + padding;
		screen.cellSize = _cellSize;

		if (_ctx) { _ctx.font = _fontStr; }
	};
	// apply defaults immediately so screen.cellSize etc. are populated
	screen.font();

	// screen.size(width, height) - create the canvas and cache its context.
	screen.size = function (screenWidth, screenHeight) {
		screenWidth  = typeof screenWidth  !== 'undefined' ? screenWidth  : 640;
		screenHeight = typeof screenHeight !== 'undefined' ? screenHeight : 480;

		_canvas = document.createElement('canvas');
		_canvas.id = "screenCanvas";
		_canvas.width  = screenWidth;
		_canvas.height = screenHeight;
		_canvas.style.position = "absolute";
		document.body.appendChild(_canvas);

		_ctx = _canvas.getContext('2d');
		_ctx.font = _fontStr;

		// expose for callers that want to dig in
		screen.canvas  = _canvas;
		screen.context = _ctx;
	};

	// screen.clear() - wipe the canvas and reset the cursor.
	screen.clear = function () {
		if (!_ctx) { return; }
		_ctx.clearRect(0, 0, _canvas.width, _canvas.height);
		_cursorX = 1;
		_cursorY = 1;
	};

	// print.at(x, y, text) - draw text at cell (x, y). Coordinates are 1-indexed.
	print.at = function (x, y, text) {
		if (!_ctx) { return; }
		text = (typeof text !== 'undefined') ? String(text) : "";
		_ctx.fillText(text, x * _cellSize, y * _cellSize);
		_cursorX = x + text.length;
		_cursorY = y;
	};

	// print.line(text) - draw text at the current cursor and advance one row.
	// Calling with no argument just advances a row.
	print.line = function (text) {
		if (!_ctx) { return; }
		text = (typeof text !== 'undefined') ? String(text) : "";
		_ctx.fillText(text, _cursorX * _cellSize, _cursorY * _cellSize);
		_cursorX = 1;
		_cursorY += 1;
	};

	// --- export ----------------------------------------------------------
	global.pbasic = { screen: screen, print: print };

}(typeof window !== 'undefined' ? window : this));
