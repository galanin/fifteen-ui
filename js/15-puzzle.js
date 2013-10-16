(function () {
    var hashBase = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
        'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/'];

    function Tile(pos) {
        this.n = pos.n; // number of tile
        this.x = this.goalX = pos.x; // current and goal position
        this.y = this.goalY = pos.y;
    }

    Tile.prototype.place = function (a1, a2) {
        if (_.isObject(a1)) {
            this.x = a1.x;
            this.y = a1.y;
        }
        else {
            this.x = a1;
            this.y = a2;
        }
    };

    Tile.prototype.getDistance = function () {
        return Math.abs(this.x - this.goalX) + Math.abs(this.y - this.goalY);
    };

    Tile.prototype.isGoalX = function () {
        return this.x === this.goalX;
    };

    Tile.prototype.isGoalY = function () {
        return this.y === this.goalY;
    };

    Tile.prototype.isGoal = function () {
        return this.isGoalX() && this.isGoalY();
    };

    Tile.prototype.doesConflictInRow = function (tile) {
        return this.isGoalY() && tile.isGoalY() &&
            (this.x > tile.x && this.goalX < tile.goalX ||
                this.x < tile.x && this.goalX > tile.goalX);
    };

    Tile.prototype.doesConflictInCol = function (tile) {
        return this.isGoalX() && tile.isGoalX() &&
            (this.y > tile.y && this.goalY < tile.goalY ||
                this.y < tile.y && this.goalY > tile.goalY);
    };

    function getPosition(i, width) {
        return { n: i, x: i % width, y: Math.floor(i / width) };
    }

    function Board(width, height) {
        var self = this;
        self.width = width;
        self.height = height;
        self.area = self.width * self.height;
        self.tile_count = self.area - 1;
        self.x0 = width - 1;
        self.y0 = height - 1;

        self.tiles = _.times(self.tile_count, function (i) {
            return new Tile(getPosition(i, self.width));
        });

        self.index = _.times(self.height, function (i) {
            return new Array(self.width);
        });
        self.reindex();

        self.parity = self.calculateParityOfSolved(width, height);

        self.events = {};
    }

    Board.prototype.init = function (map) {
        var self = this;
        _.each(map, function (tnum, pnum) {
            var pos = getPosition(pnum, self.width);
            if (tnum === 0) {
                self.x0 = pos.x;
                self.y0 = pos.y;
            }
            else {
                self.tiles[tnum - 1].place(pos);
            }
        });
        self.reindex();
        self.trigger('newgame');
        self.trigger('refresh');
    };

    Board.prototype.getTilePositions = function () {
        return _.map(this.tiles, function (tile) {
            return { x: tile.x, y: tile.y };
        });
    };

    Board.prototype.clone = function () {
        var self = this;
        var newBoard = new Board(self.width, self.height);
        newBoard.x0 = self.x0;
        newBoard.y0 = self.y0;
        _.each(self.tiles, function (tile, i) {
            newBoard.tiles[i].place(tile);
        });
        newBoard.reindex();
        return newBoard;
    };

    Board.prototype.reindex = function () {
        var self = this;
        _.each(self.tiles, function (tile) {
            self.index[tile.y][tile.x] = tile;
        });
        self.index[self.y0][self.x0] = undefined;
    };

    Board.prototype.shuffle = function () {
        this.init(_.shuffle(_.range(this.tile_count + 1)));
    };

    Board.prototype.doesConflictInRow = function (x1, x2, y) {
        return this.index[y][x1] && this.index[y][x2] &&
            this.index[y][x1].doesConflictInRow(this.index[y][x2]);
    };

    Board.prototype.doesConflictInCol = function (x, y1, y2) {
        return this.index[y1][x] && this.index[y2][x] &&
            this.index[y1][x].doesConflictInCol(this.index[y2][x]);
    };

    Board.prototype.isGoal = function (x, y) {
        return this.index[y][x] && this.index[y][x].isGoal();
    };

    /**
     * Manhattan distance used
     */
    Board.prototype.getDistance = function () {
        var self = this;

        var distance = _.reduce(self.tiles, function (memo, tile) {
            return memo + tile.getDistance();
        }, 0);

        var conflicts = _.times(self.height, function (i) {
            return new Array(self.width);
        });
        // conflicts in rows
        for (var y = 0; y < self.height; ++y) {
            for (var x1 = 0; x1 < self.width - 1; ++x1) {
                for (var x2 = x1 + 1; x2 < self.width; ++x2) {
                    if (self.doesConflictInRow(x1, x2, y)) {
                        distance += 2;
                        conflicts[y][x1] = conflicts[y][x2] = true;
                    }
                }
            }
        }

        // conflicts in columns
        for (var x = 0; x < self.width; ++x) {
            for (var y1 = 0; y1 < self.height - 1; ++y1) {
                for (var y2 = y1 + 1; y2 < self.height; ++y2) {
                    if (self.doesConflictInCol(x, y1, y2)) {
                        distance += 2;
                        conflicts[y1][x] = conflicts[y2][x] = true;
                    }
                }
            }
        }

        // conflicts in corners
        if (!self.isGoal(0, 0) && (self.isGoal(1, 0) && !conflicts[0][1]
            || self.isGoal(0, 1) && !conflicts[1][0])) {
            distance += 2;
        }
        if (!self.isGoal(0, self.height - 1) &&
            (self.isGoal(1, self.height - 1) && !conflicts[self.height - 1][1]
                || self.isGoal(0, self.height - 2) && !conflicts[self.height - 2][0])) {
            distance += 2;
        }
        if (!self.isGoal(self.width - 1, 0) &&
            (self.isGoal(self.width - 2, 0) && !conflicts[0][self.width - 2]
                || self.isGoal(self.width - 1, 1) && !conflicts[1][self.width - 1])) {
            distance += 2;
        }

        return distance;
    };

    Board.prototype.getPossibleTurns = function () {
        var self = this;
        var turns = {};
        if (self.y0 > 0) {
            turns['down'] = { x: self.x0, y: self.y0 - 1 };
        }
        if (self.y0 < self.height - 1) {
            turns['up'] = { x: self.x0, y: self.y0 + 1 };
        }
        if (self.x0 > 0) {
            turns['right'] = { x: self.x0 - 1, y: self.y0 };
        }
        if (self.x0 < self.width - 1) {
            turns['left'] = { x: self.x0 + 1, y: self.y0 };
        }
        _.each(turns, function (turn, dir) {
            turn.dir = dir;
            turn.n = self.index[turn.y][turn.x].n;
            var newBoard = self.clone();
            newBoard.turn(dir);
            turn.distance = newBoard.getDistance();
            turn.hash = newBoard.getPositionHash();
        });
        return turns;
    };

    Board.prototype.turn = function (direction) {
        var self = this;
        var x0 = self.x0, y0 = self.y0, tileX, tileY;
        if (direction === 'down' && y0 > 0) {
            tileX = x0;
            tileY = y0 - 1;
        }
        else if (direction === 'up' && y0 < self.height - 1) {
            tileX = x0;
            tileY = y0 + 1;
        }
        else if (direction === 'right' && x0 > 0) {
            tileX = x0 - 1;
            tileY = y0;
        }
        else if (direction === 'left' && x0 < self.width - 1) {
            tileX = x0 + 1;
            tileY = y0;
        }

        if (!_.isUndefined(tileX)) {
            var tile = self.index[tileY][tileX];
            tile.place(x0, y0);
            self.index[y0][x0] = tile;
            self.index[tileY][tileX] = undefined;
            self.x0 = tileX;
            self.y0 = tileY;
            self.trigger('turn', tile.n, tile.x, tile.y);
        }
    };

    Board.prototype.on = function (event, handler) {
        var self = this;
        var parts = event.split('.', 2);
        var eventType = parts[0];
        if (_.isFunction(handler) && eventType !== '') {
            var eventDescr = { eventType: eventType, namespace: parts[1] || '', handler: handler };
            if (!_.isArray(self.events[eventType])) {
                self.events[eventType] = [];
            }
            self.events[eventType].push(eventDescr);
        }
    };

    Board.prototype.off = function (event) {
        var self = this;
        var parts = event.split('.', 2);
        var eventType = parts[0];
        var namespace = parts[1] || '';
        for (var et in self.events) {
            var filtered = _.reject(self.events[et], function (e) {
                var f = // immediate return doesn't work in chrome, I have no guess
                    (namespace === '' && eventType === e.eventType) ||
                        (eventType === '' && namespace === e.namespace) ||
                        (eventType === e.eventType && namespace === e.namespace);
                return f;
            });
            self.events[et] = filtered;
        }
    };

    Board.prototype.trigger = function (eventType) {
        var self = this;
        if (_.isArray(self.events[eventType])) {
            var args = _.toArray(arguments).slice(1);
            _.each(self.events[eventType], function (e) {
                e.handler.apply(null, args);
            });
        }
    };

    Board.prototype.getPositionHash = function () {
        var self = this;
        if (self.area > hashBase.length) {
            throw "Too big board";
        }
        return _.reduce(self.tiles, function (memo, tile) {
            return memo + hashBase[ tile.y * self.width + tile.x ];
        }, '');
    };

    Board.prototype.getPositionArray = function () {
        var self = this;
        var position = [];
        for (var y = 0; y < self.height; ++y) {
            for (var x = 0; x < self.width; ++x) {
                var tile = self.index[y][x];
                position.push(_.isUndefined(tile) ? 0 : tile.n + 1);
            }
        }
        return position;
    };

    Board.prototype.calculateParityOfSolved = function (width, height) {
        var tileMap = [];
        for (var y = 0; y < height; ++y) {
            for (var x = 0; x < width; ++x) {
                tileMap.push(y*w + (y % 2 === 0 ? x : width - 1 - x));
            }
        }
        tileMap.pop();
        var sum = 0;
        for (var i = 0; i < tileMap.length - 1; ++i) {
            for (var j = i + 1; j < tileMap.length; ++j) {
                if (tileMap[i] > tileMap[j]) {
                    ++sum;
                }
            }
        }
        return sum % 2;
    };

    Board.prototype.testSolubility = function () {
        var self = this;
        var tileMap = [];
        for (var y = 0; y < self.height; ++y) {
            // arrange tiles like snake
            if (y % 2 === 0) { // left to right for even rows (starting from zero)
                for (var x = 0; x < self.width; ++x) {
                    if (!_.isUndefined(self.index[y][x])) {
                        tileMap.push(self.index[y][x].n);
                    }
                }
            }
            else { // right to left for odd rows
                for (var x = self.width - 1; x >= 0; --x) {
                    if (!_.isUndefined(self.index[y][x])) {
                        tileMap.push(self.index[y][x].n);
                    }
                }
            }
        }

        var sum = 0;
        for (var i = 0; i < tileMap.length - 1; ++i) {
            for (var j = i + 1; j < tileMap.length; ++j) {
                if (tileMap[i] > tileMap[j]) {
                    ++sum;
                }
            }
        }

        return sum % 2 === self.parity;
    };

    window.FifteenPuzzle = function (width, height) {
        var self = this;
        var board = new Board(width, height);

        /**
         * Initializes a position by the given array of numbers.
         * Amount of numbers are equal to amount of board's tiles.
         * Empty tile is coded by zero in the array.
         * @param {Array} item's index is tile position, item value is number of tile
         */
        self.init = function (map) {
            board.init(map);
        };

        /**
         * Returns width of a board.
         * @returns {Number} width of a board
         */
        self.getWidth = function() {
            return board.width;
        };


        /**
         * Returns height of a board.
         * @returns {Number} height of a board
         */
        self.getHeight = function() {
            return board.height;
        };

        /**
         * Shuffles a game position.
         * Unsolvable positions are possible.
         * @see FifteenPuzzle#testSolubility
         */
        self.shuffle = function () {
            board.shuffle();
        };

        /**
         * Returns an array of tiles with their coords on board.
         * @returns {Array} [{x:x, y:y}, ...]
         */
        self.getTilePositions = function () {
            return board.getTilePositions();
        };

        /**
         * Return "manhattan distance" between a current position and goal position.
         * @returns {Number} positive integer number
         */
        self.getDistance = function () {
            return board.getDistance();
        };

        /**
         * Return an object with all possible turns.
         * Each turn object contains direction, coords and number of a tile turned,
         * a manhattan distance and position's hash code after the turn.
         * @returns {Object} {up: {dir:'up', x:x, y:y, n:n, distance:d, hash:h}, ... }
         */
        self.getPossibleTurns = function () {
            return board.getPossibleTurns();
        };

        /**
         * Make turn.
         * @param {String} direction turn direction: up|down|left|right
         */
        self.turn = function (direction) {
            board.turn(direction);
        };

        /**
         * Attach an event handler function for one of the event: newgame, refresh or turn.
         * You can append namespace to event name. Separate namespace by dot.
         * @param {String} event event name with an optional namespace
         * @param {Function} handler event handler function
         */
        self.on = function (event, handler) {
            board.on(event, handler);
        };

        /**
         * Detach an event handler for one of the event: newgame, refresh or turn.
         * You can append namespace after the eventname, or use only namespace beginning a dot.
         * @param {String} event event name with an optional namespace
         */
        self.off = function (event) {
            board.off(event);
        };

        /**
         * Return hash code of a current position.
         * Length of hash is equal to amount of cells on the board.
         * @returns {String} hash-code
         */
        self.getPositionHash = function () {
            return board.getPositionHash();
        };

        /**
         * Return array of tile numbers.
         * @returns {Array}
         */
        self.getPositionArray = function () {
            return board.getPositionArray();
        };

        /**
         * Test solubility of a current game position.
         * @returns {Boolean}
         */
        self.testSolubility = function () {
            return board.testSolubility();
        };
    };
})();