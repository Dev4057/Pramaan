// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Pramaan
 * @dev Decentralised income verification protocol for India's gig workers.
 * Identity and income both verified via Reclaim Protocol HTTPS proofs.
 * GigScore written on-chain by AI Agent after fetching proof from Fileverse.
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface IProofVerifier {
    function verifyProof(bytes calldata proof, uint256[] calldata publicSignals) external view returns (bool);
}

contract Pramaan {

    // --- Structs ---

    struct WorkerProfile {
        bool identityVerified;
        bool incomeVerified;
        uint8 gigScore;
        uint256 lastUpdated;
        string identityDdocId;   // Fileverse doc ID for identity proof
        string incomeDdocId;     // Fileverse doc ID for income proof
        string platform;         // Swiggy / Uber / SBI
        string identityProofHash;
        string incomeProofHash;
        bytes32 identityNullifier;
        bytes32 incomeNullifier;
        bytes32 identityCommitment;
        bytes32 incomeCommitment;
        bool exists;
    }

    struct VerificationLog {
        address lender;
        address worker;
        uint256 timestamp;
        uint256 feePaid;
    }

    // --- State ---

    address public immutable AI_AGENT;
    address public admin;
    address public treasury;
    IERC20 public usdc;
    uint256 public verificationFee;
    IProofVerifier public identityVerifier;
    IProofVerifier public incomeVerifier;

    mapping(address => WorkerProfile) public workers;
    mapping(string => bool) public usedProofHashes; // Prevents proof replay attacks
    mapping(bytes32 => bool) public usedNullifiers; // Prevents proof replay in ZK mode
    VerificationLog[] public verificationLogs;

    // --- Events ---

    event IdentityVerified(
        address indexed worker,
        string ddocId,
        string proofHash,
        uint256 timestamp
    );

    event IncomeVerified(
        address indexed worker,
        string platform,
        string ddocId,
        string proofHash,
        uint256 timestamp
    );

    event ScoreUpdated(
        address indexed worker,
        uint8 newScore,
        uint256 timestamp
    );

    event WorkerVerified(
        address indexed lender,
        address indexed worker,
        uint256 feePaid,
        uint256 timestamp
    );

    event ZKVerifiersUpdated(address indexed identityVerifier, address indexed incomeVerifier);

    event IdentityVerifiedZK(
        address indexed worker,
        bytes32 indexed nullifier,
        bytes32 commitment,
        uint256 timestamp
    );

    event IncomeVerifiedZK(
        address indexed worker,
        uint256 indexed platformCode,
        bytes32 indexed nullifier,
        bytes32 commitment,
        uint256 timestamp
    );

    // --- Modifiers ---

    modifier onlyAgent() {
        require(msg.sender == AI_AGENT, "Pramaan: Only AI Agent");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Pramaan: Only admin");
        _;
    }

    // --- Constructor ---

    constructor(
        address _aiAgent,
        address _treasury,
        address _usdcAddress,
        uint256 _verificationFee
    ) {
        AI_AGENT = _aiAgent;
        admin = msg.sender;
        treasury = _treasury;
        usdc = IERC20(_usdcAddress);
        verificationFee = _verificationFee;
    }

    function setZKVerifiers(address _identityVerifier, address _incomeVerifier) external onlyAdmin {
        require(_identityVerifier != address(0), "Pramaan: Invalid identity verifier");
        require(_incomeVerifier != address(0), "Pramaan: Invalid income verifier");
        identityVerifier = IProofVerifier(_identityVerifier);
        incomeVerifier = IProofVerifier(_incomeVerifier);
        emit ZKVerifiersUpdated(_identityVerifier, _incomeVerifier);
    }

    function _validateWalletSignal(uint256 walletSignal) internal view returns (bool) {
        return address(uint160(walletSignal)) == msg.sender;
    }

    // --- Core Functions ---

    /**
     * @dev Step 1: Worker submits Reclaim identity proof (Aadhaar DigiLocker)
     * Proof is stored encrypted on Fileverse. Only ddocId goes on-chain.
     */
    function submitIdentity(
        string calldata _ddocId,
        string calldata _proofHash
    ) external {
        require(!workers[msg.sender].identityVerified, "Pramaan: Identity already verified");
        require(!usedProofHashes[_proofHash], "Pramaan: Proof already used");
        require(bytes(_ddocId).length > 0, "Pramaan: Invalid ddocId");
        require(bytes(_proofHash).length > 0, "Pramaan: Invalid proof hash");

        workers[msg.sender].identityVerified = true;
        workers[msg.sender].identityDdocId = _ddocId;
        workers[msg.sender].identityProofHash = _proofHash;
        workers[msg.sender].exists = true;
        usedProofHashes[_proofHash] = true;

        emit IdentityVerified(msg.sender, _ddocId, _proofHash, block.timestamp);
    }

    /**
     * @dev Step 2: Worker submits Reclaim income proof (Swiggy / Uber / SBI)
     * Proof is stored encrypted on Fileverse. Only ddocId goes on-chain.
     */
    function submitIncome(
        string calldata _ddocId,
        string calldata _platform,
        string calldata _proofHash
    ) external {
        require(workers[msg.sender].identityVerified, "Pramaan: Verify identity first");
        require(!usedProofHashes[_proofHash], "Pramaan: Proof already used");
        require(bytes(_ddocId).length > 0, "Pramaan: Invalid ddocId");
        require(bytes(_platform).length > 0, "Pramaan: Invalid platform");

        workers[msg.sender].incomeVerified = true;
        workers[msg.sender].incomeDdocId = _ddocId;
        workers[msg.sender].platform = _platform;
        workers[msg.sender].incomeProofHash = _proofHash;
        usedProofHashes[_proofHash] = true;

        emit IncomeVerified(msg.sender, _platform, _ddocId, _proofHash, block.timestamp);
    }

    /**
     * @dev ZK Step 1: verifies identity proof and stores nullifier + commitment.
     * publicSignals schema:
     * [0] wallet (uint160 packed in uint256)
     * [1] isAdult (must be 1)
     * [2] isIndian (must be 1)
     * [3] nullifier
     * [4] identityCommitment
     */
    function submitIdentityZK(
        bytes calldata proof,
        uint256[] calldata publicSignals,
        string calldata _ddocId
    ) external {
        require(address(identityVerifier) != address(0), "Pramaan: Identity verifier not set");
        require(!workers[msg.sender].identityVerified, "Pramaan: Identity already verified");
        require(publicSignals.length == 5, "Pramaan: Invalid identity public signals");
        require(bytes(_ddocId).length > 0, "Pramaan: Invalid ddocId");
        require(_validateWalletSignal(publicSignals[0]), "Pramaan: Wallet mismatch");
        require(publicSignals[1] == 1, "Pramaan: Age check failed");
        require(publicSignals[2] == 1, "Pramaan: Country check failed");
        require(identityVerifier.verifyProof(proof, publicSignals), "Pramaan: Invalid identity ZK proof");

        bytes32 nullifier = bytes32(publicSignals[3]);
        bytes32 commitment = bytes32(publicSignals[4]);
        require(!usedNullifiers[nullifier], "Pramaan: Nullifier already used");

        workers[msg.sender].identityVerified = true;
        workers[msg.sender].identityDdocId = _ddocId;
        workers[msg.sender].identityProofHash = "zk:identity";
        workers[msg.sender].identityNullifier = nullifier;
        workers[msg.sender].identityCommitment = commitment;
        workers[msg.sender].exists = true;
        usedNullifiers[nullifier] = true;

        emit IdentityVerifiedZK(msg.sender, nullifier, commitment, block.timestamp);
    }

    /**
     * @dev ZK Step 2: verifies income proof and stores nullifier + commitment.
     * publicSignals schema:
     * [0] wallet (uint160 packed in uint256)
     * [1] incomeFloorMet (must be 1)
     * [2] platformCode (1=SBI, 2=Uber)
     * [3] nullifier
     * [4] incomeCommitment
     */
    function submitIncomeZK(
        bytes calldata proof,
        uint256[] calldata publicSignals,
        string calldata _ddocId,
        string calldata _platform
    ) external {
        require(address(incomeVerifier) != address(0), "Pramaan: Income verifier not set");
        require(workers[msg.sender].identityVerified, "Pramaan: Verify identity first");
        require(publicSignals.length == 5, "Pramaan: Invalid income public signals");
        require(bytes(_ddocId).length > 0, "Pramaan: Invalid ddocId");
        require(bytes(_platform).length > 0, "Pramaan: Invalid platform");
        require(_validateWalletSignal(publicSignals[0]), "Pramaan: Wallet mismatch");
        require(publicSignals[1] == 1, "Pramaan: Income threshold failed");
        require(incomeVerifier.verifyProof(proof, publicSignals), "Pramaan: Invalid income ZK proof");

        bytes32 nullifier = bytes32(publicSignals[3]);
        bytes32 commitment = bytes32(publicSignals[4]);
        require(!usedNullifiers[nullifier], "Pramaan: Nullifier already used");

        workers[msg.sender].incomeVerified = true;
        workers[msg.sender].incomeDdocId = _ddocId;
        workers[msg.sender].platform = _platform;
        workers[msg.sender].incomeProofHash = "zk:income";
        workers[msg.sender].incomeNullifier = nullifier;
        workers[msg.sender].incomeCommitment = commitment;
        usedNullifiers[nullifier] = true;

        emit IncomeVerifiedZK(msg.sender, publicSignals[2], nullifier, commitment, block.timestamp);
    }

    /**
     * @dev Step 3: AI Agent writes GigScore after analyzing Fileverse proof
     */
    function setGigScore(address _worker, uint8 _score) external onlyAgent {
        require(workers[_worker].exists, "Pramaan: Worker not found");
        require(workers[_worker].incomeVerified, "Pramaan: Income not verified");
        require(_score <= 100, "Pramaan: Score must be 0-100");

        workers[_worker].gigScore = _score;
        workers[_worker].lastUpdated = block.timestamp;

        emit ScoreUpdated(_worker, _score, block.timestamp);
    }

    /**
     * @dev Step 4: Lender pays USDC fee to verify worker GigScore
     */
    function verifyWorker(address _workerAddress) external {
        WorkerProfile memory profile = workers[_workerAddress];
        require(profile.exists, "Pramaan: Worker not found");
        require(profile.identityVerified && profile.incomeVerified, "Pramaan: Profile incomplete");
        require(profile.gigScore > 0, "Pramaan: Score not yet assigned");
        require(
            block.timestamp - profile.lastUpdated < 90 days,
            "Pramaan: Score expired"
        );

        require(
            usdc.transferFrom(msg.sender, treasury, verificationFee),
            "Pramaan: Fee transfer failed"
        );

        verificationLogs.push(VerificationLog({
            lender: msg.sender,
            worker: _workerAddress,
            timestamp: block.timestamp,
            feePaid: verificationFee
        }));

        emit WorkerVerified(msg.sender, _workerAddress, verificationFee, block.timestamp);
    }

    // --- View Functions ---

    function isVerified(address _worker) external view returns (bool) {
        return workers[_worker].identityVerified && workers[_worker].incomeVerified;
    }

    function getGigScore(address _worker) external view returns (uint8) {
        return workers[_worker].gigScore;
    }

    function getWorkerProfile(address _worker) external view returns (WorkerProfile memory) {
        return workers[_worker];
    }

    function getVerificationCount() external view returns (uint256) {
        return verificationLogs.length;
    }
}