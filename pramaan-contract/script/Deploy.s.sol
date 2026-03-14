// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Pramaan.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address aiAgent   = vm.envAddress("AGENT_WALLET");
        address treasury  = vm.envAddress("TREASURY_WALLET");
        address usdc      = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        uint256 fee       = 1_000_000; // 1 USDC

        Pramaan pramaan = new Pramaan(
            aiAgent,
            treasury,
            usdc,
            fee
        );

        console.log("Pramaan deployed at:", address(pramaan));

        vm.stopBroadcast();
    }
}