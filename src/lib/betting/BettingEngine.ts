import { GameResult } from "../chess/ChessEngine";

export type BetSide = "white" | "black" | "draw";
export type BetStatus = "pending" | "won" | "lost" | "cancelled";

export interface Bet {
  id: string;
  gameId: string;
  playerAddress: string;
  side: BetSide;
  amount: bigint; // in wei
  odds: number; // decimal odds (e.g., 2.5 for 3:2)
  status: BetStatus;
  createdAt: Date;
  resolvedAt?: Date;
  payout?: bigint;
}

export interface BettingPool {
  gameId: string;
  whiteBets: Bet[];
  blackBets: Bet[];
  drawBets: Bet[];
  totalWhiteAmount: bigint;
  totalBlackAmount: bigint;
  totalDrawAmount: bigint;
  totalAmount: bigint;
  houseFee: bigint; // percentage of total pool (e.g., 5% = 500)
  createdAt: Date;
  resolvedAt?: Date;
  result?: GameResult;
}

export class BettingEngine {
  private pools: Map<string, BettingPool> = new Map();
  private bets: Map<string, Bet> = new Map();
  private houseFeePercentage: number = 500; // 5% in basis points

  constructor(houseFeePercentage: number = 500) {
    this.houseFeePercentage = houseFeePercentage;
  }

  // Create a new betting pool for a game
  createBettingPool(gameId: string): BettingPool {
    const pool: BettingPool = {
      gameId,
      whiteBets: [],
      blackBets: [],
      drawBets: [],
      totalWhiteAmount: 0n,
      totalBlackAmount: 0n,
      totalDrawAmount: 0n,
      totalAmount: 0n,
      houseFee: 0n,
      createdAt: new Date(),
    };

    this.pools.set(gameId, pool);
    return pool;
  }

  // Place a bet
  placeBet(
    gameId: string,
    playerAddress: string,
    side: BetSide,
    amount: bigint
  ): Bet | null {
    const pool = this.pools.get(gameId);
    if (!pool) {
      console.error("Betting pool not found for game:", gameId);
      return null;
    }

    if (pool.resolvedAt) {
      console.error("Cannot bet on resolved game");
      return null;
    }

    const betId = `${gameId}-${playerAddress}-${Date.now()}`;
    const odds = this.calculateOdds(pool, side);
    
    const bet: Bet = {
      id: betId,
      gameId,
      playerAddress,
      side,
      amount,
      odds,
      status: "pending",
      createdAt: new Date(),
    };

    // Add bet to pool
    if (side === "white") {
      pool.whiteBets.push(bet);
      pool.totalWhiteAmount += amount;
    } else if (side === "black") {
      pool.blackBets.push(bet);
      pool.totalBlackAmount += amount;
    } else {
      pool.drawBets.push(bet);
      pool.totalDrawAmount += amount;
    }

    pool.totalAmount += amount;
    pool.houseFee = (pool.totalAmount * BigInt(this.houseFeePercentage)) / 10000n;

    this.bets.set(betId, bet);
    return bet;
  }

    // Calculate odds for a bet
    private calculateOdds(pool: BettingPool, side: BetSide): number {
        let sideAmount: bigint;

        if (side === "white") {
            sideAmount = pool.totalWhiteAmount;
        } else if (side === "black") {
            sideAmount = pool.totalBlackAmount;
        } else {
            sideAmount = pool.totalDrawAmount;
        }

    if (sideAmount === 0n) {
      return 2.0; // Default odds if no bets on this side
    }

    // Simple odds calculation: (total pool - house fee) / side amount
    const netPool = pool.totalAmount - pool.houseFee;
    const odds = Number(netPool) / Number(sideAmount);
    
    return Math.max(1.1, odds); // Minimum odds of 1.1
  }

  // Resolve all bets for a game
  resolveBets(gameId: string, result: GameResult): BettingPool | null {
    const pool = this.pools.get(gameId);
    if (!pool) {
      console.error("Betting pool not found for game:", gameId);
      return null;
    }

    if (pool.resolvedAt) {
      console.error("Bets already resolved for this game");
      return null;
    }

    pool.result = result;
    pool.resolvedAt = new Date();

    // Calculate payouts
    const netPool = pool.totalAmount - pool.houseFee;
    let winningBets: Bet[] = [];

    if (result === "white") {
      winningBets = pool.whiteBets;
    } else if (result === "black") {
      winningBets = pool.blackBets;
    } else if (result === "draw") {
      winningBets = pool.drawBets;
    }

    if (winningBets.length === 0) {
      // No winning bets, all bets are lost
      pool.whiteBets.forEach(bet => {
        bet.status = "lost";
        bet.resolvedAt = new Date();
      });
      pool.blackBets.forEach(bet => {
        bet.status = "lost";
        bet.resolvedAt = new Date();
      });
      pool.drawBets.forEach(bet => {
        bet.status = "lost";
        bet.resolvedAt = new Date();
      });
    } else {
      // Calculate proportional payouts
      const totalWinningAmount = winningBets.reduce((sum, bet) => sum + bet.amount, 0n);
      
      winningBets.forEach(bet => {
        const proportion = Number(bet.amount) / Number(totalWinningAmount);
        bet.payout = BigInt(Math.floor(Number(netPool) * proportion));
        bet.status = "won";
        bet.resolvedAt = new Date();
      });

      // Mark losing bets
      [...pool.whiteBets, ...pool.blackBets, ...pool.drawBets]
        .filter(bet => !winningBets.includes(bet))
        .forEach(bet => {
          bet.status = "lost";
          bet.resolvedAt = new Date();
        });
    }

    return pool;
  }

  // Get betting pool for a game
  getBettingPool(gameId: string): BettingPool | undefined {
    return this.pools.get(gameId);
  }

  // Get bet by ID
  getBet(betId: string): Bet | undefined {
    return this.bets.get(betId);
  }

  // Get all bets for a player
  getPlayerBets(playerAddress: string): Bet[] {
    return Array.from(this.bets.values()).filter(
      bet => bet.playerAddress === playerAddress
    );
  }

  // Get all bets for a game
  getGameBets(gameId: string): Bet[] {
    return Array.from(this.bets.values()).filter(
      bet => bet.gameId === gameId
    );
  }

  // Calculate potential payout for a bet
  calculatePotentialPayout(
    gameId: string,
    side: BetSide,
    amount: bigint
  ): bigint {
    const pool = this.pools.get(gameId);
    if (!pool) return 0n;

    const odds = this.calculateOdds(pool, side);
    return BigInt(Math.floor(Number(amount) * odds));
  }

  // Get current odds for all sides
  getCurrentOdds(gameId: string): { white: number; black: number; draw: number } | null {
    const pool = this.pools.get(gameId);
    if (!pool) return null;

    return {
      white: this.calculateOdds(pool, "white"),
      black: this.calculateOdds(pool, "black"),
      draw: this.calculateOdds(pool, "draw"),
    };
  }

  // Cancel a bet (only if game hasn't started)
  cancelBet(betId: string): boolean {
    const bet = this.bets.get(betId);
    if (!bet || bet.status !== "pending") {
      return false;
    }

    const pool = this.pools.get(bet.gameId);
    if (!pool || pool.resolvedAt) {
      return false;
    }

    // Remove bet from pool
    if (bet.side === "white") {
      const index = pool.whiteBets.findIndex(b => b.id === betId);
      if (index !== -1) {
        pool.whiteBets.splice(index, 1);
        pool.totalWhiteAmount -= bet.amount;
      }
    } else if (bet.side === "black") {
      const index = pool.blackBets.findIndex(b => b.id === betId);
      if (index !== -1) {
        pool.blackBets.splice(index, 1);
        pool.totalBlackAmount -= bet.amount;
      }
    } else {
      const index = pool.drawBets.findIndex(b => b.id === betId);
      if (index !== -1) {
        pool.drawBets.splice(index, 1);
        pool.totalDrawAmount -= bet.amount;
      }
    }

    pool.totalAmount -= bet.amount;
    pool.houseFee = (pool.totalAmount * BigInt(this.houseFeePercentage)) / 10000n;

    bet.status = "cancelled";
    bet.resolvedAt = new Date();

    return true;
  }
}
