(function ($) {
    var SOLVING = {
        IDLE: 0,
        RUNNING: 1,
        STOPPED: 2
    };

    $.widget('game.fifteen_puzzle', {
        options: {
            width: 4,
            height: 4,
            tileSize: 75,
            tileSpace: 10
        },

        _getHash: function () {
            var char = '0123456789abcdefghijklmnopqrstuvwxyz';
            return _.range(10).reduce(function (memo) {
                return memo + char[Math.random() * char.length];
            }, '.view');
        },
        _create: function () {
            var self = this;

            self._setOption('width', self.options.width);
            self._setOption('height', self.options.height);

            if (self.options.width < 3 || self.options.height < 3) {
                throw 'Too small board';
            }

            self._widgetHash = _.uniqueId('.view');
            self._createUI();

            self.game = new FifteenPuzzle(self.options.width, self.options.height);
            self.turns = 0;
            self.solving = SOLVING.IDLE;
            self.positions = {};
            self.previousHash = '';
            self.tiles = _.times(self.options.width * self.options.height - 1, function (i) {
                return $('<div class="tile">' + (i + 1) + '<div class="prio"></div></div>')
                    .appendTo(self.$board)
                    .css('width', self.options.tileSize + 'px')
                    .css('height', self.options.tileSize + 'px')
                    .css('font-size', (self.options.tileSize * .5) + 'px')
                    .css('line-height', (self.options.tileSize - 10) + 'px');
            });
            self.$tiles = self.$board.find('.tile');
            self.refresh();
            self._checkSolved();

            self._initEvents();
        },

        _createUI: function () {
            var self = this;

            self.element.addClass("fifteen-puzzle initial")
                .css('width', self._getX(self.options.width) + 'px')
                .css('height', self._getY(self.options.height) + 'px');
            self.$panel = $('<div class="panel"/>').appendTo(self.element);
            self.$board = $('<div class="board"/>').appendTo(self.element);
            self.$btnShuffle = $('<div class="btn shuffle">Shuffle</div>').appendTo(self.$panel).button();
            self.$infoSolvable = $('<div class="info solubility ui-widget center"><div class="yes">Solvable</div><div class="no">Unsolvable</div></div>').appendTo(self.$panel);
            self.$permalink = $('<div class="info permalink ui-widget center"><a href="" target="_blank">Permalink</a> to this position</div>').appendTo(self.$panel).find('a');
            self.$btnSolve = $('<div class="btn solve">Solve</div>').appendTo(self.$panel).button();
            self.$btnStop = $('<div class="btn stop-solving">Stop</div>').appendTo(self.$panel).button();
            self.$cbByStep = $('<div class="cb step-by-step ui-widget center"><label><input type="checkbox"/> Step by step</label></div>').appendTo(self.$panel).find('input');
            self.$cbWithTips = $('<div class="cb with-tips ui-widget center"><label><input type="checkbox"/> Highlight good moves</label></div>').appendTo(self.$panel).find('input');
            self.$infoTurns = $('<div class="info shuffle ui-widget center">Moves<div class="value">0</div></div>').appendTo(self.$panel).find('.value');
            self.$infoDistance = $('<div class="info distance ui-widget center"><a href="http://en.wikipedia.org/wiki/Manhattan_distance" target="_blank">Manhattan distance</a><div class="value">&nbsp;</div></div>').appendTo(self.$panel).find('.value');
            self.$infoSolved = $('<div class="info solved ui-widget center"><div class="yes">Solved!</div><div class="no">Not solved...</div></div>').appendTo(self.$panel);
        },

        _initEvents: function () {
            var self = this;

            self.game.on('refresh' + self._widgetHash, function () {
                self.refresh();
            });

            self.game.on('newgame' + self._widgetHash, _.bind(self._onNewGame, self));

            self.game.on('turn' + self._widgetHash, _.bind(self._onTurn, self));

            self.$board.on('click', '.tile.sliding', function (event) {
                self.game.turn($(event.currentTarget).data('turn'));
            });

            self.$btnShuffle.on('click', _.bind(self.game.shuffle, self.game));

            self.$btnSolve.on('click', function () {
                if (!self.$cbByStep.prop('checked')) {
                    self._changeSolvingState(SOLVING.RUNNING);
                }
                self._makeAutoTurn();
            });

            self.$btnStop.on('click', function () {
                self._changeSolvingState(SOLVING.STOPPED);
            });

            self.$cbWithTips.on('click', function() {
                self.$board.toggleClass('show-tips', $(this).prop('checked'));
            });
        },

        _setOption: function (key, value) {
            if (key === 'width' || key === 'height') {
                value = Math.floor(value);
            }
            this._super(key, value);
        },

        refresh: function () {
            var self = this;
            var gameTiles = self.game.getTilePositions();
            _.each(self.tiles, function ($tile, i) {
                self._placeTile($tile, gameTiles[i]);
            });
            self._refreshGameInfo();
            self._cleanupTileStyles();
            self._setupTileStyles();
        },

        init: function (map) {
            this.game.init(map);
        },

        shuffle: function () {
            this.game.shuffle();
        },

        _placeTile: function ($tile, pos) {
            $tile.css('left', this._getX(pos.x) + "px");
            $tile.css('top', this._getY(pos.y) + "px");
        },

        _getX: function (x) {
            return x * (this.options.tileSize + this.options.tileSpace) + this.options.tileSpace;
        },

        _getY: function (y) {
            return y * (this.options.tileSize + this.options.tileSpace) + this.options.tileSpace;
        },

        _refreshGameInfo: function () {
            var self = this;
            self.$infoTurns.text(self.turns);
            self.$infoDistance.text(self.game.getDistance());
        },

        _changeSolvingState: function (newState) {
            var self = this;
            if (newState === SOLVING.RUNNING) {
                self.solving = SOLVING.RUNNING;
                self.element.addClass('solving');
                self.$btnShuffle.button('disable');
                self.$cbByStep.prop('disabled', true)
                    .closest('.ui-widget').addClass('ui-state-disabled');
            }
            else if (newState === SOLVING.STOPPED) {
                self.solving = SOLVING.STOPPED;
                self._createPermalink();
            }
            else if (newState === undefined) { // called without an argument
                if (self.solving === SOLVING.STOPPED) {
                    self.solving = SOLVING.IDLE;
                    self.element.removeClass('solving');
                    self.$btnShuffle.button('enable');
                    self.$cbByStep.prop('disabled', false)
                        .closest('.ui-widget').removeClass('ui-state-disabled');
                }
            }
        },

        _checkSolved: function () {
            var self = this;
            if (self.game.getDistance() === 0) {
                self._changeSolvingState(SOLVING.STOPPED);
                self.element.addClass('solved');
                self.$btnSolve.button('disable');
                self.$cbByStep.prop('disabled', true)
                    .closest('.ui-widget').addClass('ui-state-disabled');
            }
        },

        _onNewGame: function() {
            var self = this;
            self.positions = {};
            self.turns = 0;
            self._refreshGameInfo();
            self.element.removeClass('solved initial');
            self.$btnSolve.button('enable');
            self.$cbByStep.prop('disabled', false)
                .closest('.ui-widget').removeClass('ui-state-disabled');
            self.$infoSolvable.toggleClass('yes', self.game.testSolubility());
            self._createPermalink();
        },

        _onTurn: function (n, x, y) {
            var self = this;
            self._cleanupTileStyles();
            ++self.turns;
            self._refreshGameInfo();
            if (self.solving !== SOLVING.RUNNING) {
                // human's turn
                self.tiles[n].animate({
                        left: self._getX(x),
                        top: self._getY(y)
                    }, 90,
                    function () {
                        self._setupTileStyles();
                        self._checkSolved();
                    });
                self._createPermalink();
            }
            else {
                // machine's turn, skip animation of moving
                self.tiles[n]
                    .css('left', self._getX(x) + 'px')
                    .css('top', self._getY(y) + 'px');
                self._setupTileStyles();
                self._checkSolved();
                self._changeSolvingState();
                if (self.solving === SOLVING.RUNNING) {
                    setTimeout(_.bind(self._makeAutoTurn, self), 1);
                }
            }
        },

        _getPossibleTurns: function () {
            var self = this;
            var hash = self.game.getPositionHash();
            var distance = self.game.getDistance();
            if (!_.has(self.positions, hash)) {
                self.positions[hash] = self.game.getPossibleTurns();
                _.each(self.positions[hash], function (turn, dir) {
                    turn.prio = turn.distance - distance;
                    turn.goodTurn = turn.prio < 0;
                });
            }
            return self.positions[hash];
        },

        _cleanupTileStyles: function () {
            this.$tiles.removeClass('sliding good-turn').removeData('turn');
        },

        _setupTileStyles: function () {
            var self = this;
            _.each(self._getPossibleTurns(), function (turn, dir) {
                self.tiles[turn.n].addClass('sliding').data('turn', dir)
                    .toggleClass('good-turn', turn.goodTurn)
                    .find('.prio').text(turn.prio);
            });
        },

        _makeAutoTurn: function () {
            var self = this;

            var nextTurn = _.chain(self._getPossibleTurns())
                .filter(function (turn) {
                    return turn.hash != self.previousHash;
                })
                .sortBy('prio').value()[0];

            nextTurn.prio++;

            self.previousHash = self.game.getPositionHash();

            self.game.turn(nextTurn.dir);
        },

        _createPermalink: function () {
            var self = this;

            var position = self.game.getPositionArray();
            var href = document.location.toString().split('?', 2)[0] +
                '?' + self.game.getWidth() + 'x' + self.game.getHeight() + ':' + position.join(',');
            self.$permalink.attr('href', href);
        },

        destroy: function () {
            this.game.off(this._widgetHash);
            this.element.empty();
        }
    });
})(jQuery);