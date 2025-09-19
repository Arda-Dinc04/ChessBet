import { ChessEngine, ChessGame, GameResult } from "../chess/ChessEngine";
import { BettingEngine, BettingPool } from "../betting/BettingEngine";
import { OrderbookManager, Order, OrderSide } from "../orderbook/OrderbookManager";

export type BettingTier = "low" | "medium" | "unlimited";

export interface GameMatch {
  id: string;
  whitePlayer: string;
  blackPlayer: string;
  game: ChessGame;
  bettingPool: BettingPool;
  bettingTier: BettingTier;
  timeControl: {
    initial: number; // seconds
    increment: number; // seconds per move
  };
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface Player {
  address: string;
  rating: number;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  preferredBettingTier: BettingTier;
  totalWagered: bigint; // in wei
  totalWon: bigint; // in wei
  createdAt: Date;
}

export class GameManager {
  private games: Map<string, GameMatch> = new Map();
  private players: Map<string, Player> = new Map();
  private waitingQueues: Map<BettingTier, string[]> = new Map(); // Separate queues for each betting tier
  private chessEngine: ChessEngine;
  private bettingEngine: BettingEngine;
  private orderbookManager: OrderbookManager;

  // Betting tier constants (in wei)
  private readonly BETTING_TIERS = {
    low: 5n * 10n ** 18n, // 5 ETH (or 5 USDC if using stablecoin)
    medium: 50n * 10n ** 18n, // 50 ETH (or 50 USDC if using stablecoin)
    unlimited: 0n // No limit
  };

  constructor() {
    this.chessEngine = new ChessEngine();
    this.bettingEngine = new BettingEngine();
    this.orderbookManager = new OrderbookManager();
    
    // Initialize waiting queues for each tier
    this.waitingQueues.set("low", []);
    this.waitingQueues.set("medium", []);
    this.waitingQueues.set("unlimited", []);
  }

  // Register a new player
  registerPlayer(
    address: string, 
    initialRating: number = 1200, 
    preferredBettingTier: BettingTier = "low"
  ): Player {
    const player: Player = {
      address,
      rating: initialRating,
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      preferredBettingTier,
      totalWagered: 0n,
      totalWon: 0n,
      createdAt: new Date(),
    };

    this.players.set(address, player);
    return player;
  }

  // Get player by address
  getPlayer(address: string): Player | undefined {
    return this.players.get(address);
  }

  // Find a match for a player
  findMatch(
    playerAddress: string, 
    bettingTier: BettingTier,
    timeControl: { initial: number; increment: number },
    side?: OrderSide,
    amount?: bigint
  ): GameMatch | null {
    // Check if player is already in a game
    const existingGame = this.getPlayerActiveGame(playerAddress);
    if (existingGame) {
      return existingGame;
    }

    // For unlimited tier, use orderbook system
    if (bettingTier === "unlimited") {
      if (!side || !amount) {
        throw new Error("Side and amount required for unlimited tier");
      }
      return this.findMatchUnlimited(playerAddress, side, amount, timeControl);
    }

    // For low and medium tiers, use simple queue system
    return this.findMatchTiered(playerAddress, bettingTier, timeControl);
  }

  // Find match for unlimited tier using orderbook
  private findMatchUnlimited(
    playerAddress: string,
    side: OrderSide,
    amount: bigint,
    timeControl: { initial: number; increment: number }
  ): GameMatch | null {
    try {
      // Place order in orderbook
      this.orderbookManager.placeOrder(
        playerAddress,
        side,
        amount,
        timeControl
      );

      // If order was immediately filled, we should have matches
      // In a real implementation, we'd process the matches here
      // For now, we'll return null and let the frontend handle the order status
      return null;
    } catch (error) {
      console.error("Error placing order:", error);
      return null;
    }
  }

  // Find match for tiered betting (low/medium)
  private findMatchTiered(
    playerAddress: string,
    bettingTier: BettingTier,
    timeControl: { initial: number; increment: number }
  ): GameMatch | null {
    // Get the waiting queue for this betting tier
    const waitingQueue = this.waitingQueues.get(bettingTier);
    if (!waitingQueue) {
      return null;
    }

    // Check if player is already in queue
    if (waitingQueue.includes(playerAddress)) {
      return null; // Already waiting
    }

    // Add player to queue
    waitingQueue.push(playerAddress);

    // Try to find a suitable opponent in the same betting tier
    const suitableOpponent = waitingQueue.find(opponentAddress => {
      if (opponentAddress === playerAddress) return false;
      
      const opponent = this.getPlayer(opponentAddress);
      if (!opponent) return false;

      // For betting tiers, we can match anyone in the same tier
      // Optionally, we could still consider rating differences
      const currentPlayer = this.getPlayer(playerAddress);
      const ratingDiff = Math.abs((currentPlayer?.rating || 1200) - opponent.rating);
      return ratingDiff <= 300; // Slightly more lenient for betting tiers
    });

    if (suitableOpponent) {
      // Create match
      const match = this.createMatch(playerAddress, suitableOpponent, bettingTier, timeControl);
      
      // Remove both players from queue
      const updatedQueue = waitingQueue.filter(
        addr => addr !== playerAddress && addr !== suitableOpponent
      );
      this.waitingQueues.set(bettingTier, updatedQueue);

      return match;
    }

    return null; // No suitable opponent found
  }

  // Create a new match
  private createMatch(
    whitePlayer: string,
    blackPlayer: string,
    bettingTier: BettingTier,
    timeControl: { initial: number; increment: number }
  ): GameMatch {
    const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const game: ChessGame = {
      id: gameId,
      whitePlayer,
      blackPlayer,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", // Starting position
      pgn: "",
      status: "waiting",
      result: null,
      moves: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const bettingPool = this.bettingEngine.createBettingPool(gameId);

    const match: GameMatch = {
      id: gameId,
      whitePlayer,
      blackPlayer,
      game,
      bettingPool,
      bettingTier,
      timeControl,
      createdAt: new Date(),
    };

    this.games.set(gameId, match);
    return match;
  }

  // Start a game
  startGame(gameId: string): boolean {
    const match = this.games.get(gameId);
    if (!match || match.game.status !== "waiting") {
      return false;
    }

    match.game.status = "active";
    match.startedAt = new Date();
    match.game.updatedAt = new Date();

    return true;
  }

  // Make a move in a game
  makeMove(gameId: string, move: string, playerAddress: string): boolean {
    const match = this.games.get(gameId);
    if (!match) return false;

    // Verify it's the player's turn
    const isWhiteTurn = match.game.moves.length % 2 === 0;
    const isPlayerTurn = (isWhiteTurn && playerAddress === match.whitePlayer) ||
                        (!isWhiteTurn && playerAddress === match.blackPlayer);

    if (!isPlayerTurn) {
      return false;
    }

    // Create chess engine instance and load current position
    const chessEngine = new ChessEngine(match.game.fen);
    
    // Validate and make move
    if (!chessEngine.makeMove(move)) {
      return false;
    }

    // Update game state
    match.game.fen = chessEngine.getFen();
    match.game.pgn = chessEngine.getPgn();
    match.game.moves.push(move);
    match.game.updatedAt = new Date();

    // Check if game is over
    if (chessEngine.isGameOver()) {
      this.finishGame(gameId, chessEngine.getGameResult());
    }

    return true;
  }

  // Finish a game
  finishGame(gameId: string, result: GameResult): boolean {
    const match = this.games.get(gameId);
    if (!match) return false;

    match.game.status = "finished";
    match.game.result = result;
    match.finishedAt = new Date();
    match.game.updatedAt = new Date();

    // Resolve betting pool
    this.bettingEngine.resolveBets(gameId, result);

    // Update player statistics
    this.updatePlayerStats(match.whitePlayer, match.blackPlayer, result);
    
    return true;
  }

  // Update player statistics
  private updatePlayerStats(whitePlayer: string, blackPlayer: string, result: GameResult): void {
    const white = this.players.get(whitePlayer);
    const black = this.players.get(blackPlayer);

    if (white) {
      white.totalGames++;
      if (result === "white") white.wins++;
      else if (result === "black") white.losses++;
      else if (result === "draw") white.draws++;
    }

    if (black) {
      black.totalGames++;
      if (result === "black") black.wins++;
      else if (result === "white") black.losses++;
      else if (result === "draw") black.draws++;
    }

    // Update ratings (simplified ELO system)
    if (white && black && result) {
      this.updateRatings(white, black, result);
    }
  }

  // Update player ratings using simplified ELO
  private updateRatings(white: Player, black: Player, result: GameResult): void {
    const K = 32; // ELO K-factor
    const expectedWhite = 1 / (1 + Math.pow(10, (black.rating - white.rating) / 400));
    const expectedBlack = 1 - expectedWhite;

    let actualWhite: number;
    let actualBlack: number;

    if (result === "white") {
      actualWhite = 1;
      actualBlack = 0;
    } else if (result === "black") {
      actualWhite = 0;
      actualBlack = 1;
    } else {
      actualWhite = 0.5;
      actualBlack = 0.5;
    }

    const whiteChange = Math.round(K * (actualWhite - expectedWhite));
    const blackChange = Math.round(K * (actualBlack - expectedBlack));

    white.rating += whiteChange;
    black.rating += blackChange;

    // Ensure minimum rating
    white.rating = Math.max(100, white.rating);
    black.rating = Math.max(100, black.rating);
  }

  // Get game by ID
  getGame(gameId: string): GameMatch | undefined {
    return this.games.get(gameId);
  }

  // Get player's active game
  getPlayerActiveGame(playerAddress: string): GameMatch | undefined {
    return Array.from(this.games.values()).find(
      match => 
        (match.whitePlayer === playerAddress || match.blackPlayer === playerAddress) &&
        match.game.status === "active"
    );
  }

  // Get player's waiting game
  getPlayerWaitingGame(playerAddress: string): GameMatch | undefined {
    return Array.from(this.games.values()).find(
      match => 
        (match.whitePlayer === playerAddress || match.blackPlayer === playerAddress) &&
        match.game.status === "waiting"
    );
  }

  // Get all games for a player
  getPlayerGames(playerAddress: string): GameMatch[] {
    return Array.from(this.games.values()).filter(
      match => 
        match.whitePlayer === playerAddress || match.blackPlayer === playerAddress
    );
  }

  // Get recent games
  getRecentGames(limit: number = 10): GameMatch[] {
    return Array.from(this.games.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Get leaderboard
  getLeaderboard(limit: number = 10): Player[] {
    return Array.from(this.players.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  // Cancel waiting in queue
  cancelWaiting(playerAddress: string, bettingTier: BettingTier): boolean {
    const waitingQueue = this.waitingQueues.get(bettingTier);
    if (!waitingQueue) return false;

    const index = waitingQueue.indexOf(playerAddress);
    if (index === -1) return false;

    waitingQueue.splice(index, 1);
    return true;
  }

  // Get waiting queue status for a specific tier
  getWaitingQueueStatus(bettingTier: BettingTier): { count: number; players: string[] } {
    const waitingQueue = this.waitingQueues.get(bettingTier) || [];
    return {
      count: waitingQueue.length,
      players: [...waitingQueue],
    };
  }

  // Get all waiting queue statuses
  getAllWaitingQueueStatuses(): Record<BettingTier, { count: number; players: string[] }> {
    return {
      low: this.getWaitingQueueStatus("low"),
      medium: this.getWaitingQueueStatus("medium"),
      unlimited: this.getWaitingQueueStatus("unlimited"),
    };
  }

  // Get betting tier amount
  getBettingTierAmount(bettingTier: BettingTier): bigint {
    return this.BETTING_TIERS[bettingTier];
  }

  // Check if a bet amount is valid for a tier
  isValidBetAmount(bettingTier: BettingTier, amount: bigint): boolean {
    if (bettingTier === "unlimited") return true;
    return amount === this.BETTING_TIERS[bettingTier];
  }

  // Get betting engine instance
  getBettingEngine(): BettingEngine {
    return this.bettingEngine;
  }

  // Orderbook methods for unlimited tier
  placeOrder(
    playerAddress: string,
    side: OrderSide,
    amount: bigint,
    timeControl: { initial: number; increment: number }
  ): Order {
    return this.orderbookManager.placeOrder(playerAddress, side, amount, timeControl);
  }

  cancelOrder(orderId: string): boolean {
    return this.orderbookManager.cancelOrder(orderId);
  }

  getOrder(orderId: string): Order | undefined {
    return this.orderbookManager.getOrder(orderId);
  }

  getPlayerOrders(playerAddress: string): Order[] {
    return this.orderbookManager.getPlayerOrders(playerAddress);
  }

  getOrderbookDepth(timeControl: { initial: number; increment: number }) {
    return this.orderbookManager.getOrderbookDepth(timeControl);
  }

  getBestBidAsk(timeControl: { initial: number; increment: number }) {
    return this.orderbookManager.getBestBidAsk(timeControl);
  }

  getTickSize(): bigint {
    return this.orderbookManager.getTickSize();
  }

  quantizeAmount(amount: bigint): bigint {
    return this.orderbookManager.quantizeAmount(amount);
  }
}
