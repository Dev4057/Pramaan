// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockProofVerifier {
    function verifyProof(bytes calldata, uint256[] calldata) external pure returns (bool) {
        return true;
    }
}
