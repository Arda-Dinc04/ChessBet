import { MockERC20__factory } from "../../../typechain-types";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";

// Contract ABI
export const MOCK_ERC20_ABI = MockERC20__factory.abi;

// Hook for reading token balance
export function useTokenBalance(address: string) {
  const { contractAddress } = useChessBetContract();
  
  const { data: balance, isLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: MOCK_ERC20_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: {
      enabled: !!contractAddress && !!address,
    },
  });

  return { balance, isLoading };
}

// Hook for reading token allowance
export function useTokenAllowance(owner: string, spender: string) {
  const { contractAddress } = useChessBetContract();
  
  const { data: allowance, isLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: MOCK_ERC20_ABI,
    functionName: "allowance",
    args: [owner as `0x${string}`, spender as `0x${string}`],
    query: {
      enabled: !!contractAddress && !!owner && !!spender,
    },
  });

  return { allowance, isLoading };
}

// Hook for approving token spending
export function useApproveToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = async (spender: string, amount: string, contractAddress: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: MOCK_ERC20_ABI,
      functionName: "approve",
      args: [spender as `0x${string}`, parseUnits(amount, 6)], // USDC has 6 decimals
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

// Hook for minting tokens (for testing)
export function useMintTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const mint = async (to: string, amount: string, contractAddress: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: MOCK_ERC20_ABI,
      functionName: "mint",
      args: [to as `0x${string}`, parseUnits(amount, 6)], // USDC has 6 decimals
    });
  };

  return {
    mint,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

// Import the contract hook from ChessBetContract
import { useChessBetContract } from "./ChessBetContract";
