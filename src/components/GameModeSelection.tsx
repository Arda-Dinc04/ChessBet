"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

interface GameModeSelectionProps {
  onSelectMode: (mode: string, betAmount: number) => void;
}

export function GameModeSelection({ onSelectMode }: GameModeSelectionProps) {
  const { isConnected } = useAccount();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const modes = [
    {
      id: "low",
      name: "Low Stakes",
      amount: 5,
      displayAmount: "$5",
      description: "Perfect for beginners",
      color: "emerald",
      icon: "🟢"
    },
    {
      id: "medium", 
      name: "Medium Stakes",
      amount: 50,
      displayAmount: "$50",
      description: "For experienced players",
      color: "blue",
      icon: "🔵"
    },
    {
      id: "unlimited",
      name: "Unlimited",
      amount: 0, // Custom amount
      displayAmount: "Custom",
      description: "Orderbook matching",
      color: "purple",
      icon: "🟣"
    }
  ];

  const handleModeSelect = (modeId: string) => {
    if (modeId === "unlimited") {
      setSelectedMode(modeId);
    } else {
      const mode = modes.find(m => m.id === modeId);
      if (mode) {
        handlePlaceBet(modeId, mode.amount);
      }
    }
  };

  const handlePlaceBet = async (modeId: string, amount: number) => {
    if (!isConnected) return;
    
    setIsPlacingBet(true);
    
    // Simulate placing bet (replace with actual contract call)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      onSelectMode(modeId, amount);
    } catch (error) {
      console.error("Failed to place bet:", error);
    } finally {
      setIsPlacingBet(false);
    }
  };

  const handleCustomBet = () => {
    const amount = parseFloat(customAmount);
    if (amount > 0 && amount % 10 === 0) { // Must be multiple of $10 for unlimited
      handlePlaceBet("unlimited", amount);
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "emerald":
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/30",
          hover: "hover:bg-emerald-500/20",
          text: "text-emerald-400",
          button: "bg-emerald-500 hover:bg-emerald-600"
        };
      case "blue":
        return {
          bg: "bg-blue-500/10",
          border: "border-blue-500/30", 
          hover: "hover:bg-blue-500/20",
          text: "text-blue-400",
          button: "bg-blue-500 hover:bg-blue-600"
        };
      case "purple":
        return {
          bg: "bg-purple-500/10",
          border: "border-purple-500/30",
          hover: "hover:bg-purple-500/20", 
          text: "text-purple-400",
          button: "bg-purple-500 hover:bg-purple-600"
        };
      default:
        return {
          bg: "bg-slate-500/10",
          border: "border-slate-500/30",
          hover: "hover:bg-slate-500/20",
          text: "text-slate-400",
          button: "bg-slate-500 hover:bg-slate-600"
        };
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">
          Choose Your Game Mode
        </h2>
        <p className="text-slate-400 text-lg">
          Select a betting tier and start playing chess for real money
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {modes.map((mode) => {
          const colors = getColorClasses(mode.color);
          
          return (
            <div
              key={mode.id}
              className={`
                relative p-8 rounded-2xl border-2 transition-all duration-300 cursor-pointer
                ${colors.bg} ${colors.border} ${colors.hover}
                hover:scale-105 hover:shadow-2xl
              `}
              onClick={() => handleModeSelect(mode.id)}
            >
              {/* Icon */}
              <div className="text-6xl mb-4 text-center">
                {mode.icon}
              </div>

              {/* Content */}
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {mode.name}
                </h3>
                
                <div className={`text-3xl font-bold ${colors.text} mb-3`}>
                  {mode.displayAmount}
                </div>
                
                <p className="text-slate-400 mb-6">
                  {mode.description}
                </p>

                {/* Features */}
                <div className="space-y-2 mb-8">
                  {mode.id === "low" && (
                    <>
                      <div className="text-sm text-slate-300">• Fixed $5 bet</div>
                      <div className="text-sm text-slate-300">• Quick matching</div>
                      <div className="text-sm text-slate-300">• Beginner friendly</div>
                    </>
                  )}
                  {mode.id === "medium" && (
                    <>
                      <div className="text-sm text-slate-300">• Fixed $50 bet</div>
                      <div className="text-sm text-slate-300">• Higher stakes</div>
                      <div className="text-sm text-slate-300">• More experienced players</div>
                    </>
                  )}
                  {mode.id === "unlimited" && (
                    <>
                      <div className="text-sm text-slate-300">• Custom bet amounts</div>
                      <div className="text-sm text-slate-300">• Orderbook matching</div>
                      <div className="text-sm text-slate-300">• $10 tick increments</div>
                    </>
                  )}
                </div>

                {/* Select Button */}
                <button
                  className={`
                    w-full py-3 px-6 text-white font-semibold rounded-lg transition-colors
                    ${colors.button} ${isPlacingBet ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  disabled={isPlacingBet}
                >
                  {isPlacingBet ? 'Placing Bet...' : `Bet ${mode.displayAmount}`}
                </button>
              </div>

              {/* Hover Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          );
        })}
      </div>

      {/* Custom Betting Interface for Unlimited Mode */}
      {selectedMode === "unlimited" && (
        <div className="mt-8 max-w-md mx-auto">
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-purple-500/30">
            <h3 className="text-2xl font-bold text-white mb-4 text-center">
              Custom Bet Amount
            </h3>
            <p className="text-slate-400 text-center mb-6">
              Enter your bet amount (must be multiple of $10)
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Bet Amount ($)
                </label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount (e.g., 100)"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-purple-500 focus:outline-none"
                  min="10"
                  step="10"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCustomBet}
                  disabled={!customAmount || parseFloat(customAmount) % 10 !== 0 || isPlacingBet}
                  className="flex-1 py-3 px-6 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {isPlacingBet ? 'Placing Bet...' : `Bet $${customAmount || '0'}`}
                </button>
                <button
                  onClick={() => setSelectedMode(null)}
                  className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-16 text-center">
        <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-4">
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-slate-300">
            <div>
              <div className="text-2xl mb-2">1️⃣</div>
              <div className="font-medium">Choose Mode</div>
              <div className="text-sm">Select your betting tier</div>
            </div>
            <div>
              <div className="text-2xl mb-2">2️⃣</div>
              <div className="font-medium">Place Bet</div>
              <div className="text-sm">Put your money on the line</div>
            </div>
            <div>
              <div className="text-2xl mb-2">3️⃣</div>
              <div className="font-medium">Play & Win</div>
              <div className="text-sm">Winner takes the pot!</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
