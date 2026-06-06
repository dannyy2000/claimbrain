// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAgentRequester.sol";
import "./interfaces/IPolicyBrain.sol";
import "./interfaces/IInsurancePool.sol";
import "./ClaimRegistry.sol";

contract ClaimBrain {
    uint256 public constant JSON_API_AGENT_ID      = 13174292974160097713;
    uint256 public constant LLM_INFERENCE_AGENT_ID = 12847293847561029384;

    address public owner;
    IAgentRequester public platform;
    IPolicyBrain    public policyBrain;
    IInsurancePool  public insurancePool;
    ClaimRegistry   public claimRegistry;

    struct ClaimContext {
        uint256 policyId;
        address claimant;
        string  protocolOrFlight;
        string  rawApiData;
        uint8   stage;      // 1 = awaiting API, 2 = awaiting LLM
    }

    mapping(uint256 => ClaimContext) public pendingClaims;

    event ClaimInitiated(uint256 indexed policyId, address indexed claimant, uint256 requestId);
    event ApiDataReceived(uint256 indexed requestId, string data);
    event DecisionReceived(uint256 indexed requestId, string decision);
    event PayoutTriggered(uint256 indexed policyId, address indexed claimant, uint256 amount);
    event ClaimRejected(uint256 indexed policyId, address indexed claimant);
    event FraudFlagged(uint256 indexed policyId, address indexed claimant);

    modifier onlyOwner() { require(msg.sender == owner, "ClaimBrain: not owner"); _; }
    modifier onlyPlatform() { require(msg.sender == address(platform), "ClaimBrain: only platform"); _; }

    constructor(address _platform, address _policyBrain, address _insurancePool, address _claimRegistry) {
        owner         = msg.sender;
        platform      = IAgentRequester(_platform);
        policyBrain   = IPolicyBrain(_policyBrain);
        insurancePool = IInsurancePool(_insurancePool);
        claimRegistry = ClaimRegistry(_claimRegistry);
    }

    receive() external payable {}

    // -------------------------------------------------------------------------
    // onchainTools — ALL return string so the platform can relay them to LLM.
    // Signatures use types only (no param names) for correct ABI selector.
    // -------------------------------------------------------------------------

    function getActiveRules(uint256 policyId) external view returns (string memory) {
        Rule[] memory rules = policyBrain.getRules(policyId);
        bytes memory out;
        for (uint256 i = 0; i < rules.length; i++) {
            out = abi.encodePacked(
                out,
                "Rule #", _uintToString(rules[i].ruleId),
                " [", rules[i].ruleType, " priority=", _uintToString(rules[i].priority), "]: ",
                rules[i].condition, "\n"
            );
        }
        return string(out);
    }

    // Returns a plain string so the LLM sees readable text, not ABI bytes.
    function getFraudHistory(address claimant) external view returns (string memory) {
        (uint256 claimsThisYear, bool hasFraudFlag) = policyBrain.getFraudHistory(claimant);
        return string(abi.encodePacked(
            "claimsThisYear=", _uintToString(claimsThisYear),
            " hasFraudFlag=", hasFraudFlag ? "true" : "false"
        ));
    }

    function getCustomerTier(address claimant) external view returns (string memory) {
        return policyBrain.getCustomerTier(claimant);
    }

    // -------------------------------------------------------------------------
    // Step 1 — Initiate claim: fire JSON API Request agent
    // -------------------------------------------------------------------------

    function initiateClaim(
        uint256 policyId,
        address claimant,
        string calldata protocolOrFlight,
        string calldata apiUrl,
        string calldata apiSelector
    ) external payable {
        uint256 floor = platform.getRequestDeposit();
        // floor*4 JSON API + floor*12 first LLM + floor*12 reserve for tool-loop second LLM
        require(msg.value >= floor * 28, "ClaimBrain: send at least floor*28");

        bytes memory payload = abi.encodeWithSignature(
            "fetchString(string,string)",
            apiUrl,
            apiSelector
        );

        uint256 requestId = platform.createRequest{value: floor * 4}(
            JSON_API_AGENT_ID,
            address(this),
            this.handleApiData.selector,
            payload
        );

        pendingClaims[requestId] = ClaimContext({
            policyId:         policyId,
            claimant:         claimant,
            protocolOrFlight: protocolOrFlight,
            rawApiData:       "",
            stage:            1
        });

        emit ClaimInitiated(policyId, claimant, requestId);
    }

    // -------------------------------------------------------------------------
    // Step 2 — API callback: pre-fetch onchain data, fire LLM with onchainTools
    // -------------------------------------------------------------------------

    function handleApiData(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatform {
        require(pendingClaims[requestId].stage == 1, "ClaimBrain: unexpected callback");

        ClaimContext memory ctx = pendingClaims[requestId];
        string memory apiData = (status == ResponseStatus.Success && responses.length > 0)
            ? abi.decode(responses[0].result, (string))
            : "UNAVAILABLE";

        emit ApiDataReceived(requestId, apiData);

        // Pre-fetch claimant data directly — backup if onchain tool calls fail
        (uint256 claimsThisYear, bool hasFraudFlag) = policyBrain.getFraudHistory(ctx.claimant);
        string memory tier = policyBrain.getCustomerTier(ctx.claimant);
        uint256 purchasedAt = insurancePool.getPurchasedAt(ctx.policyId, ctx.claimant);
        uint256 holdingDays = purchasedAt > 0 ? (block.timestamp - purchasedAt) / 86400 : 9999;

        // Register onchain tools with type-only signatures (correct ABI selectors)
        OnchainTool[] memory tools = new OnchainTool[](3);
        tools[0] = OnchainTool({
            signature:   "getActiveRules(uint256)",
            description: "Returns all active insurance rules as a string. Args: policyId (uint256)."
        });
        tools[1] = OnchainTool({
            signature:   "getFraudHistory(address)",
            description: "Returns claimsThisYear and hasFraudFlag as a string. Args: claimant (address)."
        });
        tools[2] = OnchainTool({
            signature:   "getCustomerTier(address)",
            description: "Returns STANDARD or VIP tier. Args: claimant (address)."
        });

        string[] memory roles    = new string[](2);
        string[] memory messages = new string[](2);

        roles[0]    = "system";
        messages[0] = "You are an autonomous DeFi insurance claims settlement agent on the Somnia blockchain. "
                      "Use your onchain tools to get rules and claimant data, then apply rules in priority order. "
                      "Output exactly one of: APPROVE, REJECT, FLAG_FRAUD";

        roles[1]    = "user";
        messages[1] = string(abi.encodePacked(
            "CLAIM:\n",
            "Event: ", ctx.protocolOrFlight, "\n",
            "Oracle data: ", apiData, "\n\n",
            "PRE-FETCHED CLAIMANT DATA:\n",
            "claimant=", _addressToString(ctx.claimant), " policyId=", _uintToString(ctx.policyId), "\n",
            "claims_this_year=", _uintToString(claimsThisYear),
            " fraud_flag=", hasFraudFlag ? "true" : "false", "\n",
            "tier=", tier, " holding_days=", _uintToString(holdingDays), "\n\n",
            "Call getActiveRules(", _uintToString(ctx.policyId), ") to get the current active rules. ",
            "Apply them in priority order and output APPROVE, REJECT, or FLAG_FRAUD."
        ));

        bytes memory llmPayload = abi.encodeWithSignature(
            "inferToolsChat(string[],string[],string[],(string,string)[],uint256,bool)",
            roles, messages, new string[](0), tools, uint256(5), true
        );

        // Send half the remaining balance — keep half as reserve for the tool-loop second call
        uint256 llmDeposit = address(this).balance / 2;
        if (llmDeposit == 0) llmDeposit = address(this).balance;

        uint256 llmRequestId = platform.createRequest{value: llmDeposit}(
            LLM_INFERENCE_AGENT_ID,
            address(this),
            this.handleDecision.selector,
            llmPayload
        );

        pendingClaims[llmRequestId] = ctx;
        pendingClaims[llmRequestId].rawApiData = apiData;
        pendingClaims[llmRequestId].stage      = 2;
        delete pendingClaims[requestId];
    }

    // -------------------------------------------------------------------------
    // Step 3 — LLM callback.
    // If finishReason=="tool_calls": execute pending calls via staticcall,
    // feed results back, resubmit to LLM for final answer.
    // If finishReason=="stop": decode decision and execute payout.
    // -------------------------------------------------------------------------

    function handleDecision(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatform {
        require(pendingClaims[requestId].stage == 2, "ClaimBrain: unexpected callback");

        ClaimContext memory ctx = pendingClaims[requestId];
        delete pendingClaims[requestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            claimRegistry.logDecision(ctx.policyId, ctx.claimant, "REJECT", "Agent call failed", 0, requestId);
            emit ClaimRejected(ctx.policyId, ctx.claimant);
            return;
        }

        (
            string memory finishReason,
            string memory finalResponse,
            ,
            string[] memory updatedMessages,
            string[] memory pendingToolCallIds,
            bytes[] memory pendingToolCalls
        ) = abi.decode(
            responses[0].result,
            (string, string, string[], string[], string[], bytes[])
        );

        // Tool calls pending — execute them and resubmit as a fresh conversation.
        // We do NOT use the "tool" role (Somnia may not support it).
        // Instead we build a new user message embedding the tool results as text.
        if (
            keccak256(bytes(finishReason)) == keccak256(bytes("tool_calls")) &&
            pendingToolCalls.length > 0 &&
            address(this).balance > 0
        ) {
            // Execute each pending tool call via staticcall
            bytes memory toolContext;
            for (uint256 i = 0; i < pendingToolCalls.length; i++) {
                string memory toolResult;
                if (pendingToolCalls[i].length >= 4) {
                    (bool ok, bytes memory ret) = address(this).staticcall(pendingToolCalls[i]);
                    toolResult = (ok && ret.length > 0)
                        ? abi.decode(ret, (string))
                        : "unavailable";
                } else {
                    toolResult = "unavailable";
                }
                toolContext = abi.encodePacked(
                    toolContext, pendingToolCallIds[i], " result: ", toolResult, "\n"
                );
            }

            // Build a fresh conversation — avoids "tool" role compatibility issues
            string[] memory freshRoles    = new string[](2);
            string[] memory freshMessages = new string[](2);
            freshRoles[0]    = "system";
            freshMessages[0] = "You are a DeFi insurance claims settlement agent. "
                               "Based on the onchain data provided, output exactly APPROVE, REJECT, or FLAG_FRAUD.";
            freshRoles[1]    = "user";
            freshMessages[1] = string(abi.encodePacked(
                "Onchain data retrieved from Policy Brain:\n",
                string(toolContext),
                "\nClaim: event=", ctx.protocolOrFlight,
                " oracle_data=", ctx.rawApiData, "\n",
                "Apply the rules (from getActiveRules result above) in priority order and output your decision."
            ));

            // Second LLM call — no tools, forces a single-turn final answer
            bytes memory llmPayload = abi.encodeWithSignature(
                "inferToolsChat(string[],string[],string[],(string,string)[],uint256,bool)",
                freshRoles, freshMessages, new string[](0), new OnchainTool[](0), uint256(1), true
            );

            uint256 newReqId = platform.createRequest{value: address(this).balance}(
                LLM_INFERENCE_AGENT_ID,
                address(this),
                this.handleDecision.selector,
                llmPayload
            );

            pendingClaims[newReqId]       = ctx;
            pendingClaims[newReqId].stage = 2;
            return;
        }

        // Use the last assistant message — it contains the full LLM response including
        // chain-of-thought. finalResponse sometimes carries a partial/preprocessed value
        // that doesn't match the actual output (Somnia platform behaviour).
        string memory decision = updatedMessages.length > 0
            ? updatedMessages[updatedMessages.length - 1]
            : finalResponse;
        string memory reasoning = decision;

        emit DecisionReceived(requestId, decision);

        // Extract first word — LLM outputs decision first, then chain-of-thought.
        // Searching the full string causes false positives ("FLAG_FRAUD would result if...").
        bytes32 d = _firstWordHash(decision);
        if (d == keccak256(bytes("APPROVE"))) {
            uint256 payout = insurancePool.getCoverageAmount(ctx.policyId, ctx.claimant);
            insurancePool.executePayout(ctx.policyId, ctx.claimant, payout);
            policyBrain.recordClaim(ctx.policyId, ctx.claimant, "APPROVE");
            claimRegistry.logDecision(ctx.policyId, ctx.claimant, "APPROVE", reasoning, payout, requestId);
            emit PayoutTriggered(ctx.policyId, ctx.claimant, payout);

        } else if (d == keccak256(bytes("FLAG_FRAUD"))) {
            insurancePool.flagForReview(ctx.policyId, ctx.claimant);
            policyBrain.recordClaim(ctx.policyId, ctx.claimant, "FLAG_FRAUD");
            claimRegistry.logDecision(ctx.policyId, ctx.claimant, "FLAG_FRAUD", reasoning, 0, requestId);
            emit FraudFlagged(ctx.policyId, ctx.claimant);

        } else {
            policyBrain.recordClaim(ctx.policyId, ctx.claimant, "REJECT");
            claimRegistry.logDecision(ctx.policyId, ctx.claimant, "REJECT", reasoning, 0, requestId);
            emit ClaimRejected(ctx.policyId, ctx.claimant);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    // Extracts the first word (stops at space, newline, CR, period, comma)
    // and returns its keccak256. The LLM outputs the decision keyword first,
    // then chain-of-thought — so checking only the first word avoids false
    // positives like "FLAG_FRAUD would result if..." appearing in reasoning.
    function _firstWordHash(string memory s) internal pure returns (bytes32) {
        bytes memory sb = bytes(s);
        uint256 end = 0;
        while (end < sb.length) {
            bytes1 c = sb[end];
            if (c == 0x20 || c == 0x0a || c == 0x0d || c == 0x2e || c == 0x2c) break;
            end++;
        }
        if (end == 0) return keccak256(bytes(""));
        bytes memory word = new bytes(end);
        for (uint256 i = 0; i < end; i++) word[i] = sb[i];
        return keccak256(word);
    }

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory data     = abi.encodePacked(addr);
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str      = new bytes(42);
        str[0] = "0"; str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2]     = hexChars[uint8(data[i] >> 4)];
            str[3 + i * 2]     = hexChars[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value; uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
