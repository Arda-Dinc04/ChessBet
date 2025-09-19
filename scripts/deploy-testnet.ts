const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying ChessBet to Base Sepolia Testnet\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Check if we have enough ETH for deployment
  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance < ethers.parseEther("0.01")) {
    console.log("❌ Insufficient ETH for deployment. Please fund your account with at least 0.01 ETH");
    console.log("You can get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
    process.exit(1);
  }

  // Deploy MockERC20 (USDC-like token for testing)
  console.log("\n📦 Deploying MockERC20...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy(
    "Test USDC", 
    "tUSDC", 
    ethers.parseUnits("1000000", 6) // 1M tokens with 6 decimals
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ MockERC20 deployed to:", tokenAddress);

  // Deploy ChessBet
  console.log("\n📦 Deploying ChessBet...");
  const ChessBet = await ethers.getContractFactory("ChessBet");
  const chessBet = await ChessBet.deploy(tokenAddress);
  await chessBet.waitForDeployment();
  const contractAddress = await chessBet.getAddress();
  console.log("✅ ChessBet deployed to:", contractAddress);

  // Set initial parameters
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

  // Mint some test tokens to deployer for testing
  console.log("\n🪙 Minting test tokens...");
  const mintTx = await token.mint(deployer.address, ethers.parseUnits("1000", 6)); // 1000 USDC
  await mintTx.wait();
  console.log("✅ Minted 1000 tUSDC to deployer");

  // Verify contract state
  console.log("\n🔍 Verifying contract state...");
  const tickSize = await chessBet.tickSize();
  const houseFeePercentage = await chessBet.houseFeePercentage();
  const lowTier = await chessBet.lowTierAmount();
  const mediumTier = await chessBet.mediumTierAmount();
  const tokenBalance = await token.balanceOf(deployer.address);

  console.log("Tick Size:", ethers.formatUnits(tickSize, 6), "USDC");
  console.log("House Fee Percentage:", houseFeePercentage.toString(), "basis points");
  console.log("Low Tier Amount:", ethers.formatUnits(lowTier, 6), "USDC");
  console.log("Medium Tier Amount:", ethers.formatUnits(mediumTier, 6), "USDC");
  console.log("Deployer Token Balance:", ethers.formatUnits(tokenBalance, 6), "tUSDC");

  // Get network info
  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();
  
  console.log("\n📋 Deployment Summary:");
  console.log("=====================");
  console.log("Network:", network.name, "(Chain ID:", network.chainId.toString() + ")");
  console.log("Block Number:", blockNumber);
  console.log("ChessBet Contract:", contractAddress);
  console.log("MockERC20 Contract:", tokenAddress);
  console.log("Deployer:", deployer.address);
  
  // Update environment file
  console.log("\n📝 Updating environment configuration...");
  const envPath = path.join(__dirname, "..", ".env.local");
  let envContent = "";
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  } else {
    envContent = `# RPC Endpoints
NEXT_PUBLIC_RPC_BASE=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
NEXT_PUBLIC_RPC_BASE_SEP=https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# WalletConnect Project ID
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id

# Contract Addresses
NEXT_PUBLIC_CHESS_BET_CONTRACT_BASE=
NEXT_PUBLIC_CHESS_BET_CONTRACT_BASE_SEP=
NEXT_PUBLIC_MOCK_ERC20_CONTRACT_BASE=
NEXT_PUBLIC_MOCK_ERC20_CONTRACT_BASE_SEP=

# Private key for deployment (keep secure!)
PRIVATE_KEY=your_private_key_here

# BaseScan API key for contract verification
BASESCAN_API_KEY=your_basescan_api_key
`;
  }

  // Update the testnet addresses
  envContent = envContent.replace(
    /NEXT_PUBLIC_CHESS_BET_CONTRACT_BASE_SEP=.*/,
    `NEXT_PUBLIC_CHESS_BET_CONTRACT_BASE_SEP=${contractAddress}`
  );
  envContent = envContent.replace(
    /NEXT_PUBLIC_MOCK_ERC20_CONTRACT_BASE_SEP=.*/,
    `NEXT_PUBLIC_MOCK_ERC20_CONTRACT_BASE_SEP=${tokenAddress}`
  );

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Environment file updated with contract addresses");

  console.log("\n🔗 Verification Commands:");
  console.log("npx hardhat verify --network base-sepolia", contractAddress, `"${tokenAddress}"`);
  console.log("npx hardhat verify --network base-sepolia", tokenAddress);
  
  console.log("\n📝 Next Steps:");
  console.log("1. Verify contracts on BaseScan");
  console.log("2. Update your .env.local with the contract addresses above");
  console.log("3. Start the frontend: npm run dev");
  console.log("4. Test the betting functionality");
  console.log("5. Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
  
  console.log("\n⚠️  Important Notes:");
  console.log("- This is a testnet deployment - use testnet ETH only");
  console.log("- The MockERC20 tokens have no real value");
  console.log("- Test all functions before considering mainnet deployment");
  console.log("- Keep your private keys secure");
  
  console.log("\n🎉 Testnet deployment completed successfully!");
  console.log("\n🔗 View on BaseScan:");
  console.log(`ChessBet: https://sepolia.basescan.org/address/${contractAddress}`);
  console.log(`MockERC20: https://sepolia.basescan.org/address/${tokenAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
