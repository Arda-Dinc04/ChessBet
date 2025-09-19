import { Chess } from "chess.js";

export type GameResult = "white" | "black" | "draw" | null;
export type GameStatus = "waiting" | "active" | "finished";

export interface ChessGame {
  id: string;
  whitePlayer: string;
  blackPlayer: string;
  fen: string;
  pgn: string;
  status: GameStatus;
  result: GameResult;
  moves: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Move {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  lan: string;
}

export class ChessEngine {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  // Get current board position as FEN
  getFen(): string {
    return this.chess.fen();
  }

  // Get current board position as PGN
  getPgn(): string {
    return this.chess.pgn();
  }

  // Get all moves in algebraic notation
  getMoves(): string[] {
    return this.chess.history();
  }

  // Get all moves in long algebraic notation
  getMovesLan(): string[] {
    return this.chess.history({ verbose: true }).map(move => move.lan);
  }

  // Make a move
  makeMove(move: string | Move): boolean {
    try {
      if (typeof move === "string") {
        this.chess.move(move);
      } else {
        this.chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        });
      }
      return true;
    } catch {
      // Silently handle invalid moves - error will be shown via notifications
      return false;
    }
  }

  // Check if the game is over
  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  // Get game result
  getGameResult(): GameResult {
    if (!this.isGameOver()) return null;
    
    if (this.chess.isCheckmate()) {
      return this.chess.turn() === "w" ? "black" : "white";
    }
    
    if (this.chess.isDraw()) {
      return "draw";
    }
    
    return null;
  }

  // Get current turn
  getTurn(): "w" | "b" {
    return this.chess.turn();
  }

  // Get legal moves for current position
  getLegalMoves(): Move[] {
    return this.chess.moves({ verbose: true });
  }

  // Check if a move is legal
  isLegalMove(move: string | Move): boolean {
    try {
      if (typeof move === "string") {
        return this.chess.moves().includes(move);
      } else {
        return this.chess.moves({ verbose: true }).some(
          legalMove => 
            legalMove.from === move.from && 
            legalMove.to === move.to &&
            legalMove.promotion === move.promotion
        );
      }
    } catch {
      return false;
    }
  }

  // Get board state for rendering
  getBoard(): (string | null)[][] {
    return this.chess.board().map(row => 
      row.map(piece => piece ? `${piece.color}${piece.type}` : null)
    );
  }

  // Reset game
  reset(): void {
    this.chess.reset();
  }

  // Load game from FEN
  loadFen(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch (error) {
      console.error("Invalid FEN:", error);
      return false;
    }
  }

  // Load game from PGN
  loadPgn(pgn: string): boolean {
    try {
      this.chess.loadPgn(pgn);
      return true;
    } catch (error) {
      console.error("Invalid PGN:", error);
      return false;
    }
  }

  // Get game status
  getGameStatus(): GameStatus {
    if (this.isGameOver()) {
      return "finished";
    }
    return "active";
  }

  // Create a new game instance
  static createNewGame(): ChessEngine {
    return new ChessEngine();
  }

  // Create game from existing state
  static fromFen(fen: string): ChessEngine | null {
    try {
      return new ChessEngine(fen);
    } catch {
      return null;
    }
  }
}
