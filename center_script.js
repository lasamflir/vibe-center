document.addEventListener('DOMContentLoaded', () => {
    // Game state variables
    let boardSize = 7;
    let boardState = [];
    let thoughtsState = []; // Bot's expected outcome
    let currentPlayer = 1; // 1 for black, 2 for white
    let gameOver = false;
    let playerTypes = {
        1: 'human', // Black player type (human/bot)
        2: 'human'  // White player type (human/bot)
    };
    let botThinking = false;
    let botMoveTimeout = null;
    let lastMove = null; // Track last move made
    
    // Bot constants
    const BOT_TYPES = {
        BAD: 'bad-bot',
        GOOD: 'good-bot'
    };
    
    // Alpha-beta search state
    let searchInfo = {
        nodesExplored: 0,
        maxDepthReached: 0,
        bestMoveFound: null,
        timeExceeded: false
    };
    
    // Global flag to track if a search is in progress
    let searchInProgress = false;
    
    // DOM elements
    const boardElement = document.getElementById('game-board');
    const thoughtsBoardElement = document.getElementById('thoughts-board');
    const thoughtsWrapperElement = document.getElementById('thoughts-wrapper');
    const showThoughtsCheckbox = document.getElementById('show-thoughts');
    const statusElement = document.getElementById('game-status');
    const boardSizeSelect = document.getElementById('board-size');
    const newGameButton = document.getElementById('new-game');
    const player1TypeSelect = document.getElementById('player1-type');
    const player2TypeSelect = document.getElementById('player2-type');
    const botTimeLimitBlackInput = document.getElementById('bot-time-limit-black');
    const botTimeLimitWhiteInput = document.getElementById('bot-time-limit-white');
    const thinkingInfoElement = document.getElementById('thinking-info');
    
    // Initialize the game
    initGame();
    
    // Event listeners
    boardSizeSelect.addEventListener('change', () => {
        boardSize = parseInt(boardSizeSelect.value);
        initGame();
    });
    
    newGameButton.addEventListener('click', initGame);
    
    player1TypeSelect.addEventListener('change', () => {
        playerTypes[1] = player1TypeSelect.value;
        // If it's player 1's turn and now a bot, make a move
        if (currentPlayer === 1 && playerTypes[1].includes('bot') && !gameOver) {
            makeBotMove();
        }
    });
    
    player2TypeSelect.addEventListener('change', () => {
        playerTypes[2] = player2TypeSelect.value;
        // If it's player 2's turn and now a bot, make a move
        if (currentPlayer === 2 && playerTypes[2].includes('bot') && !gameOver) {
            makeBotMove();
        }
    });
    
    showThoughtsCheckbox.addEventListener('change', () => {
        thoughtsWrapperElement.style.display = showThoughtsCheckbox.checked ? 'flex' : 'none';
    });
    
    function initGame() {
        // Reset game state
        currentPlayer = 1;
        gameOver = false;
        lastMove = null; // Reset last move
        
        // Cancel any pending bot moves
        if (botMoveTimeout) {
            clearTimeout(botMoveTimeout);
            botMoveTimeout = null;
        }
        botThinking = false;
        
        // Reset search info
        searchInfo = {
            nodesExplored: 0,
            maxDepthReached: 0,
            bestMoveFound: null,
            timeExceeded: false
        };
        
        // Clear thinking info
        thinkingInfoElement.textContent = '';
        
        // Get player types
        playerTypes[1] = player1TypeSelect.value;
        playerTypes[2] = player2TypeSelect.value;
        
        // Create empty boards
        boardState = Array(boardSize).fill().map(() => Array(boardSize).fill(0));
        thoughtsState = Array(boardSize).fill().map(() => Array(boardSize).fill(0));
        
        // Render the boards
        renderBoard();
        renderThoughtsBoard();
        
        // Set initial thoughts board visibility
        thoughtsWrapperElement.style.display = showThoughtsCheckbox.checked ? 'flex' : 'none';
        
        // Update status message
        updateStatus();
        
        // Highlight legal moves
        highlightLegalMoves();
        
        // If current player is a bot, make a move
        if (playerTypes[currentPlayer].includes('bot')) {
            makeBotMove();
        }
    }
    
    function renderBoard() {
        // Clear the board
        boardElement.innerHTML = '';
        
        // Set grid template
        boardElement.style.gridTemplateColumns = `repeat(${boardSize}, 50px)`;
        
        // Calculate center position
        const centerPos = Math.floor(boardSize / 2);
        
        // Create cells
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                
                // Mark center cell
                if (row === centerPos && col === centerPos) {
                    cell.classList.add('center');
                }
                
                // Mark cells that can see the center
                if (canSeeCenter(row, col)) {
                    cell.classList.add('sees-center');
                }
                
                // Add stone if the cell is occupied
                if (boardState[row][col] !== 0) {
                    cell.classList.add('occupied');
                    const stone = document.createElement('div');
                    
                    // Check if this is the last move played
                    const isLastMove = lastMove && lastMove.row === row && lastMove.col === col;
                    
                    // Add square class if this is the last move
                    stone.className = `stone player${boardState[row][col]}${isLastMove ? ' square' : ''}`;
                    cell.appendChild(stone);
                }
                
                // Add click event
                cell.addEventListener('click', () => makeMove(row, col));
                
                // Store row and col data for accessibility
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                boardElement.appendChild(cell);
            }
        }
    }
    
    function renderThoughtsBoard() {
        // Clear the board
        thoughtsBoardElement.innerHTML = '';
        
        // Set grid template
        thoughtsBoardElement.style.gridTemplateColumns = `repeat(${boardSize}, 50px)`;
        
        // Calculate center position
        const centerPos = Math.floor(boardSize / 2);
        
        // Create cells
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                
                // Mark center cell
                if (row === centerPos && col === centerPos) {
                    cell.classList.add('center');
                }
                
                // Mark cells that can see the center
                if (canSeeCenter(row, col)) {
                    cell.classList.add('sees-center');
                }
                
                // Add stone if the cell is occupied in the thoughts state
                if (thoughtsState[row][col] !== 0) {
                    cell.classList.add('occupied');
                    const stone = document.createElement('div');
                    
                    // Check if this stone is already on the actual board (existing) or predicted
                    const isPredicted = boardState[row][col] !== thoughtsState[row][col];
                    
                    // Use square shape only for predicted stones
                    stone.className = `stone player${thoughtsState[row][col]}${isPredicted ? ' square' : ''}`;
                    cell.appendChild(stone);
                }
                
                // Store row and col data for accessibility
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                thoughtsBoardElement.appendChild(cell);
            }
        }
    }
    
    // Function to check if a cell can see the center
    function canSeeCenter(row, col) {
        const centerPos = Math.floor(boardSize / 2);
        
        // If this is the center itself, return false
        if (row === centerPos && col === centerPos) {
            return false;
        }
        
        // Check all 8 directions
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],  // NW, N, NE
            [0, -1],           [0, 1],    // W, E
            [1, -1],  [1, 0],  [1, 1]     // SW, S, SE
        ];
        
        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            
            while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                if (r === centerPos && c === centerPos) {
                    return true; // Can see the center
                }
                
                if (boardState[r][c] !== 0) {
                    break; // Blocked by a piece
                }
                
                r += dr;
                c += dc;
            }
        }
        
        return false; // Can't see the center from any direction
    }
    
    function makeMove(row, col) {
        // Don't allow moves after game over or on occupied cells
        if (gameOver || boardState[row][col] !== 0 || botThinking) {
            return;
        }
        
        // If it's a bot's turn, don't allow human moves
        if (playerTypes[currentPlayer].includes('bot')) {
            return;
        }
        
        // Check if the move is legal
        if (!isLegalMove(row, col, currentPlayer)) {
            return;
        }
        
        // Execute the move and handle consequences
        executeMove(row, col);
    }
    
    function executeMove(row, col) {
        // Make the move
        boardState[row][col] = currentPlayer;
        
        // Record this as the last move
        lastMove = { row, col };
        
        // Check for win (center cell)
        const centerPos = Math.floor(boardSize / 2);
        if (row === centerPos && col === centerPos) {
            gameOver = true;
            updateStatus(true);
        } else {
            // Switch players
            currentPlayer = currentPlayer === 1 ? 2 : 1;
            
            // Check if next player has any legal moves
            const nextPlayerMoves = findLegalMoves(currentPlayer);
            if (nextPlayerMoves.length === 0) {
                // Game is a draw if a player has no legal moves
                gameOver = true;
                updateStatus(false, true);
            } else {
                updateStatus();
            }
        }
        
        // Re-render the board and highlight legal moves
        renderBoard();
        
        if (!gameOver) {
            // Only highlight legal moves for human players
            highlightLegalMoves(false);
            
            // If next player is a bot, make a move
            if (playerTypes[currentPlayer].includes('bot')) {
                makeBotMove();
            }
        }
    }
    
    function makeBotMove() {
        if (gameOver || botThinking) return;
        
        botThinking = true;
        const player = currentPlayer === 1 ? 'Black' : 'White';
        const botType = playerTypes[currentPlayer] === BOT_TYPES.BAD ? 'Bad Bot' : 'Good Bot';
        statusElement.textContent = `${player} (${botType}) is thinking...`;
        
        // Show legal moves
        highlightLegalMoves(true);
        
        // Reset search info
        searchInfo = {
            nodesExplored: 0,
            maxDepthReached: 0,
            bestMoveFound: null,
            timeExceeded: false
        };
        
        // Determine which bot strategy to use
        if (playerTypes[currentPlayer] === BOT_TYPES.BAD) {
            makeBadBotMove();
        } else if (playerTypes[currentPlayer] === BOT_TYPES.GOOD) {
            makeGoodBotMove();
        }
    }
    
    function makeBadBotMove() {
        // Find all legal moves
        const legalMoves = findLegalMoves(currentPlayer);
        
        // Calculate center position
        const centerPos = Math.floor(boardSize / 2);
        let centerMove = null;
        
        for (const move of legalMoves) {
            if (move.row === centerPos && move.col === centerPos) {
                centerMove = move;
                break;
            }
        }
        
        // If there are legal moves, prioritize center or select randomly
        if (legalMoves.length > 0) {
            const selectedMove = centerMove || legalMoves[Math.floor(Math.random() * legalMoves.length)];
            
            // Wait at least one second before making the move
            botMoveTimeout = setTimeout(() => {
                botThinking = false;
                executeMove(selectedMove.row, selectedMove.col);
                botMoveTimeout = null;
            }, 1000);
        } else {
            botThinking = false;
            updateStatus();
        }
    }
    
    function makeGoodBotMove() {
        // Get time limit from UI based on current player
        const timeLimit = currentPlayer === 1 ? 
            parseInt(botTimeLimitBlackInput.value) : 
            parseInt(botTimeLimitWhiteInput.value);
        
        const playerColor = currentPlayer === 1 ? 'Black' : 'White';
        const startTime = Date.now();
        
        // Find all legal moves
        const legalMoves = findLegalMoves(currentPlayer);
        
        if (legalMoves.length === 0) {
            // Game is a draw if current player has no legal moves
            gameOver = true;
            botThinking = false;
            updateStatus(false, true);
            return;
        }
        
        // Check for immediate win (center move)
        const centerPos = Math.floor(boardSize / 2);
        for (const move of legalMoves) {
            if (move.row === centerPos && move.col === centerPos) {
                // Winning move found - execute immediately
                botThinking = false;
                thinkingInfoElement.textContent = `Found winning move immediately`;
                executeMove(move.row, move.col);
                return;
            }
        }
        
        // Reset search in progress flag
        searchInProgress = true;
        
        // Variables for iterative deepening search
        let depth = 1;
        let bestMove = null;
        let bestScore = -Infinity;
        let foundForcedWin = false;
        let foundForcedLoss = false;
        let searchTimeoutId = null;
        
        // Calculate maximum reasonable search depth
        const emptyCells = countEmptyCells();
        const maxReasonableDepth = emptyCells
        
        // Ensure any previous searches are cancelled
        cancelAllSearches();
        
        // Clear thoughts state before starting new search
        thoughtsState = JSON.parse(JSON.stringify(boardState));
        
        const searchUntilTimeLimit = () => {
            // Calculate remaining time
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, timeLimit - elapsedTime);
            
            // Immediately exit if search should be stopped or we've reached the max reasonable depth
            if (!searchInProgress || gameOver || foundForcedWin || foundForcedLoss || depth > maxReasonableDepth) {
                clearSearchAndMakeMove();
                return;
            }
            
            // Check if we've exceeded the time limit
            if (elapsedTime >= timeLimit || searchInfo.timeExceeded) {
                clearSearchAndMakeMove();
                return;
            }
            
            // Try to search at the current depth
            console.log(`${playerColor} searching at depth ${depth} - Remaining time: ${remainingTime}ms of ${timeLimit}ms`);
            const result = alphaBetaRoot(depth, currentPlayer, startTime, timeLimit, foundForcedWin || foundForcedLoss);
            
            // Update search info
            searchInfo.nodesExplored += result.nodesExplored;
            
            // If we found a better move and didn't exceed time, update best move
            if (!result.timeExceeded && result.move) {
                bestMove = result.move;
                bestScore = result.score;
                searchInfo.maxDepthReached = depth;
                
                // Update thoughts board with the principal variation
                if (result.principalVariation && result.principalVariation.length > 0) {
                    // Apply the full sequence of moves to show final position
                    thoughtsState = JSON.parse(JSON.stringify(boardState));
                    
                    // Apply each move in the principal variation
                    let currentPVPlayer = currentPlayer;
                    for (const pvMove of result.principalVariation) {
                        thoughtsState[pvMove.row][pvMove.col] = currentPVPlayer;
                        currentPVPlayer = currentPVPlayer === 1 ? 2 : 1;
                    }
                    
                    renderThoughtsBoard();
                }
                
                // If we found a winning move, stop all search and execute immediately
                if (bestScore === Infinity || result.foundForcedWin) {
                    console.log(`${playerColor} found forced win at depth ${depth}, stopping all searches - Time used: ${elapsedTime}ms of ${timeLimit}ms`);
                    foundForcedWin = true;
                    searchInProgress = false;
                    
                    cancelAllSearches();
                    
                    // Stop thinking and make move immediately
                    botThinking = false;
                    thinkingInfoElement.textContent = `Found forced win at depth ${depth}`;
                    executeMove(bestMove.row, bestMove.col);
                    return;
                }
                
                // If all moves lead to a loss, no need to search deeper
                if (bestScore === -Infinity && result.allMovesLoseAtDepth) {
                    console.log(`${playerColor} found forced loss at depth ${depth}, stopping deeper searches - Time used: ${elapsedTime}ms of ${timeLimit}ms`);
                    foundForcedLoss = true;
                    searchInfo.forcedLossDepth = depth;
                    clearSearchAndMakeMove();
                    return;
                }
            }
            
            // Update elapsed and remaining time for next iteration
            const currentElapsedTime = Date.now() - startTime;
            const currentRemainingTime = Math.max(0, timeLimit - currentElapsedTime);
            
            // Increase depth for next iteration if we should continue
            if (!result.timeExceeded && searchInProgress && !foundForcedWin && !foundForcedLoss && depth < maxReasonableDepth) {
                depth++;
                console.log(`${playerColor} preparing depth ${depth} search - Remaining time: ${currentRemainingTime}ms of ${timeLimit}ms`);
                searchTimeoutId = setTimeout(() => {
                    searchUntilTimeLimit();
                }, 0); // Continue search in next tick
            } else {
                // We exceeded time or should stop, use the best move found so far
                console.log(`${playerColor} search complete - Final depth: ${depth}, Time used: ${currentElapsedTime}ms of ${timeLimit}ms`);
                clearSearchAndMakeMove();
            }
        };
        
        // Helper function to cancel all searches
        function cancelAllSearches() {
            // Clear current timeout
            if (searchTimeoutId) {
                clearTimeout(searchTimeoutId);
                searchTimeoutId = null;
            }
            
            // Force clear all timeouts (more aggressive approach)
            const highestTimeoutId = setTimeout(() => {}, 0);
            for (let i = highestTimeoutId; i >= highestTimeoutId - 100; i--) {
                clearTimeout(i);
            }
        }
        
        // Helper function to clean up search and make the final move
        const clearSearchAndMakeMove = () => {
            // Do nothing if we already found a forced win
            if (foundForcedWin) {
                return;
            }
            
            cancelAllSearches();
            
            searchInProgress = false;
            botThinking = false;
            
            if (bestMove) {
                let infoMessage = `${playerColor} - Depth: ${searchInfo.maxDepthReached}, Nodes: ${searchInfo.nodesExplored}`;
                if (foundForcedLoss) {
                    infoMessage = `${playerColor} found forced loss at depth ${searchInfo.forcedLossDepth}. Playing best delaying move.`;
                }
                thinkingInfoElement.textContent = infoMessage;
                executeMove(bestMove.row, bestMove.col);
            } else if (legalMoves.length > 0) {
                bestMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                thinkingInfoElement.textContent = `Time exceeded, used random move`;
                executeMove(bestMove.row, bestMove.col);
            } else {
                updateStatus();
            }
        };
        
        // Start the search with a short delay to allow UI to update
        searchTimeoutId = setTimeout(() => {
            searchUntilTimeLimit();
        }, 10);
    }
    
    // Alpha-beta search root function
    function alphaBetaRoot(depth, player, startTime, timeLimit, searchTerminationFlag) {
        // Early exit if a forced win/loss was already found or search stopped
        if (searchTerminationFlag || !searchInProgress) {
            return {
                move: null,
                score: 0,
                timeExceeded: true,
                nodesExplored: 0,
                foundForcedWin: false,
                allMovesLoseAtDepth: false
            };
        }
        
        const legalMoves = findLegalMoves(player);
        
        // Order moves by distance to center
        const orderedMoves = orderMovesByCenter(legalMoves);
        
        let bestMove = null;
        let bestScore = -Infinity;
        let alpha = -Infinity;
        let beta = Infinity;
        let timeExceeded = false;
        let nodesExplored = 0;
        let foundForcedWin = false;
        let allMovesLoseAtDepth = true; // Assume all moves lose until proven otherwise
        let principalVariation = []; // Track the best sequence of moves
        
        for (const move of orderedMoves) {
            // Check if time limit exceeded
            if (Date.now() - startTime >= timeLimit) {
                timeExceeded = true;
                break;
            }
            
            // Make move on a copy of the board
            const boardCopy = JSON.parse(JSON.stringify(boardState));
            boardCopy[move.row][move.col] = player;
            nodesExplored++;
            
            // Check if this move wins
            const centerPos = Math.floor(boardSize / 2);
            if (move.row === centerPos && move.col === centerPos) {
                foundForcedWin = true;
                allMovesLoseAtDepth = false; // We found a winning move
                return { 
                    move, 
                    score: Infinity, 
                    timeExceeded: false, 
                    nodesExplored,
                    foundForcedWin,
                    allMovesLoseAtDepth: false,
                    principalVariation: [move] // Winning move is the only move in PV
                };
            }
            
            // Evaluate opponent's response
            const opponent = player === 1 ? 2 : 1;
            const result = alphaBeta(
                boardCopy, 
                depth - 1, 
                alpha, 
                beta, 
                false, // Minimizing player (opponent)
                opponent, 
                player,
                startTime, 
                timeLimit
            );
            
            nodesExplored += result.nodesExplored;
            
            // Check if time was exceeded during search
            if (result.timeExceeded) {
                timeExceeded = true;
                break;
            }
            
            const score = result.score;
            
            // If we found a move that doesn't lose, update flag
            if (score > -Infinity) {
                allMovesLoseAtDepth = false;
            }
            
            // Update best move and principal variation
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
                
                // Create principal variation with this move followed by opponent's best response sequence
                principalVariation = [move];
                if (result.principalVariation) {
                    principalVariation = principalVariation.concat(result.principalVariation);
                }
                
                // If this is a forced win, mark it
                if (score === Infinity) {
                    foundForcedWin = true;
                }
            }
            
            // Update alpha for pruning
            alpha = Math.max(alpha, score);
        }
        
        return {
            move: bestMove,
            score: bestScore,
            timeExceeded,
            nodesExplored,
            foundForcedWin,
            allMovesLoseAtDepth,
            principalVariation
        };
    }
    
    // Alpha-beta search function
    function alphaBeta(board, depth, alpha, beta, isMaximizing, currentSearchPlayer, originalPlayer, startTime, timeLimit) {
        // Early exit if a forced win was found or search stopped
        if (!searchInProgress) {
            return { score: 0, timeExceeded: true, nodesExplored: 0 };
        }
        
        // Check if time limit exceeded
        if (Date.now() - startTime >= timeLimit) {
            return { score: 0, timeExceeded: true, nodesExplored: 0 };
        }
        
        // Calculate center position
        const centerPos = Math.floor(boardSize / 2);
        
        // Check for terminal state (win/loss)
        if (board[centerPos][centerPos] !== 0) {
            // Game is over - center is occupied
            const winner = board[centerPos][centerPos];
            return { 
                score: winner === originalPlayer ? Infinity : -Infinity,
                timeExceeded: false,
                nodesExplored: 1,
                principalVariation: [] // Game over, no more moves
            };
        }
        
        // If depth limit reached, evaluate position
        if (depth === 0) {
            return { 
                score: evaluatePosition(board, originalPlayer),
                timeExceeded: false,
                nodesExplored: 1,
                principalVariation: [] // Reached evaluation depth
            };
        }
        
        let nodesExplored = 0;
        
        // Find legal moves for current player
        const legalMoves = [];
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col] === 0 && isLegalMoveOnBoard(board, row, col, currentSearchPlayer)) {
                    legalMoves.push({ row, col });
                }
            }
        }
        
        // Order moves by distance to center
        const orderedMoves = orderMovesByCenter(legalMoves);
        
        // If no moves, return draw value (0) - changed from previous scoring
        if (orderedMoves.length === 0) {
            return { 
                score: 0, // Draw value
                timeExceeded: false,
                nodesExplored: 1,
                principalVariation: []
            };
        }
        
        // Additional early termination condition:
        // If we're at a depth that exceeds the number of empty cells, terminate
        const emptyCells = countEmptyCellsOnBoard(board);
        if (depth > emptyCells) {
            return {
                score: evaluatePosition(board, originalPlayer),
                timeExceeded: false,
                nodesExplored: 1,
                principalVariation: []
            };
        }
        
        let principalVariation = [];
        
        if (isMaximizing) {
            let maxScore = -Infinity;
            
            for (const move of orderedMoves) {
                // Check for time limit
                if (Date.now() - startTime >= timeLimit) {
                    return { 
                        score: maxScore, 
                        timeExceeded: true, 
                        nodesExplored,
                        principalVariation 
                    };
                }
                
                // Make move on a copy of the board
                const boardCopy = JSON.parse(JSON.stringify(board));
                boardCopy[move.row][move.col] = currentSearchPlayer;
                nodesExplored++;
                
                // Check if this move wins
                if (move.row === centerPos && move.col === centerPos) {
                    return { 
                        score: Infinity,
                        timeExceeded: false,
                        nodesExplored,
                        principalVariation: [move] // Winning move is the only move in PV
                    };
                }
                
                // Recurse with opponent
                const nextPlayer = currentSearchPlayer === 1 ? 2 : 1;
                const result = alphaBeta(
                    boardCopy, 
                    depth - 1, 
                    alpha, 
                    beta, 
                    false, 
                    nextPlayer, 
                    originalPlayer,
                    startTime, 
                    timeLimit
                );
                
                nodesExplored += result.nodesExplored;
                
                if (result.timeExceeded) {
                    return { 
                        score: maxScore, 
                        timeExceeded: true, 
                        nodesExplored,
                        principalVariation 
                    };
                }
                
                // Update best move and principal variation if better move found
                if (result.score > maxScore) {
                    maxScore = result.score;
                    // New PV is this move followed by the opponent's best response
                    principalVariation = [move];
                    if (result.principalVariation) {
                        principalVariation = principalVariation.concat(result.principalVariation);
                    }
                }
                
                alpha = Math.max(alpha, maxScore);
                
                // Alpha-beta pruning
                if (beta <= alpha) {
                    break;
                }
            }
            
            return {
                score: maxScore,
                timeExceeded: false,
                nodesExplored,
                principalVariation
            };
            
        } else {
            let minScore = Infinity;
            
            for (const move of orderedMoves) {
                // Check for time limit
                if (Date.now() - startTime >= timeLimit) {
                    return { 
                        score: minScore, 
                        timeExceeded: true, 
                        nodesExplored,
                        principalVariation 
                    };
                }
                
                // Make move on a copy of the board
                const boardCopy = JSON.parse(JSON.stringify(board));
                boardCopy[move.row][move.col] = currentSearchPlayer;
                nodesExplored++;
                
                // Check if this move wins for opponent
                if (move.row === centerPos && move.col === centerPos) {
                    return { 
                        score: -Infinity,
                        timeExceeded: false,
                        nodesExplored,
                        principalVariation: [move] // Winning move is the only move in PV
                    };
                }
                
                // Recurse with opponent
                const nextPlayer = currentSearchPlayer === 1 ? 2 : 1;
                const result = alphaBeta(
                    boardCopy, 
                    depth - 1, 
                    alpha, 
                    beta, 
                    true, 
                    nextPlayer, 
                    originalPlayer,
                    startTime, 
                    timeLimit
                );
                
                nodesExplored += result.nodesExplored;
                
                if (result.timeExceeded) {
                    return { 
                        score: minScore, 
                        timeExceeded: true, 
                        nodesExplored,
                        principalVariation 
                    };
                }
                
                // Update best move and principal variation if better move found
                if (result.score < minScore) {
                    minScore = result.score;
                    // New PV is this move followed by the opponent's best response
                    principalVariation = [move];
                    if (result.principalVariation) {
                        principalVariation = principalVariation.concat(result.principalVariation);
                    }
                }
                
                beta = Math.min(beta, minScore);
                
                // Alpha-beta pruning
                if (beta <= alpha) {
                    break;
                }
            }
            
            return {
                score: minScore,
                timeExceeded: false,
                nodesExplored,
                principalVariation
            };
        }
    }
    
    // Find all legal moves for a player
    function findLegalMoves(player) {
        const legalMoves = [];
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (boardState[row][col] === 0 && isLegalMove(row, col, player)) {
                    legalMoves.push({ row, col });
                }
            }
        }
        return legalMoves;
    }
    
    // Order moves by distance to center for more efficient search
    function orderMovesByCenter(moves) {
        const centerPos = Math.floor(boardSize / 2);
        return moves.sort((a, b) => {
            const distA = Math.abs(a.row - centerPos) + Math.abs(a.col - centerPos);
            const distB = Math.abs(b.row - centerPos) + Math.abs(b.col - centerPos);
            return distA - distB; // Closer to center first
        });
    }
    
    // Check if a move is legal on a given board state
    function isLegalMoveOnBoard(board, row, col, player) {
        // If the cell is already occupied, it's not a legal move
        if (board[row][col] !== 0) {
            return false;
        }
        
        // Calculate the distance from the perimeter
        const distFromTop = row;
        const distFromBottom = boardSize - 1 - row;
        const distFromLeft = col;
        const distFromRight = boardSize - 1 - col;
        const distFromPerimeter = Math.min(distFromTop, distFromBottom, distFromLeft, distFromRight);
        
        // If the placement is on the perimeter, it's always legal
        if (distFromPerimeter === 0) {
            return true;
        }
        
        // Count the number of friendly pieces in sight
        let friendlyPiecesInSight = 0;
        
        // Check all 8 directions
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],  // NW, N, NE
            [0, -1],           [0, 1],    // W, E
            [1, -1],  [1, 0],  [1, 1]     // SW, S, SE
        ];
        
        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            
            while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                if (board[r][c] === player) {
                    friendlyPiecesInSight++;
                    break;
                } else if (board[r][c] !== 0) {
                    // If we encounter an opponent's piece, we can't see beyond it
                    break;
                }
                r += dr;
                c += dc;
            }
        }
        
        // A placement N steps away from the perimeter must have at least N friendly pieces in sight
        return friendlyPiecesInSight >= distFromPerimeter;
    }
    
    // Helper function to count empty cells on the board
    function countEmptyCells() {
        let count = 0;
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (boardState[row][col] === 0) {
                    count++;
                }
            }
        }
        return count;
    }
    
    // Helper function to count empty cells on a specific board state
    function countEmptyCellsOnBoard(board) {
        let count = 0;
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col] === 0) {
                    count++;
                }
            }
        }
        return count;
    }
    
    // Evaluate a board position
    function evaluatePosition(board, player) {
        const opponent = player === 1 ? 2 : 1;
        const centerPos = Math.floor(boardSize / 2);
        let score = 0;
        
        // Get legal moves for both players
        const playerLegalMoves = [];
        const opponentLegalMoves = [];
        
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col] === 0) {
                    // Calculate move value based on distance from center
                    const distToCenter = Math.abs(row - centerPos) + Math.abs(col - centerPos);
                    
                    // Progressive bonus - square the value for moves closer to center
                    // This creates a non-linear increase in value as we get closer to center
                    const closenessToCenter = boardSize - distToCenter;
                    const moveValue = closenessToCenter * closenessToCenter;
                    
                    // Check if move is legal for player
                    if (isLegalMoveOnBoard(board, row, col, player)) {
                        playerLegalMoves.push({
                            row,
                            col,
                            value: moveValue
                        });
                    }
                    
                    // Check if move is legal for opponent
                    if (isLegalMoveOnBoard(board, row, col, opponent)) {
                        opponentLegalMoves.push({
                            row,
                            col,
                            value: moveValue
                        });
                    }
                }
            }
        }
        
        // Calculate weighted mobility scores
        let playerMobilityScore = 0;
        let opponentMobilityScore = 0;
        
        playerLegalMoves.forEach(move => {
            playerMobilityScore += move.value;
            
            // Center move is critically important - special bonus
            const distToCenter = Math.abs(move.row - centerPos) + Math.abs(move.col - centerPos);
            if (distToCenter === 0) {
                playerMobilityScore += boardSize * boardSize * 2; // Much higher bonus for center move
            }
        });
        
        opponentLegalMoves.forEach(move => {
            opponentMobilityScore += move.value;
            
            // Center move is critically important - special bonus
            const distToCenter = Math.abs(move.row - centerPos) + Math.abs(move.col - centerPos);
            if (distToCenter === 0) {
                opponentMobilityScore += boardSize * boardSize * 2; // Much higher bonus for center move
            }
        });
        
        // Final score combines mobility and restricts opponent's mobility
        score = playerMobilityScore - 1.5 * opponentMobilityScore;
        
        return score;
    }
    
    function isLegalMove(row, col, player) {
        // If the cell is already occupied, it's not a legal move
        if (boardState[row][col] !== 0) {
            return false;
        }
        
        // Calculate the distance from the perimeter
        const distFromTop = row;
        const distFromBottom = boardSize - 1 - row;
        const distFromLeft = col;
        const distFromRight = boardSize - 1 - col;
        const distFromPerimeter = Math.min(distFromTop, distFromBottom, distFromLeft, distFromRight);
        
        // If the placement is on the perimeter, it's always legal
        if (distFromPerimeter === 0) {
            return true;
        }
        
        // Count the number of friendly pieces in sight
        let friendlyPiecesInSight = 0;
        
        // Check all 8 directions
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],  // NW, N, NE
            [0, -1],           [0, 1],    // W, E
            [1, -1],  [1, 0],  [1, 1]     // SW, S, SE
        ];
        
        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            
            while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                if (boardState[r][c] === player) {
                    friendlyPiecesInSight++;
                    break;
                } else if (boardState[r][c] !== 0) {
                    // If we encounter an opponent's piece, we can't see beyond it
                    break;
                }
                r += dr;
                c += dc;
            }
        }
        
        // A placement N steps away from the perimeter must have at least N friendly pieces in sight
        return friendlyPiecesInSight >= distFromPerimeter;
    }
    
    function highlightLegalMoves(forBot = false) {
        // Remove existing highlights
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('legal-move');
        });
        
        // Highlight moves if current player is human or if we're showing bot moves
        if (playerTypes[currentPlayer] === 'human' || forBot) {
            // Add highlight to all legal moves
            for (let row = 0; row < boardSize; row++) {
                for (let col = 0; col < boardSize; col++) {
                    if (boardState[row][col] === 0 && isLegalMove(row, col, currentPlayer)) {
                        const cellIndex = row * boardSize + col;
                        const cell = boardElement.children[cellIndex];
                        cell.classList.add('legal-move');
                    }
                }
            }
        }
    }
    
    function updateStatus(isWin = false, isDraw = false) {
        if (isWin) {
            const winner = currentPlayer === 1 ? 'Black' : 'White';
            const botType = playerTypes[currentPlayer].includes('bot') ? 
                ` (${playerTypes[currentPlayer] === BOT_TYPES.BAD ? 'Bad Bot' : 'Good Bot'})` : '';
            statusElement.textContent = `${winner}${botType} wins!`;
        } else if (isDraw) {
            statusElement.textContent = 'Game ends in a draw! (No legal moves)';
        } else if (botThinking) {
            const player = currentPlayer === 1 ? 'Black' : 'White';
            const botType = playerTypes[currentPlayer] === BOT_TYPES.BAD ? 'Bad Bot' : 'Good Bot';
            statusElement.textContent = `${player} (${botType}) is thinking...`;
        } else {
            const player = currentPlayer === 1 ? 'Black' : 'White';
            const botType = playerTypes[currentPlayer].includes('bot') ? 
                ` (${playerTypes[currentPlayer] === BOT_TYPES.BAD ? 'Bad Bot' : 'Good Bot'})` : '';
            statusElement.textContent = `${player}${botType}'s turn`;
        }
    }
});
