// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum ResponseStatus { SUCCESS, ERROR, TIMEOUT }

struct Response {
    bytes result;
}

struct Request {
    uint256 agentId;
    address callbackContract;
    bytes4  callbackSelector;
    bytes   payload;
}

struct OnchainTool {
    string signature;
    string description;
}

interface IAgentRequester {
    function createRequest(
        uint256        agentId,
        address        callbackContract,
        bytes4         callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
}
