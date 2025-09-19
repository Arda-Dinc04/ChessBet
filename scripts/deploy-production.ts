import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying ChessBet to Production Network\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy MockERC20 (replace with real USDC address in production)
  console.log("\n📦 Deploying MockERC20...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy("Test USDC", "tUSDC", ethers.parseUnits("1000000", 6));
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("MockERC20 deployed to:", tokenAddress);

  // Deploy ChessBet
  console.log("\n📦 Deploying ChessBet...");
  const ChessBet = await ethers.getContractFactory("ChessBet");
  const chessBet = await ChessBet.deploy(tokenAddress);
  await chessBet.waitForDeployment();
  const contractAddress = await chessBet.getAddress();
  console.log("ChessBet deployed to:", contractAddress);

  // Set initial parameters (USDC with 6 decimals)
  console.log("\n⚙️ Setting initial parameters...");
  
  // Set betting tier amounts (USDC with 6 decimals)
  const lowTierAmount = ethers.parseUnits("5", 6); // 5 USDC
  const mediumTierAmount = ethers.parseUnits("50", 6); // 50 USDC
  
  const setTiersTx = await chessBet.setBettingTierAmounts(lowTierAmount, mediumTierAmount);
  await setTiersTx.wait();
  console.log("✅ Betting tier amounts set");
  console.log("  - Low Tier: 5.0 USDC");
  console.log("  - Medium Tier: 50.0 USDC");

  // Set house fee (5% = 500 basis points)
  const setFeeTx = await chessBet.setHouseFeePercentage(500);
  await setFeeTx.wait();
  console.log("✅ House fee percentage set to 5%");

  // Verify contract state
  console.log("\n🔍 Verifying contract state...");
  const tickSize = await chessBet.tickSize();
  const houseFeePercentage = await chessBet.houseFeePercentage();
  const lowTier = await chessBet.lowTierAmount();
  const mediumTier = await chessBet.mediumTierAmount();

  console.log("Tick Size:", ethers.formatUnits(tickSize, 6), "USDC");
  console.log("House Fee Percentage:", houseFeePercentage.toString(), "basis points");
  console.log("Low Tier Amount:", ethers.formatUnits(lowTier, 6), "USDC");
  console.log("Medium Tier Amount:", ethers.formatUnits(mediumTier, 6), "USDC");

  // Get network info
  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();
  
  console.log("\n📋 Deployment Summary:");
  console.log("=====================");
  console.log("Network:", network.name, "(Chain ID:", network.chainId.toString() + ")");
  console.log("Block Number:", blockNumber);
  console.log("Contract Address:", contractAddress);
  console.log("Token Address:", tokenAddress);
  console.log("Deployer:", deployer.address);
  
  console.log("\n🔗 Verification Commands:");
  console.log("npx hardhat verify --network", network.name, contractAddress, `"${tokenAddress}"`);
  console.log("npx hardhat verify --network", network.name, tokenAddress);
  
  console.log("\n📝 Next Steps:");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Transfer ownership to multisig (Safe)");
  console.log("3. Set up monitoring and alerts");
  console.log("4. Deploy frontend with contract addresses");
  console.log("5. Run comprehensive tests on testnet first");
  
  console.log("\n⚠️  Security Reminders:");
  console.log("- Transfer ownership to multisig immediately");
  console.log("- Test all functions on testnet before mainnet");
  console.log("- Set up monitoring for contract events");
  console.log("- Document all parameter changes");
  console.log("- Keep private keys secure");
  
  console.log("\n🎉 Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

