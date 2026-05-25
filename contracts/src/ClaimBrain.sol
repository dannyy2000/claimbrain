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
        uint8   stage;          // 1 = awaiting API, 2 = awaiting LLM
    }

    // requestId => ClaimContext — preserves state across async callbacks
    mapping(uint256 => ClaimContext) public pendingClaims;

    event ClaimInitiated(uint256 indexed policyId, address indexed claimant, uint256 requestId);
    event ApiDataReceived(uint256 indexed requestId, string data);
    event DecisionReceived(uint256 indexed requestId, string decision);
    event PayoutTriggered(uint256 indexed policyId, address indexed claimant, uint256 amount);
    event ClaimRejected(uint256 indexed policyId, address indexed claimant);
    event FraudFlagged(uint256 indexed policyId, address indexed claimant);

    modifier onlyOwner() {
        require(msg.sender == owner, "ClaimBrain: not owner");
        _;
    }

    modifier onlyPlatform() {
        require(msg.sender == address(platform), "ClaimBrain: only platform");
        _;
    }

    constructor(
        address _platform,
        address _policyBrain,
        address _insurancePool,
        address _claimRegistry
    ) {
        owner         = msg.sender;
        platform      = IAgentRequester(_platform);
        policyBrain   = IPolicyBrain(_policyBrain);
        insurancePool = IInsurancePool(_insurancePool);
        claimRegistry = ClaimRegistry(_claimRegistry);
    }

    receive() external payable {}

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
        require(msg.value > 0, "ClaimBrain: deposit required for agent");

        bytes memory payload = abi.encodeWithSignature(
            "fetchString(string,string)",
            apiUrl,
            apiSelector
        );

        uint256 requestId = platform.createRequest{value: msg.value / 2}(
            JSON_API_AGENT_ID,
            address(this),
            this.handleApiData.selector,
            payload
        );

        pendingClaims[requestId] = ClaimContext({
            policyId:          policyId,
            claimant:          claimant,
            protocolOrFlight:  protocolOrFlight,
            rawApiData:        "",
            stage:             1
        });

        emit ClaimInitiated(policyId, claimant, requestId);
    }

    // -------------------------------------------------------------------------
    // Step 2 — Agent 1 callback: receive API data, fire LLM Inference agent
    // -------------------------------------------------------------------------

    function handleApiData(
        uint256          requestId,
        Response[] memory responses,
        ResponseStatus   status,
        Request  memory
    ) external onlyPlatform {
        require(pendingClaims[requestId].stage == 1, "ClaimBrain: unexpected callback");

        ClaimContext memory ctx = pendingClaims[requestId];
        string memory apiData   = (status == ResponseStatus.SUCCESS)
            ? abi.decode(responses[0].result, (string))
            : "UNAVAILABLE";

        emit ApiDataReceived(requestId, apiData);

        // Build onchain tools — register Policy Brain functions for the LLM
        OnchainTool[] memory tools = new OnchainTool[](3);
        tools[0] = OnchainTool({
            signature:   "getRules(uint256 policyId)",
            description: "Fetch all active insurance rules for this policy. Returns conditions and payout amounts ordered by priority."
        });
        tools[1] = OnchainTool({
            signature:   "getFraudHistory(address claimant)",
            description: "Get claim history for this wallet. Returns claimsThisYear count and hasFraudFlag boolean."
        });
        tools[2] = OnchainTool({
            signature:   "getCustomerTier(address claimant)",
            description: "Get customer tier for this wallet. Returns STANDARD or VIP. VIP receives a 1.5x payout multiplier."
        });

        // Build conversation for the LLM
        string[] memory roles    = new string[](2);
        string[] memory messages = new string[](2);

        roles[0]    = "system";
        messages[0] = "You are an autonomous insurance claims settlement agent running on the Somnia blockchain. "
                      "You have access to onchain tools to query policy rules, fraud history, and customer tier. "
                      "Use them. Reason step by step using chain-of-thought. "
                      "Your final answer MUST be exactly one of: APPROVE, REJECT, FLAG_FRAUD — nothing else.";

        roles[1]    = "user";
        messages[1] = string(abi.encodePacked(
            "Claim details — ",
            "Protocol or flight: ", ctx.protocolOrFlight, ". ",
            "Live data from oracle: ", apiData, ". ",
            "Claimant address: ", _addressToString(ctx.claimant), ". ",
            "Policy ID: ", _uintToString(ctx.policyId), ". ",
            "Use your tools to fetch the rules, check fraud history, and get customer tier. ",
            "Then decide: APPROVE, REJECT, or FLAG_FRAUD."
        ));

        string[] memory allowedValues = new string[](3);
        allowedValues[0] = "APPROVE";
        allowedValues[1] = "REJECT";
        allowedValues[2] = "FLAG_FRAUD";

        bytes memory llmPayload = abi.encodeWithSignature(
            "inferToolsChat(string[],string[],string[],tuple(string,string)[],uint256,bool,string[])",
            roles,
            messages,
            new string[](0),    // no MCP servers
            tools,
            uint256(5),         // max 5 tool-call iterations
            true,               // chainOfThought ON
            allowedValues
        );

        uint256 llmRequestId = platform.createRequest{value: address(this).balance}(
            LLM_INFERENCE_AGENT_ID,
            address(this),
            this.handleDecision.selector,
            llmPayload
        );

        // Transfer context to the new requestId
        pendingClaims[llmRequestId] = ctx;
        pendingClaims[llmRequestId].rawApiData = apiData;
        pendingClaims[llmRequestId].stage      = 2;
        delete pendingClaims[requestId];
    }

    // -------------------------------------------------------------------------
    // Step 3 — Agent 2 callback: decode decision, execute payout
    // -------------------------------------------------------------------------

    function handleDecision(
        uint256          requestId,
        Response[] memory responses,
        ResponseStatus   status,
        Request  memory
    ) external onlyPlatform {
        require(pendingClaims[requestId].stage == 2, "ClaimBrain: unexpected callback");

        ClaimContext memory ctx = pendingClaims[requestId];
        delete pendingClaims[requestId];

        if (status != ResponseStatus.SUCCESS || responses.length == 0) {
            // Agent failed — reject claim and log
            claimRegistry.logDecision(ctx.policyId, ctx.claimant, "REJECT", "Agent call failed", 0, requestId);
            emit ClaimRejected(ctx.policyId, ctx.claimant);
            return;
        }

        string memory decision  = abi.decode(responses[0].result, (string));
        string memory reasoning = responses.length > 1 ? abi.decode(responses[1].result, (string)) : "";

        emit DecisionReceived(requestId, decision);

        bytes32 d = keccak256(bytes(decision));

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
            // REJECT
            policyBrain.recordClaim(ctx.policyId, ctx.claimant, "REJECT");
            claimRegistry.logDecision(ctx.policyId, ctx.claimant, "REJECT", reasoning, 0, requestId);
            emit ClaimRejected(ctx.policyId, ctx.claimant);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory data = abi.encodePacked(addr);
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2]     = hexChars[uint8(data[i] >> 4)];
            str[3 + i * 2]     = hexChars[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
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
