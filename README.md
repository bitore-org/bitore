# BitOre: Advanced Proof-of-Work Mining Protocol

BitOre is an innovative blockchain mining project that implements a sophisticated Proof-of-Work (PoW) system. It introduces a dynamic, epoch-based mining mechanism with adaptive difficulty and a unique reward system based on miners' historical gas usage. This project aims to create a more efficient and fair mining environment while maintaining network security.

## Table of Contents

1. [Features](#features)
2. [Smart Contracts](#smart-contracts)
3. [Technical Details](#technical-details)
4. [Getting Started](#getting-started)
5. [Usage](#usage)
6. [Configuration](#configuration)
7. [Development](#development)
8. [Contributing](#contributing)
9. [License](#license)
10. [Disclaimer](#disclaimer)

## Features

- Epoch-based mining system with adaptive length
- Dynamic difficulty adjustment for optimal mining pace
- Gas-usage based mining rewards to incentivize efficiency
- Multiple token minting support for flexible reward structures
- Reentrancy protection for enhanced security
- Automatic adjustment of allowed miners per epoch
- Gaussian distribution target for balanced network participation

## Smart Contracts

The core of this project is the `BitOrePow.sol` contract, which manages the entire mining process. It interacts with an `IBitOreToken` interface for minting rewards.

### Key Components

- **Epoch System**: Mining occurs in epochs, targeting 60 seconds length but adjustable based on network conditions.
- **Dynamic Difficulty**: The mining difficulty (`miningTarget`) adjusts based on network participation and mining speed.
- **Miner Allowance**: The contract dynamically adjusts the number of allowed miners per epoch to balance participation.
- **Gas-Based Rewards**: A unique feature where miners' rewards are influenced by their historical gas usage, promoting efficient mining practices.
- **Multi-Token Minting**: Supports minting multiple token types as rewards for successful miners.

## Technical Details

### Epoch Management

- Epochs start and end based on block numbers
- New epochs trigger difficulty adjustments and miner allowance updates

### Difficulty Adjustment

- Difficulty increases if 68.2% of allowed miners participate in less than half the epoch time
- Adjustments aim to maintain optimal epoch length and network security

### Reward Calculation

- Miners' rewards are multiplied based on their historical gas usage
- A base multiplier is adjusted up to a maximum multiplier to reward efficient miners

### Security Measures

- Reentrancy guard to prevent exploits
- Checks to ensure miners only participate once per epoch

## Getting Started

To set up the BitOre project:

Install dependencies:

```
npm install
```

Compile the contracts:

```
npm compile
```

Run tests:

```
npm test
```

## Usage

Miners can participate by calling the `mine` function:

```
function mine(bytes32 nonce, address[] calldata mintAddresses) public nonReentrant
```

- `nonce`: A unique value to solve the mining puzzle
- `mintAddresses`: Array of token addresses to mint as rewards

## Configuration

Key configurable parameters:

- `epochLengthOptimal`: Target epoch length (default: 60 seconds)
- `adjustmentInterval`: Frequency of major adjustments (default: every 4 epochs)
- `allowedMiners`: Maximum number of miners per epoch (dynamically adjusted)
- `miningTarget`: Current mining difficulty target
- `baseMultiplier` and `maxMultiplier`: Control the range of reward multipliers

## Development

To contribute to BitOre development:

1. Fork the repository
2. Create a new branch for your feature
3. Implement your changes
4. Write or update tests as necessary
5. Submit a pull request

We recommend using Hardhat for local development and testing.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

This project is experimental and for educational purposes only. Use at your own risk. The authors and contributors are not responsible for any loss or damage arising from the use of this software.
