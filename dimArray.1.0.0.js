/*!
 * dimArray v1.0.0
 * BASIC-style DIM arrays for JavaScript.
 *  - pbasic.dim(dims, [opts])        : numeric array,  DIM A(N), A(M,N), ...
 *  - pbasic.dimString(dims, [opts])  : fixed-length string array,
 *                                      DIM A$(N) / A$(M,N) / A$(L,M,N) ...
 * https://github.com/nate2squared/print.At
 *
 * Both flavours are 1-indexed - A(1)..A(N) is the valid range, matching
 * ZX Spectrum BASIC and print.at's 1-indexed cell coords. Out-of-range or
 * non-integer subscripts throw, so off-by-one bugs surface immediately
 * rather than silently writing into a phantom slot.
 *
 * Strings are Procrustean: assigning to A$(n) pads with spaces up to the
 * declared length or truncates if the value is too long. Slice assignment
 * A$(n)(from TO to) follows the same rule for the slice range.
 *
 * Extends (or creates) the global `pbasic` namespace. Alias locally for
 * BASIC-like terseness:
 *     var dim = pbasic.dim, dimString = pbasic.dimString;
 *
 * Loads independently of print.At - no hard dependency either way.
 *
 * 1.0 additions:
 *  - .fill(value), .forEach(fn), .copy() on both numeric and string dims
 *  - dim(dims, {fill, type}) - initial fill + typed clamping
 *    (UBYTE / BYTE / UINT / INT / ULONG / LONG; FLOAT/no-type unbounded)
 *    Out-of-range writes throw, matching the BASIC 'AS UBYTE' contract.
 *  - dimString(dims, {fill}) - initial fill for every string slot
 *  - varargs form on dimString.set / dimString.get
 *      AS.set([2, 7], 'Q')     <-> AS.set(2, 7, 'Q')
 *      AS.get([2, [4, 8]])     <-> AS.get(2, [4, 8])
 *    (Note: a single-string slice S$(3 TO 5) must use the array form
 *     S.get([[3, 5]]) - in varargs the bare [3, 5] is ambiguous with
 *     "array form with two subscripts" so the array form wins.)
 */
(function (global) {
	"use strict";

	function _err(msg) { throw new Error('pbasic: ' + msg); }

	function _isArray(x) {
		return Object.prototype.toString.call(x) === '[object Array]';
	}

	function _repeat(ch, n) {
		var s = '';
		for (var i = 0; i < n; i++) { s += ch; }
		return s;
	}

	// Procrustean fit: pad with spaces or truncate to exactly `n` chars.
	function _fit(value, n) {
		if (typeof value !== 'string') { value = String(value); }
		if (value.length >= n) { return value.slice(0, n); }
		return value + _repeat(' ', n - value.length);
	}

	function _validateDims(dims, label) {
		if (!_isArray(dims) || dims.length < 1) {
			_err(label + ' needs at least one dimension');
		}
		for (var i = 0; i < dims.length; i++) {
			var n = dims[i];
			if (typeof n !== 'number' || (n | 0) !== n || n < 1) {
				_err(label + ' dimensions must be positive integers (got ' +
				     n + ' at position ' + i + ')');
			}
		}
	}

	function _checkSubscript(idx, max, label) {
		if (typeof idx !== 'number' || (idx | 0) !== idx) {
			_err('subscript ' + label + ' must be an integer (got ' + idx + ')');
		}
		if (idx < 1 || idx > max) {
			_err('subscript ' + label + ' = ' + idx +
			     ' out of range (1..' + max + ')');
		}
	}

	// Numeric type ranges (BASIC-flavoured names). FLOAT / undefined = unbounded.
	var _typeRanges = {
		UBYTE: [0,           255],
		BYTE:  [-128,        127],
		UINT:  [0,           65535],
		INT:   [-32768,      32767],
		ULONG: [0,           4294967295],
		LONG:  [-2147483648, 2147483647],
		FLOAT: null
	};

	function _resolveType(type) {
		if (typeof type === 'undefined' || type === null) { return null; }
		if (typeof type !== 'string') {
			_err('type must be a string (UBYTE / BYTE / UINT / INT / ULONG / LONG / FLOAT)');
		}
		var key = type.toUpperCase();
		if (!Object.prototype.hasOwnProperty.call(_typeRanges, key)) {
			_err('unknown type "' + type + '" (try UBYTE, BYTE, UINT, INT, ULONG, LONG, FLOAT)');
		}
		return _typeRanges[key]; // either [min, max] or null
	}

	// --- numeric DIM ----------------------------------------------------
	function _buildNumeric(d, fillValue) {
		var size = d[0] + 1;
		if (d.length === 1) {
			var a = new Array(size);
			for (var i = 0; i < size; i++) { a[i] = fillValue; }
			return a;
		}
		var rest = d.slice(1);
		var arr = new Array(size);
		for (var j = 0; j < size; j++) { arr[j] = _buildNumeric(rest, fillValue); }
		return arr;
	}

	function dim(dims, opts) {
		_validateDims(dims, 'dim');
		opts = opts || {};
		var copy   = dims.slice();
		var range  = _resolveType(opts.type);
		var typeNm = opts.type ? String(opts.type).toUpperCase() : null;

		function _checkValue(v) {
			if (typeof v !== 'number') {
				_err('numeric dim accepts numbers only (got ' + typeof v + ')');
			}
			if (range !== null) {
				if ((v | 0) !== v) {
					_err('type ' + typeNm + ' requires an integer (got ' + v + ')');
				}
				if (v < range[0] || v > range[1]) {
					_err('value ' + v + ' out of range for ' + typeNm +
					     ' (' + range[0] + '..' + range[1] + ')');
				}
			}
		}

		var fillValue = (typeof opts.fill === 'number') ? opts.fill : 0;
		if (typeof opts.fill !== 'undefined') { _checkValue(fillValue); }

		var raw = _buildNumeric(copy, fillValue);

		function _navigate(subs) {
			if (!_isArray(subs) || subs.length !== copy.length) {
				_err('dim(' + copy.join(',') + ') needs ' + copy.length +
				     ' subscript(s), got ' +
				     (_isArray(subs) ? subs.length : typeof subs));
			}
			var node = raw;
			for (var i = 0; i < subs.length - 1; i++) {
				_checkSubscript(subs[i], copy[i], 'dim ' + (i + 1));
				node = node[subs[i]];
			}
			_checkSubscript(subs[subs.length - 1], copy[copy.length - 1],
			                'dim ' + subs.length);
			return node;
		}

		// Both forms supported, to keep BASIC ports terse:
		//     A.get([5])       A.set([5], 42)        (array form, original)
		//     A.get(5)         A.set(5, 42)          (varargs form, 1.1+)
		//     B.get([2, 4])    B.set([2, 4], 99)
		//     B.get(2, 4)      B.set(2, 4, 99)
		function _subsFromGetArgs(args) {
			if (args.length === 1 && _isArray(args[0])) { return args[0]; }
			return Array.prototype.slice.call(args);
		}

		function _subsValueFromSetArgs(args) {
			if (args.length === 0) {
				_err('numeric dim set needs subscripts and a value');
			}
			if (args.length >= 2 && _isArray(args[0])) {
				return { subs: args[0], value: args[1] };
			}
			if (args.length < 2) {
				_err('numeric dim set needs subscripts and a value');
			}
			return {
				subs:  Array.prototype.slice.call(args, 0, args.length - 1),
				value: args[args.length - 1]
			};
		}

		function _walk(callback, partial, depth) {
			if (depth === copy.length) {
				callback(partial.slice());
				return;
			}
			for (var i = 1; i <= copy[depth]; i++) {
				partial.push(i);
				_walk(callback, partial, depth + 1);
				partial.pop();
			}
		}

		var api = {
			dims: copy.slice(),       // defensive copy
			raw:  raw,                // 1-indexed; index 0 unused
			type: typeNm,             // null if untyped

			get: function () {
				var subs = _subsFromGetArgs(arguments);
				var node = _navigate(subs);
				return node[subs[subs.length - 1]];
			},

			set: function () {
				var p = _subsValueFromSetArgs(arguments);
				_checkValue(p.value);
				var node = _navigate(p.subs);
				node[p.subs[p.subs.length - 1]] = p.value;
				return p.value;
			},

			// Set every cell to `value`. Respects the declared type.
			fill: function (value) {
				if (typeof value === 'undefined') { value = 0; }
				_checkValue(value);
				_walk(function (subs) {
					var node = raw;
					for (var i = 0; i < subs.length - 1; i++) {
						node = node[subs[i]];
					}
					node[subs[subs.length - 1]] = value;
				}, [], 0);
			},

			// Iterate every cell in subscript order. Callback receives
			// (value, subs) where subs is a fresh array of the 1-indexed
			// coordinates of that cell.
			forEach: function (fn) {
				if (typeof fn !== 'function') {
					_err('forEach needs a function');
				}
				_walk(function (subs) {
					var node = raw;
					for (var i = 0; i < subs.length - 1; i++) {
						node = node[subs[i]];
					}
					fn(node[subs[subs.length - 1]], subs);
				}, [], 0);
			},

			// Return a new dim with the same shape, type, and current values.
			copy: function () {
				var clone = dim(copy, { type: opts.type });
				api.forEach(function (v, subs) {
					clone.set(subs, v);
				});
				return clone;
			}
		};

		return api;
	}

	// --- string DIM -----------------------------------------------------
	// dims is the BASIC subscript list, e.g.:
	//   [10]       -> DIM A$(10)        single fixed string of length 10
	//   [5, 10]    -> DIM A$(5,10)      array of 5 strings, each 10 chars
	//   [3, 5, 10] -> DIM A$(3,5,10)    3x5 grid of 10-char strings
	// The LAST entry is always the string length, matching Spectrum BASIC.
	function dimString(dims, opts) {
		_validateDims(dims, 'dimString');
		opts = opts || {};
		var copy      = dims.slice();
		var length    = copy[copy.length - 1];
		var arrayDims = copy.slice(0, -1);     // leading subscripts (may be [])
		var blank     = _repeat(' ', length);

		var fillValue = (typeof opts.fill === 'string')
			? _fit(opts.fill, length) : blank;

		function _build(d) {
			if (d.length === 0) { return fillValue; }
			var size = d[0] + 1;
			var rest = d.slice(1);
			var arr  = new Array(size);
			for (var i = 0; i < size; i++) { arr[i] = _build(rest); }
			return arr;
		}

		// Single-string case still needs to be assignable as a value, so
		// wrap storage in a one-cell holder regardless of dimensionality.
		var holder = { value: _build(arrayDims) };

		// Walk to the parent of the string slot. Returns [parentObject, key]
		// so the caller can read or write the string by reference.
		function _resolveSlot(arrSubs) {
			if (arrayDims.length === 0) {
				if (arrSubs.length !== 0) {
					_err('dimString(' + copy.join(',') +
					     ') is a single string - no array subscripts allowed');
				}
				return [holder, 'value'];
			}
			if (arrSubs.length !== arrayDims.length) {
				_err('dimString(' + copy.join(',') + ') needs ' +
				     arrayDims.length + ' array subscript(s), got ' +
				     arrSubs.length);
			}
			var node = holder.value;
			for (var i = 0; i < arrSubs.length - 1; i++) {
				_checkSubscript(arrSubs[i], arrayDims[i], 'dim ' + (i + 1));
				node = node[arrSubs[i]];
			}
			var lastIdx = arrSubs[arrSubs.length - 1];
			_checkSubscript(lastIdx, arrayDims[arrayDims.length - 1],
			                'dim ' + arrSubs.length);
			return [node, lastIdx];
		}

		function _readWhole(arrSubs) {
			var slot = _resolveSlot(arrSubs);
			return slot[0][slot[1]];
		}

		function _writeWhole(arrSubs, value) {
			var slot = _resolveSlot(arrSubs);
			slot[0][slot[1]] = _fit(value, length);
		}

		// Split user-supplied subscripts into the array-addressing prefix
		// and an optional final char/slice subscript:
		//   AS.get([2])           -> arrSubs=[2], char=undef       (whole)
		//   AS.get([2, 7])        -> arrSubs=[2], char=7           (single char)
		//   AS.get([2, [4,8]])    -> arrSubs=[2], char=[4,8]       (slice)
		//   For a single string DIM A$(n):
		//   S.get([])             -> whole
		//   S.get([7])            -> char 7
		//   S.get([[4,8]])        -> slice 4 TO 8
		function _parse(subs) {
			if (!_isArray(subs)) {
				_err('subscripts must be supplied as an array (got ' +
				     typeof subs + ')');
			}
			var maxLen = arrayDims.length + 1;
			if (subs.length > maxLen) {
				_err('dimString(' + copy.join(',') + ') accepts at most ' +
				     maxLen + ' subscript(s), got ' + subs.length);
			}
			var arrSubs = subs.slice(0, arrayDims.length);
			var charSub = (subs.length > arrayDims.length)
				? subs[arrayDims.length] : undefined;
			return { arrSubs: arrSubs, charSub: charSub };
		}

		function _checkSlice(range) {
			if (range.length !== 2) {
				_err('slice subscript must be [from, to]');
			}
			_checkSubscript(range[0], length, 'slice from');
			_checkSubscript(range[1], length, 'slice to');
			if (range[1] < range[0]) {
				_err('slice ' + range[0] + ' TO ' + range[1] +
				     ' is empty/reversed');
			}
		}

		// dimString varargs disambiguation:
		// - Array form (existing): single array arg = the full subs list.
		// - Varargs form (new): positional args, where the FINAL arg may
		//   itself be a [from,to] slice array. The presence of more than
		//   one positional arg disambiguates.
		// - Caveat: for a single-string DIM A$(n), a slice expressed as
		//   `S.get([3, 5])` collides with the array-form rule (one array
		//   arg = subs list). Use `S.get([[3, 5]])` for that case.
		function _subsFromGetArgs(args) {
			if (args.length === 1 && _isArray(args[0])) { return args[0]; }
			return Array.prototype.slice.call(args);
		}

		function _subsValueFromSetArgs(args) {
			if (args.length === 0) {
				_err('dimString set needs a value');
			}
			if (args.length === 1) {
				// AS.set('hello') for a single-string DIM
				return { subs: [], value: args[0] };
			}
			if (args.length === 2 && _isArray(args[0])) {
				return { subs: args[0], value: args[1] };
			}
			return {
				subs:  Array.prototype.slice.call(args, 0, args.length - 1),
				value: args[args.length - 1]
			};
		}

		function get() {
			var subs = _subsFromGetArgs(arguments);
			var p = _parse(subs);
			var whole = _readWhole(p.arrSubs);
			if (typeof p.charSub === 'undefined') { return whole; }
			if (_isArray(p.charSub)) {
				_checkSlice(p.charSub);
				return whole.slice(p.charSub[0] - 1, p.charSub[1]);
			}
			_checkSubscript(p.charSub, length, 'char');
			return whole.charAt(p.charSub - 1);
		}

		function set() {
			var sv = _subsValueFromSetArgs(arguments);
			var p = _parse(sv.subs);
			var value = sv.value;
			if (typeof value !== 'string') { value = String(value); }
			if (typeof p.charSub === 'undefined') {
				_writeWhole(p.arrSubs, value);
				return _readWhole(p.arrSubs);
			}
			var whole = _readWhole(p.arrSubs);
			if (_isArray(p.charSub)) {
				_checkSlice(p.charSub);
				var from = p.charSub[0], to = p.charSub[1];
				var sliceLen = to - from + 1;
				whole = whole.slice(0, from - 1) +
				        _fit(value, sliceLen) +
				        whole.slice(to);
			} else {
				_checkSubscript(p.charSub, length, 'char');
				var ch = value.length > 0 ? value.charAt(0) : ' ';
				whole = whole.slice(0, p.charSub - 1) + ch +
				        whole.slice(p.charSub);
			}
			_writeWhole(p.arrSubs, whole);
			return _readWhole(p.arrSubs);
		}

		function _walk(callback, partial, depth) {
			if (depth === arrayDims.length) {
				callback(partial.slice());
				return;
			}
			for (var i = 1; i <= arrayDims[depth]; i++) {
				partial.push(i);
				_walk(callback, partial, depth + 1);
				partial.pop();
			}
		}

		var api = {
			dims:   copy.slice(),
			length: length,           // declared char length per string

			get:    get,
			set:    set,

			// Set every string slot to `value` (Procrustean-fit).
			fill: function (value) {
				if (typeof value === 'undefined') { value = ''; }
				if (typeof value !== 'string') { value = String(value); }
				if (arrayDims.length === 0) {
					_writeWhole([], value);
					return;
				}
				_walk(function (subs) { _writeWhole(subs, value); }, [], 0);
			},

			// Iterate every string slot in subscript order. Callback
			// receives (stringValue, subs). For a single-string DIM the
			// callback is invoked once with subs=[].
			forEach: function (fn) {
				if (typeof fn !== 'function') {
					_err('forEach needs a function');
				}
				if (arrayDims.length === 0) {
					fn(_readWhole([]), []);
					return;
				}
				_walk(function (subs) {
					fn(_readWhole(subs), subs);
				}, [], 0);
			},

			// Return a new dimString with the same shape and current values.
			copy: function () {
				var clone = dimString(copy);
				api.forEach(function (str, subs) {
					clone.set(subs, str);
				});
				return clone;
			}
		};

		return api;
	}

	// --- export ----------------------------------------------------------
	var ns = global.pbasic || (global.pbasic = {});
	ns.dim       = dim;
	ns.dimString = dimString;

}(typeof window !== 'undefined' ? window : this));
