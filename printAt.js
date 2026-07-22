/*!
 * print.At v1.7.0
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
	//                 colors:      [css strings indexed by color number],
	//                 defaults:    { ink, paper },
	//                 resolution:  { width, height, cols, rows }        // optional, the default mode
	//                 resolutions: { modeName: { width, height, cols, rows }, ... }  // optional, named modes
	//                 font:        name of a _bitmapFonts entry             // optional
	//               }
	// `resolutions` is for machines that had more than one real video mode
	// (BBC MODE 0-7, CGA's 40/80-column text, CPC MODE 0-2); pick one via
	// screen.size(paletteName, modeName). `resolution` alone still works
	// via screen.size(paletteName) for machines with just the one mode.
	// `font`, if present, is applied automatically by screen.palette() --
	// selecting a palette also selects its machine's own bitmap font, the
	// same way it already selects that machine's default ink/paper.
	var palettes = {
		spectrum: {
			name: 'ZX Spectrum',
			colors: ['#000000', '#0000FF', '#FF0000', '#FF00FF',
			         '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF'],
			defaults:   { ink: 0, paper: 7 },
			resolution: { width: 256, height: 192, cols: 32, rows: 24 },
			font:       'spectrum'
		},
		c64: {
			name: 'Commodore 64',
			colors: ['#000000', '#FFFFFF', '#9F4E44', '#6ABFC6',
			         '#A057A3', '#5CAB5E', '#50459B', '#C9D487',
			         '#A1683C', '#6D5412', '#CB7E75', '#626262',
			         '#898989', '#9AE29B', '#887ECB', '#ADADAD'],
			defaults:   { ink: 14, paper: 6 },
			resolution: { width: 320, height: 200, cols: 40, rows: 25 },
			font:       'c64'
		},
		cga: {
			name: 'CGA',
			colors: ['#000000', '#0000AA', '#00AA00', '#00AAAA',
			         '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
			         '#555555', '#5555FF', '#55FF55', '#55FFFF',
			         '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF'],
			defaults:   { ink: 7, paper: 0 },
			// CGA's two text modes: 80-column (640x200, the default here)
			// and 40-column (320x200) -- same vertical resolution, double
			// the pixels per character horizontally in 80-column mode.
			resolution: { width: 640, height: 200, cols: 80, rows: 25 },
			resolutions: {
				hires: { width: 640, height: 200, cols: 80, rows: 25 }, // 80-column text
				lores: { width: 320, height: 200, cols: 40, rows: 25 }  // 40-column text
			},
			font: 'cga'
		},
		bbc: {
			name: 'BBC Micro',
			colors: ['#000000', '#FF0000', '#00FF00', '#FFFF00',
			         '#0000FF', '#FF00FF', '#00FFFF', '#FFFFFF'],
			defaults:   { ink: 7, paper: 0 },
			// BBC MODEs: 0 (80x32 text, the default here), 1 (40x32),
			// 2 (20x32), 7 (Teletext, 40x25 -- the BBC's iconic mode).
			resolution: { width: 640, height: 256, cols: 80, rows: 32 },
			resolutions: {
				mode0: { width: 640, height: 256, cols: 80, rows: 32 },
				mode1: { width: 320, height: 256, cols: 40, rows: 32 },
				mode2: { width: 160, height: 256, cols: 20, rows: 32 },
				mode7: { width: 480, height: 250, cols: 40, rows: 25 }
			}
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
			// CPC MODEs: 0 (20x25 text, 16 colours), 1 (40x25, the default
			// here, 4 colours), 2 (80x25, 2 colours) -- same vertical
			// resolution throughout, more/narrower columns per mode.
			resolution: { width: 320, height: 200, cols: 40, rows: 25 },
			resolutions: {
				mode0: { width: 160, height: 200, cols: 20, rows: 25 },
				mode1: { width: 320, height: 200, cols: 40, rows: 25 },
				mode2: { width: 640, height: 200, cols: 80, rows: 25 }
			}
		}
	};

	// --- bundled bitmap fonts (1.6) ---------------------------------------
	// True 8x8 pixel ROM fonts for screen.bitmapFont(), so text is a real
	// bitmap instead of the canvas's own font rendering -- especially
	// crisp at screen.scale(1), one source pixel per device pixel.
	// Each row is 8 bytes, MSB = leftmost pixel (the same convention as
	// screen.glyph). Row index 0 is character code `startCode`.
	//
	// spectrum: the ZX Spectrum ROM character set, codes 0x20-0x7F
	// (space through the "(c)" copyright glyph), extracted from the
	// character table at ROM address 3D00 (skoolkid.github.io/rom, a
	// public disassembly of the Spectrum ROM) and verified against the
	// font's well-known "slashed zero" at code 0x30.
	var _spectrumFontRows = [
		[0,0,0,0,0,0,0,0],         // 0x20 space
		[0,16,16,16,16,0,16,0],    // 0x21 !
		[0,36,36,0,0,0,0,0],       // 0x22 "
		[0,36,126,36,36,126,36,0], // 0x23 #
		[0,8,62,40,62,10,62,8],    // 0x24 $
		[0,98,100,8,16,38,70,0],   // 0x25 %
		[0,16,40,16,42,68,58,0],   // 0x26 &
		[0,8,16,0,0,0,0,0],        // 0x27 '
		[0,4,8,8,8,8,4,0],         // 0x28 (
		[0,32,16,16,16,16,32,0],   // 0x29 )
		[0,0,20,8,62,8,20,0],      // 0x2A *
		[0,0,8,8,62,8,8,0],        // 0x2B +
		[0,0,0,0,0,8,8,16],        // 0x2C ,
		[0,0,0,0,62,0,0,0],        // 0x2D -
		[0,0,0,0,0,24,24,0],       // 0x2E .
		[0,0,2,4,8,16,32,0],       // 0x2F /
		[0,60,70,74,82,98,60,0],   // 0x30 0
		[0,24,40,8,8,8,62,0],      // 0x31 1
		[0,60,66,2,60,64,126,0],   // 0x32 2
		[0,60,66,12,2,66,60,0],    // 0x33 3
		[0,8,24,40,72,126,8,0],    // 0x34 4
		[0,126,64,124,2,66,60,0],  // 0x35 5
		[0,60,64,124,66,66,60,0],  // 0x36 6
		[0,126,2,4,8,16,16,0],     // 0x37 7
		[0,60,66,60,66,66,60,0],   // 0x38 8
		[0,60,66,66,62,2,60,0],    // 0x39 9
		[0,0,0,16,0,0,16,0],       // 0x3A :
		[0,0,16,0,0,16,16,32],     // 0x3B ;
		[0,0,4,8,16,8,4,0],        // 0x3C <
		[0,0,0,62,0,62,0,0],       // 0x3D =
		[0,0,16,8,4,8,16,0],       // 0x3E >
		[0,60,66,4,8,0,8,0],       // 0x3F ?
		[0,60,74,86,94,64,60,0],   // 0x40 @
		[0,60,66,66,126,66,66,0],  // 0x41 A
		[0,124,66,124,66,66,124,0], // 0x42 B
		[0,60,66,64,64,66,60,0],   // 0x43 C
		[0,120,68,66,66,68,120,0], // 0x44 D
		[0,126,64,124,64,64,126,0], // 0x45 E
		[0,126,64,124,64,64,64,0], // 0x46 F
		[0,60,66,64,78,66,60,0],   // 0x47 G
		[0,66,66,126,66,66,66,0],  // 0x48 H
		[0,62,8,8,8,8,62,0],       // 0x49 I
		[0,2,2,2,66,66,60,0],      // 0x4A J
		[0,68,72,112,72,68,66,0],  // 0x4B K
		[0,64,64,64,64,64,126,0],  // 0x4C L
		[0,66,102,90,66,66,66,0],  // 0x4D M
		[0,66,98,82,74,70,66,0],   // 0x4E N
		[0,60,66,66,66,66,60,0],   // 0x4F O
		[0,124,66,66,124,64,64,0], // 0x50 P
		[0,60,66,66,82,74,60,0],   // 0x51 Q
		[0,124,66,66,124,68,66,0], // 0x52 R
		[0,60,64,60,2,66,60,0],    // 0x53 S
		[0,254,16,16,16,16,16,0],  // 0x54 T
		[0,66,66,66,66,66,60,0],   // 0x55 U
		[0,66,66,66,66,36,24,0],   // 0x56 V
		[0,66,66,66,66,90,36,0],   // 0x57 W
		[0,66,36,24,24,36,66,0],   // 0x58 X
		[0,130,68,40,16,16,16,0],  // 0x59 Y
		[0,126,4,8,16,32,126,0],   // 0x5A Z
		[0,14,8,8,8,8,14,0],       // 0x5B [
		[0,0,64,32,16,8,4,0],      // 0x5C backslash
		[0,112,16,16,16,16,112,0], // 0x5D ]
		[0,16,56,84,16,16,16,0],   // 0x5E ^
		[0,0,0,0,0,0,0,255],       // 0x5F _
		[0,28,34,120,32,32,126,0], // 0x60 `
		[0,0,56,4,60,68,60,0],     // 0x61 a
		[0,32,32,60,34,34,60,0],   // 0x62 b
		[0,0,28,32,32,32,28,0],    // 0x63 c
		[0,4,4,60,68,68,60,0],     // 0x64 d
		[0,0,56,68,120,64,60,0],   // 0x65 e
		[0,12,16,24,16,16,16,0],   // 0x66 f
		[0,0,60,68,68,60,4,56],    // 0x67 g
		[0,64,64,120,68,68,68,0],  // 0x68 h
		[0,16,0,48,16,16,56,0],    // 0x69 i
		[0,4,0,4,4,4,36,24],       // 0x6A j
		[0,32,40,48,48,40,36,0],   // 0x6B k
		[0,16,16,16,16,16,12,0],   // 0x6C l
		[0,0,104,84,84,84,84,0],   // 0x6D m
		[0,0,120,68,68,68,68,0],   // 0x6E n
		[0,0,56,68,68,68,56,0],    // 0x6F o
		[0,0,120,68,68,120,64,64], // 0x70 p
		[0,0,60,68,68,60,4,6],     // 0x71 q
		[0,0,28,32,32,32,32,0],    // 0x72 r
		[0,0,56,64,56,4,120,0],    // 0x73 s
		[0,16,56,16,16,16,12,0],   // 0x74 t
		[0,0,68,68,68,68,56,0],    // 0x75 u
		[0,0,68,68,40,40,16,0],    // 0x76 v
		[0,0,68,84,84,84,40,0],    // 0x77 w
		[0,0,68,40,16,40,68,0],    // 0x78 x
		[0,0,68,68,68,60,4,56],    // 0x79 y
		[0,0,124,8,16,32,124,0],   // 0x7A z
		[0,14,8,48,8,8,14,0],      // 0x7B {
		[0,8,8,8,8,8,8,0],         // 0x7C |
		[0,112,16,12,16,16,112,0], // 0x7D }
		[0,20,40,0,0,0,0,0],       // 0x7E ~
		[60,66,153,161,161,153,66,60] // 0x7F (c) copyright
	];

	// c64: character ROM "901225-01" charset 2 (the mixed-case set, at ROM
	// offset 0x0800 -- charset 1 is upper-case-only with PETSCII graphics
	// where lowercase would be, so charset 2 is the one that actually
	// covers normal text), from the ROM binary at
	// zimmers.net/anonftp/pub/cbm/firmware/characters/c64.bin, verified by
	// rendering every glyph as ASCII art and reading the shapes back.
	// Codes 0x5B-0x60 (`[ \ ] ^ _ \``) have no entry: PETSCII has no
	// equivalent there (those screen codes hold line-drawing graphics
	// instead), so text using them falls back to the canvas font for just
	// those characters rather than showing the wrong glyph.
	var _c64FontRows = [
		[0,0,0,0,0,0,0,0],         // 0x20 space (screen code 32)
		[24,24,24,24,0,0,24,0],    // 0x21 ! (screen code 33)
		[102,102,102,0,0,0,0,0],   // 0x22 " (screen code 34)
		[102,102,255,102,255,102,102,0], // 0x23 # (screen code 35)
		[24,62,96,60,6,124,24,0],  // 0x24 $ (screen code 36)
		[98,102,12,24,48,102,70,0], // 0x25 % (screen code 37)
		[60,102,60,56,103,102,63,0], // 0x26 & (screen code 38)
		[6,12,24,0,0,0,0,0],       // 0x27 ' (screen code 39)
		[12,24,48,48,48,24,12,0],  // 0x28 ( (screen code 40)
		[48,24,12,12,12,24,48,0],  // 0x29 ) (screen code 41)
		[0,102,60,255,60,102,0,0], // 0x2A * (screen code 42)
		[0,24,24,126,24,24,0,0],   // 0x2B + (screen code 43)
		[0,0,0,0,0,24,24,48],      // 0x2C , (screen code 44)
		[0,0,0,126,0,0,0,0],       // 0x2D - (screen code 45)
		[0,0,0,0,0,24,24,0],       // 0x2E . (screen code 46)
		[0,3,6,12,24,48,96,0],     // 0x2F / (screen code 47)
		[60,102,110,118,102,102,60,0], // 0x30 0 (screen code 48)
		[24,24,56,24,24,24,126,0], // 0x31 1 (screen code 49)
		[60,102,6,12,48,96,126,0], // 0x32 2 (screen code 50)
		[60,102,6,28,6,102,60,0],  // 0x33 3 (screen code 51)
		[6,14,30,102,127,6,6,0],   // 0x34 4 (screen code 52)
		[126,96,124,6,6,102,60,0], // 0x35 5 (screen code 53)
		[60,102,96,124,102,102,60,0], // 0x36 6 (screen code 54)
		[126,102,12,24,24,24,24,0], // 0x37 7 (screen code 55)
		[60,102,102,60,102,102,60,0], // 0x38 8 (screen code 56)
		[60,102,102,62,6,102,60,0], // 0x39 9 (screen code 57)
		[0,0,24,0,0,24,0,0],       // 0x3A : (screen code 58)
		[0,0,24,0,0,24,24,48],     // 0x3B ; (screen code 59)
		[14,24,48,96,48,24,14,0],  // 0x3C < (screen code 60)
		[0,0,126,0,126,0,0,0],     // 0x3D = (screen code 61)
		[112,24,12,6,12,24,112,0], // 0x3E > (screen code 62)
		[60,102,6,12,24,0,24,0],   // 0x3F ? (screen code 63)
		[60,102,110,110,96,98,60,0], // 0x40 @ (screen code 0)
		[24,60,102,126,102,102,102,0], // 0x41 A (screen code 65)
		[124,102,102,124,102,102,124,0], // 0x42 B (screen code 66)
		[60,102,96,96,96,102,60,0], // 0x43 C (screen code 67)
		[120,108,102,102,102,108,120,0], // 0x44 D (screen code 68)
		[126,96,96,120,96,96,126,0], // 0x45 E (screen code 69)
		[126,96,96,120,96,96,96,0], // 0x46 F (screen code 70)
		[60,102,96,110,102,102,60,0], // 0x47 G (screen code 71)
		[102,102,102,126,102,102,102,0], // 0x48 H (screen code 72)
		[60,24,24,24,24,24,60,0],  // 0x49 I (screen code 73)
		[30,12,12,12,12,108,56,0], // 0x4A J (screen code 74)
		[102,108,120,112,120,108,102,0], // 0x4B K (screen code 75)
		[96,96,96,96,96,96,126,0], // 0x4C L (screen code 76)
		[99,119,127,107,99,99,99,0], // 0x4D M (screen code 77)
		[102,118,126,126,110,102,102,0], // 0x4E N (screen code 78)
		[60,102,102,102,102,102,60,0], // 0x4F O (screen code 79)
		[124,102,102,124,96,96,96,0], // 0x50 P (screen code 80)
		[60,102,102,102,102,60,14,0], // 0x51 Q (screen code 81)
		[124,102,102,124,120,108,102,0], // 0x52 R (screen code 82)
		[60,102,96,60,6,102,60,0], // 0x53 S (screen code 83)
		[126,24,24,24,24,24,24,0], // 0x54 T (screen code 84)
		[102,102,102,102,102,102,60,0], // 0x55 U (screen code 85)
		[102,102,102,102,102,60,24,0], // 0x56 V (screen code 86)
		[99,99,99,107,127,119,99,0], // 0x57 W (screen code 87)
		[102,102,60,24,60,102,102,0], // 0x58 X (screen code 88)
		[102,102,102,60,24,24,24,0], // 0x59 Y (screen code 89)
		[126,6,12,24,48,96,126,0], // 0x5A Z (screen code 90)
		null,                      // 0x5B [
		null,                      // 0x5C backslash
		null,                      // 0x5D ]
		null,                      // 0x5E ^
		null,                      // 0x5F _
		null,                      // 0x60 `
		[0,0,60,6,62,102,62,0],    // 0x61 a (screen code 1)
		[0,96,96,124,102,102,124,0], // 0x62 b (screen code 2)
		[0,0,60,96,96,96,60,0],    // 0x63 c (screen code 3)
		[0,6,6,62,102,102,62,0],   // 0x64 d (screen code 4)
		[0,0,60,102,126,96,60,0],  // 0x65 e (screen code 5)
		[0,14,24,62,24,24,24,0],   // 0x66 f (screen code 6)
		[0,0,62,102,102,62,6,124], // 0x67 g (screen code 7)
		[0,96,96,124,102,102,102,0], // 0x68 h (screen code 8)
		[0,24,0,56,24,24,60,0],    // 0x69 i (screen code 9)
		[0,6,0,6,6,6,6,60],        // 0x6A j (screen code 10)
		[0,96,96,108,120,108,102,0], // 0x6B k (screen code 11)
		[0,56,24,24,24,24,60,0],   // 0x6C l (screen code 12)
		[0,0,102,127,127,107,99,0], // 0x6D m (screen code 13)
		[0,0,124,102,102,102,102,0], // 0x6E n (screen code 14)
		[0,0,60,102,102,102,60,0], // 0x6F o (screen code 15)
		[0,0,124,102,102,124,96,96], // 0x70 p (screen code 16)
		[0,0,62,102,102,62,6,6],   // 0x71 q (screen code 17)
		[0,0,124,102,96,96,96,0],  // 0x72 r (screen code 18)
		[0,0,62,96,60,6,124,0],    // 0x73 s (screen code 19)
		[0,24,126,24,24,24,14,0],  // 0x74 t (screen code 20)
		[0,0,102,102,102,102,62,0], // 0x75 u (screen code 21)
		[0,0,102,102,102,60,24,0], // 0x76 v (screen code 22)
		[0,0,99,107,127,62,54,0],  // 0x77 w (screen code 23)
		[0,0,102,60,24,60,102,0],  // 0x78 x (screen code 24)
		[0,0,102,102,102,62,12,120], // 0x79 y (screen code 25)
		[0,0,126,12,24,48,126,0]   // 0x7A z (screen code 26)
	];

	// cga: the IBM PC/CGA 8x8 BIOS font (CP437), codes 0x20-0x7E -- a full,
	// contiguous ASCII range since CP437 is ASCII-compatible here (unlike
	// PETSCII, no gaps or remapping needed). Sourced from the raw binary
	// CGA.F08 in viler-int10h/vga-text-mode-fonts (a font-preservation
	// project cataloguing original IBM/OEM ROM fonts), verified by
	// rendering space/!/0/A/a/z as ASCII art and reading the shapes back.
	var _cgaFontRows = [
		[0,0,0,0,0,0,0,0],         // 0x20 space
		[48,120,120,48,48,0,48,0], // 0x21 !
		[108,108,108,0,0,0,0,0],   // 0x22 "
		[108,108,254,108,254,108,108,0], // 0x23 #
		[48,124,192,120,12,248,48,0], // 0x24 $
		[0,198,204,24,48,102,198,0], // 0x25 %
		[56,108,56,118,220,204,118,0], // 0x26 &
		[96,96,192,0,0,0,0,0],     // 0x27 '
		[24,48,96,96,96,48,24,0],  // 0x28 (
		[96,48,24,24,24,48,96,0],  // 0x29 )
		[0,102,60,255,60,102,0,0], // 0x2A *
		[0,48,48,252,48,48,0,0],   // 0x2B +
		[0,0,0,0,0,48,48,96],      // 0x2C ,
		[0,0,0,252,0,0,0,0],       // 0x2D -
		[0,0,0,0,0,48,48,0],       // 0x2E .
		[6,12,24,48,96,192,128,0], // 0x2F /
		[124,198,206,222,246,230,124,0], // 0x30 0
		[48,112,48,48,48,48,252,0], // 0x31 1
		[120,204,12,56,96,204,252,0], // 0x32 2
		[120,204,12,56,12,204,120,0], // 0x33 3
		[28,60,108,204,254,12,30,0], // 0x34 4
		[252,192,248,12,12,204,120,0], // 0x35 5
		[56,96,192,248,204,204,120,0], // 0x36 6
		[252,204,12,24,48,48,48,0], // 0x37 7
		[120,204,204,120,204,204,120,0], // 0x38 8
		[120,204,204,124,12,24,112,0], // 0x39 9
		[0,48,48,0,0,48,48,0],     // 0x3A :
		[0,48,48,0,0,48,48,96],    // 0x3B ;
		[24,48,96,192,96,48,24,0], // 0x3C <
		[0,0,252,0,0,252,0,0],     // 0x3D =
		[96,48,24,12,24,48,96,0],  // 0x3E >
		[120,204,12,24,48,0,48,0], // 0x3F ?
		[124,198,222,222,222,192,120,0], // 0x40 @
		[48,120,204,204,252,204,204,0], // 0x41 A
		[252,102,102,124,102,102,252,0], // 0x42 B
		[60,102,192,192,192,102,60,0], // 0x43 C
		[248,108,102,102,102,108,248,0], // 0x44 D
		[254,98,104,120,104,98,254,0], // 0x45 E
		[254,98,104,120,104,96,240,0], // 0x46 F
		[60,102,192,192,206,102,62,0], // 0x47 G
		[204,204,204,252,204,204,204,0], // 0x48 H
		[120,48,48,48,48,48,120,0], // 0x49 I
		[30,12,12,12,204,204,120,0], // 0x4A J
		[230,102,108,120,108,102,230,0], // 0x4B K
		[240,96,96,96,98,102,254,0], // 0x4C L
		[198,238,254,254,214,198,198,0], // 0x4D M
		[198,230,246,222,206,198,198,0], // 0x4E N
		[56,108,198,198,198,108,56,0], // 0x4F O
		[252,102,102,124,96,96,240,0], // 0x50 P
		[120,204,204,204,220,120,28,0], // 0x51 Q
		[252,102,102,124,108,102,230,0], // 0x52 R
		[120,204,96,48,24,204,120,0], // 0x53 S
		[252,180,48,48,48,48,120,0], // 0x54 T
		[204,204,204,204,204,204,252,0], // 0x55 U
		[204,204,204,204,204,120,48,0], // 0x56 V
		[198,198,198,214,254,238,198,0], // 0x57 W
		[198,198,108,56,56,108,198,0], // 0x58 X
		[204,204,204,120,48,48,120,0], // 0x59 Y
		[254,198,140,24,50,102,254,0], // 0x5A Z
		[120,96,96,96,96,96,120,0], // 0x5B [
		[192,96,48,24,12,6,2,0],   // 0x5C backslash
		[120,24,24,24,24,24,120,0], // 0x5D ]
		[16,56,108,198,0,0,0,0],   // 0x5E ^
		[0,0,0,0,0,0,0,255],       // 0x5F _
		[48,48,24,0,0,0,0,0],      // 0x60 `
		[0,0,120,12,124,204,118,0], // 0x61 a
		[224,96,96,124,102,102,220,0], // 0x62 b
		[0,0,120,204,192,204,120,0], // 0x63 c
		[28,12,12,124,204,204,118,0], // 0x64 d
		[0,0,120,204,252,192,120,0], // 0x65 e
		[56,108,96,240,96,96,240,0], // 0x66 f
		[0,0,118,204,204,124,12,248], // 0x67 g
		[224,96,108,118,102,102,230,0], // 0x68 h
		[48,0,112,48,48,48,120,0], // 0x69 i
		[12,0,12,12,12,204,204,120], // 0x6A j
		[224,96,102,108,120,108,230,0], // 0x6B k
		[112,48,48,48,48,48,120,0], // 0x6C l
		[0,0,204,254,254,214,198,0], // 0x6D m
		[0,0,248,204,204,204,204,0], // 0x6E n
		[0,0,120,204,204,204,120,0], // 0x6F o
		[0,0,220,102,102,124,96,240], // 0x70 p
		[0,0,118,204,204,124,12,30], // 0x71 q
		[0,0,220,118,102,96,240,0], // 0x72 r
		[0,0,124,192,120,12,248,0], // 0x73 s
		[16,48,124,48,48,52,24,0], // 0x74 t
		[0,0,204,204,204,204,118,0], // 0x75 u
		[0,0,204,204,204,120,48,0], // 0x76 v
		[0,0,198,214,254,254,108,0], // 0x77 w
		[0,0,198,108,56,108,198,0], // 0x78 x
		[0,0,204,204,204,124,12,248], // 0x79 y
		[0,0,252,152,48,100,252,0], // 0x7A z
		[28,48,48,224,48,48,28,0], // 0x7B {
		[24,24,24,0,24,24,24,0],   // 0x7C |
		[224,48,48,28,48,48,224,0], // 0x7D }
		[118,220,0,0,0,0,0,0]      // 0x7E ~
	];

	var _bitmapFonts = {
		spectrum: { startCode: 0x20, rows: _spectrumFontRows },
		c64:      { startCode: 0x20, rows: _c64FontRows },
		cga:      { startCode: 0x20, rows: _cgaFontRows }
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

	// 1.5 additions
	var _cellChars = [];             // [row][col] -> last-drawn character
	var _cellAttrs = [];             // [row][col] -> { ink, paper } last used to draw it

	// 1.6 additions
	var _activeBitmapFont = 'spectrum'; // name of the active bundled font, or null -- matches the default palette
	var _printInvert = false;        // INVERSE: swap ink/paper for the draw
	var _printBright = true;         // BRIGHT: defaults on to match this library's pre-1.6 colors
	var _printOver   = false;        // OVER: skip the paper fill, draw ink onto what's already there
	var _printFlash  = false;        // FLASH: periodically swap ink/paper until redrawn without it
	var _flashTimer  = null;
	var _flashPhase  = false;

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
				name:        profile.name        || 'custom',
				colors:      profile.colors      || [],
				defaults:    profile.defaults    || { ink: 0, paper: 0 },
				resolution:  profile.resolution,
				resolutions: profile.resolutions,
				font:        profile.font
			};
		}

		_palette     = p;
		_screenInk   = p.defaults.ink;
		_screenPaper = p.defaults.paper;
		_printInk    = p.defaults.ink;
		_printPaper  = p.defaults.paper;

		// A palette's own bitmap font (if any) becomes active automatically,
		// same as its default ink/paper -- explicit screen.bitmapFont() calls
		// after this still override it, same as with any other setter.
		_activeBitmapFont = (p.font && _bitmapFonts[p.font]) ? p.font : null;

		if (_ctx) { screen.clear(); }
		return _palette;
	};

	// --- colors ----------------------------------------------------------
	screen.color = function (ink, paper) {
		if (typeof ink   !== 'undefined') { _screenInk   = ink; }
		if (typeof paper !== 'undefined') { _screenPaper = paper; }
	};

	// print.color(ink, paper) - set the persistent print ink/paper.
	// print.color()           - getter; returns the current { ink, paper }.
	print.color = function (ink, paper) {
		if (typeof ink === 'undefined' && typeof paper === 'undefined') {
			return { ink: _printInk, paper: _printPaper };
		}
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

	// screen.size(paletteName)            - the palette's default resolution
	// screen.size(paletteName, modeName)  - a named mode from that palette's
	//                                        `resolutions` map (e.g. 'bbc', 'mode1')
	// screen.size(width, height)          - custom pixel dimensions
	// screen.size()                       - re-applies the active palette's
	//                                        current resolution, if any
	screen.size = function (widthOrName, height) {
		var resolution;

		if (typeof widthOrName === 'string' && typeof height === 'string') {
			var withModes = palettes[widthOrName];
			if (!withModes) {
				_warn('pbasic: unknown palette "' + widthOrName + '"');
				return;
			}
			resolution = withModes.resolutions && withModes.resolutions[height];
			if (!resolution) {
				_warn('pbasic: no resolution mode "' + height + '" for palette "' + widthOrName + '"');
				return;
			}
		} else if (typeof widthOrName === 'string') {
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

		_allocCellBuffer();
		screen.clear();
	}

	// (Re)allocates the charAt/attrAt buffer to the current screen.cols x
	// screen.rows. Called whenever the screen is (re)sized; screen.clear()
	// resets the contents in place afterwards without reallocating.
	function _blankAttr() {
		return { ink: _screenInk, paper: _screenPaper, invert: false, bright: true, over: false, flash: false };
	}

	function _allocCellBuffer() {
		_cellChars = [];
		_cellAttrs = [];
		for (var y = 0; y < screen.rows; y++) {
			var charRow = [], attrRow = [];
			for (var x = 0; x < screen.cols; x++) {
				charRow.push(' ');
				attrRow.push(_blankAttr());
			}
			_cellChars.push(charRow);
			_cellAttrs.push(attrRow);
		}
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

		_printInk    = _screenInk;
		_printPaper  = _screenPaper;
		_printInvert = false;
		_printBright = true;
		_printOver   = false;
		_printFlash  = false;
		_cursorX = 1;
		_cursorY = 1;

		for (var y = 0; y < screen.rows; y++) {
			for (var x = 0; x < screen.cols; x++) {
				_cellChars[y][x] = ' ';
				_cellAttrs[y][x] = _blankAttr();
			}
		}

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

		// INVERSE swaps which of ink/paper is used for which role; BRIGHT
		// dims both when off (defaults on, so existing content keeps its
		// pre-1.6 full-intensity look); OVER skips the paper fill so text
		// draws onto whatever's already there instead of erasing it first.
		var paperColor = _printInvert ? _printInk : _printPaper;
		var inkColor   = _printInvert ? _printPaper : _printInk;
		var paperCss   = _resolveColor(paperColor);
		var inkCss     = _resolveColor(inkColor);
		if (!_printBright) {
			paperCss = _dimColor(paperCss);
			inkCss   = _dimColor(inkCss);
		}

		if (!_printOver) {
			_ctx.fillStyle = paperCss;
			_ctx.fillRect(px, py, _cellW * text.length, _cellH);
		}

		// If any character in the run has a glyph -- either a user-registered
		// UDG or a character from the active bundled bitmap font, which are
		// consulted in that order -- draw cell-by-cell so glyphs and font
		// characters can mix freely.
		var hasGlyph = false;
		for (var i = 0; i < text.length; i++) {
			if (_glyphFor(text.charAt(i))) { hasGlyph = true; break; }
		}
		if (hasGlyph) {
			_ctx.fillStyle = inkCss;
			for (var j = 0; j < text.length; j++) {
				var ch = text.charAt(j);
				var cx = px + j * _cellW;
				var glyph = _glyphFor(ch);
				if (glyph) {
					_drawGlyph(cx, py, glyph, inkCss);
				} else {
					_ctx.fillStyle = inkCss;
					_ctx.fillText(ch, cx, py);
				}
			}
		} else {
			_ctx.fillStyle = inkCss;
			_ctx.fillText(text, px, py);
		}

		var row = y - 1;
		if (row >= 0 && row < screen.rows) {
			for (var k = 0; k < text.length; k++) {
				var col = x - 1 + k;
				if (col < 0 || col >= screen.cols) { continue; }
				_cellChars[row][col] = text.charAt(k);
				_cellAttrs[row][col] = {
					ink: _printInk, paper: _printPaper,
					invert: _printInvert, bright: _printBright,
					over: _printOver, flash: _printFlash
				};
			}
		}

		if (_printFlash) { _ensureFlashTimer(); }
		if (_gridOn) { _drawGrid(); }
	}

	// Dims a resolved CSS hex color by the Spectrum ROM's normal/bright
	// component ratio (0xCD / 0xFF). Non-hex CSS (named colors, rgb(...))
	// is returned unchanged -- best-effort, not a full CSS color parser.
	function _dimColor(css) {
		if (typeof css !== 'string' || css.charAt(0) !== '#') { return css; }
		var hex = css;
		if (hex.length === 4) {
			hex = '#' + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2) + hex.charAt(3) + hex.charAt(3);
		}
		if (hex.length !== 7) { return css; }
		var ratio = 205 / 255;
		function scale(c) {
			var n = Math.round(parseInt(hex.substr(c, 2), 16) * ratio);
			var s = n.toString(16);
			return s.length < 2 ? '0' + s : s;
		}
		return '#' + scale(1) + scale(3) + scale(5);
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

	// --- 1.2 verbs: genuine BASIC ports -----------------------------------
	// tab/fill/repeat are lifted from real dialects rather than invented:
	// Sinclair's TAB is column-only (no SPC/STRING$ on the Spectrum), so
	// the relative-space and repeat-string verbs are borrowed from the
	// BBC / Amstrad CPC side of the bundled palettes.

	// print.tab(n, [ink], [paper])
	// Sinclair BASIC `PRINT TAB n` analogue: pads with paper-colored spaces
	// from the cursor's current column out to column n on the current row
	// (1-indexed, matching print.at). No-op if the cursor is already at or
	// past column n. Clamps (with a warning) if n is beyond screen.cols.
	//     BASIC:  PRINT TAB 10; "score"
	//     pbasic: print.tab(11); print.line("score");
	print.tab = function (n, ink, paper) {
		if (!_ctx || typeof n !== 'number') { return; }
		if (n > screen.cols) {
			_warn('pbasic: print.tab column ' + n + ' beyond screen.cols (' + screen.cols + '), clamping');
			n = screen.cols;
		}
		var gap = n - _cursorX;
		if (gap <= 0) { return; }
		var cx = _cursorX, cy = _cursorY;
		var pad = new Array(gap + 1).join(' ');
		_withScopedColor(ink, paper, function () { _drawText(cx, cy, pad); });
		_cursorX = n;
	};

	// print.fill(n, [char], [ink], [paper])
	// BBC BASIC / Locomotive (Amstrad CPC) `SPC(n)` analogue: draws n cells
	// of `char` (default space) starting at the cursor and advances the
	// cursor by n, wrapping to the start of the next row if it runs past
	// screen.cols. Unlike TAB (an absolute column), SPC — and print.fill —
	// is relative to wherever the cursor already sits.
	//     BASIC:  PRINT SPC(5); "go"
	//     pbasic: print.fill(5); print.line("go");
	print.fill = function (n, char, ink, paper) {
		if (!_ctx || typeof n !== 'number' || n <= 0) { return; }
		char = (typeof char !== 'undefined' && char !== null && String(char).length > 0) ?
			String(char).charAt(0) : ' ';

		var cx = _cursorX, cy = _cursorY;
		var remaining = Math.floor(n);
		_withScopedColor(ink, paper, function () {
			while (remaining > 0) {
				var onLine = Math.min(remaining, screen.cols - cx + 1);
				if (onLine > 0) {
					_drawText(cx, cy, new Array(onLine + 1).join(char));
					remaining -= onLine;
					cx += onLine;
				}
				if (cx > screen.cols) { cx = 1; cy += 1; }
			}
		});
		_cursorX = cx;
		_cursorY = cy;
	};

	// print.repeat(text, count)
	// BBC BASIC / Locomotive (Amstrad CPC) `STRING$(count, char$)` analogue.
	// A pure string helper — like STRING$, it's a function that produces a
	// string for use with print.at / print.line / print.fill, not a
	// drawing primitive of its own.
	//     BASIC:  PRINT STRING$(20, "=")
	//     pbasic: print.line(print.repeat("=", 20));
	print.repeat = function (text, count) {
		text = (typeof text !== 'undefined') ? String(text) : '';
		count = (typeof count === 'number' && count > 0) ? Math.floor(count) : 0;
		if (text === '' || count === 0) { return ''; }
		return new Array(count + 1).join(text);
	};

	// --- 1.3 verbs: JS ergonomics with no BASIC ancestor ------------------
	// None of these come from a real dialect — they fill gaps the 8-bit
	// BASICs never needed a verb for, using JS-native idioms (a getter, a
	// scoped callback) rather than statement syntax.

	// print.cr([n])
	// Advance the cursor to column 1, n rows down (default 1), without
	// drawing anything. The closest BASIC has is the implicit newline at
	// the end of a plain PRINT statement — there's no standalone verb for
	// it, so this exists purely for inserting blank lines / spacing.
	print.cr = function (n) {
		if (!_ctx) { return; }
		n = (typeof n === 'number' && n > 0) ? Math.floor(n) : 1;
		_cursorX = 1;
		_cursorY += n;
	};

	// print.clearLine([y], [paper])
	// Repaints row y (default: the cursor's current row) with `paper`
	// (default: the persistent print paper) across the full screen width,
	// and moves the cursor to column 1 of that row.
	print.clearLine = function (y, paper) {
		if (!_ctx) { return; }
		y = (typeof y === 'number') ? y : _cursorY;
		var p = (typeof paper !== 'undefined') ? paper : _printPaper;
		var b = _borderPx();
		var py = (y - 1) * _cellH + b;
		_ctx.fillStyle = _resolveColor(p);
		_ctx.fillRect(b, py, screen.cols * _cellW, _cellH);
		if (_gridOn) { _drawGrid(); }
		_cursorX = 1;
		_cursorY = y;
	};

	// print.padRight(text, width, [char])
	// print.padLeft (text, width, [char])
	// Pure string helpers — pad `text` out to `width` with `char` (default
	// space) on the right or left. Returns `text` unchanged if it's
	// already at or beyond `width`. No BASIC dialect has these; JS-native
	// string ergonomics for building aligned columns before printing.
	print.padRight = function (text, width, char) {
		text = (typeof text !== 'undefined') ? String(text) : '';
		char = (typeof char !== 'undefined' && char !== null && String(char).length > 0) ?
			String(char).charAt(0) : ' ';
		width = (typeof width === 'number') ? Math.floor(width) : 0;
		var gap = width - text.length;
		if (gap <= 0) { return text; }
		return text + new Array(gap + 1).join(char);
	};

	print.padLeft = function (text, width, char) {
		text = (typeof text !== 'undefined') ? String(text) : '';
		char = (typeof char !== 'undefined' && char !== null && String(char).length > 0) ?
			String(char).charAt(0) : ' ';
		width = (typeof width === 'number') ? Math.floor(width) : 0;
		var gap = width - text.length;
		if (gap <= 0) { return text; }
		return new Array(gap + 1).join(char) + text;
	};

	// print.style({ink, paper, invert, bright, over, flash}, fn)
	// Runs `fn` with the persistent print attributes temporarily
	// overridden, restoring the prior values once `fn` returns. Unlike the
	// inline ink/paper args on print.at / print.line (which apply to a
	// single draw), this scopes every print.* call inside `fn` — a
	// block-scoped analogue of BASIC's per-statement PAPER/INK/INVERSE/
	// OVER/BRIGHT/FLASH, expressed as a JS callback since BASIC has no
	// block syntax to borrow.
	//     print.style({ink: 2, paper: 0}, function () {
	//         print.line("danger");
	//         print.line("zone");
	//     });
	print.style = function (opts, fn) {
		if (typeof fn !== 'function') { return; }
		opts = opts || {};
		var saved = {
			ink: _printInk, paper: _printPaper,
			invert: _printInvert, bright: _printBright,
			over: _printOver, flash: _printFlash
		};
		if (typeof opts.ink    !== 'undefined') { _printInk    = opts.ink; }
		if (typeof opts.paper  !== 'undefined') { _printPaper  = opts.paper; }
		if (typeof opts.invert !== 'undefined') { _printInvert = !!opts.invert; }
		if (typeof opts.bright !== 'undefined') { _printBright = !!opts.bright; }
		if (typeof opts.over   !== 'undefined') { _printOver   = !!opts.over; }
		if (typeof opts.flash  !== 'undefined') { _printFlash  = !!opts.flash; }
		try { fn(); }
		finally {
			_printInk    = saved.ink;
			_printPaper  = saved.paper;
			_printInvert = saved.invert;
			_printBright = saved.bright;
			_printOver   = saved.over;
			_printFlash  = saved.flash;
		}
	};

	// --- 1.4: print.cursor -------------------------------------------------
	// BBC BASIC `POS` / `VPOS` analogue, made set-able. POS and VPOS are
	// read-only functions on the BBC (and there's no single combined form)
	// — this merges them into one getter/setter, following the same
	// call-with-no-args-to-read pattern as print.color / screen.palette.
	//     BASIC:  PRINT POS, VPOS        (read only)
	//     pbasic: print.cursor()                    // -> { x, y }
	//             print.cursor(5, 3)                 // move without drawing
	print.cursor = function (x, y) {
		if (typeof x === 'undefined' && typeof y === 'undefined') {
			return { x: _cursorX, y: _cursorY };
		}
		if (typeof x === 'number') { _cursorX = x; }
		if (typeof y === 'number') { _cursorY = y; }
	};

	// --- 1.6: Spectrum text attributes --------------------------------------
	// Each is a persistent getter/setter, call-with-no-args-to-read, like
	// print.color. Real Sinclair BASIC only offers INVERSE and OVER as
	// per-statement PRINT items (never a persistent default) — making them
	// persistent here is a deliberate convenience, consistent with how
	// this library already treats ink/paper; combine with print.style for
	// a scoped one-off instead.

	// print.invert([bool]) - INVERSE: swaps ink/paper for the draw.
	print.invert = function (on) {
		if (typeof on === 'undefined') { return _printInvert; }
		_printInvert = !!on;
	};

	// print.bright([bool]) - BRIGHT: the Spectrum's two-tier color
	// intensity. Defaults to true so existing print.At content (which has
	// always used full-intensity palette colors) keeps its look;
	// print.bright(false) dims ink/paper by the ROM's normal/bright
	// component ratio (0xCD / 0xFF).
	print.bright = function (on) {
		if (typeof on === 'undefined') { return _printBright; }
		_printBright = !!on;
	};

	// print.over([bool]) - OVER: draws ink onto the existing background
	// instead of painting a paper rect first, so text can overlay whatever
	// is already there. Real Sinclair OVER XORs pixel-for-pixel with the
	// existing bitmap; this is a practical approximation (skip the paper
	// fill, draw ink on top) rather than true per-pixel XOR compositing.
	print.over = function (on) {
		if (typeof on === 'undefined') { return _printOver; }
		_printOver = !!on;
	};

	// print.flash([bool]) - FLASH: cells drawn with this on periodically
	// swap ink/paper (a shared ~320ms timer, started lazily on first use)
	// until redrawn with flash off. screen.attrAt reports the stored
	// (non-swapped) ink/paper regardless of which phase is currently
	// showing, matching how the real attribute byte doesn't change either
	// — only the displayed colors alternate.
	print.flash = function (on) {
		if (typeof on === 'undefined') { return _printFlash; }
		_printFlash = !!on;
	};

	function _paintCell(x, y, ch, ink, paper, bright) {
		var b = _borderPx();
		var px = (x - 1) * _cellW + b;
		var py = (y - 1) * _cellH + b;
		var paperCss = _resolveColor(paper);
		var inkCss   = _resolveColor(ink);
		if (!bright) {
			paperCss = _dimColor(paperCss);
			inkCss   = _dimColor(inkCss);
		}
		_ctx.fillStyle = paperCss;
		_ctx.fillRect(px, py, _cellW, _cellH);
		var glyph = _glyphFor(ch);
		if (glyph) {
			_drawGlyph(px, py, glyph, inkCss);
		} else {
			_ctx.fillStyle = inkCss;
			_ctx.fillText(ch, px, py);
		}
	}

	function _redrawFlashingCells() {
		if (!_ctx) { return; }
		for (var row = 0; row < screen.rows; row++) {
			for (var col = 0; col < screen.cols; col++) {
				var a = _cellAttrs[row][col];
				if (!a.flash) { continue; }
				var ink   = _flashPhase ? a.paper : a.ink;
				var paper = _flashPhase ? a.ink   : a.paper;
				_paintCell(col + 1, row + 1, _cellChars[row][col], ink, paper, a.bright);
			}
		}
	}

	function _ensureFlashTimer() {
		if (_flashTimer || typeof setInterval === 'undefined') { return; }
		_flashTimer = setInterval(function () {
			_flashPhase = !_flashPhase;
			_redrawFlashingCells();
		}, 320); // roughly the Spectrum's own flash period
	}

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

	// screen.bitmapFont(name) - activates a bundled 8x8 bitmap ROM font:
	// registered characters render as true pixel bitmaps instead of the
	// canvas's own font -- especially crisp at screen.scale(1), where it
	// works out to one source pixel per device pixel. Individual
	// screen.glyph() registrations always take priority, so custom UDGs
	// still override specific characters even with a bitmap font active.
	// screen.bitmapFont(null) turns it off, back to the canvas font.
	// screen.bitmapFont() with no args returns the active font name, or
	// null. Bundled so far: 'spectrum' (the ZX Spectrum ROM character set).
	//     screen.bitmapFont('spectrum');
	//     screen.scale(1); screen.size('spectrum');
	//     print.at(1, 1, "TRUE PIXEL TEXT");
	screen.bitmapFont = function (name) {
		if (arguments.length === 0) { return _activeBitmapFont; }
		if (name === null) { _activeBitmapFont = null; return; }
		if (!_bitmapFonts[name]) {
			_warn('pbasic: unknown bitmap font "' + name + '"');
			return;
		}
		_activeBitmapFont = name;
	};

	// Glyph lookup used by _drawText: user-registered UDGs (screen.glyph)
	// take priority over the active bundled bitmap font, if any.
	function _glyphFor(ch) {
		if (_glyphs[ch]) { return _glyphs[ch]; }
		if (_activeBitmapFont) {
			var font = _bitmapFonts[_activeBitmapFont];
			var idx  = ch.charCodeAt(0) - font.startCode;
			if (idx >= 0 && idx < font.rows.length) { return font.rows[idx]; }
		}
		return undefined;
	}

	// --- 1.5: stateful screen -----------------------------------------------
	// No single bundled dialect has these as statements — Spectrum BASIC's
	// nearest equivalent is PEEKing screen/attribute memory directly. Here
	// print.at / print.line / print.tab / print.fill / print.repeat all
	// write through to a parallel char/attr buffer as they draw, which is
	// what charAt / attrAt / attr / snapshot / restore read from.

	// screen.charAt(x, y) - the character currently occupying cell (x, y)
	// (1-indexed, matching print.at), or undefined if out of bounds.
	// ' ' after a clear; whatever a print.* call last left there otherwise.
	screen.charAt = function (x, y) {
		var row = y - 1, col = x - 1;
		if (row < 0 || row >= screen.rows || col < 0 || col >= screen.cols) { return undefined; }
		return _cellChars[row][col];
	};

	// screen.attrAt(x, y) - the { ink, paper, invert, bright, over, flash }
	// last used to draw cell (x, y), or undefined if out of bounds.
	screen.attrAt = function (x, y) {
		var row = y - 1, col = x - 1;
		if (row < 0 || row >= screen.rows || col < 0 || col >= screen.cols) { return undefined; }
		var a = _cellAttrs[row][col];
		return {
			ink: a.ink, paper: a.paper,
			invert: a.invert, bright: a.bright, over: a.over, flash: a.flash
		};
	};

	// screen.attr(x, y, ink, paper) - recolor cell (x, y) in place, keeping
	// whatever character already occupies it. The color-only counterpart
	// to print.at's inline ink/paper args — redraws one cell without
	// touching its content.
	screen.attr = function (x, y, ink, paper) {
		if (!_ctx) { return; }
		var ch = screen.charAt(x, y);
		if (typeof ch === 'undefined') {
			_warn('pbasic: screen.attr(' + x + ', ' + y + ') is out of bounds');
			return;
		}
		_withScopedColor(ink, paper, function () { _drawText(x, y, ch); });
	};

	function _cloneCellBuffer(chars, attrs) {
		var newChars = [], newAttrs = [];
		for (var y = 0; y < chars.length; y++) {
			var charRow = chars[y].slice();
			var attrRow = [];
			for (var x = 0; x < attrs[y].length; x++) {
				var a = attrs[y][x];
				attrRow.push({
					ink: a.ink, paper: a.paper,
					invert: a.invert, bright: a.bright, over: a.over, flash: a.flash
				});
			}
			newChars.push(charRow);
			newAttrs.push(attrRow);
		}
		return { chars: newChars, attrs: newAttrs };
	}

	// screen.snapshot() - captures the full visible screen: pixels, the
	// char/attr buffer behind charAt/attrAt, cursor position and the
	// persistent print colors. Returns an opaque object for screen.restore().
	// Handy for a menu / dialog overlay: snapshot, draw over it, restore.
	screen.snapshot = function () {
		if (!_ctx) { return null; }
		var cloned = _cloneCellBuffer(_cellChars, _cellAttrs);
		return {
			width:        _canvas.width,
			height:       _canvas.height,
			cursorX:      _cursorX,
			cursorY:      _cursorY,
			printInk:     _printInk,
			printPaper:   _printPaper,
			printInvert:  _printInvert,
			printBright:  _printBright,
			printOver:    _printOver,
			printFlash:   _printFlash,
			pixels:       _ctx.getImageData(0, 0, _canvas.width, _canvas.height),
			chars:        cloned.chars,
			attrs:        cloned.attrs
		};
	};

	// screen.restore(snapshot) - restores a screen.snapshot() capture.
	// Skips (with a warning) if the canvas has been resized since the
	// snapshot was taken, since the pixel buffer wouldn't line up.
	screen.restore = function (snap) {
		if (!_ctx || !snap) { return; }
		if (snap.width !== _canvas.width || snap.height !== _canvas.height) {
			_warn('pbasic: screen.restore snapshot size does not match the current canvas, skipping');
			return;
		}
		_ctx.putImageData(snap.pixels, 0, 0);
		var cloned = _cloneCellBuffer(snap.chars, snap.attrs);
		_cellChars  = cloned.chars;
		_cellAttrs   = cloned.attrs;
		_cursorX     = snap.cursorX;
		_cursorY     = snap.cursorY;
		_printInk    = snap.printInk;
		_printPaper  = snap.printPaper;
		_printInvert = snap.printInvert;
		_printBright = snap.printBright;
		_printOver   = snap.printOver;
		_printFlash  = snap.printFlash;
	};

	// --- 1.4: pbasic.sound (BEEP) -----------------------------------------
	// Sinclair BASIC `BEEP duration, pitch` analogue: duration in seconds,
	// pitch in semitones relative to middle C (0 = C4 — the Spectrum ROM's
	// own convention). Plays a plain square wave via the Web Audio API, no
	// envelope shaping — the Spectrum's one-bit beeper had hard on/off
	// clicks too, so this stays faithful rather than smoothing it out.
	// Returns a promise that resolves once `duration` has elapsed, so it
	// composes with `await` the same way `input.pause` does, without
	// actually blocking the JS thread the way real BEEP blocks BASIC.
	//     BASIC:  BEEP 0.5, 0
	//     pbasic: await pbasic.sound(0.5, 0);
	var _audioCtx = null;
	function _getAudioCtx() {
		if (_audioCtx) { return _audioCtx; }
		var AC = global.AudioContext || global.webkitAudioContext;
		if (!AC) {
			_warn('pbasic: Web Audio API not available; sound() is a no-op');
			return null;
		}
		_audioCtx = new AC();
		return _audioCtx;
	}

	function sound(duration, pitch) {
		duration = (typeof duration === 'number' && duration > 0) ? duration : 0;
		pitch    = (typeof pitch === 'number') ? pitch : 0;

		var ctx = _getAudioCtx();
		if (!ctx || duration === 0) { return Promise.resolve(); }

		var freq = 261.6255653005986 * Math.pow(2, pitch / 12); // middle C * 2^(semitones/12)
		var osc  = ctx.createOscillator();
		var gain = ctx.createGain();
		osc.type = 'square';
		osc.frequency.value = freq;
		gain.gain.value = 0.15; // the real beeper is loud; keep this a background tone
		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start();
		osc.stop(ctx.currentTime + duration);

		return new Promise(function (resolve) {
			osc.onended = function () { resolve(); };
		});
	}

	// --- export ----------------------------------------------------------
	global.pbasic = {
		screen:   screen,
		print:    print,
		palettes: palettes,
		sound:    sound
	};

}(typeof window !== 'undefined' ? window : this));
