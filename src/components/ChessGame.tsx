"use client";

import { useState, useEffect } from "react";
import { ChessBoard } from "./ChessBoard";
import { GameStatus } from "./GameStatus";

interface Game {
  id?: string;
  status?: string;
  whitePlayer?: string;
  blackPlayer?: string;
  bettingTier?: string;
  betAmount?: number;
  totalPool?: number;
  timeControl?: {
    initial: number;
    increment: number;
  };
  fen?: string;
  pgn?: string;
  moves?: string[];
  isGameOver?: boolean;
  result?: string;
}

interface ChessGameProps {
  mode: string;
  betAmount: number;
  onBack: () => void;
  onGameUpdate: (game: Game) => void;
}

export function ChessGame({ mode, betAmount, onBack, onGameUpdate }: ChessGameProps) {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');

  // Test addresses for demo
  const testAddresses = {
    player1: '0x1234567890123456789012345678901234567890',
    player2: '0x9876543210987654321098765432109876543210'
  };

  useEffect(() => {
    // Create game with locked pool immediately
    const mockGame: Game = {
      id: `game-${Date.now()}`,
      status: 'waiting',
      whitePlayer: testAddresses.player1,
      blackPlayer: testAddresses.player2,
      bettingTier: mode,
      betAmount: betAmount,
      totalPool: betAmount * 2, // Both players bet the same amount
      timeControl: { initial: 1800, increment: 30 },
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      moves: [],
      isGameOver: false,
      result: undefined
    };
    
    setCurrentGame(mockGame);
    
    // Simulate finding opponent after 2 seconds
    setTimeout(() => {
      setGameState('playing');
      setCurrentGame(prev => prev ? { ...prev, status: 'active' } : null);
      onGameUpdate(mockGame);
    }, 2000);
  }, [mode, betAmount, onGameUpdate]);

  const getModeInfo = () => {
    switch (mode) {
      case 'low':
        return { name: 'Low Stakes', amount: '$5', color: 'emerald' };
      case 'medium':
        return { name: 'Medium Stakes', amount: '$50', color: 'blue' };
      case 'unlimited':
        return { name: 'Unlimited', amount: `$${betAmount}`, color: 'purple' };
      default:
        return { name: 'Unknown', amount: '$0', color: 'slate' };
    }
  };

  const modeInfo = getModeInfo();

  if (gameState === 'waiting') {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700/50">
          <div className="text-6xl mb-6">⏳</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Finding Opponent...
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Looking for another player in the {modeInfo.name} queue
          </p>
          <div className="mb-6">
            <div className="text-2xl font-bold text-emerald-400 mb-2">
              Pool: ${currentGame?.totalPool || betAmount * 2}
            </div>
            <div className="text-slate-400">
              Winner takes all • Draw = refund both players
            </div>
          </div>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (gameState === 'playing' || gameState === 'finished') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chess Board */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Chess Game</h2>
              <div className={`px-3 py-1 text-sm rounded-full bg-${modeInfo.color}-500/20 text-${modeInfo.color}-400`}>
                {modeInfo.name}
              </div>
            </div>
            <ChessBoard game={currentGame} onGameUpdate={onGameUpdate} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Game Status */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Game Status</h3>
            <GameStatus game={currentGame} />
          </div>

          {/* Locked Pool Info */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pool Information</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Total Pool:</span>
                <span className="text-2xl font-bold text-emerald-400">
                  ${currentGame?.totalPool || betAmount * 2}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Your Bet:</span>
                <span className="text-lg font-semibold text-white">
                  ${betAmount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Opponent Bet:</span>
                <span className="text-lg font-semibold text-white">
                  ${betAmount}
                </span>
              </div>
              <div className="pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400 text-center">
                  🏆 Winner takes all<br/>
                  🤝 Draw = refund both players
                </div>
              </div>
            </div>
          </div>

          {/* Back Button */}
          <button
            onClick={onBack}
            className="w-full py-3 px-4 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors"
          >
            ← Back to Game Modes
          </button>
        </div>
      </div>
    );
  }

  return null;
}
