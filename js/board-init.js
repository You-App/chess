var autoPromotion = true; // auto promotion flag
var showHint = true; // show hint flag
var analyzeMode = false; // analyze mode flag

// Function to start the game
function startGame() {
  gameStarted = true;
  game.reset();
  board.start();
  stopTimer();
  resetGame();
  startTimer();

  // Reset flags and variables
  gameEnd = false;
  engineDisabled = false;
  stateAnalyze = false;
  stateAnalyzeMatch = '';
  stateHint = false;

  // Clear log
  dumpLog();

  // Update UI
  $('#btn-take-back').addClass('disabled');
  $('#game-analyze-string').text('').addClass('hidden');
  $('#game-turns-history ol').html('');

  // Generate initial list of moves
  listMoves();

  // Add event listeners
  $('#btn-show-hint').off().click(function() {
    if (!stateHint) {
      stateHint = true;
      $(this).addClass('loading disabled');
      stockfish.postMessage('go depth 10');
    }
  });

  $('#btn-analyze').off().click(function() {
    if (!stateAnalyze) {
      stateAnalyze = true;
      $(this).addClass('loading disabled');
      stockfish.postMessage('go depth ' + staticSkill);
    }
  });

  $('#btn-take-back').off().click(function () {
    if (!game.started() || game.turn() === firstTurn) {
      return;
    }

    var prevFen = localStorage.getItem('boardHistory');
    if (prevFen.length > 0) {
      prevFen.pop();
    }

    if (prevFen.length === 0) {
      board.start();
      game.reset();
      stopTimer();

      // Reset flags and variables
      gameEnd = false;
      engineDisabled = false;
      stateAnalyze = false;
      stateAnalyzeMatch = '';
      stateHint = false;

      // Clear log
      dumpLog();

      // Update UI
      $('#btn-take-back').addClass('disabled');
      $('#game-analyze-string').text('').addClass('hidden');
      $('#game-turns-history ol').html('');
    } else {
      loadBoard(prevFen[prevFen.length - 1], true);
    }

    listMoves();
  });

  $('#btn-restart').off().click(function () {
    if (!game.started()) {
      return;
    }

    stopTimer();
    board.start();
    game.reset();
    resetGame();
    startTimer();

    // Reset flags and variables
    gameEnd = false;
    engineDisabled = false;
    stateAnalyze = false;
    stateAnalyzeMatch = '';
    stateHint = false;

    // Clear log
    dumpLog();

    // Update UI
    $('#btn-take-back').addClass('disabled');
    $('#game-analyze-string').text('').addClass('hidden');
    $('#game-turns-history ol').html('');

    // Generate initial list of moves
    listMoves();
  });
}

// Function to reset the game
function resetGame() {
  gameStarted = false;
  playerSide = 'w';
  opponentSide = 'b';
  firstTurn = 'player';
  promotionFigure = 'q';
  togglePlayer = false;
  engineSkill = 8;
  staticSkill = 16;

  // Set initial position
  var position = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w';

  // Load initial position
  loadBoard(position, true);
}

// Function to load a specific board position
function loadBoard(fen, disableEngine) {
  if (gameStarted) {
    stopTimer();
  }

  board.position(fen);
  game.load(fen);

  // Disable engine if required
  if (disableEngine) {
    engineDisabled = true;
  }

  // Update UI
  $('#board-positions-data').text('');
  $('#btn-take-back').addClass('disabled');
  dumpLog();

  if (gameStarted) {
    startTimer();
  }
}

// Function to handle promotion events
function onPromotion(event) {
  promotionEvent = event;
  $('#promotionModal').modal('show');

  // Add event listeners for promotion options
  $('.promotion-option').off().click(function() {
    promotionFigure = $(this).attr('data-piece');
    movePiece(promotionPos, moveSource, moveTarget, promotionFigure);
    $('#promotionModal').modal('hide');
  });
}

// Function to move a piece on the board
function movePiece(piece, source, target, promotion) {
  if (autoPromotion && piece.type === 'p' &&
    ((piece.color === 'w' && target.charAt(1) === '8') ||
    (piece.color === 'b' && target.charAt(1) === '1'))) {
    onPromotion({source: source, target: target});
    return;
  }

  var move = game.move({
    from: source,
    to: target,
    promotion: promotion
  });

  if (!move) {
    return;
  }

  board.position(game.fen());

  checkPositions('player');
  checkAnalyzeOption();
  updateGameEndStatus();

  if (game.history().length > 0) {
    $('#btn-take-back').removeClass('disabled');
  }

  listMoves();

  if (engineDisabled || gameEnd) {
    return;
  }

  if (playerSide === 'w' && game.turn() === 'b' ||
    playerSide === 'b' && game.turn() === 'w') {
    startTimer();
    return;
  }

  stopTimer();

  var fen = game.fen();
  var moves = board.history();
  stockfish.postMessage('position fen ' + fen + ' moves ' + moves);
  stockfish.postMessage('go depth ' + engineSkill);
}

// Function to start the timer
function startTimer() {
  if (gameEnd) {
    return;
  }

  var timerElement = $('#game-timer');

  var timeSeconds = timerElement.attr('data-time');
  var time = parseInt(timeSeconds, 10);
  var minutes = Math.floor(time / 60);
  var seconds = time - (minutes * 60);

  if (!timeSeconds) {
    timerElement.attr('data-time', 0);
    return;
  }

  timerElement.text(('00' + minutes).slice(-2) + ':' + ('00' + seconds).slice(-2));

  gameTimer = setInterval(function() {
    if (gameStarted && !gameEnd) {
      var currentTime = timerElement.attr('data-time');
      var currentTimeInt = parseInt(currentTime, 10);
      var minutes = Math.floor(currentTimeInt / 60);
      var seconds = currentTimeInt - (minutes * 60);

      if (minutes === 0 && seconds === 0) {
        gameEnd = true;
        timerElement.addClass('text-danger');
        return;
      }

      if (seconds === 0) {
        minutes--;
        seconds = 59;
      } else {
        seconds--;
      }

      var newTime = ('00' + minutes).slice(-2) + ':' + ('00' + seconds).slice(-2);

      timerElement.text(newTime);
      timerElement.attr('data-time', (currentTimeInt - 1));

      if (showHint && currentTimeInt === 6) {
        stateHint = true;
        $(this).addClass('loading disabled');
        stockfish.postMessage('go depth 10');
      }
    }
  }, 1000);
}

// Function to stop the timer
function stopTimer() {
  clearInterval(gameTimer);
  $('#game-timer').removeClass('text-danger');
}

// Function to check positions and update UI
function checkPositions(player) {
  var positions = {
    'king': ['e1', 'e8'],
    'checkmate': false,
    'stalemate': false,
    'insufficient': false,
  };

  for (var i = 0; i < 2; i++) {
    var result = game.validate();
    if (result.status === 'illegal') {
      gameEnd = true;
      stateAnalyze = false;
      stateHint = false;
      positions.checkmate = true;

      if (player === 'player') {
        dumpLog('Checkmate! You lost.');
        $('#game-positions-data').text('Checkmate! You lost.');
      } else {
        dumpLog('Checkmate! You win.');
        $('#game-positions-data').text('Checkmate! You win.');
      }

      break;
    } else if (result.status === 'draw') {
      gameEnd = true;
      stateAnalyze = false;
      stateHint = false;

      if (result.type === 'stalemate') {
        positions.stalemate = true;
        dumpLog('Stalemate! It\'s a draw.');
        $('#game-positions-data').text('Stalemate! It\'s a draw.');
      } else if (result.type === 'insufficient_material') {
        positions.insufficient = true;
        dumpLog('Insufficient material! It\'s a draw.');
        $('#game-positions-data').text('Insufficient material! It\'s a draw.');
      } else if (result.type === 'threefold_repetition') {
        dumpLog('Threefold repetition! It\'s a draw.');
        $('#game-positions-data').text('Threefold repetition! It\'s a draw.');
      } else if (result.type === 'fivefold_repetition') {
        dumpLog('Fivefold repetition! It\'s a draw.');
        $('#game-positions-data').text('Fivefold repetition! It\'s a draw.');
      } else if (result.type === 'seventyfive_moves') {
        dumpLog('Seventy-five moves rule! It\'s a draw.');
        $('#game-positions-data').text('Seventy-five moves rule! It\'s a draw.');
      }

      break;
    } else if (result.status === 'check') {
      positions.check = true;
      dumpLog('Check!');

      if (player === 'player') {
        $('#game-positions-data').text('Check!');
      } else {
        $('#game-positions-data').text('Your opponent is in check!');
      }
    }
  }

  return positions;
}

// Function to check if analyze option should be enabled
function checkAnalyzeOption() {
  var analyzeButton = $('#btn-analyze');

  if (stateAnalyze || stateHint) {
    analyzeButton.addClass('disabled');
  } else {
    analyzeButton.removeClass('disabled');
  }
}

// Function to update game end status
function updateGameEndStatus() {
  if (game.game_over()) {
    gameEnd = true;
    stopTimer();

    if (game.in_draw()) {
      $('#game-positions-data').text('Draw');
    } else if (game.in_checkmate()) {
      $('#game-positions-data').text('Checkmate');
    }
  }
}

// Start the game
startGame();
