"use client";

import { useState, useEffect } from "react";
import { ChessEngine } from "@/lib/chess/ChessEngine";
import { useNotifications } from "@/contexts/NotificationContext";
import { MoveHistory } from "./MoveHistory";

interface Game {
  fen?: string;
  pgn?: string;
  moves?: string[];
  isGameOver?: boolean;
  result?: string;
  status?: string;
  whitePlayer?: string;
  blackPlayer?: string;
  bettingTier?: string;
  timeControl?: {
    initial: number;
    increment: number;
  };
}

interface ChessBoardProps {
  game: Game | null;
  onGameUpdate: (game: Game) => void;
  onMakeMove?: (move: string) => void;
  onSubmitResult?: (result: number) => void;
}

export function ChessBoard({ game, onGameUpdate, onMakeMove, onSubmitResult }: ChessBoardProps) {
  const [chess, setChess] = useState<ChessEngine | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [board, setBoard] = useState<(string | null)[][]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const { addNotification } = useNotifications();

  useEffect(() => {
    const engine = new ChessEngine();
    setChess(engine);
    setBoard(engine.getBoard());
  }, []);

  // Watch for game over state changes
  useEffect(() => {
    if (chess && chess.isGameOver()) {
      const result = chess.getGameResult();
      if (result === "white") {
        addNotification({
          message: "🎉 White wins! Game over.",
          type: "success",
          duration: 5000
        });
      } else if (result === "black") {
        addNotification({
          message: "🎉 Black wins! Game over.",
          type: "success",
          duration: 5000
        });
      } else if (result === "draw") {
        addNotification({
          message: "🤝 It's a draw! Game over.",
          type: "info",
          duration: 5000
        });
      }
    }
  }, [chess, addNotification]);

  const getPieceSymbol = (piece: string | null) => {
    if (!piece) return "";
    
    const symbols: { [key: string]: string } = {
      'wp': '♙', 'wr': '♖', 'wn': '♘', 'wb': '♗', 'wq': '♕', 'wk': '♔',
      'bp': '♟', 'br': '♜', 'bn': '♞', 'bb': '♝', 'bq': '♛', 'bk': '♚'
    };
    
    return symbols[piece] || "";
  };

  const getSquareColor = (row: number, col: number) => {
    return (row + col) % 2 === 0 ? "bg-slate-100" : "bg-slate-800";
  };

  const handleSquareClick = (row: number, col: number) => {
    if (!chess) return;
    
    const square = String.fromCharCode(97 + col) + (8 - row);
    
    if (selectedSquare) {
      // Try to make a move
      const move = selectedSquare + square;
      
      // Check if move is legal before attempting
      if (chess.isLegalMove(move)) {
        if (chess.makeMove(move)) {
          setBoard(chess.getBoard());
          setSelectedSquare(null);
          setCurrentMoveIndex(chess.getMoves().length - 1);
          
          // Show success notification for valid move
          addNotification({
            message: `Move ${move} played successfully!`,
            type: "success",
            duration: 2000
          });
          
          // Submit move to contract if callback provided
          if (onMakeMove) {
            onMakeMove(move);
          }
          
          // Update game state
          if (onGameUpdate) {
            onGameUpdate({
              ...game,
              fen: chess.getFen(),
              pgn: chess.getPgn(),
              moves: chess.getMoves(),
              isGameOver: chess.isGameOver(),
              result: chess.getGameResult() || undefined
            });
          }
        }
      } else {
        // Show gentle reminder for invalid move
        const piece = board[8 - parseInt(selectedSquare[1])][selectedSquare.charCodeAt(0) - 97];
        const pieceName = piece ? getPieceName(piece) : "piece";
        
        addNotification({
          message: `Invalid move! ${pieceName} cannot move to ${square}. Try a different square.`,
          type: "error",
          duration: 4000
        });
        
        setSelectedSquare(null);
      }
    } else {
      // Select a piece
      const piece = board[row][col];
      if (piece) {
        // Check if it's the correct turn
        const pieceColor = piece[0]; // 'w' or 'b'
        const currentTurn = chess.getTurn();
        
        if (pieceColor === currentTurn) {
          setSelectedSquare(square);
          
          // Show info about selected piece
          const pieceName = getPieceName(piece);
          addNotification({
            message: `Selected ${pieceName}. Click a destination square to move.`,
            type: "info",
            duration: 2000
          });
        } else {
          addNotification({
            message: `It's ${currentTurn === 'w' ? 'white' : 'black'}'s turn. Select a ${currentTurn === 'w' ? 'white' : 'black'} piece.`,
            type: "error",
            duration: 3000
          });
        }
      } else {
        addNotification({
          message: "No piece on this square. Select a piece to move.",
          type: "info",
          duration: 2000
        });
      }
    }
  };

  const getPieceName = (piece: string) => {
    const pieceNames: { [key: string]: string } = {
      'wp': 'white pawn', 'wr': 'white rook', 'wn': 'white knight', 
      'wb': 'white bishop', 'wq': 'white queen', 'wk': 'white king',
      'bp': 'black pawn', 'br': 'black rook', 'bn': 'black knight', 
      'bb': 'black bishop', 'bq': 'black queen', 'bk': 'black king'
    };
    
    return pieceNames[piece] || "piece";
  };

  if (!chess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-white/50">Loading chess board...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chess Board */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-8 gap-0 border-2 border-slate-600 rounded-lg overflow-hidden max-w-lg mx-auto">
            {board.map((row, rowIndex) =>
              row.map((piece, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    aspect-square flex items-center justify-center text-4xl cursor-pointer
                    ${getSquareColor(rowIndex, colIndex)}
                    ${selectedSquare === String.fromCharCode(97 + colIndex) + (8 - rowIndex) 
                      ? "ring-2 ring-blue-500 ring-inset" 
                      : "hover:bg-slate-200/20"
                    }
                  `}
                  onClick={() => handleSquareClick(rowIndex, colIndex)}
                >
                  {getPieceSymbol(piece)}
                </div>
              ))
            )}
          </div>

          {/* Game Info */}
          <div className="mt-4 text-center text-white/70 text-sm">
            <div>Turn: {chess.getTurn() === "w" ? "White" : "Black"}</div>
            <div>Moves: {chess.getMoves().length}</div>
            {chess.isGameOver() && (
              <div className="text-green-400 font-semibold">
                Game Over: {chess.getGameResult() === "white" ? "White Wins" : 
                           chess.getGameResult() === "black" ? "Black Wins" : "Draw"}
              </div>
            )}
            
            {/* Result Submission */}
            {chess.isGameOver() && onSubmitResult && (
              <div className="mt-4 space-y-2">
                <div className="text-sm text-slate-300 mb-2">Submit result to contract:</div>
                <div className="flex space-x-2 justify-center">
                  <button
                    onClick={() => onSubmitResult(0)} // 0 = white wins
                    className="px-3 py-1 bg-white text-black text-xs rounded hover:bg-gray-200"
                  >
                    White Wins
                  </button>
                  <button
                    onClick={() => onSubmitResult(1)} // 1 = black wins
                    className="px-3 py-1 bg-black text-white text-xs rounded hover:bg-gray-800"
                  >
                    Black Wins
                  </button>
                  <button
                    onClick={() => onSubmitResult(2)} // 2 = draw
                    className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                  >
                    Draw
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Move History Table */}
        <div className="lg:col-span-1">
          <MoveHistory 
            moves={chess.getMoves()} 
            currentMoveIndex={currentMoveIndex}
          />
        </div>
      </div>
    </div>
  );
}
