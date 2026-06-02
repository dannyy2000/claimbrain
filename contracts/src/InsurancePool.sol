// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IInsurancePool.sol";

contract InsurancePool is IInsurancePool {
    address public owner;

    struct PolicyPool {
        uint256 balance;        // current pool balance in wei
        uint256 premium;        // monthly premium in wei
        uint256 totalPolicies;
        uint256 totalShares;    // total LP shares issued for this pool
    }

    struct PolicyHolder {
        uint256 coverageAmount;
        uint256 purchasedAt;
        bool    active;
    }

    struct LPPosition {
        uint256 shares;         // LP's share of this pool
        uint256 depositedAt;
    }

    mapping(uint256 => PolicyPool)                              private _pools;
    mapping(uint256 => mapping(address => PolicyHolder))        private _holders;
    mapping(uint256 => mapping(address => LPPosition))          private _lpPositions;

    mapping(address => bool) public authorised;

    event PoolFunded(uint256 indexed policyId, address indexed lp, uint256 amount, uint256 sharesIssued);
    event LPWithdrew(uint256 indexed policyId, address indexed lp, uint256 amount, uint256 sharesBurned);
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

    // -------------------------------------------------------------------------
    // LP — deposit capital, receive shares
    // -------------------------------------------------------------------------

    function fundPool(uint256 policyId) external payable {
        require(msg.value > 0, "InsurancePool: zero deposit");

        PolicyPool storage pool = _pools[policyId];

        // Shares calculation: first depositor gets shares 1:1 with wei
        // Subsequent depositors get shares proportional to their contribution
        uint256 shares;
        if (pool.totalShares == 0 || pool.balance == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * pool.totalShares) / pool.balance;
        }

        pool.balance      += msg.value;
        pool.totalShares  += shares;

        _lpPositions[policyId][msg.sender].shares      += shares;
        _lpPositions[policyId][msg.sender].depositedAt  = block.timestamp;

        emit PoolFunded(policyId, msg.sender, msg.value, shares);
    }

    // -------------------------------------------------------------------------
    // LP — withdraw proportional share (principal + accumulated premiums - claims)
    // -------------------------------------------------------------------------

    function withdrawLP(uint256 policyId, uint256 sharesToBurn) external {
        LPPosition storage pos  = _lpPositions[policyId][msg.sender];
        PolicyPool  storage pool = _pools[policyId];

        require(pos.shares >= sharesToBurn, "InsurancePool: insufficient shares");
        require(pool.totalShares > 0,       "InsurancePool: empty pool");

        // Amount owed = (sharesToBurn / totalShares) * currentBalance
        uint256 amount = (sharesToBurn * pool.balance) / pool.totalShares;
        require(amount > 0,              "InsurancePool: zero withdrawal");
        require(pool.balance >= amount,  "InsurancePool: insufficient liquidity");

        pos.shares        -= sharesToBurn;
        pool.totalShares  -= sharesToBurn;
        pool.balance      -= amount;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "InsurancePool: withdrawal transfer failed");

        emit LPWithdrew(policyId, msg.sender, amount, sharesToBurn);
    }

    // Convenience: withdraw all shares at once
    function withdrawAllLP(uint256 policyId) external {
        uint256 shares = _lpPositions[policyId][msg.sender].shares;
        require(shares > 0, "InsurancePool: no LP position");

        PolicyPool storage pool = _pools[policyId];
        uint256 amount = (shares * pool.balance) / pool.totalShares;
        require(pool.balance >= amount, "InsurancePool: insufficient liquidity");

        _lpPositions[policyId][msg.sender].shares  = 0;
        pool.totalShares  -= shares;
        pool.balance      -= amount;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "InsurancePool: withdrawal transfer failed");

        emit LPWithdrew(policyId, msg.sender, amount, shares);
    }

    // -------------------------------------------------------------------------
    // Policy purchase — premium goes into pool (LPs earn it proportionally)
    // -------------------------------------------------------------------------

    function buyPolicy(
        uint256 policyId,
        uint256 coverageAmount
    ) external payable returns (uint256 policyTokenId) {
        PolicyPool storage pool = _pools[policyId];
        require(pool.premium > 0,               "InsurancePool: premium not set");
        require(msg.value >= pool.premium,       "InsurancePool: insufficient premium");
        require(pool.balance >= coverageAmount,  "InsurancePool: pool underfunded");
        require(!_holders[policyId][msg.sender].active, "InsurancePool: policy already active");

        // Premium joins the pool — LPs earn it when they withdraw
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

    // -------------------------------------------------------------------------
    // Claim execution — called only by ClaimBrain
    // -------------------------------------------------------------------------

    function executePayout(uint256 policyId, address claimant, uint256 amount) external onlyAuthorised {
        PolicyPool storage pool = _pools[policyId];
        require(pool.balance >= amount,               "InsurancePool: insufficient pool balance");
        require(_holders[policyId][claimant].active,  "InsurancePool: no active policy");

        pool.balance -= amount;
        _holders[policyId][claimant].active = false;

        (bool sent, ) = payable(claimant).call{value: amount}("");
        require(sent, "InsurancePool: payout transfer failed");

        emit PayoutExecuted(policyId, claimant, amount);
    }

    function flagForReview(uint256 policyId, address claimant) external onlyAuthorised {
        emit FlaggedForReview(policyId, claimant);
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    function setPremium(uint256 policyId, uint256 monthlyPremium) external onlyOwner {
        _pools[policyId].premium = monthlyPremium;
        emit PremiumSet(policyId, monthlyPremium);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

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

    function getLPShares(uint256 policyId, address lp) external view returns (uint256 shares, uint256 totalShares, uint256 estimatedValue) {
        shares      = _lpPositions[policyId][lp].shares;
        totalShares = _pools[policyId].totalShares;
        estimatedValue = totalShares > 0
            ? (shares * _pools[policyId].balance) / totalShares
            : 0;
    }
}
