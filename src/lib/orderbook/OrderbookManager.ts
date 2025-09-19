import { ChessEngine, GameResult } from "../chess/ChessEngine";
import { BettingEngine } from "../betting/BettingEngine";

export type TimeControl = {
  initial: number; // seconds
  increment: number; // seconds per move
};

export type OrderSide = "white" | "black";

export interface Order {
  id: string;
  playerAddress: string;
  side: OrderSide;
  amount: bigint; // in wei
  tickAmount: bigint; // quantized amount
  timeControl: TimeControl;
  createdAt: Date;
  filledAmount: bigint;
  status: "open" | "partially_filled" | "filled" | "cancelled";
}

export interface OrderbookLevel {
  tickAmount: bigint;
  orders: Order[]; // FIFO queue
  totalAmount: bigint;
}

export interface Orderbook {
  timeControl: TimeControl;
  whiteLevels: Map<string, OrderbookLevel>; // key = tickAmount.toString()
  blackLevels: Map<string, OrderbookLevel>; // key = tickAmount.toString()
  allOrders: Map<string, Order>;
}

export interface MatchResult {
  matches: Array<{
    whiteOrder: Order;
    blackOrder: Order;
    matchAmount: bigint;
    gameId: string;
  }>;
  remainingOrder?: Order;
}

export class OrderbookManager {
  private orderbooks: Map<string, Orderbook> = new Map(); // key = timeControlKey
  private readonly TICK_SIZE = 10n * 10n ** 18n; // $10 in wei
  private readonly TOLERANCE_PERCENTAGE = 5; // 5% tolerance for nearest-level matching
  private chessEngine: ChessEngine;
  private bettingEngine: BettingEngine;

  constructor() {
    this.chessEngine = new ChessEngine();
    this.bettingEngine = new BettingEngine();
  }

  // Quantize amount to nearest tick
  public quantizeAmount(amount: bigint): bigint {
    return (amount / this.TICK_SIZE) * this.TICK_SIZE;
  }

  // Get orderbook key for time control
  private getTimeControlKey(timeControl: TimeControl): string {
    return `${timeControl.initial}-${timeControl.increment}`;
  }

  // Get or create orderbook for time control
  private getOrCreateOrderbook(timeControl: TimeControl): Orderbook {
    const key = this.getTimeControlKey(timeControl);
    
    if (!this.orderbooks.has(key)) {
      this.orderbooks.set(key, {
        timeControl,
        whiteLevels: new Map(),
        blackLevels: new Map(),
        allOrders: new Map(),
      });
    }
    
    return this.orderbooks.get(key)!;
  }

  // Place an order
  placeOrder(
    playerAddress: string,
    side: OrderSide,
    amount: bigint,
    timeControl: TimeControl
  ): Order {
    const quantizedAmount = this.quantizeAmount(amount);
    
    if (quantizedAmount === 0n) {
      throw new Error("Amount too small after quantization");
    }

    const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const order: Order = {
      id: orderId,
      playerAddress,
      side,
      amount,
      tickAmount: quantizedAmount,
      timeControl,
      createdAt: new Date(),
      filledAmount: 0n,
      status: "open",
    };

    const orderbook = this.getOrCreateOrderbook(timeControl);
    orderbook.allOrders.set(orderId, order);

    // Add to appropriate level
    const levels = side === "white" ? orderbook.whiteLevels : orderbook.blackLevels;
    const levelKey = quantizedAmount.toString();
    
    if (!levels.has(levelKey)) {
      levels.set(levelKey, {
        tickAmount: quantizedAmount,
        orders: [],
        totalAmount: 0n,
      });
    }

    const level = levels.get(levelKey)!;
    level.orders.push(order);
    level.totalAmount += quantizedAmount;

    // Try to match immediately
    this.attemptMatch(order);

    return order;
  }

  // Attempt to match an order
  private attemptMatch(order: Order): MatchResult {
    const orderbook = this.getOrCreateOrderbook(order.timeControl);
    const oppositeLevels = order.side === "white" 
      ? orderbook.blackLevels 
      : orderbook.whiteLevels;

    const matches: MatchResult["matches"] = [];
    let remainingAmount = order.amount - order.filledAmount;

    // First try exact level matching
    const exactLevelKey = order.tickAmount.toString();
    if (oppositeLevels.has(exactLevelKey)) {
      const exactMatches = this.matchAtLevel(order, oppositeLevels.get(exactLevelKey)!, remainingAmount);
      matches.push(...exactMatches.matches);
      remainingAmount = exactMatches.remainingAmount;
    }

    // If still not fully filled, try nearest level matching
    if (remainingAmount > 0n) {
      const nearestMatches = this.matchNearestLevels(order, oppositeLevels, remainingAmount);
      matches.push(...nearestMatches.matches);
      remainingAmount = nearestMatches.remainingAmount;
    }

    // Update order status
    if (remainingAmount === 0n) {
      order.status = "filled";
    } else if (order.filledAmount > 0n) {
      order.status = "partially_filled";
    }

    return {
      matches,
      remainingOrder: remainingAmount > 0n ? order : undefined,
    };
  }

  // Match at a specific level
  private matchAtLevel(
    order: Order, 
    level: OrderbookLevel, 
    maxAmount: bigint
  ): { matches: MatchResult["matches"]; remainingAmount: bigint } {
    const matches: MatchResult["matches"] = [];
    let remainingAmount = maxAmount;

    while (remainingAmount > 0n && level.orders.length > 0) {
      const oppositeOrder = level.orders[0];
      const matchAmount = remainingAmount < oppositeOrder.amount - oppositeOrder.filledAmount
        ? remainingAmount
        : oppositeOrder.amount - oppositeOrder.filledAmount;

      // Create match
      const gameId = this.createMatch(order, oppositeOrder);
      
      matches.push({
        whiteOrder: order.side === "white" ? order : oppositeOrder,
        blackOrder: order.side === "black" ? order : oppositeOrder,
        matchAmount,
        gameId,
      });

      // Update order fills
      order.filledAmount += matchAmount;
      oppositeOrder.filledAmount += matchAmount;
      remainingAmount -= matchAmount;

      // Update level total
      level.totalAmount -= matchAmount;

      // Remove fully filled orders
      if (oppositeOrder.filledAmount >= oppositeOrder.amount) {
        oppositeOrder.status = "filled";
        level.orders.shift();
      }
    }

    return { matches, remainingAmount };
  }

  // Match with nearest levels within tolerance
  private matchNearestLevels(
    order: Order,
    oppositeLevels: Map<string, OrderbookLevel>,
    maxAmount: bigint
  ): { matches: MatchResult["matches"]; remainingAmount: bigint } {
    const matches: MatchResult["matches"] = [];
    let remainingAmount = maxAmount;

    // Calculate tolerance
    const toleranceAmount = (order.tickAmount * BigInt(this.TOLERANCE_PERCENTAGE)) / 100n;
    const minTick = order.tickAmount - toleranceAmount;
    const maxTick = order.tickAmount + toleranceAmount;

    // Find all levels within tolerance, sorted by distance
    const candidateLevels = Array.from(oppositeLevels.values())
      .filter(level => level.tickAmount >= minTick && level.tickAmount <= maxTick)
      .sort((a, b) => {
        const distanceA = a.tickAmount > order.tickAmount 
          ? a.tickAmount - order.tickAmount 
          : order.tickAmount - a.tickAmount;
        const distanceB = b.tickAmount > order.tickAmount 
          ? b.tickAmount - order.tickAmount 
          : order.tickAmount - b.tickAmount;
        return Number(distanceA - distanceB);
      });

    for (const level of candidateLevels) {
      if (remainingAmount <= 0n) break;

      const levelMatches = this.matchAtLevel(order, level, remainingAmount);
      matches.push(...levelMatches.matches);
      remainingAmount = levelMatches.remainingAmount;
    }

    return { matches, remainingAmount };
  }

  // Create a match between two orders
  private createMatch(whiteOrder: Order, blackOrder: Order): string {
    const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create chess game
    const chessGame = {
      id: gameId,
      whitePlayer: whiteOrder.playerAddress,
      blackPlayer: blackOrder.playerAddress,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      pgn: "",
      status: "waiting" as const,
      result: null as GameResult,
      moves: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create betting pool
    this.bettingEngine.createBettingPool(gameId);

    // Store the match (in a real implementation, this would be stored in a database)
    // For now, we'll just return the game ID
    console.log("Created match:", chessGame.id);

    return gameId;
  }

  // Cancel an order
  cancelOrder(orderId: string): boolean {
    for (const orderbook of this.orderbooks.values()) {
      const order = orderbook.allOrders.get(orderId);
      if (order) {
        if (order.status !== "open" && order.status !== "partially_filled") {
          return false; // Cannot cancel filled or already cancelled orders
        }

        order.status = "cancelled";

        // Remove from level
        const levels = order.side === "white" ? orderbook.whiteLevels : orderbook.blackLevels;
        const levelKey = order.tickAmount.toString();
        const level = levels.get(levelKey);
        
        if (level) {
          const index = level.orders.findIndex(o => o.id === orderId);
          if (index !== -1) {
            level.orders.splice(index, 1);
            level.totalAmount -= order.amount - order.filledAmount;
          }
        }

        return true;
      }
    }
    return false;
  }

  // Get order by ID
  getOrder(orderId: string): Order | undefined {
    for (const orderbook of this.orderbooks.values()) {
      const order = orderbook.allOrders.get(orderId);
      if (order) return order;
    }
    return undefined;
  }

  // Get orders for a player
  getPlayerOrders(playerAddress: string): Order[] {
    const orders: Order[] = [];
    for (const orderbook of this.orderbooks.values()) {
      for (const order of orderbook.allOrders.values()) {
        if (order.playerAddress === playerAddress) {
          orders.push(order);
        }
      }
    }
    return orders;
  }

  // Get orderbook depth for a time control
  getOrderbookDepth(timeControl: TimeControl): {
    white: Array<{ tickAmount: bigint; totalAmount: bigint; orderCount: number }>;
    black: Array<{ tickAmount: bigint; totalAmount: bigint; orderCount: number }>;
  } {
    const orderbook = this.orderbooks.get(this.getTimeControlKey(timeControl));
    if (!orderbook) {
      return { white: [], black: [] };
    }

    const white = Array.from(orderbook.whiteLevels.values())
      .map(level => ({
        tickAmount: level.tickAmount,
        totalAmount: level.totalAmount,
        orderCount: level.orders.length,
      }))
      .sort((a, b) => Number(a.tickAmount - b.tickAmount));

    const black = Array.from(orderbook.blackLevels.values())
      .map(level => ({
        tickAmount: level.tickAmount,
        totalAmount: level.totalAmount,
        orderCount: level.orders.length,
      }))
      .sort((a, b) => Number(a.tickAmount - b.tickAmount));

    return { white, black };
  }

  // Get best bid/ask for a time control
  getBestBidAsk(timeControl: TimeControl): { bestBid: bigint; bestAsk: bigint } {
    const orderbook = this.orderbooks.get(this.getTimeControlKey(timeControl));
    if (!orderbook) {
      return { bestBid: 0n, bestAsk: 0n };
    }

    const whiteLevels = Array.from(orderbook.whiteLevels.values())
      .filter(level => level.orders.length > 0)
      .sort((a, b) => Number(a.tickAmount - b.tickAmount));
    
    const blackLevels = Array.from(orderbook.blackLevels.values())
      .filter(level => level.orders.length > 0)
      .sort((a, b) => Number(a.tickAmount - b.tickAmount));

    return {
      bestBid: blackLevels.length > 0 ? blackLevels[0].tickAmount : 0n,
      bestAsk: whiteLevels.length > 0 ? whiteLevels[0].tickAmount : 0n,
    };
  }

  // Get tick size
  getTickSize(): bigint {
    return this.TICK_SIZE;
  }
}
