/*!
 * dimArray v0.9.0
 * BASIC-style DIM arrays for JavaScript.
 *  - pbasic.dim(dims)        : numeric array, DIM A(N), A(M,N), ...
 *  - pbasic.dimString(dims)  : fixed-length string array,
 *                              DIM A$(N) / A$(M,N) / A$(L,M,N) ...
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

	// --- numeric DIM ----------------------------------------------------
	// Storage allocates size+1 in each dim; index 0 is reserved (unused)
	// so that user-facing subscripts can be 1-indexed without arithmetic.
	function _buildNumeric(d) {
		var size = d[0] + 1;
		if (d.length === 1) {
			var a = new Array(size);
			for (var i = 0; i < size; i++) { a[i] = 0; }
			return a;
		}
		var rest = d.slice(1);
		var arr = new Array(size);
		for (var j = 0; j < size; j++) { arr[j] = _buildNumeric(rest); }
		return arr;
	}

	function dim(dims) {
		_validateDims(dims, 'dim');
		var copy = dims.slice();
		var raw  = _buildNumeric(copy);

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
		//     A.get(5)         A.set(5, 42)          (varargs form, new)
		//     B.get([2, 4])    B.set([2, 4], 99)
		//     B.get(2, 4)      B.set(2, 4, 99)
		// The varargs form mirrors BASIC's LET A(5) = 42 and LET B(2,4) = 99
		// almost character-for-character. The array form remains for code
		// that builds subscripts programmatically.
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

		return {
			dims: copy.slice(),       // defensive copy
			raw:  raw,                // 1-indexed; index 0 unused
			get: function () {
				var subs = _subsFromGetArgs(arguments);
				var node = _navigate(subs);
				return node[subs[subs.length - 1]];
			},
			set: function () {
				var p = _subsValueFromSetArgs(arguments);
				if (typeof p.value !== 'number') {
					_err('numeric dim accepts numbers only (got ' +
					     typeof p.value + ')');
				}
				var node = _navigate(p.subs);
				node[p.subs[p.subs.length - 1]] = p.value;
				return p.value;
			}
		};
	}

	// --- string DIM -----------------------------------------------------
	// dims is the BASIC subscript list, e.g.:
	//   [10]       -> DIM A$(10)        single fixed string of length 10
	//   [5, 10]    -> DIM A$(5,10)      array of 5 strings, each 10 chars
	//   [3, 5, 10] -> DIM A$(3,5,10)    3x5 grid of 10-char strings
	// The LAST entry is always the string length, matching Spectrum BASIC.
	function dimString(dims) {
		_validateDims(dims, 'dimString');
		var copy      = dims.slice();
		var length    = copy[copy.length - 1];
		var arrayDims = copy.slice(0, -1);     // leading subscripts (may be [])
		var blank     = _repeat(' ', length);

		function _build(d) {
			if (d.length === 0) { return blank; }
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

		function get(subs) {
			var p = _parse(subs || []);
			var whole = _readWhole(p.arrSubs);
			if (typeof p.charSub === 'undefined') { return whole; }
			if (_isArray(p.charSub)) {
				_checkSlice(p.charSub);
				return whole.slice(p.charSub[0] - 1, p.charSub[1]);
			}
			_checkSubscript(p.charSub, length, 'char');
			return whole.charAt(p.charSub - 1);
		}

		function set(subs, value) {
			var p = _parse(subs || []);
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

		return {
			dims:   copy.slice(),
			length: length,           // declared char length per string
			get:    get,
			set:    set
		};
	}

	// --- export ----------------------------------------------------------
	var ns = global.pbasic || (global.pbasic = {});
	ns.dim       = dim;
	ns.dimString = dimString;

}(typeof window !== 'undefined' ? window : this));
