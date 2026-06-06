// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Exact definitions from Somnia docs
// https://docs.somnia.network/agents/invoking-agents/from-solidity

enum ResponseStatus {
    None,       // 0
    Pending,    // 1
    Success,    // 2
    Failed,     // 3
    TimedOut    // 4
}

enum ConsensusType { Majority, Threshold }

struct Response {
    address         validator;
    bytes           result;
    ResponseStatus  status;
    uint256         receipt;
    uint256         timestamp;
    uint256         executionCost;
}

struct Request {
    uint256         id;
    address         requester;
    address         callbackAddress;
    bytes4          callbackSelector;
    address[]       subcommittee;
    Response[]      responses;
    uint256         responseCount;
    uint256         failureCount;
    uint256         threshold;
    uint256         createdAt;
    uint256         deadline;
    ResponseStatus  status;
    ConsensusType   consensusType;
    uint256         remainingBudget;
    uint256         perAgentBudget;
}

struct OnchainTool {
    string signature;
    string description;
}

interface IAgentRequester {
    function createRequest(
        uint256        agentId,
        address        callbackAddress,
        bytes4         callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
}
