/*
 * color coherence vector.
 */
function CCV(options) {
    this.img = document.getElementById(options.element);
    this.canvas = this.prepareCanvas(this.img, options.size);
    this.threshold = options.threshold;
}

/*
 * some utilities.
 */
CCV.createTable = function(width, height) {
    var table = new Array(height);
    for (var j = 0; j < height; j++) {
        table[j] = new Array(width);
    }
    return table;
};

CCV.Coordinate = function(x, y) {
    this.x = x || 0;
    this.y = y || 0;
};

CCV.Region = function(id, color) {
    this.id = id;
    this.color = color;
    this.coords = [];
};
CCV.Region.prototype = {
    addCoord: function(coord, idTable) {
        this.coords.push(coord);
        idTable[coord.y][coord.x] = this.id;
    },
    mergeRegion: function(region, idTable) {
        var transferCoords = region.coords;
        var coord;
        for (var i = 0; i < transferCoords.length; i++) {
            coord = transferCoords[i];
            idTable[coord.y][coord.x] = this.id;
            this.coords.push(coord);
        }
    },
};

/*
 * main.
 */
CCV.prototype = {
    prepareCanvas: function(element, size) {
        var canvas = document.createElement('canvas');
        canvas.setAttribute("id", "targetCanvas");
        canvas.width = size;
        canvas.height = size;
        document.getElementsByTagName('body')[0].appendChild(canvas);

        var context = canvas.getContext('2d');
        context.drawImage(element, 0, 0, size, size);

        // Gaussian blur. original radius is 9 / 2.0 = 4.5
        stackBlurCanvasRGB("targetCanvas", 0, 0, size, size, 4);
        return canvas;
    },
    calc: function () {
        this.reducedImage = this.reduceColor();
        var regions = this.calcRegions();
        return this.calcCCV(regions, this.threshold);
    },
    reduceColor: function() {
        var width = this.canvas.width;
        var height = this.canvas.height;
        var context = this.canvas.getContext('2d');
        var imageData = context.getImageData(0, 0, width, height);
        var pixels = imageData.data;

        var r, g, b, value;
        var table = CCV.createTable(width, height);

        for (var i = 0; i < pixels.length; i+=4) {
            r = Math.floor(pixels[i] / 64);
            g = Math.floor(pixels[i+1] / 64);
            b = Math.floor(pixels[i+2] / 64);
            value = (14 * r + 4 * g + b);
            table[Math.floor((i / 4) / width)][(i / 4) % width] = value;
        }
        return table;
    },
    calcRegions: function() {
        var width = this.canvas.width;
        var height = this.canvas.height;
        var reducedImage = this.reducedImage;
        var threshold = this.threshold;

        var idTable = CCV.createTable(width, height);
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
        var color;
        var idA, idB;
        var regA, regB;
        var coord;

        for (i = 0; i < width; i++) {
            for (j = 0; j < height; j++) {
                coord = new CCV.Coordinate(i, j);
                color = reducedImage[j][i];
                idA = isSameColor(i, j - 1, color) ? idTable[j - 1][i]: false;
                idB = isSameColor(i - 1, j, color) ? idTable[j][i - 1]: false;
                regA = idA ? regions[idA]: undefined;
                regB = idB ? regions[idB]: undefined;

                if (idA && idB) {
                    if (idA != idB) {
                        if (regA.coords.length > regB.coords.length) {
                            delete regions[idB];
                            regA.mergeRegion(regB, idTable);
                            regA.addCoord(coord, idTable);
                        } else {
                            delete regions[idA];
                            regB.mergeRegion(regA, idTable);
                            regB.addCoord(coord, idTable);
                        }
                    } else {
                        regA.addCoord(coord, idTable);
                    }
                } else if (idA) {
                    regA.addCoord(coord, idTable);
                } else if (idB) {
                    regB.addCoord(coord, idTable);
                } else {
                    var newRegion = new CCV.Region(ids, color);
                    newRegion.addCoord(coord, idTable);
                    regions[ids] = newRegion;
                    ++ids;
                }
            }
        }
        this.idTable = idTable;
        return regions;
    },
    calcCCV: function(regions, threshold) {
        var ccv = new Array(128);
        for (i = 0; i < 128; i++) {
            ccv[i] = 0;
        }
        for (var id in regions) {
            var region = regions[id];
            if (region.coords.length > threshold) {
                ccv[region.color * 2]++;
            } else {
                ccv[region.color * 2 + 1]++;
            }
        }
        return ccv;
    },
    debugPreview: function() {
        var context = this.canvas.getContext('2d');
        var width = this.canvas.width;
        var height = this.canvas.height;
        var imageData = context.getImageData(0, 0, width, height);
        var pixels = imageData.data;
        var idTable = this.idTable;
        var value;
        for (i = 0; i < pixels.length; i+=4) {
            value = idTable[Math.floor(i / 4 / width)][(i / 4) % width];
            pixels[i] = (value* 29 + 73) % 256;
            pixels[i+1] = (value * 61 + 101) % 256;
            pixels[i+2] = (value * 31 + 237) % 256;
        }
        context.putImageData(imageData, 0, 0);
    }
}
