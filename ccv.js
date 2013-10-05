function CCV(options) {
    this.img = document.getElementById(options.element);
    this.canvas = this.prepareCanvas(this.img, options.size);
    var reducedImage = this.reduceColor(this.canvas);
    this.calc(reducedImage, options.threshold);
}

CCV.prototype.prepareCanvas = function(element, size) {
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    document.getElementsByTagName('body')[0].appendChild(canvas);
    var context = canvas.getContext('2d');
    context.drawImage(element, 0, 0, size, size);
    return canvas;
}

function createTable(width, height) {
    var table = new Array(height);
    for (var j = 0; j < height; j++) {
	table[j] = new Array(width);
    }
    return table;
}

CCV.prototype.reduceColor = function(canvas) {
    var width = canvas.width;
    var height = canvas.height;
    var context = canvas.getContext('2d');
    var imageData = context.getImageData(0, 0, width, height);
    var pixels = imageData.data;

    var r, g, b, value;
    var table = createTable(width, height);

    for (var i = 0; i < pixels.length; i+=4) {
	r = Math.floor(pixels[i] / 64);
	g = Math.floor(pixels[i+1] / 64);
	b = Math.floor(pixels[i+2] / 64);
	value = (14 * r + 4 * g + b);
	table[Math.floor((i / 4) / width)][(i / 4) % width] = value;
    }
    return table;
}

function Coordinate(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

function Region(id, color) {
    this.id = id;
    this.color = color;
    this.coords = [];
}
Region.prototype.addCoord = function(coord, idTable) {
    this.coords.push(coord);
    idTable[coord.y][coord.x] = this.id;
};
Region.prototype.mergeRegion = function(region, idTable) {
    var transferCoords = region.coords;
    var coord;
    for (var i = 0; i < transferCoords.length; i++) {
	coord = transferCoords[i];
	idTable[coord.y][coord.x] = this.id;
	this.coords.push(coord);
    }
};

CCV.prototype.calc = function(reducedImage, threshold) {
    var width = this.canvas.width;
    var height = this.canvas.height;

    var idTable = createTable(width, height);
    var regions = {};
    var ids = 1;

    function isSameColor(x, y, color) {
	if ((0 <= x) && (x < width) && (0 <= y) && (y < height)) {
	    if (reducedImage[y][x] == color) {
		return true;
	    } else {
		return false;
	    }
	} else {
	    return false;
	}
    }

    var i, j;
    var color, a, b;
    var regA, regB;
    var coord;

    for (i = 0; i < width; i++) {
	for (j = 0; j < height; j++) {
	    coord = new Coordinate(i, j);
	    color = reducedImage[j][i];
	    a = isSameColor(i, j - 1, color) ? idTable[j - 1][i]: false;
	    b = isSameColor(i - 1, j, color) ? idTable[j][i - 1]: false;
	    regA = a ? regions[a]: undefined;
	    regB = b ? regions[b]: undefined;

	    if (a && b) {
		if (a != b) {
		    if (regA.coords.length > regB.coords.length) {
			delete regions[regB.id];
			regA.mergeRegion(regB, idTable);
			regA.addCoord(coord, idTable);
		    } else {
			delete regions[regA.id];
			regB.mergeRegion(regA, idTable);
			regB.addCoord(coord, idTable);
		    }
		} else {
		    regA.addCoord(coord, idTable);
		}
	    } else if (a) {
		regA.addCoord(coord, idTable);
	    } else if (b) {
		regB.addCoord(coord, idTable);
	    } else {
		var newRegion = new Region(ids, color);
		newRegion.addCoord(coord, idTable);
		regions[ids] = newRegion;
		++ids;
	    }
	}
    }

    // calculate color coherence vector!
    // (for preview debug)
    var context = this.canvas.getContext('2d');
    var imageData = context.getImageData(0, 0, width, height);
    var pixels = imageData.data;
    var value;
    for (i = 0; i < pixels.length; i+=4) {
	value = idTable[Math.floor(i / 4 / width)][(i / 4) % width];
	pixels[i] = (value* 29 + 73) % 256;
	pixels[i+1] = (value * 61 + 101) % 256;
	pixels[i+2] = (value * 31 + 237) % 256;
    }
    context.putImageData(imageData, 0, 0);

    // calculate!
    var ccv = new Array(128);
    for (i = 0; i < 128; i++) {
	ccv[i] = 0;
    }
    for (var id in regions) {
	var region = regions[id];
	if (region.coords.length > threshold) {
	    ccv[region.color * 2] += 1;
	} else {
	    ccv[region.color * 2 + 1] += 1;
	}
    }

    var resultDisplay = document.getElementById('result');
    var result = 'ccv = [' + ccv.join(', ') + ']';
    var node = document.createTextNode(result);
    resultDisplay.appendChild(node);
}
