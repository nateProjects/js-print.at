/*!
 * inputKey v1.0.0
 * BASIC-style keyboard input for JavaScript.
 *  - input.inkey()        : INKEY$ analogue - char of key currently held, or ""
 *  - input.line()         : INPUT analogue  - prompt and read a line, returns Promise
 *  - input.getkey()       : Wait for next key press, returns Promise (or callback)
 *  - input.onkey()        : Edge-trigger key handler, returns unsubscribe fn
 *  - input.multikeys()    : MultiKeys analogue - snapshot of which keys are held
 *  - input.held(code)     : Single-key boolean shortcut
 *  - input.pause(ms)      : PAUSE n - promise-based delay
 *  - input.attach(target) : Scope listeners to a window or DOM element
 *  - input.reset()        : Clear held state
 *  - input.keys           : Named constants for common keys
 * https://github.com/nate2squared/print.At
 *
 * Extends (or creates) the global `pbasic` namespace. Alias locally for
 * BASIC-like terseness:
 *     var input = pbasic.input;
 *
 * Loads independently of print.At - no hard dependency either way, except
 * that input.line needs print.at + screen to render the prompt and field.
 */
(function (global) {
	"use strict";

	// --- private state ---------------------------------------------------
	var _attachedTo    = null;   // window or DOM element
	var _held          = {};
	var _lastKey       = "";
	var _lastCode      = "";
	var _pendingGet    = [];
	var _onkeyHandlers = [];     // {target, handler, repeat}
	var _activeLine    = null;   // active input.line capture, or null

	function _warn(msg) {
		if (typeof console !== 'undefined' && console.warn) { console.warn(msg); }
	}

	// --- listeners -------------------------------------------------------
	function _onKeyDown(e) {
		var isRepeat = !!_held[e.code] || e.repeat === true;
		_held[e.code] = true;
		_lastKey  = e.key;
		_lastCode = e.code;

		// Active line input is modal: it absorbs everything and prevents
		// default so the page doesn't scroll on Space/arrow keys, etc.
		if (_activeLine) {
			_activeLine(e, isRepeat);
			if (e.preventDefault) { e.preventDefault(); }
			return;
		}

		// Fire onkey handlers (edge-only by default; opt-in to repeats)
		for (var i = 0; i < _onkeyHandlers.length; i++) {
			var h = _onkeyHandlers[i];
			if (isRepeat && !h.repeat) { continue; }
			if (h.target && h.target !== e.code && h.target !== e.key) { continue; }
			try { h.handler({ key: e.key, code: e.code, repeat: isRepeat }); }
			catch (err) { _warn(err); }
		}

		// Resolve pending getkey()s (edge-only)
		if (!isRepeat && _pendingGet.length > 0) {
			var waiting = _pendingGet;
			_pendingGet = [];
			var payload = { key: e.key, code: e.code };
			for (var j = 0; j < waiting.length; j++) {
				try { waiting[j](payload); } catch (err2) { _warn(err2); }
			}
		}
	}

	function _onKeyUp(e) {
		delete _held[e.code];
		if (_lastCode === e.code) {
			_lastKey  = "";
			_lastCode = "";
		}
	}

	// If the window loses focus we stop receiving keyup events for any
	// keys that were held, so clear everything to avoid "stuck" keys.
	function _onBlur() {
		_held     = {};
		_lastKey  = "";
		_lastCode = "";
	}

	function _detachFrom(target) {
		if (!target) { return; }
		target.removeEventListener('keydown', _onKeyDown, false);
		target.removeEventListener('keyup',   _onKeyUp,   false);
		target.removeEventListener('blur',    _onBlur,    false);
	}

	function _attachToTarget(target) {
		if (!target) { return; }
		target.addEventListener('keydown', _onKeyDown, false);
		target.addEventListener('keyup',   _onKeyUp,   false);
		target.addEventListener('blur',    _onBlur,    false);
		// Non-window elements need tabindex to receive keyboard focus.
		if (typeof window !== 'undefined' && target !== window) {
			if (target.hasAttribute && !target.hasAttribute('tabindex')) {
				target.tabIndex = 0;
			}
		}
	}

	function _ensureAttached() {
		if (_attachedTo) { return; }
		if (typeof window === 'undefined') { return; }
		_attachedTo = window;
		_attachToTarget(_attachedTo);
	}

	// Modifier-key convenience: treat 'Shift'/'Control'/'Alt'/'Meta' as
	// "either side", since the browser reports ShiftLeft/ShiftRight etc.
	function _isHeld(code) {
		if (_held[code]) { return true; }
		if (code === 'Shift')   { return !!(_held.ShiftLeft   || _held.ShiftRight);   }
		if (code === 'Control') { return !!(_held.ControlLeft || _held.ControlRight); }
		if (code === 'Alt')     { return !!(_held.AltLeft     || _held.AltRight);     }
		if (code === 'Meta')    { return !!(_held.MetaLeft    || _held.MetaRight);    }
		return false;
	}

	// --- public API ------------------------------------------------------
	var input = {};

	// INKEY$ analogue. Non-blocking, synchronous.
	// Returns the event.key (e.g. "a", "A", "ArrowUp", "Enter") of the
	// key currently held, or "" if no key is held.
	input.inkey = function () {
		_ensureAttached();
		if (_lastCode && _held[_lastCode]) { return _lastKey; }
		return "";
	};

	// GetKey analogue. Waits for the next key press (edge-only).
	//     var k = await input.getkey();           // promise form: {key, code}
	//     input.getkey(function (k) { ... });     // callback form
	input.getkey = function (callback) {
		_ensureAttached();
		if (typeof callback === 'function') {
			_pendingGet.push(callback);
			return;
		}
		if (typeof Promise === 'undefined') {
			_warn('pbasic: input.getkey needs a Promise or callback');
			return;
		}
		return new Promise(function (resolve) {
			_pendingGet.push(resolve);
		});
	};

	// MultiKeys analogue. Synchronous snapshot.
	//   With no args, returns an array of event.code strings for every
	//   key currently held.
	//   With one or more code arguments, returns an object:
	//     { mask, any, all, <code>: bool, ... }
	input.multikeys = function () {
		_ensureAttached();
		var i;
		if (arguments.length === 0) {
			var held = [];
			for (var k in _held) {
				if (Object.prototype.hasOwnProperty.call(_held, k)) { held.push(k); }
			}
			return held;
		}
		var result = { mask: 0, any: false, all: true };
		for (i = 0; i < arguments.length; i++) {
			var code = arguments[i];
			var down = _isHeld(code);
			result[code] = down;
			if (down) {
				result.mask |= (1 << i);
				result.any = true;
			} else {
				result.all = false;
			}
		}
		return result;
	};

	// Single-key boolean shortcut. Layout-independent (event.code), with
	// modifier aliases ('Shift'/'Control'/'Alt'/'Meta' = either side).
	//     if (input.held('Space')) { ... }
	input.held = function (code) {
		_ensureAttached();
		return _isHeld(code);
	};

	// PAUSE n analogue. Returns a Promise that resolves after `ms` ms.
	// Designed for use with `await` inside async game loops:
	//     await input.pause(80);
	input.pause = function (ms) {
		if (typeof Promise === 'undefined') {
			_warn('pbasic: input.pause needs a Promise environment');
			return;
		}
		ms = (typeof ms === 'number' && ms > 0) ? ms : 0;
		return new Promise(function (resolve) { setTimeout(resolve, ms); });
	};

	// Edge-trigger keydown handler. Returns an unsubscribe function.
	//     input.onkey(handler)                        // any key, edge-only
	//     input.onkey(handler, {repeat: true})        // any key, with OS repeats
	//     input.onkey('KeyA', handler)                // specific key, edge-only
	//     input.onkey('KeyA', handler, {repeat:true}) // specific key, with repeats
	// `target` matches against event.code OR event.key. Handler receives
	// { key, code, repeat }.
	input.onkey = function (targetOrHandler, handlerOrOpts, optsArg) {
		_ensureAttached();
		var target, handler, opts;
		if (typeof targetOrHandler === 'function') {
			target  = null;
			handler = targetOrHandler;
			opts    = handlerOrOpts;
		} else {
			target  = targetOrHandler;
			handler = handlerOrOpts;
			opts    = optsArg;
		}
		if (typeof handler !== 'function') {
			_warn('pbasic: input.onkey needs a handler function');
			return function () {};
		}
		opts = opts || {};
		var entry = {
			target:  target || null,
			handler: handler,
			repeat:  !!opts.repeat
		};
		_onkeyHandlers.push(entry);
		return function unsubscribe() {
			var i = _onkeyHandlers.indexOf(entry);
			if (i >= 0) { _onkeyHandlers.splice(i, 1); }
		};
	};

	// Scope listeners to a window or DOM element. By default they attach
	// to `window` lazily on the first input.* call. Pass an element to
	// scope input there; if the element has no tabindex one is added so
	// it can receive keyboard focus.
	//     input.attach(document.getElementById('screenCanvas'));
	//     input.attach();   // back to window
	input.attach = function (target) {
		if (typeof target === 'undefined') {
			target = (typeof window !== 'undefined') ? window : null;
		}
		if (!target) {
			_warn('pbasic: input.attach needs a window or DOM element');
			return;
		}
		if (_attachedTo) { _detachFrom(_attachedTo); }
		_attachedTo = target;
		_attachToTarget(target);
	};

	// INPUT a$ / INPUT a analogue. Reads a line from the keyboard,
	// rendering the prompt and field into the canvas via printAt.
	// Resolves on Enter.
	//
	//     await input.line();
	//     await input.line('Name? ');
	//     await input.line({prompt: 'N? ', at: [1, 22], length: 16});
	//     await input.line({numeric: true});           // resolves to Number
	//
	// Options:
	//   prompt    string     text printed before the field
	//   at        [x, y]     cell where prompt starts (default [1, screen.rows])
	//   length    number     max chars in the field (default: rest of row)
	//   numeric   boolean    filter to numeric keys; resolve as Number
	//   ink/paper number     colors for prompt + field
	//   cursor    string     cursor character (default '_')
	//
	// Requires printAt 1.1+ to be loaded. Only one input.line may be
	// active at a time; concurrent calls return a rejected Promise.
	input.line = function (promptOrOpts, optsArg) {
		_ensureAttached();
		if (typeof Promise === 'undefined') {
			_warn('pbasic: input.line needs a Promise environment');
			return;
		}
		var p = global.pbasic || {};
		if (!p.print || !p.screen || typeof p.print.at !== 'function') {
			_warn('pbasic: input.line needs printAt to be loaded');
			return Promise.resolve('');
		}
		if (_activeLine) {
			return Promise.reject(new Error('pbasic: input.line already in progress'));
		}

		var prompt = '';
		var opts;
		if (typeof promptOrOpts === 'string') {
			prompt = promptOrOpts;
			opts   = optsArg || {};
		} else {
			opts   = promptOrOpts || {};
		}
		if (typeof opts.prompt === 'string') { prompt = opts.prompt; }

		var screen = p.screen, print = p.print;

		var atX, atY;
		if (opts.at && typeof opts.at[0] === 'number' && typeof opts.at[1] === 'number') {
			atX = opts.at[0];
			atY = opts.at[1];
		} else {
			atX = 1;
			atY = screen.rows || 24;
		}

		var fieldX   = atX + prompt.length;
		var maxField = (screen.cols || 32) - fieldX + 1;
		var fieldLen = (typeof opts.length === 'number' && opts.length > 0)
			? Math.min(opts.length, maxField)
			: maxField;
		if (fieldLen < 1) { fieldLen = 1; }

		var ink      = opts.ink;
		var paper    = opts.paper;
		var cursorCh = (typeof opts.cursor === 'string' && opts.cursor.length > 0)
			? opts.cursor.charAt(0) : '_';
		var numeric  = !!opts.numeric;

		if (prompt.length > 0) {
			print.at(atX, atY, prompt, ink, paper);
		}

		var buf = '';

		function paint(showCursor) {
			var content = buf;
			if (showCursor && content.length < fieldLen) { content += cursorCh; }
			while (content.length < fieldLen) { content += ' '; }
			print.at(fieldX, atY, content, ink, paper);
		}

		paint(true);

		return new Promise(function (resolve) {
			_activeLine = function (e) {
				var k = e.key;

				if (k === 'Enter') {
					_activeLine = null;
					paint(false);
					if (numeric) {
						if (buf.length === 0) { resolve(0); }
						else {
							var n = Number(buf);
							resolve(isNaN(n) ? 0 : n);
						}
					} else {
						resolve(buf);
					}
					return;
				}

				if (k === 'Backspace') {
					if (buf.length > 0) { buf = buf.slice(0, -1); }
					paint(true);
					return;
				}

				// Printable single-character keys
				if (k && k.length === 1 && buf.length < fieldLen) {
					if (numeric) {
						if (!/^[0-9.\-+eE]$/.test(k)) { return; }
					}
					buf += k;
					paint(true);
				}
			};
		});
	};

	// Clear all held state (useful for tests or after modal dialogs).
	input.reset = function () {
		_held     = {};
		_lastKey  = "";
		_lastCode = "";
	};

	// Common named keys, using event.code values so they work with
	// getkey, onkey, multikeys regardless of keyboard layout.
	// Modifier names ('SHIFT', 'CTRL', 'ALT', 'META') match either side.
	input.keys = {
		UP:        'ArrowUp',
		DOWN:      'ArrowDown',
		LEFT:      'ArrowLeft',
		RIGHT:     'ArrowRight',
		ENTER:     'Enter',
		SPACE:     'Space',
		ESC:       'Escape',
		TAB:       'Tab',
		BACKSPACE: 'Backspace',
		DELETE:    'Delete',
		SHIFT:     'Shift',
		CTRL:      'Control',
		ALT:       'Alt',
		META:      'Meta',

		A: 'KeyA', B: 'KeyB', C: 'KeyC', D: 'KeyD', E: 'KeyE',
		F: 'KeyF', G: 'KeyG', H: 'KeyH', I: 'KeyI', J: 'KeyJ',
		K: 'KeyK', L: 'KeyL', M: 'KeyM', N: 'KeyN', O: 'KeyO',
		P: 'KeyP', Q: 'KeyQ', R: 'KeyR', S: 'KeyS', T: 'KeyT',
		U: 'KeyU', V: 'KeyV', W: 'KeyW', X: 'KeyX', Y: 'KeyY', Z: 'KeyZ',

		N0: 'Digit0', N1: 'Digit1', N2: 'Digit2', N3: 'Digit3', N4: 'Digit4',
		N5: 'Digit5', N6: 'Digit6', N7: 'Digit7', N8: 'Digit8', N9: 'Digit9'
	};

	// --- export ----------------------------------------------------------
	var ns = global.pbasic || (global.pbasic = {});
	ns.input = input;

}(typeof window !== 'undefined' ? window : this));
