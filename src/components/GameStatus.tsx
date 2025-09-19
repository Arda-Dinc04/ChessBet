"use client";

interface Game {
  status?: string;
  whitePlayer?: string;
  blackPlayer?: string;
  bettingTier?: string;
  timeControl?: {
    initial: number;
    increment: number;
  };
  moves?: string[];
  result?: string;
}

interface GameStatusProps {
  game: Game | null;
}

export function GameStatus({ game }: GameStatusProps) {
  if (!game) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-300">Status:</span>
          <span className="text-slate-400">No Game</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-300">Players:</span>
          <span className="text-slate-400">-</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-300">Betting Pool:</span>
          <span className="text-slate-400">-</span>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "waiting": return "text-yellow-400";
      case "active": return "text-emerald-400";
      case "finished": return "text-blue-400";
      default: return "text-slate-400";
    }
  };

  const getStatusText = (status: string | undefined) => {
    switch (status) {
      case "waiting": return "Waiting for opponent";
      case "active": return "Game in progress";
      case "finished": return "Game finished";
      default: return "Unknown";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-slate-300">Status:</span>
        <span className={getStatusColor(game.status)}>
          {getStatusText(game.status)}
        </span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-slate-300">White:</span>
        <span className="text-white">
          {game.whitePlayer?.slice(0, 6)}...{game.whitePlayer?.slice(-4)}
        </span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-slate-300">Black:</span>
        <span className="text-white">
          {game.blackPlayer?.slice(0, 6)}...{game.blackPlayer?.slice(-4)}
        </span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-slate-300">Betting Tier:</span>
        <span className="text-white capitalize">
          {game.bettingTier || "Unknown"}
        </span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-slate-300">Time Control:</span>
        <span className="text-white">
          {game.timeControl?.initial}+{game.timeControl?.increment}
        </span>
      </div>
      
      {game.moves && (
        <div className="flex justify-between items-center">
          <span className="text-slate-300">Moves:</span>
          <span className="text-white">{game.moves.length}</span>
        </div>
      )}
      
      {game.result && (
        <div className="flex justify-between items-center">
          <span className="text-slate-300">Result:</span>
          <span className="text-emerald-400 font-semibold capitalize">
            {game.result} wins
          </span>
        </div>
      )}
    </div>
  );
}
