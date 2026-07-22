/*!
 * pbasic.data v1.0.0
 * BASIC-style DATA / READ / RESTORE for JavaScript.
 *  - data(...)          : DATA statement    - append values to the shared pool
 *  - data.read([n])     : READ statement    - pull the next value (or n values as an array), advancing the cursor
 *  - data.restore([i])  : RESTORE statement - reset the read cursor to the start, or to a specific index
 *  - data.remaining()   : count of unread values left in the pool (not a BASIC statement - a JS convenience)
 * https://github.com/nate2squared/print.At
 *
 * Extends (or creates) the global `pbasic` namespace. Alias locally for
 * BASIC-like terseness:
 *     var data = pbasic.data;
 *
 * Loads independently of printAt / inputKey / dimArray - no hard dependency
 * either way.
 */
(function (global) {
	"use strict";

	function _warn(msg) {
		if (typeof console !== 'undefined' && console.warn) { console.warn(msg); }
	}

	var _pool = [];
	var _cursor = 0;

	// data(...)
	// DATA statement analogue: appends every argument to the shared pool,
	// in call order. Values keep whatever type they're given (numbers,
	// strings, ...) -- BASIC's DATA doesn't distinguish types until READ
	// assigns them to a typed variable, and neither does this.
	//     BASIC:  DATA 1, 2, 3, "hello"
	//     pbasic: data(1, 2, 3, "hello");
	function data() {
		for (var i = 0; i < arguments.length; i++) {
			_pool.push(arguments[i]);
		}
	}

	// data.read([n])
	// READ statement analogue: returns the next value from the pool and
	// advances the cursor. With a count, returns that many values as an
	// array in one call -- BASIC's `READ a, b, c` reads three values in a
	// single statement; JS has no equivalent multi-variable assignment, so
	// `data.read(3)` is the closest single-call analogue.
	// Warns and returns undefined (n omitted) or as many values as were
	// left (n given) if the pool runs out. Real BASIC's "Out of DATA" is a
	// runtime error; here it's a warning, consistent with how the rest of
	// this library degrades rather than throws.
	//     BASIC:  READ a
	//             READ a, b, c
	//     pbasic: var a = data.read();
	//             var abc = data.read(3);   // [a, b, c]
	data.read = function (n) {
		if (typeof n === 'number') {
			var out = [];
			for (var i = 0; i < n; i++) {
				if (_cursor >= _pool.length) {
					_warn('pbasic: data.read() out of DATA');
					break;
				}
				out.push(_pool[_cursor++]);
			}
			return out;
		}
		if (_cursor >= _pool.length) {
			_warn('pbasic: data.read() out of DATA');
			return undefined;
		}
		return _pool[_cursor++];
	};

	// data.restore([index])
	// RESTORE statement analogue: resets the read cursor to the start of
	// the pool (no args), or to a specific absolute position -- the
	// nearest analogue to BASIC's `RESTORE line`, which real line numbers
	// made possible and this doesn't have.
	//     BASIC:  RESTORE
	//     pbasic: data.restore();
	data.restore = function (index) {
		_cursor = (typeof index === 'number' && index >= 0) ? index : 0;
	};

	// data.remaining()
	// Count of unread values left in the pool. Not a BASIC statement --
	// real BASIC has no built-in "is there more DATA" check -- but useful
	// enough in a JS port (`while (data.remaining()) { ... }`) to include.
	data.remaining = function () {
		return _pool.length - _cursor;
	};

	// --- export ----------------------------------------------------------
	var ns = global.pbasic || (global.pbasic = {});
	ns.data = data;

}(typeof window !== 'undefined' ? window : this));
