with open('pramaan-contract/src/Pramaan.sol', 'r') as f:
    text = f.read()

# Replace setGigScore
old_func = """    function setGigScore(address _worker, uint8 _score) external onlyAgent {
        WorkerProfile storage w = workers[_worker];
        require(w.exists && w.incomeVerified, "Income not verified");
        require(_score <= 100, "Score 0-100");

        w.gigScore = _score;
        _bumpRevision(_worker);

        emit ScoreUpdated(_worker, _score, w.revision, block.timestamp);
    }"""

new_func = """    function updateGigScore(address _worker, uint8 _score, string memory _dataHash) external onlyAgent {
        WorkerProfile storage w = workers[_worker];
        require(w.exists && w.incomeVerified, "Income not verified");
        require(_score <= 100, "Score 0-100");

        w.gigScore = _score;
        w.expiresAt = block.timestamp + 30 days;
        w.isDefaulted = false;
        // Optionally store _dataHash, e.g. w.dataHash = _dataHash
        _bumpRevision(_worker);

        emit ScoreUpdated(_worker, _score, w.revision, block.timestamp);
    }"""

if old_func in text:
    text = text.replace(old_func, new_func)

    with open('pramaan-contract/src/Pramaan.sol', 'w') as f:
        f.write(text)
    print("Contract patched.")
else:
    print("Function not found.")

