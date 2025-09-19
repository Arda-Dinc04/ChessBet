# ChessBet - Production Deployment Guide

## 🚀 Production-Ready Chess Betting dApp

ChessBet is a decentralized chess betting platform built on EVM L2 (Base) that allows users to bet on chess games using USDC. The platform features three betting tiers and an orderbook system for unlimited betting amounts.

## 📋 Contract Addresses

### Mainnet (Base)

- **ChessBet Contract**: `0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f`
- **USDC Token**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base USDC)

### Testnet (Base Sepolia)

- **ChessBet Contract**: `TBD`
- **USDC Token**: `TBD`

## 🔧 Key Features

### Betting Tiers

- **Low Tier**: 5 USDC (fixed amount)
- **Medium Tier**: 50 USDC (fixed amount)
- **Unlimited Tier**: Custom amounts with $10 tick size

### Game Flow

1. **Create Game**: Player creates game with opponent
2. **Place Bets**: Both players place bets (USDC required)
3. **Start Game**: Game begins, betting pool locked
4. **Play Chess**: Players make moves (max 200 moves, 16 bytes per move)
5. **Submit Results**: Both players submit same result to resolve
6. **Claim Payouts**: Winner claims entire pool (minus 5% house fee)

### Orderbook System (Unlimited Tier)

- **Tick Size**: $10 USDC increments
- **Partial Fills**: Orders can be partially filled
- **Nearest-Level Matching**: Matches within 5% tolerance
- **FIFO**: First-in-first-out order processing

## 🛡️ Security Features

### Access Control

- **Owner Functions**: Parameter updates, emergency pause
- **Pausable**: Emergency stop for all betting activities
- **ReentrancyGuard**: Protection against reentrancy attacks

### Input Validation

- **Move Length**: Max 16 bytes per move
- **Move Count**: Max 200 moves per game
- **Amount Validation**: Proper USDC decimal handling (6 decimals)
- **Parameter Bounds**: Fee limits, tier amount validation

### Fund Safety

- **SafeERC20**: Safe token transfers
- **Escrow System**: Funds locked until game resolution
- **Dual Confirmation**: Both players must agree on result
- **Refund System**: Draws result in full refunds

## 📊 Events

### Game Events

- `GameCreated(gameId, whitePlayer, blackPlayer, timeControl)`
- `GameStarted(gameId)`
- `GameFinished(gameId, result)`
- `GameResolved(gameId, winner, result)`
- `MoveMade(gameId, move)`

### Betting Events

- `BetPlaced(gameId, player, amount)`
- `BetResolved(gameId, player, amount, payout, result)`
- `PayoutClaimed(player, amount)`

### Orderbook Events

- `OrderPlaced(orderId, player, side, amount)`
- `OrderCancelled(orderId)`
- `OrderMatched(orderId, matchId, amount)`

### Admin Events

- `HouseFeePercentageUpdated(newFeePercentage)`
- `BettingTierAmountsUpdated(lowTierAmount, mediumTierAmount)`

## 🔧 Admin Functions

### Parameter Management

```solidity
function setHouseFeePercentage(uint256 _houseFeePercentage) external onlyOwner
function setBettingTierAmounts(uint256 _lowTierAmount, uint256 _mediumTierAmount) external onlyOwner
```

### Emergency Functions

```solidity
function pause() external onlyOwner
function unpause() external onlyOwner
function pauseGame(bytes32 gameId) external onlyOwner
```

### Fee Management

```solidity
function withdrawTokenFees() external onlyOwner
```

## 📈 Monitoring & Observability

### Key Metrics to Track

- **Active Games**: Games in progress
- **Total Volume**: USDC bet across all games
- **House Fees**: Accumulated fees
- **Unclaimed Payouts**: Pending user payouts
- **Orderbook Depth**: Available liquidity per level

### Event Indexing

Use The Graph or custom indexer to track:

- Game lifecycle events
- Betting activity
- Orderbook activity
- Admin parameter changes

## 🚨 Emergency Procedures

### Pause Protocol

1. **Detection**: Monitor for suspicious activity
2. **Pause**: Call `pause()` to stop all betting
3. **Investigation**: Analyze the issue
4. **Resolution**: Fix issue and call `unpause()`

### Game Pause

1. **Individual Game**: Call `pauseGame(gameId)`
2. **Refund**: Players automatically refunded
3. **Investigation**: Resolve dispute
4. **Resume**: Create new game if needed

## 🔍 Testing

### Unit Tests

```bash
npx hardhat test
```

### Production Readiness Tests

```bash
npx hardhat run scripts/test-production.ts --network localhost
```

### Gas Estimation

```bash
npx hardhat run scripts/estimate-gas.ts --network localhost
```

## 🚀 Deployment

### Prerequisites

- Node.js 18+
- Hardhat
- Base RPC URL
- Private key for deployment

### Deploy to Testnet

```bash
npx hardhat run scripts/deploy-production.ts --network baseSepolia
```

### Deploy to Mainnet

```bash
npx hardhat run scripts/deploy-production.ts --network base
```

### Verify Contracts

```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> <TOKEN_ADDRESS>
```

## 📝 Integration Guide

### Frontend Integration

1. **Connect Wallet**: Use wagmi/viem for wallet connection
2. **Approve USDC**: Users must approve contract to spend USDC
3. **Create Games**: Call `createGame()` with opponent address
4. **Place Bets**: Call `placeBet()` with game ID and amount
5. **Listen to Events**: Track game state changes via events

### API Integration

- **Game State**: Query contract for game details
- **Player Bets**: Use `getPlayerBets()` for user history
- **Orderbook**: Query orderbook levels for depth
- **Events**: Index events for real-time updates

## ⚠️ Important Notes

### USDC Decimals

- All amounts use 6 decimal places (USDC standard)
- 1 USDC = 1,000,000 units
- Frontend should display amounts divided by 1,000,000

### Gas Optimization

- Hot paths optimized for gas efficiency
- Move counting uses O(1) operations
- Orderbook uses swap-and-pop for gas savings

### Security Considerations

- Transfer ownership to multisig immediately
- Monitor for suspicious activity
- Keep private keys secure
- Test all functions on testnet first

## 📞 Support

For technical support or questions:

- GitHub Issues: [Repository Issues]
- Documentation: [Full Documentation]
- Security: [Security Contact]

## 📄 License

MIT License - see LICENSE file for details.

---

**⚠️ DISCLAIMER**: This is experimental software. Use at your own risk. Always test thoroughly on testnets before mainnet deployment.

