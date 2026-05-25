// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPolicyBrain.sol";

contract ClaimRegistry {
    address public owner;

    uint256 private _claimCounter;

    mapping(uint256 => ClaimRecord) private _claims;

    // policyId => claimIds
    mapping(uint256 => uint256[]) private _claimsByPolicy;
    // claimant => claimIds
    mapping(address => uint256[]) private _claimsByClaimant;

    mapping(address => bool) public authorised;

    event DecisionLogged(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        string  decision,
        uint256 payoutAmount,
        uint256 requestId
    );
    event AuthorisedSet(address indexed caller, bool status);

    modifier onlyOwner() {
        require(msg.sender == owner, "ClaimRegistry: not owner");
        _;
    }

    modifier onlyAuthorised() {
        require(authorised[msg.sender] || msg.sender == owner, "ClaimRegistry: not authorised");
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

    function logDecision(
        uint256 policyId,
        address claimant,
        string  calldata decision,
        string  calldata reasoning,
        uint256 payoutAmount,
        uint256 requestId
    ) external onlyAuthorised returns (uint256 claimId) {
        _claimCounter++;
        claimId = _claimCounter;

        _claims[claimId] = ClaimRecord({
            claimId:       claimId,
            policyId:      policyId,
            claimant:      claimant,
            decision:      decision,
            reasoning:     reasoning,
            payoutAmount:  payoutAmount,
            requestId:     requestId,
            timestamp:     block.timestamp
        });

        _claimsByPolicy[policyId].push(claimId);
        _claimsByClaimant[claimant].push(claimId);

        emit DecisionLogged(claimId, policyId, claimant, decision, payoutAmount, requestId);
    }

    // --- Views ---

    function getClaim(uint256 claimId) external view returns (ClaimRecord memory) {
        require(_claims[claimId].claimId != 0, "ClaimRegistry: not found");
        return _claims[claimId];
    }

    function getClaimsByPolicy(uint256 policyId) external view returns (ClaimRecord[] memory) {
        uint256[] storage ids = _claimsByPolicy[policyId];
        ClaimRecord[] memory records = new ClaimRecord[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            records[i] = _claims[ids[i]];
        }
        return records;
    }

    function getClaimsByClaimant(address claimant) external view returns (ClaimRecord[] memory) {
        uint256[] storage ids = _claimsByClaimant[claimant];
        ClaimRecord[] memory records = new ClaimRecord[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            records[i] = _claims[ids[i]];
        }
        return records;
    }

    function totalClaims() external view returns (uint256) {
        return _claimCounter;
    }
}
