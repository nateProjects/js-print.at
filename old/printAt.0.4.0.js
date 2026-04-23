var screen = {};

screen.font = function (type, size, padding) {
	type = typeof type !== 'undefined' ? type : "Courier";  // default
	screen.font[0] = type;
	size = typeof size !== 'undefined' ? size : 14;
	screen.font[1] = size;
	padding = typeof padding !== 'undefined' ? padding : 4;
	screen.font[2] = padding;
	screen.cellSize = screen.font[1] + screen.font[2];
};

screen.size = function (screenWidth, screenHeight) {
	var screenCanvas = document.createElement('canvas');
	// screenContext = screenCanvas.getContext('2d');
	screenCanvas.id = "screenCanvas";
	screenCanvas.width = screenWidth;  // Need to add defaults
	screenCanvas.height = screenHeight;
	screenCanvas.style.position = "absolute";
	// screenCanvas.style.border = "1px dashed silver";
	var screenBody = document.getElementsByTagName("body")[0];
	screenBody.appendChild(screenCanvas);
};

screen.clear = function () {
	screenContext.clearRect(0, 0, screenCanvas.width, screenCanvas.height);
};

var print = {
	at: function (x, y, text) {
		x *= screen.cellSize, y *= screen.cellSize;
		var displayText = document.getElementById('screenCanvas').getContext('2d');
		displayText.font = screen.font[1] + " " + screen.font[0];
		displayText.fillText(text, x, y);
	},
	line: function (text) {
		document.write(text);
	},
};
