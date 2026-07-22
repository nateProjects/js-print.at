/*!
 * pbasic.format v1.0.0
 * BASIC-style RND / INT / STR$ helpers for JavaScript.
 *  - format.rnd([n]) : RND analogue - float in [0,1) with no args (Sinclair/CPC),
 *                       or a random integer 1..n with a positive n (BBC)
 *  - format.int(n)   : INT analogue - floor, not truncate-toward-zero
 *  - format.str(n)   : STR$ analogue - number to string
 * https://github.com/nate2squared/print.At
 *
 * Extends (or creates) the global `pbasic` namespace. Alias locally for
 * BASIC-like terseness:
 *     var format = pbasic.format;
 *
 * Loads independently of printAt / inputKey / dimArray / data - no hard
 * dependency either way.
 */
(function (global) {
	"use strict";

	// format.rnd([n])
	// No args (or n <= 0): Sinclair / Locomotive (Amstrad CPC) BASIC's bare
	// `RND` -- a float in [0, 1), the same range as Math.random().
	// n a positive number: BBC BASIC's `RND(n)` -- a random INTEGER from 1
	// to n inclusive. Sinclair has no bounded RND of its own (a die roll
	// there is `INT (RND*6)+1`); format.rnd(6) is the BBC form instead,
	// borrowed the same way print.fill/repeat borrowed from BBC/CPC.
	//     BASIC:  LET x = RND         (Sinclair/CPC)
	//             LET x = RND(6)      (BBC)
	//     pbasic: var x = format.rnd();
	//             var x = format.rnd(6);
	function rnd(n) {
		if (typeof n === 'number' && n > 0) {
			return Math.floor(Math.random() * Math.floor(n)) + 1;
		}
		return Math.random();
	}

	// format.int(n)
	// BASIC `INT` -- the largest integer not greater than n (floor, not
	// truncate-toward-zero: INT(-2.5) is -3, not -2). Sinclair and BBC
	// both define it this way, and it matches Math.floor exactly. A thin
	// wrapper, but one that keeps a ported `INT(x)` reading as
	// `format.int(x)` line-for-line rather than needing a mental
	// floor-vs-truncate check at every call site.
	//     BASIC:  LET x = INT (y)
	//     pbasic: var x = format.int(y);
	function int(n) {
		return Math.floor(n);
	}

	// format.str(n)
	// BASIC `STR$` -- number-to-string conversion. This uses JavaScript's
	// own Number-to-string rules rather than replicating any dialect's
	// exact ROM floating-point formatting (scientific-notation thresholds,
	// digit precision); faithful for the integer / simple-decimal values a
	// ported program actually prints, not a full float-to-ASCII emulation
	// of the original hardware.
	//     BASIC:  LET a$ = STR$ (n)
	//     pbasic: var a = format.str(n);
	function str(n) {
		return String(n);
	}

	// --- export ----------------------------------------------------------
	var ns = global.pbasic || (global.pbasic = {});
	ns.format = { rnd: rnd, int: int, str: str };

}(typeof window !== 'undefined' ? window : this));
