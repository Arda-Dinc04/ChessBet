"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { ChessBoard } from "./ChessBoard";
import { GameStatus } from "./GameStatus";
import { 
  useChessBetContract, 
  useGame, 
  useBettingPool, 
  useCreateGame,
  usePlaceBet,
  useMakeMove,
  useSubmitGameResult,
  useClaimPayout,
  formatUSDC
} from "@/lib/contracts/ChessBetContract";
import { useTokenBalance, useApproveToken } from "@/lib/contracts/MockERC20Contract";

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

export function ChessGameReal({ mode, betAmount, onBack, onGameUpdate }: ChessGameProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [gameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Contract hooks
  const { contractAddress, tokenAddress, isConfigured } = useChessBetContract();
  const { balance } = useTokenBalance(address || "");
  const { approve } = useApproveToken();
  const { createGame } = useCreateGame();
  const { placeBet } = usePlaceBet();
  const { makeMove } = useMakeMove();
  const { submitGameResult } = useSubmitGameResult();
  const { claimPayout } = useClaimPayout();

  // Get game data from contract
  const { game: contractGame, isLoading: gameLoading } = useGame(gameId || "");
  const { pool: bettingPool } = useBettingPool(gameId || "");

  // Check if we're on the right network
  const isCorrectNetwork = chainId === 84532; // Base Sepolia
  const isMainnet = chainId === 8453; // Base Mainnet

  useEffect(() => {
    if (!isConnected) {
      setError("Please connect your wallet");
    } else if (!isCorrectNetwork && !isMainnet) {
      setError("Please switch to Base Sepolia or Base Mainnet");
    } else if (!isConfigured) {
      setError("Contract not configured. Please deploy contracts first.");
    } else {
      setError(null);
    }
  }, [isConnected, isCorrectNetwork, isMainnet, isConfigured]);

  const initializeGame = useCallback(async () => {
    if (!address || !contractAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      // Create a game with a dummy opponent (in real app, this would be matchmaking)
      const dummyOpponent = "0x0000000000000000000000000000000000000001";
      const timeControl = 1800; // 30 minutes
      const bettingTier = mode === "low" ? 0 : mode === "medium" ? 1 : 2;

      console.log("Creating game...");
      await createGame(dummyOpponent, timeControl, bettingTier, contractAddress);
      
      // Wait for transaction to be confirmed
      // In a real app, you'd listen for the GameCreated event
      console.log("Game creation transaction submitted");
      setGameState('waiting');
    } catch (error: unknown) {
      console.error("Failed to create game:", error);
      setError(error instanceof Error ? error.message : "Failed to create game");
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, createGame, mode]);

  const updateGameFromContract = useCallback(() => {
    if (!contractGame) return;

    const game: Game = {
      id: gameId || "",
      status: contractGame.status === 0 ? 'waiting' : contractGame.status === 1 ? 'active' : 'finished',
      whitePlayer: contractGame.whitePlayer,
      blackPlayer: contractGame.blackPlayer,
      bettingTier: mode,
      betAmount: betAmount,
      totalPool: bettingPool ? Number(formatUSDC(bettingPool.totalAmount)) : betAmount * 2,
      timeControl: { initial: 1800, increment: 30 },
      fen: contractGame.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: contractGame.pgn || '',
      moves: contractGame.pgn ? contractGame.pgn.split(' ') : [],
      isGameOver: contractGame.status === 2,
      result: contractGame.result === 0 ? 'white' : contractGame.result === 1 ? 'black' : 'draw'
    };

    setCurrentGame(game);
    onGameUpdate(game);

    // Update game state based on contract status
    if (contractGame.status === 0) {
      setGameState('waiting');
    } else if (contractGame.status === 1) {
      setGameState('playing');
    } else if (contractGame.status === 2) {
      setGameState('finished');
    }
  }, [contractGame, gameId, onGameUpdate, mode, betAmount, bettingPool]);

  // Initialize game when component mounts
  useEffect(() => {
    if (isConfigured && address && !gameId) {
      initializeGame();
    }
  }, [isConfigured, address, gameId, initializeGame]);

  // Update game state when contract data changes
  useEffect(() => {
    if (contractGame && gameId) {
      updateGameFromContract();
    }
  }, [contractGame, gameId, updateGameFromContract]);

  const handlePlaceBet = async () => {
    if (!gameId || !address || !contractAddress || !tokenAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      // Check if we have enough balance
      const requiredAmount = BigInt(betAmount * 1000000); // Convert to USDC units
      if (balance && balance < requiredAmount) {
        setError(`Insufficient balance. You need ${betAmount} tUSDC but have ${formatUSDC(balance)}`);
        return;
      }

      // Check if we need to approve tokens
      // For now, we'll assume approval is needed
      console.log("Approving tokens...");
      await approve(contractAddress, betAmount.toString(), tokenAddress);

      // Place the bet
      console.log("Placing bet...");
      await placeBet(gameId, betAmount.toString(), contractAddress);
      
      console.log("Bet placed successfully");
      setGameState('playing');
    } catch (error: unknown) {
      console.error("Failed to place bet:", error);
      setError(error instanceof Error ? error.message : "Failed to place bet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMakeMove = async (move: string) => {
    if (!gameId) return;

    try {
      console.log("Making move:", move);
      await makeMove(gameId, move, contractAddress);
      
      console.log("Move submitted successfully");
      // The game state will be updated via the contract hook
    } catch (error: unknown) {
      console.error("Failed to make move:", error);
      setError(error instanceof Error ? error.message : "Failed to make move");
    }
  };

  const handleSubmitResult = async (result: number) => {
    if (!gameId) return;

    try {
      console.log("Submitting result:", result);
      await submitGameResult(gameId, result, contractAddress);
      
      console.log("Result submitted successfully");
      setGameState('finished');
    } catch (error: unknown) {
      console.error("Failed to submit result:", error);
      setError(error instanceof Error ? error.message : "Failed to submit result");
    }
  };

  const handleClaimPayout = async () => {
    try {
      console.log("Claiming payout...");
      await claimPayout(contractAddress);
      
      console.log("Payout claimed successfully");
    } catch (error: unknown) {
      console.error("Failed to claim payout:", error);
      setError(error instanceof Error ? error.message : "Failed to claim payout");
    }
  };

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

  // Show error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-12">
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Error
          </h2>
          <p className="text-red-400 text-lg mb-8">
            {error}
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading || gameLoading) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700/50">
          <div className="text-6xl mb-6">⏳</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            {isLoading ? 'Processing...' : 'Loading...'}
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Please wait while we process your request
          </p>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Show waiting state
  if (gameState === 'waiting') {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700/50">
          <div className="text-6xl mb-6">⏳</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            {gameId ? 'Waiting for Bet...' : 'Creating Game...'}
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            {gameId ? 'Place your bet to start the game' : 'Setting up your game'}
          </p>
          
          {gameId && (
            <div className="mb-6">
              <div className="text-2xl font-bold text-emerald-400 mb-2">
                Pool: ${currentGame?.totalPool || betAmount * 2}
              </div>
              <div className="text-slate-400">
                Winner takes all • Draw = refund both players
              </div>
            </div>
          )}

          {gameId && (
            <button
              onClick={handlePlaceBet}
              disabled={isLoading}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isLoading ? 'Placing Bet...' : `Place $${betAmount} Bet`}
            </button>
          )}

          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mt-4"></div>
        </div>
      </div>
    );
  }

  // Show playing/finished state
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
            <ChessBoard 
              game={currentGame} 
              onGameUpdate={onGameUpdate}
              onMakeMove={handleMakeMove}
              onSubmitResult={handleSubmitResult}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Game Status */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Game Status</h3>
            <GameStatus game={currentGame} />
          </div>

          {/* Pool Information */}
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

          {/* Actions */}
          {gameState === 'finished' && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
              <button
                onClick={handleClaimPayout}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {isLoading ? 'Claiming...' : 'Claim Payout'}
              </button>
            </div>
          )}

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
