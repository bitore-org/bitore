// Sources flattened with hardhat v2.22.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}


// File contracts/BitOre.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.24;
interface IBitOreProtocol {
    function mintEpoch(address to, uint256 epoch, bytes32 nonce, uint256 epochMinersLimit) external;

    function mintChip(address to, uint256 epoch, bytes32 nonce, uint256 position, uint256 epochBlock, uint256 epochMinersLimit) external;
}

contract BitOrePow is ReentrancyGuard {
    event EpochStarted(uint256 indexed epochNumber, bytes32 challengeNumber, uint256 allowedMiners, uint256 difficulty);

    event DifficultyAdjusted(uint256 newMiningTarget, uint256 epochNumber);
    event AllowedMinersAdjusted(uint256 newAllowedMiners, uint256 epochNumber);
    event EpochLengthAdjusted(uint256 newEpochLengthInBlocks, uint256 epochNumber);

    struct Epoch {
        uint256 minerCount;
        uint256 startBlockNumber;
        bool reachedAdjustDifficulty;
    }

    struct EpochInfo {
        uint256 epochCount;
        uint256 minerCount;
        uint256 startBlockNumber;
        uint256 endBlockNumber;
        uint256 miningTarget;
        uint256 allowedMiners;
        bool reachedAdjustDifficulty;
        bytes32 challengeNumber;
    }

    uint256 public MIN_DIFFICULTY = 2 ** 250;
    uint256 public MAX_DIFFICULTY = 2 ** 128;
    uint256 public ADJUSTMENT_INTERVAL = 100; // Adjust every 1000 epochs
    uint256 public BASE_DIFFICULT_MULTIPLIER = 10_000;
    uint256 public MAX_DIFFICULT_MULTIPLIER = 20_000;

    uint256 public epochCount = 1;

    uint256 public epochLengthOptimal = 60 seconds;
    uint256 public _epochLengthInBlocks = 30; // 30 // Blast has 2 second block time at the moment
    uint256 public minimumEpochLength = 5; // Minimum 5 blocks
    uint256 public miningTarget = MIN_DIFFICULTY;

    uint256 public adjustmentBlockTime = 1;
    uint256 public adjustmentBlockHeight = 1;

    uint256 public GAUSSIAN_THRESHOLD_PERCENT = 68_200; //68_200; //68,2%

    uint256 public _allowedMiners = 100;
    uint256 public minAllowedMiners = 10;

    uint256 public allTimeGasUsed = 1; // To avoid division by zero

    bytes32 public challengeNumber;

    Epoch public currentEpoch;

    mapping(address => uint256) public minersLastEpoch;
    mapping(address => uint256) public gasUsedByMiner;

    constructor(
        uint256 adjustmentInterval, // 1000
        uint256 epochLengthInBlocks, // 30
        uint256 allowedMiners // 100
    ) {
        ADJUSTMENT_INTERVAL = adjustmentInterval;
        _epochLengthInBlocks = epochLengthInBlocks;
        _allowedMiners = allowedMiners;

        challengeNumber = blockhash(block.number - 1); // Initial challenge number
        adjustmentBlockTime = block.timestamp;
        adjustmentBlockHeight = block.number;

        currentEpoch = Epoch(0, block.number, false);
    }

    function isEpochEnded() public view returns (bool) {
        // Start new epoch
        if (currentEpoch.startBlockNumber + _epochLengthInBlocks < block.number) {
            return true;
        }
        return false;
    }

    function canMine(address minerAddress) public view returns (bool) {
        // Start new epoch
        if (isEpochEnded()) {
            return true;
        }

        if (minersLastEpoch[minerAddress] < epochCount || minersLastEpoch[minerAddress] == 0) {
            return true;
        }

        return false;
    }

    function mine(bytes32 nonce, address[] calldata mintAddresses) public nonReentrant {
        uint256 gasStart = gasleft();

        // Check if miner has already mined in the current epoch
        require(canMine(msg.sender), "Miner has already mined in the current epoch");

        minersLastEpoch[msg.sender] = epochCount;

        require(checkMiningSolution(nonce, challengeNumber, miningTarget), "Invalid mining diggest");

        if (isEpochEnded()) {
            startNewEpoch();

            for (uint256 i = 0; i < mintAddresses.length; i++) {
                IBitOreProtocol(mintAddresses[i]).mintEpoch(msg.sender, epochCount, nonce, _allowedMiners);
            }
        }

        // Track the mined block
        currentEpoch.minerCount++;

        require(currentEpoch.minerCount <= _allowedMiners, "Miner count exceeds allowed miners");

        // Check if 80% utilization is reached less than 50% into the epoch
        if (
            !currentEpoch.reachedAdjustDifficulty &&
            currentEpoch.minerCount >= (_allowedMiners * GAUSSIAN_THRESHOLD_PERCENT) / 100_000 &&
            block.number - currentEpoch.startBlockNumber < (epochLengthOptimal * 5_00) / 10_00
        ) {
            currentEpoch.reachedAdjustDifficulty = true;
        }

        uint256 gasUsed = gasStart - gasleft();

        gasUsedByMiner[msg.sender] += gasUsed;
        allTimeGasUsed += gasUsed;

        // Process Token minting
        for (uint256 i = 0; i < mintAddresses.length; i++) {
            IBitOreProtocol(mintAddresses[i]).mintChip(
                msg.sender,
                epochCount,
                nonce,
                currentEpoch.minerCount,
                block.number - currentEpoch.startBlockNumber,
                _allowedMiners
            );
        }
    }

    function startNewEpoch() private {
        require(isEpochEnded(), "Current epoch has not completed");

        epochCount++;

        minersLastEpoch[msg.sender] = epochCount;

        // Calculate the previous epoch hash as the starting challenge for the new epoch
        bytes32 newDifficultyHash = keccak256(abi.encodePacked(challengeNumber, blockhash(block.number - 1), miningTarget));

        challengeNumber = newDifficultyHash;

        // Adjust difficulty +10% (target decrease increase difficulty)
        if (currentEpoch.reachedAdjustDifficulty) {
            miningTarget = miningTarget - (miningTarget * 10) / 100;
            emit DifficultyAdjusted(miningTarget, epochCount);
        }

        // Adjust minerCount +10%
        if (currentEpoch.minerCount == _allowedMiners) {
            _allowedMiners = _allowedMiners + (_allowedMiners * 1_000) / 10_000;
            emit AllowedMinersAdjusted(_allowedMiners, epochCount);
        }

        if (currentEpoch.minerCount < (_allowedMiners * 4_00) / 1000) {
            _allowedMiners = _allowedMiners - ((_allowedMiners * 1_000) / 10_000);
            emit AllowedMinersAdjusted(_allowedMiners, epochCount);

            if (miningTarget < MIN_DIFFICULTY) {
                miningTarget = miningTarget + ((miningTarget * 10) / 100);
                emit DifficultyAdjusted(miningTarget, epochCount);
            }
        }

        // Safety checks
        if (_allowedMiners < minAllowedMiners) {
            _allowedMiners = minAllowedMiners;
        }

        // Very easy
        if (miningTarget > MIN_DIFFICULTY) {
            miningTarget = MIN_DIFFICULTY;
        }
        // Very hard
        if (miningTarget < MAX_DIFFICULTY) {
            miningTarget = MAX_DIFFICULTY;
        }

        if (epochCount % ADJUSTMENT_INTERVAL == 0) {
            uint256 passedBlocks = block.number - adjustmentBlockHeight;

            uint256 avgBlockTime = (block.timestamp - adjustmentBlockTime) / passedBlocks;

            if (avgBlockTime * _epochLengthInBlocks < (epochLengthOptimal * 9_00) / 10_00) {
                _epochLengthInBlocks = epochLengthOptimal / avgBlockTime;
            }

            if (avgBlockTime * _epochLengthInBlocks > (epochLengthOptimal * 11_00) / 10_00) {
                _epochLengthInBlocks = epochLengthOptimal / avgBlockTime;
            }

            if (_epochLengthInBlocks < minimumEpochLength) {
                _epochLengthInBlocks = minimumEpochLength;
            }

            emit EpochLengthAdjusted(_epochLengthInBlocks, epochCount);

            adjustmentBlockTime = block.timestamp;
            adjustmentBlockHeight = block.number;
        }

        currentEpoch = Epoch(0, block.number, false);

        // Emit epoch start event
        emit EpochStarted(epochCount, challengeNumber, _allowedMiners, miningTarget);
    }

    function getEpochInfo() public view returns (EpochInfo memory) {
        return
            EpochInfo(
                epochCount,
                currentEpoch.minerCount,
                currentEpoch.startBlockNumber,
                currentEpoch.startBlockNumber + _epochLengthInBlocks,
                miningTarget,
                _allowedMiners,
                currentEpoch.reachedAdjustDifficulty,
                challengeNumber
            );
    }

    function getDifficultyMultiplier(address miner) public view returns (uint256) {
        uint256 gasUsed = gasUsedByMiner[miner];

        if (gasUsed <= 0) {
            return BASE_DIFFICULT_MULTIPLIER; // Default multiplier
        }

        uint256 multiplier = BASE_DIFFICULT_MULTIPLIER;

        multiplier = BASE_DIFFICULT_MULTIPLIER + ((BASE_DIFFICULT_MULTIPLIER * gasUsed * _allowedMiners * 2) / allTimeGasUsed);

        if (multiplier > MAX_DIFFICULT_MULTIPLIER) {
            return MAX_DIFFICULT_MULTIPLIER;
        }

        return multiplier;
    }

    function checkMiningSolution(bytes32 nonce, bytes32 challenge_number, uint256 difficulty) public view returns (bool) {
        bytes32 digest = keccak256(abi.encodePacked(challenge_number, msg.sender, nonce));

        uint256 multiplier = getDifficultyMultiplier(msg.sender);

        require(uint256(digest) < (difficulty / BASE_DIFFICULT_MULTIPLIER) * multiplier, "Invalid mining nonce");

        return true;
    }
}
