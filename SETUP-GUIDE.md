# ChessBet Setup Guide

This guide will help you deploy and test the ChessBet application on Base Sepolia testnet.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Git**
4. **MetaMask** or compatible wallet
5. **Base Sepolia testnet ETH** (get from [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet))

## Environment Setup

### 1. Install Dependencies

```bash
cd chess-bet
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# RPC Endpoints - Get from Alchemy or Infura
NEXT_PUBLIC_RPC_BASE=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
NEXT_PUBLIC_RPC_BASE_SEP=https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# WalletConnect Project ID - Get from https://cloud.walletconnect.com/
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id

# Contract Addresses (will be set after deployment)
NEXT_PUBLIC_CHESS_BET_CONTRACT_BASE=
NEXT_PUBLIC_CHESS_BET_CONTRACT_BASE_SEP=
NEXT_PUBLIC_MOCK_ERC20_CONTRACT_BASE=
NEXT_PUBLIC_MOCK_ERC20_CONTRACT_BASE_SEP=

# Private key for deployment (keep secure!)
PRIVATE_KEY=your_private_key_here

# BaseScan API key for contract verification
BASESCAN_API_KEY=your_basescan_api_key
```

### 3. Get Required API Keys

#### Alchemy RPC URLs

1. Go to [Alchemy](https://www.alchemy.com/)
2. Create a free account
3. Create a new app for Base Sepolia
4. Copy the HTTPS URL and replace `YOUR_ALCHEMY_KEY` in `.env.local`

#### WalletConnect Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Create a new project
3. Copy the Project ID and replace `your_walletconnect_project_id` in `.env.local`

#### BaseScan API Key (Optional)

1. Go to [BaseScan](https://basescan.org/)
2. Create an account
3. Get your API key from the API section
4. Replace `your_basescan_api_key` in `.env.local`

## Deployment

### 1. Compile Contracts

```bash
npm run compile
```

### 2. Deploy to Base Sepolia Testnet

```bash
npm run deploy:testnet
```

This will:

- Deploy MockERC20 contract (test USDC token)
- Deploy ChessBet contract
- Set up betting tiers and fees
- Mint test tokens to your account
- Update `.env.local` with contract addresses

### 3. Verify Contracts (Optional)

```bash
npm run verify:base-sepolia
```

## Frontend Setup

### 1. Start Development Server

```bash
npm run dev
```

### 2. Open in Browser

Navigate to `http://localhost:3000`

### 3. Connect Wallet

1. Click "Connect Wallet"
2. Select your wallet (MetaMask recommended)
3. Switch to Base Sepolia network if not already connected

## Testing the Application

### 1. Get Testnet ETH

If you don't have Base Sepolia ETH:

1. Go to [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
2. Connect your wallet
3. Request testnet ETH

### 2. Get Test Tokens

The deployment script automatically mints 1000 tUSDC to your account. If you need more:

1. Go to the deployed MockERC20 contract on BaseScan
2. Use the `mint` function to mint more tokens
3. Or use the frontend (if implemented)

### 3. Test Betting

1. Select a game mode (Low, Medium, or Unlimited)
2. Place a bet
3. The system will create a game and match you with an opponent
4. Play chess and submit results
5. Winner takes the pot!

## Troubleshooting

### Common Issues

#### "Contract not configured" Error

- Make sure you've deployed the contracts
- Check that `.env.local` has the correct contract addresses
- Restart the development server

#### "Insufficient balance" Error

- Make sure you have enough tUSDC tokens
- Check your wallet balance
- Mint more tokens if needed

#### "Wrong network" Error

- Switch to Base Sepolia network in your wallet
- Add Base Sepolia network if not present:
  - Network Name: Base Sepolia
  - RPC URL: https://sepolia.base.org
  - Chain ID: 84532
  - Currency Symbol: ETH
  - Block Explorer: https://sepolia.basescan.org

#### Transaction Fails

- Check you have enough ETH for gas fees
- Try increasing gas limit
- Check if contract is paused

### Network Configuration

#### Base Sepolia

- Chain ID: 84532
- RPC URL: https://sepolia.base.org
- Block Explorer: https://sepolia.basescan.org

#### Base Mainnet

- Chain ID: 8453
- RPC URL: https://mainnet.base.org
- Block Explorer: https://basescan.org

## Contract Functions

### ChessBet Contract

- `createGame(blackPlayer, timeControl, bettingTier)` - Create a new game
- `placeBet(gameId, amount)` - Place a bet on a game
- `startGame(gameId)` - Start a game
- `makeMove(gameId, move)` - Make a chess move
- `submitGameResult(gameId, result)` - Submit game result
- `claimPayout()` - Claim winnings

### MockERC20 Contract

- `mint(to, amount)` - Mint test tokens
- `approve(spender, amount)` - Approve spending
- `balanceOf(account)` - Check balance

## Security Notes

- This is a testnet deployment - tokens have no real value
- Never use real private keys in production
- Always test thoroughly before mainnet deployment
- Keep your private keys secure

## Next Steps

1. Test all functionality thoroughly
2. Deploy to Base Mainnet when ready
3. Replace MockERC20 with real USDC
4. Set up monitoring and alerts
5. Implement additional features

## Support

If you encounter issues:

1. Check the console for error messages
2. Verify your environment configuration
3. Ensure you have sufficient testnet ETH
4. Check contract addresses are correct
