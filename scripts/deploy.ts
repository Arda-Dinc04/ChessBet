import hre from "hardhat";
const { ethers } = hre;

async function main() {
  console.log("Deploying ChessBet contract...");

  // Deploy a mock ERC20 token for testing (optional)
  // In production, you might want to use USDC or another stablecoin
  const MockToken = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockToken.deploy("ChessBet Token", "CBT", ethers.parseEther("1000000"));
  await mockToken.waitForDeployment();
  
  const tokenAddress = await mockToken.getAddress();
  console.log("Mock token deployed to:", tokenAddress);

  // Deploy the main ChessBet contract
  const ChessBet = await ethers.getContractFactory("ChessBet");
  const chessBet = await ChessBet.deploy(tokenAddress);
  await chessBet.waitForDeployment();

  const contractAddress = await chessBet.getAddress();
  console.log("ChessBet contract deployed to:", contractAddress);

  // Set betting tier amounts (USDC with 6 decimals)
  const lowTierAmount = ethers.parseUnits("5", 6); // 5 USDC
  const mediumTierAmount = ethers.parseUnits("50", 6); // 50 USDC
  
  await chessBet.setBettingTierAmounts(lowTierAmount, mediumTierAmount);
  console.log("Betting tier amounts set");

  // Verify deployment
  console.log("\n=== Deployment Summary ===");
  console.log("Contract Address:", contractAddress);
  console.log("Token Address:", tokenAddress);
  console.log("Low Tier Amount:", ethers.formatUnits(lowTierAmount, 6), "USDC");
  console.log("Medium Tier Amount:", ethers.formatUnits(mediumTierAmount, 6), "USDC");
  console.log("Tick Size:", ethers.formatUnits(await chessBet.tickSize(), 6), "USDC");
  console.log("House Fee Percentage:", await chessBet.houseFeePercentage(), "%");

  console.log("\n=== Next Steps ===");
  console.log("1. Update your .env.local with the contract address");
  console.log("2. Verify the contract on BaseScan (optional)");
  console.log("3. Test the contract functions");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
