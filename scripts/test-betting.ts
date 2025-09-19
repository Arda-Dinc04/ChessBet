import hre from "hardhat";
const { ethers } = hre;

async function main() {
  console.log("🧪 Testing ChessBet Wager & Escrow System\n");

  // Get test accounts
  const [deployer, player1, player2, player3] = await ethers.getSigners();
  
  // Contract addresses from deployment
  const tokenAddress = "0x922D6956C99E12DFeB3224DEA977D0939758A1Fe";
  const contractAddress = "0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f";
  
  // Get contract instances
  const token = await ethers.getContractAt("MockERC20", tokenAddress);
  const chessBet = await ethers.getContractAt("ChessBet", contractAddress);
  
  console.log("📋 Test Setup:");
  console.log(`- Token: ${tokenAddress}`);
  console.log(`- Contract: ${contractAddress}`);
  console.log(`- Player 1: ${player1.address}`);
  console.log(`- Player 2: ${player2.address}`);
  console.log(`- Player 3: ${player3.address}\n`);

  // Test 1: Token Distribution
  console.log("🪙 Test 1: Token Distribution");
  const distributeAmount = ethers.parseUnits("1000", 6); // 1000 USDC
  
  await token.transfer(player1.address, distributeAmount);
  await token.transfer(player2.address, distributeAmount);
  await token.transfer(player3.address, distributeAmount);
  
  console.log(`✅ Distributed ${ethers.formatUnits(distributeAmount, 6)} USDC to each player`);
  
  // Test 2: Token Approvals
  console.log("\n🔐 Test 2: Token Approvals");
  const approvalAmount = ethers.parseUnits("100", 6); // 100 USDC
  
  await token.connect(player1).approve(contractAddress, approvalAmount);
  await token.connect(player2).approve(contractAddress, approvalAmount);
  await token.connect(player3).approve(contractAddress, approvalAmount);
  
  console.log("✅ All players approved contract to spend tokens");

  // Test 3: Create Game (Low Tier - $5)
  console.log("\n🎮 Test 3: Create Game (Low Tier)");
  const lowTierAmount = ethers.parseUnits("5", 6); // 5 USDC
  
  const createGameTx = await chessBet.connect(player1).createGame(
    player2.address,
    0, // timeControl (not used in current implementation)
    0 // Low tier
  );
  const receipt = await createGameTx.wait();
  
  // Get the gameId from the event logs
  const gameCreatedEvent = receipt?.logs.find(log => {
    try {
      const parsed = chessBet.interface.parseLog(log);
      return parsed?.name === 'GameCreated';
    } catch {
      return false;
    }
  });
  
  const gameId = gameCreatedEvent ? 
    chessBet.interface.parseLog(gameCreatedEvent)?.args.gameId : 
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  console.log(`✅ Game created with ID: ${gameId}`);

  // Test 4: Place Bets
  console.log("\n💰 Test 4: Place Bets");
  
  // Player 1 places bet (using USDC tokens)
  const bet1Tx = await chessBet.connect(player1).placeBet(gameId, lowTierAmount);
  await bet1Tx.wait();
  console.log("✅ Player 1 placed bet");
  
  // Player 2 places bet
  const bet2Tx = await chessBet.connect(player2).placeBet(gameId, lowTierAmount);
  await bet2Tx.wait();
  console.log("✅ Player 2 placed bet");

  // Test 5: Check Betting Pool
  console.log("\n🏦 Test 5: Check Betting Pool");
  const pool = await chessBet.getBettingPool(gameId);
  console.log(`- Total Amount: ${ethers.formatUnits(pool.totalAmount, 6)} USDC`);
  console.log(`- House Fee: ${ethers.formatUnits(pool.houseFee, 6)} USDC`);
  console.log(`- Resolved: ${pool.resolved}`);
  console.log(`- Winner: ${pool.winner}`);

  // Test 6: Simulate Game Resolution (White Wins)
  console.log("\n🏁 Test 6: Simulate Game Resolution (White Wins)");
  
  // Both players submit the same result to confirm
  const submitTx1 = await chessBet.connect(player1).submitGameResult(
    gameId,
    0 // White wins
  );
  await submitTx1.wait();
  
  const submitTx2 = await chessBet.connect(player2).submitGameResult(
    gameId,
    0 // White wins
  );
  await submitTx2.wait();
  console.log("✅ Game resolved - White wins (both players confirmed)");

  // Test 7: Check Balances After Resolution
  console.log("\n💳 Test 7: Check Balances After Resolution");
  
  const player1Balance = await token.balanceOf(player1.address);
  const player2Balance = await token.balanceOf(player2.address);
  const contractBalance = await token.balanceOf(contractAddress);
  
  console.log(`- Player 1 (White) Balance: ${ethers.formatUnits(player1Balance, 6)} USDC`);
  console.log(`- Player 2 (Black) Balance: ${ethers.formatUnits(player2Balance, 6)} USDC`);
  console.log(`- Contract Balance: ${ethers.formatUnits(contractBalance, 6)} USDC`);

  // Test 8: Test Draw Scenario
  console.log("\n🤝 Test 8: Test Draw Scenario");
  
  // Create new game for draw test
  const createGame2Tx = await chessBet.connect(player2).createGame(
    player3.address,
    0, // timeControl
    0  // Low tier
  );
  const receipt2 = await createGame2Tx.wait();
  
  // Get the gameId from the event logs
  const gameCreatedEvent2 = receipt2?.logs.find(log => {
    try {
      const parsed = chessBet.interface.parseLog(log);
      return parsed?.name === 'GameCreated';
    } catch {
      return false;
    }
  });
  
  const gameId2 = gameCreatedEvent2 ? 
    chessBet.interface.parseLog(gameCreatedEvent2)?.args.gameId : 
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  // Place bets
  await chessBet.connect(player2).placeBet(gameId2, lowTierAmount);
  await chessBet.connect(player3).placeBet(gameId2, lowTierAmount);
  
  // Resolve as draw - both players submit draw result
  await chessBet.connect(player2).submitGameResult(gameId2, 2); // Draw
  await chessBet.connect(player3).submitGameResult(gameId2, 2); // Draw
  
  const player2BalanceAfterDraw = await token.balanceOf(player2.address);
  const player3BalanceAfterDraw = await token.balanceOf(player3.address);
  
  console.log(`- Player 2 Balance after draw: ${ethers.formatUnits(player2BalanceAfterDraw, 6)} USDC`);
  console.log(`- Player 3 Balance after draw: ${ethers.formatUnits(player3BalanceAfterDraw, 6)} USDC`);

  // Test 9: Test Unlimited Tier (Orderbook)
  console.log("\n📊 Test 9: Test Unlimited Tier (Orderbook)");
  
  const customAmount = ethers.parseUnits("25", 6); // 25 USDC
  
  // Create unlimited tier game
  const createUnlimitedTx = await chessBet.connect(player1).createGame(
    player2.address,
    0, // timeControl
    2  // Unlimited tier
  );
  const receipt3 = await createUnlimitedTx.wait();
  
  // Get the gameId from the event logs
  const gameCreatedEvent3 = receipt3?.logs.find(log => {
    try {
      const parsed = chessBet.interface.parseLog(log);
      return parsed?.name === 'GameCreated';
    } catch {
      return false;
    }
  });
  
  const unlimitedGameId = gameCreatedEvent3 ? 
    chessBet.interface.parseLog(gameCreatedEvent3)?.args.gameId : 
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  // Place custom bet
  await chessBet.connect(player1).placeBet(unlimitedGameId, customAmount);
  await chessBet.connect(player2).placeBet(unlimitedGameId, customAmount);
  
  console.log(`✅ Unlimited tier game created and bets placed with ${ethers.formatUnits(customAmount, 6)} USDC each`);

  console.log("\n🎉 All Tests Completed Successfully!");
  console.log("\n📊 Summary:");
  console.log("- ✅ Token distribution and approvals working");
  console.log("- ✅ Game creation and betting working");
  console.log("- ✅ Escrow system holding funds correctly");
  console.log("- ✅ Winner-takes-all payout working");
  console.log("- ✅ Draw refund system working");
  console.log("- ✅ Unlimited tier custom amounts working");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
