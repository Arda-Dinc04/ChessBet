// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ChessBet is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    
    // USDC Constants
    uint8 public constant TOKEN_DECIMALS = 6; // USDC has 6 decimals
    uint256 public constant USDC_UNIT = 10 ** TOKEN_DECIMALS; // 1 USDC = 1,000,000 units
    uint256 public constant MAX_MOVES = 200; // Cap PGN growth to prevent griefing
    uint256 public constant MAX_MOVE_BYTES = 16; // Cap single move length to prevent griefing
    
    // Game Result Constants
    uint8 private constant RESULT_WHITE = 0;
    uint8 private constant RESULT_BLACK = 1;
    uint8 private constant RESULT_DRAW = 2;
    
    // Events
    event GameCreated(
        bytes32 indexed gameId,
        address indexed whitePlayer,
        address indexed blackPlayer,
        uint256 timeControl
    );
    
    event GameStarted(bytes32 indexed gameId);
    
    event MoveMade(bytes32 indexed gameId, string move);
    
    event GameFinished(
        bytes32 indexed gameId,
        uint8 result // 0 = white wins, 1 = black wins, 2 = draw
    );
    
    event GameResolved(
        bytes32 indexed gameId,
        address indexed winner,
        uint8 result // 0 = white wins, 1 = black wins, 2 = draw
    );
    
    event BetPlaced(
        bytes32 indexed gameId,
        address indexed player,
        uint256 amount
    );
    
    event BetResolved(
        bytes32 indexed gameId,
        address indexed player,
        uint256 amount,
        uint256 payout,
        uint8 result // 0 = won, 1 = lost, 2 = refunded (draw)
    );
    
    event PayoutClaimed(
        address indexed player,
        uint256 amount
    );
    
    event HouseFeePercentageUpdated(uint256 newFeePercentage);
    event BettingTierAmountsUpdated(uint256 lowTierAmount, uint256 mediumTierAmount);

    // Structs
    struct Game {
        bytes32 id;
        address whitePlayer;
        address blackPlayer;
        string fen;
        string pgn;
        uint8 status; // 0 = waiting, 1 = active, 2 = finished
        uint8 result; // 0 = white wins, 1 = black wins, 2 = draw
        uint8 bettingTier; // 0 = Low, 1 = Medium, 2 = Unlimited
        uint256 timeControl;
        uint256 createdAt;
        uint256 startedAt;
        uint256 finishedAt;
        uint16 moveCount; // track moves for O(1) counting and PGN cap
    }

    struct GameBet {
        bytes32 gameId;
        address player;
        uint256 amount;
        uint8 status; // 0 = pending, 1 = won, 2 = lost, 3 = refunded
        uint256 createdAt;
        uint256 resolvedAt;
        uint256 payout;
    }

    struct BettingPool {
        bytes32 gameId;
        uint256 totalAmount; // Total pool (both players' bets combined)
        uint256 houseFee;
        bool resolved;
        address winner; // Address of winner, address(0) for draw
    }

    // State variables
    mapping(bytes32 => Game) public games;
    mapping(bytes32 => BettingPool) public bettingPools;
    mapping(bytes32 => GameBet[]) public gameBets;
    mapping(address => uint256) public pendingPayouts;
    
    uint256 public houseFeePercentage = 500; // 5% in basis points
    
    // Betting tier amounts (in USDC units)
    uint256 public lowTierAmount = 5 * USDC_UNIT; // 5 USDC
    uint256 public mediumTierAmount = 50 * USDC_UNIT; // 50 USDC
    // Unlimited tier has no limit
    
    // Betting tier enum
    enum BettingTier { Low, Medium, Unlimited }
    
    // Orderbook system for unlimited tier
    struct Order {
        bytes32 id;
        address player;
        uint8 side; // 0 = white, 1 = black
        uint256 amount;
        uint256 tickAmount; // quantized amount
        uint256 timeControl; // encoded time control
        uint256 createdAt;
        uint256 filledAmount;
        uint8 status; // 0 = open, 1 = partially_filled, 2 = filled, 3 = cancelled
    }
    
    struct OrderbookLevel {
        uint256 tickAmount;
        bytes32[] orderIds; // queue (not strictly FIFO; gas-optimized swap-pop removal)
        uint256 totalAmount; // stored in token units (not tick amounts)
    }
    
    // Orderbook state
    mapping(bytes32 => Order) public orders;
    mapping(uint256 => mapping(uint8 => mapping(uint256 => OrderbookLevel))) public orderbookLevels; // timeControl => side => tickAmount => level
    mapping(address => bytes32[]) public playerOrders;
    
    // Game result confirmation tracking
    mapping(bytes32 => mapping(address => bool)) public resultSubmitted; // gameId => player => submitted
    mapping(bytes32 => mapping(address => uint8)) public resultValue; // gameId => player => result value
    mapping(bytes32 => bool) public resultResolved; // gameId => resolved
    mapping(bytes32 => uint8) public resultFinal; // gameId => final result (0=white, 1=black, 2=draw)
    
    // Player game indexing for efficient bet lookup
    mapping(address => bytes32[]) public playerGameIndex; // player => gameIds
    mapping(address => mapping(bytes32 => bool)) private _playerSeenGame; // player => gameId => seen
    
    uint256 public tickSize = 10 * USDC_UNIT; // $10 USDC tick size (in token units)
    uint256 public tolerancePercentage = 5; // 5% tolerance for nearest-level matching
    
    IERC20 public immutable token; // ERC20 token for betting (USDC)
    uint256 public tokenFeeBalance; // Accumulated ERC-20 fees

    // Modifiers
    modifier onlyGamePlayer(bytes32 gameId) {
        Game storage game = games[gameId];
        require(
            msg.sender == game.whitePlayer || msg.sender == game.blackPlayer,
            "Not a game player"
        );
        _;
    }

    modifier gameExists(bytes32 gameId) {
        require(games[gameId].id != bytes32(0), "Game does not exist");
        _;
    }

    modifier gameNotFinished(bytes32 gameId) {
        require(games[gameId].status != 2, "Game already finished");
        _;
    }

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "token addr zero");
        token = IERC20(_token);
    }

    // Game Management Functions
    function createGame(
        address blackPlayer,
        uint256 timeControl,
        uint8 bettingTier
    ) external nonReentrant whenNotPaused returns (bytes32) {
        require(blackPlayer != address(0), "Invalid black player");
        require(blackPlayer != msg.sender, "Cannot play against yourself");
        require(bettingTier <= 2, "Invalid betting tier");
        
        bytes32 gameId = keccak256(
            abi.encodePacked(msg.sender, blackPlayer, block.timestamp, block.number)
        );
        
        games[gameId] = Game({
            id: gameId,
            whitePlayer: msg.sender,
            blackPlayer: blackPlayer,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            pgn: "",
            status: 0, // waiting
            result: 0,
            bettingTier: bettingTier,
            timeControl: timeControl,
            createdAt: block.timestamp,
            startedAt: 0,
            finishedAt: 0,
            moveCount: 0
        });

        // Create betting pool
        bettingPools[gameId] = BettingPool({
            gameId: gameId,
            totalAmount: 0,
            houseFee: 0,
            resolved: false,
            winner: address(0)
        });

        emit GameCreated(gameId, msg.sender, blackPlayer, timeControl);
        return gameId;
    }

    function startGame(bytes32 gameId) external gameExists(gameId) onlyGamePlayer(gameId) {
        Game storage game = games[gameId];
        require(game.status == 0, "Game not in waiting status");
        
        game.status = 1; // active
        game.startedAt = block.timestamp;
        
        emit GameStarted(gameId);
    }

    function makeMove(
        bytes32 gameId,
        string memory move
    ) external gameExists(gameId) onlyGamePlayer(gameId) {
        Game storage game = games[gameId];
        require(game.status == 1, "Game not active");
        require(bytes(move).length <= MAX_MOVE_BYTES, "move too long");
        
        // Emit move event for off-chain tracking
        emit MoveMade(gameId, move);
        
        // Update PGN with move cap to prevent griefing (O(1) counting)
        if (game.moveCount < MAX_MOVES) {
            if (bytes(game.pgn).length > 0) {
                game.pgn = string(abi.encodePacked(game.pgn, " ", move));
            } else {
                game.pgn = move;
            }
            game.moveCount++;
        }
    }

    function submitGameResult(
        bytes32 gameId,
        uint8 result
    ) external gameExists(gameId) onlyGamePlayer(gameId) {
        require(result <= 2, "Invalid result");
        
        Game storage game = games[gameId];
        require(game.status == 1, "Game not active");
        require(!resultResolved[gameId], "Game already resolved");
        
        // Record player's result submission
        resultSubmitted[gameId][msg.sender] = true;
        resultValue[gameId][msg.sender] = result;
        
        // Check if both players submitted the same result
        address otherPlayer = msg.sender == game.whitePlayer ? game.blackPlayer : game.whitePlayer;
        bool otherSubmitted = resultSubmitted[gameId][otherPlayer];
        uint8 otherResult = resultValue[gameId][otherPlayer];
        
        if (otherSubmitted && otherResult == result) {
            // Both players agree on result - resolve the game
            resultResolved[gameId] = true;
            resultFinal[gameId] = result;
            game.status = 2; // finished
            game.result = result;
            game.finishedAt = block.timestamp;
            
            // Resolve betting pool
            _resolveBets(gameId, result);
            
            emit GameFinished(gameId, result);
        }
    }
    
    // Admin override for disputed results (requires both players to have submitted)
    function resolveDisputedGame(
        bytes32 gameId,
        uint8 result
    ) external onlyOwner gameExists(gameId) {
        require(result <= 2, "Invalid result");
        require(!resultResolved[gameId], "Game already resolved");
        
        Game storage game = games[gameId];
        require(game.status == 1, "Game not active");
        
        // Both players must have submitted results
        require(
            resultSubmitted[gameId][game.whitePlayer] && 
            resultSubmitted[gameId][game.blackPlayer],
            "Both players must submit results first"
        );
        
        resultResolved[gameId] = true;
        resultFinal[gameId] = result;
        game.status = 2; // finished
        game.result = result;
        game.finishedAt = block.timestamp;
        
        // Resolve betting pool
        _resolveBets(gameId, result);
        
        emit GameFinished(gameId, result);
    }

    // Betting Functions
    function placeBet(
        bytes32 gameId,
        uint256 amount
    ) external gameExists(gameId) gameNotFinished(gameId) nonReentrant whenNotPaused {
        Game storage game = games[gameId];
        require(game.status == 0, "Game already started or finished");
        require(
            msg.sender == game.whitePlayer || msg.sender == game.blackPlayer,
            "Only game players can bet"
        );
        
        // Validate bet amount based on betting tier
        require(_isValidBetAmount(game.bettingTier, amount), "Invalid bet amount for tier");
        
        // Check if player already bet (one bet per player)
        GameBet[] storage bets = gameBets[gameId];
        for (uint256 i = 0; i < bets.length; i++) {
            require(bets[i].player != msg.sender, "Player already bet");
        }
        
        // Transfer USDC tokens from player to contract
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        BettingPool storage pool = bettingPools[gameId];
        
        // Add bet to pool
        GameBet memory newBet = GameBet({
            gameId: gameId,
            player: msg.sender,
            amount: amount,
            status: 0, // pending
            createdAt: block.timestamp,
            resolvedAt: 0,
            payout: 0
        });
        
        gameBets[gameId].push(newBet);
        
        // Index player game for efficient bet lookup
        _indexPlayerGame(msg.sender, gameId);
        
        // Update pool
        pool.totalAmount += amount;
        pool.houseFee = (pool.totalAmount * houseFeePercentage) / 10000;
        
        emit BetPlaced(gameId, msg.sender, amount);
        
        // If both players have bet, start the game
        if (gameBets[gameId].length == 2) {
            game.status = 1; // active
            game.startedAt = block.timestamp;
            emit GameStarted(gameId);
        }
    }

    function _resolveBets(bytes32 gameId, uint8 result) internal {
        BettingPool storage pool = bettingPools[gameId];
        require(!pool.resolved, "Bets already resolved");
        
        pool.resolved = true;
        
        GameBet[] storage bets = gameBets[gameId];
        require(bets.length == 2, "Must have exactly 2 bets");
        
        if (result == RESULT_DRAW) {
            // Draw - refund both players (no fees charged)
            for (uint256 i = 0; i < bets.length; i++) {
                bets[i].status = 3; // refunded
                bets[i].payout = bets[i].amount; // Full refund
                bets[i].resolvedAt = block.timestamp;
                
                pendingPayouts[bets[i].player] += bets[i].amount;
                
                emit BetResolved(
                    gameId,
                    bets[i].player,
                    bets[i].amount,
                    bets[i].amount,
                    2 // refunded
                );
            }
            pool.winner = address(0); // No winner in draw
            pool.houseFee = 0; // No fees charged on draws
            
            // Emit game resolution event for draw
            emit GameResolved(gameId, address(0), result);
        } else {
            // Determine winner
            address winner;
            if (result == RESULT_WHITE) {
                winner = games[gameId].whitePlayer;
            } else {
                winner = games[gameId].blackPlayer;
            }
            
            pool.winner = winner;
            
            // Emit game resolution event for better indexing
            emit GameResolved(gameId, winner, result);
            
            // Credit house fee before payouts
            _creditFee(pool.houseFee);
            uint256 netPool = pool.totalAmount - pool.houseFee;
            
            // Winner takes all
            for (uint256 i = 0; i < bets.length; i++) {
                if (bets[i].player == winner) {
                    bets[i].status = 0; // won
                    bets[i].payout = netPool; // Winner takes all
                    bets[i].resolvedAt = block.timestamp;
                    
                    pendingPayouts[bets[i].player] += netPool;
                    
                    emit BetResolved(
                        gameId,
                        bets[i].player,
                        bets[i].amount,
                        netPool,
                        0 // won
                    );
                } else {
                    bets[i].status = 1; // lost
                    bets[i].payout = 0;
                    bets[i].resolvedAt = block.timestamp;
                    
                    emit BetResolved(
                        gameId,
                        bets[i].player,
                        bets[i].amount,
                        0,
                        1 // lost
                    );
                }
            }
        }
    }

    function claimPayout() external nonReentrant {
        uint256 amount = pendingPayouts[msg.sender];
        require(amount > 0, "No pending payout");
        
        pendingPayouts[msg.sender] = 0;
        
        token.safeTransfer(msg.sender, amount);
        
        emit PayoutClaimed(msg.sender, amount);
    }

    // Fee Management
    function withdrawTokenFees() external onlyOwner {
        require(tokenFeeBalance > 0, "No token fees to withdraw");
        uint256 amount = tokenFeeBalance;
        tokenFeeBalance = 0;
        token.safeTransfer(owner(), amount);
    }

    function _creditFee(uint256 amount) internal {
        tokenFeeBalance += amount;
    }

    // View Functions
    function getGame(bytes32 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getBettingPool(bytes32 gameId) external view returns (BettingPool memory) {
        return bettingPools[gameId];
    }

    function getGameBets(bytes32 gameId) external view returns (GameBet[] memory) {
        return gameBets[gameId];
    }

    function getPlayerBets(address player) external view returns (GameBet[] memory) {
        // Count only the player's bets across all games
        uint256 count = 0;
        for (uint256 i = 0; i < playerGameIndex[player].length; i++) {
            GameBet[] storage gb = gameBets[playerGameIndex[player][i]];
            for (uint256 j = 0; j < gb.length; j++) {
                if (gb[j].player == player) count++;
            }
        }
        
        // Create result array with exact count
        GameBet[] memory out = new GameBet[](count);
        uint256 k = 0;
        
        // Collect all bets for this player
        for (uint256 i = 0; i < playerGameIndex[player].length; i++) {
            GameBet[] storage gb = gameBets[playerGameIndex[player][i]];
            for (uint256 j = 0; j < gb.length; j++) {
                if (gb[j].player == player) {
                    out[k] = gb[j];
                    k++;
                }
            }
        }
        
        return out;
    }

    // Odds calculation removed - no longer needed with winner-takes-all system

    // View functions for betting tiers
    function getBettingTierAmounts() external view returns (uint256, uint256) {
        return (lowTierAmount, mediumTierAmount);
    }

    function isValidBetAmountForTier(uint8 bettingTier, uint256 amount) external view returns (bool) {
        return _isValidBetAmount(bettingTier, amount);
    }

    // Orderbook functions for unlimited tier
    function placeOrder(
        uint8 side,
        uint256 timeControl,
        uint256 amount
    ) external nonReentrant whenNotPaused returns (bytes32) {
        require(side <= 1, "Invalid side");
        require(amount >= tickSize, "Amount below minimum tick size");
        
        uint256 quantizedAmount = _quantizeAmount(amount);
        require(quantizedAmount > 0, "Amount too small after quantization");
        
        // Transfer USDC tokens from player to contract
        token.safeTransferFrom(msg.sender, address(this), quantizedAmount);
        
        bytes32 orderId = keccak256(
            abi.encodePacked(msg.sender, side, quantizedAmount, timeControl, block.timestamp, block.number)
        );
        
        orders[orderId] = Order({
            id: orderId,
            player: msg.sender,
            side: side,
            amount: quantizedAmount,
            tickAmount: quantizedAmount,
            timeControl: timeControl,
            createdAt: block.timestamp,
            filledAmount: 0,
            status: 0 // open
        });
        
        playerOrders[msg.sender].push(orderId);
        
        // Add to orderbook level
        OrderbookLevel storage level = orderbookLevels[timeControl][side][quantizedAmount];
        if (level.tickAmount == 0) {
            level.tickAmount = quantizedAmount;
        }
        level.orderIds.push(orderId);
        level.totalAmount += quantizedAmount;
        
        // Try to match immediately
        _attemptMatch(orderId);
        
        return orderId;
    }
    
    function cancelOrder(bytes32 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.player == msg.sender, "Not order owner");
        require(order.status == 0 || order.status == 1, "Cannot cancel filled or cancelled order");
        
        order.status = 3; // cancelled
        
        // Remove from orderbook level
        OrderbookLevel storage level = orderbookLevels[order.timeControl][order.side][order.tickAmount];
        for (uint256 i = 0; i < level.orderIds.length; i++) {
            if (level.orderIds[i] == orderId) {
                level.orderIds[i] = level.orderIds[level.orderIds.length - 1];
                level.orderIds.pop();
                break;
            }
        }
        level.totalAmount -= (order.amount - order.filledAmount);
        
        // Refund unfilled amount
        uint256 refundAmount = order.amount - order.filledAmount;
        if (refundAmount > 0) {
            token.safeTransfer(msg.sender, refundAmount);
        }
    }
    
    function getOrder(bytes32 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
    
    function getPlayerOrders(address player) external view returns (bytes32[] memory) {
        return playerOrders[player];
    }
    
    function getOrderbookLevel(
        uint256 timeControl,
        uint8 side,
        uint256 tickAmount
    ) external view returns (OrderbookLevel memory) {
        return orderbookLevels[timeControl][side][tickAmount];
    }
    
    function quantizeAmount(uint256 amount) external view returns (uint256) {
        return _quantizeAmount(amount);
    }
    
    function _quantizeAmount(uint256 amount) internal view returns (uint256) {
        return (amount / tickSize) * tickSize;
    }
    
    function _attemptMatch(bytes32 orderId) internal {
        Order storage order = orders[orderId];
        if (order.status != 0) return; // Order not open
        
        // Find opposite orders to match against
        uint8 oppositeSide = order.side == 0 ? 1 : 0;
        
        // Try exact level first
        OrderbookLevel storage exactLevel = orderbookLevels[order.timeControl][oppositeSide][order.tickAmount];
        if (exactLevel.totalAmount > 0) {
            uint256 remainingBefore = order.amount - order.filledAmount;
            _matchAtLevel(orderId, exactLevel, remainingBefore);
        }
        
        // Recompute remaining after exact match to avoid overfill
        if (orders[orderId].status == 0 || orders[orderId].status == 1) {
            uint256 remainingAfter = order.amount - order.filledAmount;
            if (remainingAfter > 0) {
                _matchNearestLevels(orderId, oppositeSide, remainingAfter);
            }
        }
    }
    
    function _matchAtLevel(
        bytes32 orderId,
        OrderbookLevel storage level,
        uint256 maxAmount
    ) internal {
        Order storage order = orders[orderId];
        
        // Clamp to the order's current remaining to be extra safe
        uint256 orderRemaining = order.amount - order.filledAmount;
        uint256 remainingAmount = maxAmount <= orderRemaining ? maxAmount : orderRemaining;
        
        while (remainingAmount > 0 && level.orderIds.length > 0) {
            bytes32 oppositeOrderId = level.orderIds[0];
            Order storage oppositeOrder = orders[oppositeOrderId];
            
            uint256 oppositeRemaining = oppositeOrder.amount - oppositeOrder.filledAmount;
            uint256 matchAmount = remainingAmount < oppositeRemaining ? remainingAmount : oppositeRemaining;
            
            // No-op guard
            if (matchAmount == 0) {
                // If opposite is fully filled but still at head, pop it
                if (oppositeRemaining == 0) {
                    oppositeOrder.status = 2; // filled
                    level.orderIds[0] = level.orderIds[level.orderIds.length - 1];
                    level.orderIds.pop();
                    continue;
                }
                break;
            }
            
            // Create match
            _createMatch(order, oppositeOrder, matchAmount);
            
            // Update fills
            order.filledAmount += matchAmount;
            oppositeOrder.filledAmount += matchAmount;
            remainingAmount -= matchAmount;
            
            // Update level
            level.totalAmount -= matchAmount;
            
            // Remove fully filled orders
            if (oppositeOrder.filledAmount >= oppositeOrder.amount) {
                oppositeOrder.status = 2; // filled
                level.orderIds[0] = level.orderIds[level.orderIds.length - 1];
                level.orderIds.pop();
            }
        }
        
        // Update order status
        if (order.filledAmount >= order.amount) {
            order.status = 2; // filled
        } else if (order.filledAmount > 0) {
            order.status = 1; // partially filled
        }
    }
    
    function _matchNearestLevels(
        bytes32 orderId,
        uint8 oppositeSide,
        uint256 maxAmount
    ) internal {
        Order storage order = orders[orderId];
        uint256 toleranceAmount = (order.tickAmount * tolerancePercentage) / 100;
        uint256 minTick = order.tickAmount > toleranceAmount ? order.tickAmount - toleranceAmount : 0;
        uint256 maxTick = order.tickAmount + toleranceAmount;
        
        uint256 remainingAmount = maxAmount;
        
        // Search for matches within tolerance, starting above exact level (exact already handled)
        for (uint256 tick = order.tickAmount + tickSize; tick <= maxTick && remainingAmount > 0; tick += tickSize) {
            OrderbookLevel storage level = orderbookLevels[order.timeControl][oppositeSide][tick];
            if (level.orderIds.length > 0) {
                _matchAtLevel(orderId, level, remainingAmount);
                remainingAmount = order.amount - order.filledAmount;
                if (remainingAmount == 0) break;
            }
        }
        
        // If still not filled, search lower levels (with underflow protection)
        if (order.tickAmount >= tickSize) {
            uint256 tick = order.tickAmount - tickSize;
            while (tick >= minTick && remainingAmount > 0) {
                OrderbookLevel storage level = orderbookLevels[order.timeControl][oppositeSide][tick];
                if (level.orderIds.length > 0) {
                    _matchAtLevel(orderId, level, remainingAmount);
                    remainingAmount = order.amount - order.filledAmount;
                    if (remainingAmount == 0) break;
                }
                if (tick < tickSize) break; // prevent underflow
                tick -= tickSize;
            }
        }
    }
    
    function _createMatch(
        Order storage whiteOrder,
        Order storage blackOrder,
        uint256 amount
    ) internal {
        require(amount > 0, "zero match");
        
        // Determine which order is white and which is black
        address whitePlayer = whiteOrder.side == 0 ? whiteOrder.player : blackOrder.player;
        address blackPlayer = whiteOrder.side == 1 ? whiteOrder.player : blackOrder.player;
        
        bytes32 gameId = keccak256(
            abi.encodePacked(whitePlayer, blackPlayer, amount, block.timestamp, block.number)
        );
        
        // Create game
        games[gameId] = Game({
            id: gameId,
            whitePlayer: whitePlayer,
            blackPlayer: blackPlayer,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            pgn: "",
            status: 0, // waiting
            result: 0,
            bettingTier: uint8(BettingTier.Unlimited),
            timeControl: whiteOrder.timeControl,
            createdAt: block.timestamp,
            startedAt: 0,
            finishedAt: 0,
            moveCount: 0
        });
        
        // Create betting pool
        bettingPools[gameId] = BettingPool({
            gameId: gameId,
            totalAmount: 0,
            houseFee: 0,
            resolved: false,
            winner: address(0)
        });
        
        // Record bets for both players (tokens already in contract)
        _recordBet(gameId, whitePlayer, amount);
        _recordBet(gameId, blackPlayer, amount);
        
        // Auto-start the game since both players have bet
        games[gameId].status = 1; // active
        games[gameId].startedAt = block.timestamp;
        
        emit GameCreated(gameId, whitePlayer, blackPlayer, whiteOrder.timeControl);
        emit GameStarted(gameId);
    }
    
    function _recordBet(bytes32 gameId, address player, uint256 amount) internal {
        GameBet memory newBet = GameBet({
            gameId: gameId,
            player: player,
            amount: amount,
            status: 0, // pending
            createdAt: block.timestamp,
            resolvedAt: 0,
            payout: 0
        });
        
        gameBets[gameId].push(newBet);
        
        // Index player game for efficient bet lookup
        _indexPlayerGame(player, gameId);
        
        // Update pool
        BettingPool storage pool = bettingPools[gameId];
        pool.totalAmount += amount;
        pool.houseFee = (pool.totalAmount * houseFeePercentage) / 10000;
        
        emit BetPlaced(gameId, player, amount);
    }
    
    function _indexPlayerGame(address player, bytes32 gameId) internal {
        if (!_playerSeenGame[player][gameId]) {
            _playerSeenGame[player][gameId] = true;
            playerGameIndex[player].push(gameId);
        }
    }

    // _calculateOdds function removed - no longer needed with winner-takes-all system

    // Helper function to validate bet amount based on betting tier
    function _isValidBetAmount(uint8 bettingTier, uint256 amount) internal view returns (bool) {
        if (bettingTier == uint8(BettingTier.Low)) {
            return amount == lowTierAmount;
        } else if (bettingTier == uint8(BettingTier.Medium)) {
            return amount == mediumTierAmount;
        } else if (bettingTier == uint8(BettingTier.Unlimited)) {
            return amount >= 1 * USDC_UNIT; // Minimum $1 USDC for unlimited tier
        }
        return false;
    }

    // Admin Functions
    function setHouseFeePercentage(uint256 _houseFeePercentage) external onlyOwner {
        require(_houseFeePercentage <= 1000, "Fee too high"); // Max 10%
        require(_houseFeePercentage >= 0, "Fee cannot be negative");
        houseFeePercentage = _houseFeePercentage;
        emit HouseFeePercentageUpdated(_houseFeePercentage);
    }

    function setBettingTierAmounts(uint256 _lowTierAmount, uint256 _mediumTierAmount) external onlyOwner {
        require(_lowTierAmount > 0, "Low tier amount must be positive");
        require(_mediumTierAmount > _lowTierAmount, "Medium tier must be higher than low tier");
        require(_lowTierAmount >= tickSize, "Low tier must be at least tick size");
        require(_mediumTierAmount >= tickSize, "Medium tier must be at least tick size");
        lowTierAmount = _lowTierAmount;
        mediumTierAmount = _mediumTierAmount;
        emit BettingTierAmountsUpdated(_lowTierAmount, _mediumTierAmount);
    }


    // Emergency functions
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    function pauseGame(bytes32 gameId) external onlyOwner gameExists(gameId) {
        Game storage g = games[gameId];
        require(g.status != 2, "Already finished");
        g.status = 2;

        GameBet[] storage bets = gameBets[gameId];
        if (bets.length == 2) {
            _resolveBets(gameId, RESULT_DRAW); // Force draw/refund
        } else {
            // Refund any existing bets without the "exactly 2" requirement
            for (uint256 i = 0; i < bets.length; i++) {
                if (bets[i].status == 0) {
                    bets[i].status = 3; // refunded
                    bets[i].payout = bets[i].amount;
                    bets[i].resolvedAt = block.timestamp;
                    pendingPayouts[bets[i].player] += bets[i].amount;
                    emit BetResolved(gameId, bets[i].player, bets[i].amount, bets[i].amount, RESULT_DRAW);
                }
            }
            BettingPool storage pool = bettingPools[gameId];
            pool.resolved = true;
            pool.winner = address(0);
            pool.houseFee = 0; // keep semantics identical to draw/no-fee
            emit GameResolved(gameId, address(0), RESULT_DRAW); // treat as draw-style resolution
        }
        
        // Set game/result trackers for consistency with _resolveBets
        g.result = RESULT_DRAW;
        g.finishedAt = block.timestamp;
        resultResolved[gameId] = true;
        resultFinal[gameId] = RESULT_DRAW;
        
        emit GameFinished(gameId, RESULT_DRAW);
    }
}
