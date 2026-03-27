// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface IProofVerifier {
    function verifyProof(bytes calldata proof, uint256[] calldata publicSignals) external view returns (bool);
}

contract Pramaan {
    struct WorkerProfile {
        bool identityVerified;
        bool incomeVerified;
        uint8 gigScore;
        uint256 lastUpdated;
        uint256 revision;          // increments on every successful identity/income update
        string identityDdocId;
        string incomeDdocId;
        string platform;
        string identityProofHash;
        string incomeProofHash;
        bytes32 identityNullifier;
        bytes32 incomeNullifier;
        bytes32 identityCommitment;
        bytes32 incomeCommitment;
        bool exists;
        uint256 expiresAt;
        bool isDefaulted;
    }

    struct VerificationLog {
        address lender;
        address worker;
        uint256 timestamp;
        uint256 feePaid;
        uint256 revision;
    }

    address public immutable AI_AGENT;
    address public admin;
    address public treasury;
    IERC20 public usdc;
    uint256 public verificationFee;
    IProofVerifier public identityVerifier;
    IProofVerifier public incomeVerifier;
    uint256 public cooldown = 1 days; // minimum time between re-verifications per wallet

    mapping(address => WorkerProfile) public workers;
    mapping(string => bool) public usedProofHashes;  // still prevent proof replay across wallets
    mapping(bytes32 => bool) public usedNullifiers;  // for ZK replay protection
    VerificationLog[] public verificationLogs;

    event IdentityVerified(address indexed worker, string ddocId, string proofHash, uint256 revision, uint256 timestamp);
    event IncomeVerified(address indexed worker, string platform, string ddocId, string proofHash, uint256 revision, uint256 timestamp);
    event ScoreUpdated(address indexed worker, uint8 newScore, uint256 revision, uint256 timestamp);
    event WorkerVerified(address indexed lender, address indexed worker, uint256 feePaid, uint256 revision, uint256 timestamp);
    event ZKVerifiersUpdated(address indexed identityVerifier, address indexed incomeVerifier);
    event CooldownUpdated(uint256 newCooldown);
    event TreasuryUpdated(address treasury);
    event VerificationFeeUpdated(uint256 fee);
    event AdminTransferred(address newAdmin);
    event AgentUpdated(address newAgent); // optional future use if you add mutable AI agent

    modifier onlyAgent() {
        require(msg.sender == AI_AGENT, "Only AI Agent");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor(address _aiAgent, address _treasury, address _usdcAddress, uint256 _verificationFee) {
        AI_AGENT = _aiAgent;
        admin = msg.sender;
        treasury = _treasury;
        usdc = IERC20(_usdcAddress);
        verificationFee = _verificationFee;
    }

    // --- Admin controls ---
    function setZKVerifiers(address _identityVerifier, address _incomeVerifier) external onlyAdmin {
        require(_identityVerifier != address(0) && _incomeVerifier != address(0), "Invalid verifier");
        identityVerifier = IProofVerifier(_identityVerifier);
        incomeVerifier = IProofVerifier(_incomeVerifier);
        emit ZKVerifiersUpdated(_identityVerifier, _incomeVerifier);
    }

    function setCooldown(uint256 _cooldown) external onlyAdmin {
        cooldown = _cooldown;
        emit CooldownUpdated(_cooldown);
    }

    function setTreasury(address _treasury) external onlyAdmin {
        require(_treasury != address(0), "zero treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setVerificationFee(uint256 _fee) external onlyAdmin {
        verificationFee = _fee;
        emit VerificationFeeUpdated(_fee);
    }

    // --- Internal helpers ---
    function _validateWalletSignal(uint256 walletSignal) internal view returns (bool) {
        return address(uint160(walletSignal)) == msg.sender;
    }

    function _enforceCooldown(address wallet) internal view {
        WorkerProfile memory profile = workers[wallet];
        if (profile.lastUpdated > 0) {
            require(block.timestamp >= profile.lastUpdated + cooldown, "Cooldown active");
        }
    }

    function _bumpRevision(address wallet) internal {
        workers[wallet].revision += 1;
        workers[wallet].lastUpdated = block.timestamp;
        workers[wallet].exists = true;
    }

    // --- Core: Identity (non-ZK) ---
    function submitIdentity(string calldata _ddocId, string calldata _proofHash) external {
        require(bytes(_ddocId).length > 0 && bytes(_proofHash).length > 0, "Invalid inputs");
        require(!usedProofHashes[_proofHash], "Proof already used");
        _enforceCooldown(msg.sender);

        WorkerProfile storage w = workers[msg.sender];
        usedProofHashes[_proofHash] = true;

        w.identityVerified = true;
        w.identityDdocId = _ddocId;
        w.identityProofHash = _proofHash;
        _bumpRevision(msg.sender);

        emit IdentityVerified(msg.sender, _ddocId, _proofHash, w.revision, block.timestamp);
    }

    // --- Core: Income (non-ZK) ---
    function submitIncome(string calldata _ddocId, string calldata _platform, string calldata _proofHash) external {
        require(bytes(_ddocId).length > 0 && bytes(_platform).length > 0, "Invalid inputs");
        require(workers[msg.sender].identityVerified, "Verify identity first");
        require(!usedProofHashes[_proofHash], "Proof already used");
        _enforceCooldown(msg.sender);

        WorkerProfile storage w = workers[msg.sender];
        usedProofHashes[_proofHash] = true;

        w.incomeVerified = true;
        w.incomeDdocId = _ddocId;
        w.platform = _platform;
        w.incomeProofHash = _proofHash;
        _bumpRevision(msg.sender);

        emit IncomeVerified(msg.sender, _platform, _ddocId, _proofHash, w.revision, block.timestamp);
    }

    // --- Core: Identity ZK ---
    function submitIdentityZK(bytes calldata proof, uint256[] calldata publicSignals, string calldata _ddocId) external {
        require(address(identityVerifier) != address(0), "Identity verifier not set");
        require(publicSignals.length == 5, "Invalid public signals");
        require(bytes(_ddocId).length > 0, "Invalid ddocId");
        require(_validateWalletSignal(publicSignals[0]), "Wallet mismatch");
        require(publicSignals[1] == 1 && publicSignals[2] == 1, "Checks failed");
        require(identityVerifier.verifyProof(proof, publicSignals), "Invalid ZK proof");

        bytes32 nullifier = bytes32(publicSignals[3]);
        bytes32 commitment = bytes32(publicSignals[4]);
        require(!usedNullifiers[nullifier], "Nullifier used");
        _enforceCooldown(msg.sender);

        WorkerProfile storage w = workers[msg.sender];
        usedNullifiers[nullifier] = true;

        w.identityVerified = true;
        w.identityDdocId = _ddocId;
        w.identityProofHash = "zk:identity";
        w.identityNullifier = nullifier;
        w.identityCommitment = commitment;
        _bumpRevision(msg.sender);

        emit IdentityVerified(msg.sender, _ddocId, "zk:identity", w.revision, block.timestamp);
    }

    // --- Core: Income ZK ---
    function submitIncomeZK(bytes calldata proof, uint256[] calldata publicSignals, string calldata _ddocId, string calldata _platform) external {
        require(address(incomeVerifier) != address(0), "Income verifier not set");
        require(publicSignals.length == 5, "Invalid public signals");
        require(bytes(_ddocId).length > 0 && bytes(_platform).length > 0, "Invalid inputs");
        require(_validateWalletSignal(publicSignals[0]), "Wallet mismatch");
        require(publicSignals[1] == 1, "Income threshold failed");
        require(incomeVerifier.verifyProof(proof, publicSignals), "Invalid ZK proof");

        bytes32 nullifier = bytes32(publicSignals[3]);
        bytes32 commitment = bytes32(publicSignals[4]);
        require(!usedNullifiers[nullifier], "Nullifier used");
        _enforceCooldown(msg.sender);

        WorkerProfile storage w = workers[msg.sender];
        usedNullifiers[nullifier] = true;

        w.incomeVerified = true;
        w.incomeDdocId = _ddocId;
        w.platform = _platform;
        w.incomeProofHash = "zk:income";
        w.incomeNullifier = nullifier;
        w.incomeCommitment = commitment;
        _bumpRevision(msg.sender);

        emit IncomeVerified(msg.sender, _platform, _ddocId, "zk:income", w.revision, block.timestamp);
    }

    // --- GigScore ---
    function updateGigScore(address _worker, uint8 _score, string memory _dataHash) external onlyAgent {
        WorkerProfile storage w = workers[_worker];
        require(w.exists && w.incomeVerified, "Income not verified");
        require(_score <= 100, "Score 0-100");

        w.gigScore = _score;
        w.expiresAt = block.timestamp + 30 days;
        w.isDefaulted = false;
        // Optionally store _dataHash, e.g. w.dataHash = _dataHash
        _bumpRevision(_worker);

        emit ScoreUpdated(_worker, _score, w.revision, block.timestamp);
    }

    // --- Lender verify ---
    function verifyWorker(address _workerAddress) external {
        WorkerProfile memory profile = workers[_workerAddress];
        require(profile.exists, "Worker not found");
        require(profile.identityVerified && profile.incomeVerified, "Profile incomplete");
        require(profile.gigScore > 0, "Score not set");
        require(block.timestamp - profile.lastUpdated < 90 days, "Score expired");

        require(usdc.transferFrom(msg.sender, treasury, verificationFee), "Fee transfer failed");

        verificationLogs.push(
            VerificationLog({
                lender: msg.sender,
                worker: _workerAddress,
                timestamp: block.timestamp,
                feePaid: verificationFee,
                revision: profile.revision
            })
        );

        emit WorkerVerified(msg.sender, _workerAddress, verificationFee, profile.revision, block.timestamp);
    }

    // --- Views ---
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