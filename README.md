# Plurix

A local desktop application to inspect, manage, and batch sweep wallets (seed phrases & private keys).

## Features

- **Address Derivation**: Derive EVM and Solana addresses from seed phrases and private keys
- **Multi-Chain Balance Scanner**: Query balances on Ethereum, BNB Chain (BSC), Base, Arbitrum, and Solana
- **ERC-20 & SPL Token Detection**: Automatically discover popular token balances
- **Batch Wallet Sweeper**: Consolidate and sweep native funds from multiple wallets into a single recipient address with automatic gas estimation
- **Encrypted Local Storage**: SQLite vault encrypted with AES-256 and protected by your Master Password
- **Smart Duplicate Prevention**: Automatically deduplicates wallets on import
- **Funded Prioritization**: Funded wallets are highlighted and prioritized
- **Export Options**: Export wallet records and balances to TXT or CSV
- **100% Local**: Zero cloud dependencies, maximum privacy

## Development

```bash
npm install
npm run tauri dev
```

## Production Build (.exe)

```bash
npm run tauri build
```

Installer output will be located in: `src-tauri/target/release/bundle/`

## Security Notes

- Your master password encrypts all seed phrases and private keys on disk.
- Never share your database file (`wallet_inspector.db`) or unencrypted export files.
- Only run the app on personal, trusted devices.