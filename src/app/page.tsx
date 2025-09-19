"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { GameModeSelectionReal } from "@/components/GameModeSelectionReal";
import { ChessGameReal } from "@/components/ChessGameReal";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  // Fix hydration mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">♔ ChessBet</h1>
              <span className="ml-2 px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                LIVE
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              {!isHydrated ? (
                <div className="w-32 h-10 bg-slate-700/50 rounded-lg animate-pulse"></div>
              ) : isConnected ? (
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-slate-300">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </div>
                  <button
                    onClick={() => disconnect()}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => connect({ connector: connectors[0] })}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isHydrated ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="w-64 h-8 bg-slate-700/50 rounded-lg animate-pulse mx-auto mb-4"></div>
              <div className="w-48 h-4 bg-slate-700/50 rounded-lg animate-pulse mx-auto mb-8"></div>
              <div className="w-32 h-12 bg-slate-700/50 rounded-lg animate-pulse mx-auto"></div>
            </div>
          </div>
        ) : !isConnected ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <h2 className="text-3xl font-bold text-white mb-4">
                Connect Your Wallet
              </h2>
              <p className="text-slate-400 mb-8">
                Connect your wallet to start playing chess and betting on games
              </p>
              <button
                onClick={() => connect({ connector: connectors[0] })}
                className="px-8 py-3 text-lg font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        ) : selectedMode ? (
          <ChessGameReal 
            mode={selectedMode}
            betAmount={betAmount}
            onBack={() => {
              setSelectedMode(null);
              setBetAmount(0);
            }}
            onGameUpdate={() => {}}
          />
        ) : (
          <GameModeSelectionReal onSelectMode={(mode, amount) => {
            setSelectedMode(mode);
            setBetAmount(amount);
          }} />
        )}
      </main>
    </div>
  );
}