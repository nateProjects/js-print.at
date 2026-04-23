/*!
 * inputKey v0.9.0
 * BASIC-style keyboard input for JavaScript.
 *  - input.inkey()      : INKEY$ analogue - character of key currently held, or ""
 *  - input.getkey()     : GetKey analogue - returns a Promise (or takes a callback)
 *                         that resolves on the next key press
 *  - input.multikeys()  : MultiKeys analogue - snapshot of which keys are held
 *  - input.keys         : named constants for common keys
 * https://github.com/nate2squared/print.At
 *
 * Extends (or creates) the global `pbasic` namespace. Alias locally for
 * BASIC-like terseness:
 *     var input = pbasic.input;
 *
 * Loads independently of print.At - no hard dependency either way, so they
 * can be loaded together or separately.
 */
(function (global) {
	"use strict";

	// --- private state ---------------------------------------------------
	var _attached     = false;
	var _held         = {};   // map of event.code -> true while held
	var _lastKey      = "";   // event.key of the most recent keydown
	var _lastCode     = "";   // event.code of the most recent keydown
	var _pendingGet   = [];   // list of {resolve} for getkey() callers

	// --- listeners -------------------------------------------------------
	function _onKeyDown(e) {
		_held[e.code] = true;
		_lastKey  = e.key;
		_lastCode = e.code;

		if (_pendingGet.length > 0) {
			var waiting = _pendingGet;
			_pendingGet = [];
			var payload = { key: e.key, code: e.code };
			for (var i = 0; i < waiting.length; i++) {
				try { waiting[i](payload); } catch (err) { _warn(err); }
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

	function _warn(msg) {
		if (typeof console !== 'undefined' && console.warn) { console.warn(msg); }
	}

	function _attach() {
		if (_attached) { return; }
		if (typeof window === 'undefined') { return; }
		window.addEventListener('keydown', _onKeyDown, false);
		window.addEventListener('keyup',   _onKeyUp,   false);
		window.addEventListener('blur',    _onBlur,    false);
		_attached = true;
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
	// Character-flavoured (matches the original BASIC INKEY$ returning
	// a single character string).
	input.inkey = function () {
		_attach();
		if (_lastCode && _held[_lastCode]) { return _lastKey; }
		return "";
	};

	// GetKey analogue. Waits for the next key press.
	// With no args, returns a Promise that resolves to { key, code }.
	// With a callback, fires the callback once on next keydown.
	//     input.getkey().then(function (k) { ... });           // promise form
	//     input.getkey(function (k) { ... });                   // callback form
	// Layout-independent (reports event.code, e.g. "KeyA", "Space").
	input.getkey = function (callback) {
		_attach();
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
	// With no args, returns an array of event.code strings for every
	// key currently held.
	// With one or more code arguments, returns an object:
	//   {
	//     mask:  bitmask - bit N set if the Nth argument is held,
	//     any:   true if any of the named keys are held,
	//     all:   true if all of the named keys are held,
	//     <code>: boolean - per-key held state
	//   }
	// Uses event.code values (e.g. "KeyA", "ArrowUp", "Space"), which
	// are layout-independent. Modifier aliases 'Shift'/'Control'/'Alt'/
	// 'Meta' match either left or right.
	input.multikeys = function () {
		_attach();
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
		// If zero args were "all held", all would still be true - but we
		// handled the no-args case above, so arguments.length >= 1 here.
		return result;
	};

	// Clear all held state (useful for tests or after modal dialogs).
	input.reset = function () {
		_held     = {};
		_lastKey  = "";
		_lastCode = "";
	};

	// Common named keys, using event.code values so they work with
	// getkey and multikeys regardless of keyboard layout.
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
