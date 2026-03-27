with open('/home/devangandhi/pramaan/pramaan-contract/src/Pramaan.sol', 'r') as f:
    code = f.read()

import re
old_struct = r'struct WorkerProfile \{[^}]*\}'
new_struct = """struct WorkerProfile {
    address wallet;
    string identityHash;
    bool identityVerified;
    string incomeHash;
    bool incomeVerified;
    uint256 gigScore;
    uint256 lastUpdated;
    address verificationProvider;
    uint256 expiresAt;
    bool isDefaulted;
    uint256 revision;
}"""

code = re.sub(old_struct, new_struct, code, count=1)
with open('/home/devangandhi/pramaan/pramaan-contract/src/Pramaan.sol', 'w') as f:
    f.write(code)

