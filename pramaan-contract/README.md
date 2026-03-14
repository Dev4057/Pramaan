## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

## ZK Verification Phase 1 (Verifier-Gated Submissions)

This repository now supports two submission modes:

- Legacy mode: `submitIdentity` / `submitIncome` (string proof hash based)
- ZK mode: `submitIdentityZK` / `submitIncomeZK` (verifier-gated + nullifier replay protection)

### Required setup after deployment

1. Deploy the updated `Pramaan` contract.
2. Deploy identity and income verifier contracts.
3. Call `setZKVerifiers(identityVerifier, incomeVerifier)` once from admin wallet.
4. Set frontend env `VITE_USE_ZK_SUBMISSION=true`.
5. Set backend env `ENABLE_ZK_FLOW=true`.

### Public signal schema

- Identity public signals (length 5):
	- `[wallet, isAdult, isIndian, nullifier, identityCommitment]`
- Income public signals (length 5):
	- `[wallet, incomeFloorMet, platformCode, nullifier, incomeCommitment]`

`wallet` must match `msg.sender` (`uint160` packed in `uint256`).
