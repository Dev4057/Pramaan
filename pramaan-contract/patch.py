with open('src/Pramaan.sol', 'r') as f:
    text = f.read()

# 1. Add fields to struct
old_struct = """    struct WorkerProfile {
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
    }"""

new_struct = """    struct WorkerProfile {
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
    }"""
text = text.replace(old_struct, new_struct)

# 2. Add whitelistedLenders mapping, ScoreSlashed event, isScoreValid, onlyWhitelistedLender, addLender, reportDefault
# we can inject them right after `mapping(address => VerificationLog[]) public verificationLogs;`

injection_point = "    mapping(address => VerificationLog[]) public verificationLogs;"
injection_code = """    mapping(address => VerificationLog[]) public verificationLogs;

    // --- NEW DEFI/INSTITUTION SECURITY OVERHAUL ---
    mapping(address => bool) public whitelistedLenders;

    modifier isScoreValid(address worker) {
        require(workers[worker].gigScore > 0, "No score minted");
        require(block.timestamp <= workers[worker].expiresAt, "Score has expired. Re-verify data.");
        require(!workers[worker].isDefaulted, "Account in default");
        _;
    }

    modifier onlyWhitelistedLender() {
        require(whitelistedLenders[msg.sender], "Not an authorized lending protocol");
        _;
    }

    event ScoreSlashed(address indexed worker, address indexed lender, uint256 timestamp);

    function addLender(address lender) external onlyAdmin {
        whitelistedLenders[lender] = true;
    }

    function reportDefault(address worker) external onlyWhitelistedLender {
        require(workers[worker].gigScore > 0, "Worker does not exist");
        
        workers[worker].gigScore = 30; 
        workers[worker].isDefaulted = true;
        
        emit ScoreSlashed(worker, msg.sender, block.timestamp);
    }
"""
text = text.replace(injection_point, injection_code)

# 3. update updateGigScore
update_gig_score_old = """        profile.gigScore = score;
        profile.lastUpdated = block.timestamp;

        emit ScoreAssigned(wallet, score, platform, block.timestamp);"""

update_gig_score_new = """        profile.gigScore = score;
        profile.lastUpdated = block.timestamp;
        profile.expiresAt = block.timestamp + 30 days;
        profile.isDefaulted = false;

        emit ScoreAssigned(wallet, score, platform, block.timestamp);"""
text = text.replace(update_gig_score_old, update_gig_score_new)

with open('src/Pramaan.sol', 'w') as f:
    f.write(text)

