import { ChessBet__factory } from "../../../typechain-types";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";

// Contract ABI and configuration
export const CHESS_BET_ABI = ChessBet__factory.abi;

// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  base: process.env.NEXT_PUBLIC_CHESS_BET_CONTRACT_BASE || "",
  baseSepolia: process.env.NEXT_PUBLIC_CHESS_BET_CONTRACT_BASE_SEP || "",
};

export const MOCK_ERC20_ADDRESSES = {
  base: process.env.NEXT_PUBLIC_MOCK_ERC20_CONTRACT_BASE || "",
  baseSepolia: process.env.NEXT_PUBLIC_MOCK_ERC20_CONTRACT_BASE_SEP || "",
};

// Hook for reading contract data
export function useChessBetContract() {
  const { chain } = useAccount();
  
  const contractAddress = chain?.id === 8453 ? CONTRACT_ADDRESSES.base : CONTRACT_ADDRESSES.baseSepolia;
  const tokenAddress = chain?.id === 8453 ? MOCK_ERC20_ADDRESSES.base : MOCK_ERC20_ADDRESSES.baseSepolia;

  return {
    contractAddress,
    tokenAddress,
    isConfigured: !!(contractAddress && tokenAddress),
  };
}

// Hook for reading game data
export function useGame(gameId: string) {
  const { contractAddress } = useChessBetContract();
  
  const { data: game, isLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CHESS_BET_ABI,
    functionName: "getGame",
    args: [gameId as `0x${string}`],
    query: {
      enabled: !!contractAddress && !!gameId,
    },
  });

  return { game, isLoading };
}

// Hook for reading betting pool data
export function useBettingPool(gameId: string) {
  const { contractAddress } = useChessBetContract();
  
  const { data: pool, isLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CHESS_BET_ABI,
    functionName: "getBettingPool",
    args: [gameId as `0x${string}`],
    query: {
      enabled: !!contractAddress && !!gameId,
    },
  });

  return { pool, isLoading };
}

// Hook for reading game bets
export function useGameBets(gameId: string) {
  const { contractAddress } = useChessBetContract();
  
  const { data: bets, isLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CHESS_BET_ABI,
    functionName: "getGameBets",
    args: [gameId as `0x${string}`],
    query: {
      enabled: !!contractAddress && !!gameId,
    },
  });

  return { bets, isLoading };
}

// Hook for reading player bets
export function usePlayerBets(playerAddress: string) {
  const { contractAddress } = useChessBetContract();
  
  const { data: bets, isLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CHESS_BET_ABI,
    functionName: "getPlayerBets",
    args: [playerAddress as `0x${string}`],
    query: {
      enabled: !!contractAddress && !!playerAddress,
    },
  });

  return { bets, isLoading };
}

// Hook for reading betting tier amounts
export function useBettingTierAmounts() {
  const { contractAddress } = useChessBetContract();
  
  const { data: amounts, isLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CHESS_BET_ABI,
    functionName: "getBettingTierAmounts",
    query: {
      enabled: !!contractAddress,
    },
  });

  return { amounts, isLoading };
}

// Hook for reading house fee percentage
export function useHouseFeePercentage() {
  const { contractAddress } = useChessBetContract();
  
  const { data: feePercentage, isLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CHESS_BET_ABI,
    functionName: "houseFeePercentage",
    query: {
      enabled: !!contractAddress,
    },
  });

  return { feePercentage, isLoading };
}

// Hook for creating a game
export function useCreateGame() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const createGame = async (blackPlayer: string, timeControl: number, bettingTier: number, contractAddress: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: CHESS_BET_ABI,
      functionName: "createGame",
      args: [blackPlayer as `0x${string}`, BigInt(timeControl), bettingTier],
    });
  };

  return {
    createGame,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

// Hook for placing a bet
export function usePlaceBet() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const placeBet = async (gameId: string, amount: string, contractAddress: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: CHESS_BET_ABI,
      functionName: "placeBet",
      args: [gameId as `0x${string}`, parseUnits(amount, 6)], // USDC has 6 decimals
    });
  };

  return {
    placeBet,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

// Hook for starting a game
export function useStartGame() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const startGame = async (gameId: string, contractAddress: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: CHESS_BET_ABI,
      functionName: "startGame",
      args: [gameId as `0x${string}`],
    });
  };

  return {
    startGame,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

// Hook for making a move
export function useMakeMove() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const makeMove = async (gameId: string, move: string, contractAddress: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: CHESS_BET_ABI,
      functionName: "makeMove",
      args: [gameId as `0x${string}`, move],
    });
  };

  return {
    makeMove,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

// Hook for submitting game result
export function useSubmitGameResult() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const submitGameResult = async (gameId: string, result: number, contractAddress: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: CHESS_BET_ABI,
      functionName: "submitGameResult",
      args: [gameId as `0x${string}`, result],
    });
  };

  return {
    submitGameResult,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

// Hook for claiming payout
export function useClaimPayout() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const claimPayout = async (contractAddress: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: CHESS_BET_ABI,
      functionName: "claimPayout",
    });
  };

  return {
    claimPayout,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

// Hook for placing an order (unlimited tier)
export function usePlaceOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const placeOrder = async (side: number, timeControl: number, amount: string, contractAddress: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: CHESS_BET_ABI,
      functionName: "placeOrder",
      args: [side, BigInt(timeControl), parseUnits(amount, 6)], // USDC has 6 decimals
    });
  };

  return {
    placeOrder,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

// Utility functions
export function formatUSDC(amount: bigint): string {
  return formatUnits(amount, 6);
}

export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, 6);
}
