# ♔ ChessBet - Decentralized Chess Betting dApp

A modern chess betting dApp built on Base (Ethereum L2) that allows players to bet on chess games with cryptocurrency.

## 🎯 Features

- **Three Betting Tiers**: Low ($5), Medium ($50), and Unlimited (custom amounts)
- **Winner-Takes-All**: Winner gets the entire pot, draws result in refunds
- **Smart Notifications**: Gentle reminders for invalid moves
- **Modern UI**: Clean, DeFi-inspired design with smooth animations
- **Wallet Integration**: MetaMask and other injected wallet support
- **Orderbook System**: Advanced matching for unlimited tier bets

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible wallet

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd chess-bet
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Smart Contract Deployment

1. Compile contracts:

```bash
npm run compile
```

2. Deploy to Base Sepolia (testnet):

```bash
npm run deploy:base-sepolia
```

3. Deploy to Base (mainnet):

```bash
npm run deploy:base
```

## 🎮 How to Play

1. **Connect Wallet** - Connect your MetaMask or compatible wallet
2. **Choose Mode** - Select Low ($5), Medium ($50), or Unlimited betting tier
3. **Place Bet** - Your bet amount is locked when you select a mode
4. **Find Opponent** - System matches you with another player
5. **Play Chess** - Winner takes the entire pot, draws result in refunds

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: wagmi, viem, Base L2
- **Chess Engine**: chess.js
- **Smart Contracts**: Solidity, Hardhat, OpenZeppelin

## 📁 Project Structure

```
chess-bet/
├── contracts/           # Smart contracts
├── src/
│   ├── app/            # Next.js app router
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   ├── lib/           # Core logic
│   └── providers/     # App providers
├── scripts/           # Deployment scripts
└── public/           # Static assets
```

## 🔧 Development

- **Frontend**: `npm run dev`
- **Compile Contracts**: `npm run compile`
- **Lint**: `npm run lint`
- **Build**: `npm run build`

## 📄 License

MIT License - see LICENSE file for details
