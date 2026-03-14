// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Pramaan.sol";
import "../src/MockProofVerifier.sol";

contract ConfigureZK is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address pramaanAddress = vm.envAddress("PRAMAAN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        MockProofVerifier identityVerifier = new MockProofVerifier();
        MockProofVerifier incomeVerifier = new MockProofVerifier();

        Pramaan(pramaanAddress).setZKVerifiers(address(identityVerifier), address(incomeVerifier));

        console2.log("Identity verifier:", address(identityVerifier));
        console2.log("Income verifier:", address(incomeVerifier));

        vm.stopBroadcast();
    }
}
