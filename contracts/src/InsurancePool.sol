// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IInsurancePool.sol";

contract InsurancePool is IInsurancePool {
    address public owner;

    struct PolicyPool {
        uint256 balance;
        uint256 premium;       // in wei, monthly cost
        uint256 totalPolicies;
    }

    struct PolicyHolder {
        uint256 coverageAmount;
        uint256 purchasedAt;
        bool    active;
    }

    // policyId => pool state
    mapping(uint256 => PolicyPool) private _pools;

    // policyId => holder => PolicyHolder
    mapping(uint256 => mapping(address => PolicyHolder)) private _holders;

    // only ClaimBrain can trigger payouts / flags
    mapping(address => bool) public authorised;

    event PoolFunded(uint256 indexed policyId, address indexed funder, uint256 amount);
    event PolicyPurchased(uint256 indexed policyId, address indexed holder, uint256 coverageAmount, uint256 premium);
    event PayoutExecuted(uint256 indexed policyId, address indexed claimant, uint256 amount);
    event FlaggedForReview(uint256 indexed policyId, address indexed claimant);
    event PremiumSet(uint256 indexed policyId, uint256 premium);
    event AuthorisedSet(address indexed caller, bool status);

    modifier onlyOwner() {
        require(msg.sender == owner, "InsurancePool: not owner");
        _;
    }

    modifier onlyAuthorised() {
        require(authorised[msg.sender] || msg.sender == owner, "InsurancePool: not authorised");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorised[msg.sender] = true;
    }

    function setAuthorised(address caller, bool status) external onlyOwner {
        authorised[caller] = status;
        emit AuthorisedSet(caller, status);
    }

    // --- Liquidity ---

    function fundPool(uint256 policyId) external payable {
        require(msg.value > 0, "InsurancePool: zero deposit");
        _pools[policyId].balance += msg.value;
        emit PoolFunded(policyId, msg.sender, msg.value);
    }

    // --- Policy purchase ---

    function buyPolicy(
        uint256 policyId,
        uint256 coverageAmount
    ) external payable returns (uint256 policyTokenId) {
        PolicyPool storage pool = _pools[policyId];
        require(pool.premium > 0, "InsurancePool: premium not set");
        require(msg.value >= pool.premium, "InsurancePool: insufficient premium");
        require(pool.balance >= coverageAmount, "InsurancePool: pool underfunded for this coverage");
        require(!_holders[policyId][msg.sender].active, "InsurancePool: policy already active");

        pool.balance += msg.value;
        pool.totalPolicies++;

        _holders[policyId][msg.sender] = PolicyHolder({
            coverageAmount: coverageAmount,
            purchasedAt:    block.timestamp,
            active:         true
        });

        policyTokenId = pool.totalPolicies;
        emit PolicyPurchased(policyId, msg.sender, coverageAmount, msg.value);
    }

    // --- Claim execution (called only by ClaimBrain) ---

    function executePayout(uint256 policyId, address claimant, uint256 amount) external onlyAuthorised {
        PolicyPool storage pool = _pools[policyId];
        require(pool.balance >= amount, "InsurancePool: insufficient pool balance");
        require(_holders[policyId][claimant].active, "InsurancePool: no active policy");

        pool.balance -= amount;
        _holders[policyId][claimant].active = false;

        (bool sent, ) = payable(claimant).call{value: amount}("");
        require(sent, "InsurancePool: payout transfer failed");

        emit PayoutExecuted(policyId, claimant, amount);
    }

    function flagForReview(uint256 policyId, address claimant) external onlyAuthorised {
        emit FlaggedForReview(policyId, claimant);
    }

    // --- Configuration ---

    function setPremium(uint256 policyId, uint256 monthlyPremium) external onlyOwner {
        _pools[policyId].premium = monthlyPremium;
        emit PremiumSet(policyId, monthlyPremium);
    }

    // --- Views ---

    function getPoolBalance(uint256 policyId) external view returns (uint256) {
        return _pools[policyId].balance;
    }

    function getCoverageAmount(uint256 policyId, address holder) external view returns (uint256) {
        return _holders[policyId][holder].coverageAmount;
    }

    function getPremium(uint256 policyId) external view returns (uint256) {
        return _pools[policyId].premium;
    }

    function isActive(uint256 policyId, address holder) external view returns (bool) {
        return _holders[policyId][holder].active;
    }

    function getPurchasedAt(uint256 policyId, address holder) external view returns (uint256) {
        return _holders[policyId][holder].purchasedAt;
    }
}
