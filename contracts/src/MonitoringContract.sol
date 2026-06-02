// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IClaimBrainTrigger {
    function initiateClaim(
        uint256 policyId,
        address claimant,
        string  calldata protocolOrFlight,
        string  calldata apiUrl,
        string  calldata apiSelector
    ) external payable;
}

contract MonitoringContract {
    uint256 public constant DEFI_HACK_POLICY_ID    = 1;
    uint256 public constant FLIGHT_DELAY_POLICY_ID = 2;

    address public owner;
    IClaimBrainTrigger public claimBrain;

    // protocol name (lowercase) => registered holders
    mapping(string => address[]) private _protocolHolders;
    // flight code (uppercase) => registered holders
    mapping(string => address[])  private _flightHolders;

    // prevent double-registration
    mapping(string => mapping(address => bool)) private _protocolRegistered;
    mapping(string => mapping(address => bool)) private _flightRegistered;

    // prevent triggering the same protocol twice within a cooldown window
    mapping(string => uint256) public lastTriggered;
    uint256 public constant TRIGGER_COOLDOWN = 1 hours;

    event ProtocolRegistered(string indexed protocol, address indexed holder);
    event FlightRegistered(string indexed flightCode, address indexed holder);
    event ProtocolCheckTriggered(string indexed protocol, uint256 holderCount, address triggeredBy);
    event FlightCheckTriggered(string indexed flightCode, uint256 holderCount, address triggeredBy);

    modifier onlyOwner() {
        require(msg.sender == owner, "MonitoringContract: not owner");
        _;
    }

    constructor(address _claimBrain) {
        owner      = msg.sender;
        claimBrain = IClaimBrainTrigger(_claimBrain);
    }

    function setClaimBrain(address _claimBrain) external onlyOwner {
        claimBrain = IClaimBrainTrigger(_claimBrain);
    }

    // -------------------------------------------------------------------------
    // Registration — called when a user buys a policy
    // -------------------------------------------------------------------------

    function registerProtocol(string calldata protocol, address holder) external {
        string memory key = _toLower(protocol);
        if (_protocolRegistered[key][holder]) return;
        _protocolRegistered[key][holder] = true;
        _protocolHolders[key].push(holder);
        emit ProtocolRegistered(key, holder);
    }

    function registerFlight(string calldata flightCode, address holder) external {
        string memory key = _toUpper(flightCode);
        if (_flightRegistered[key][holder]) return;
        _flightRegistered[key][holder] = true;
        _flightHolders[key].push(holder);
        emit FlightRegistered(key, holder);
    }

    // -------------------------------------------------------------------------
    // Triggers — called by the keeper bot (or anyone)
    // -------------------------------------------------------------------------

    function triggerProtocolCheck(
        string calldata protocol,
        string calldata apiUrl,
        string calldata apiSelector,
        uint256         depositPerHolder
    ) external payable {
        string memory key     = _toLower(protocol);
        address[] storage holders = _protocolHolders[key];
        require(holders.length > 0, "MonitoringContract: no holders for this protocol");
        require(
            block.timestamp >= lastTriggered[key] + TRIGGER_COOLDOWN,
            "MonitoringContract: trigger cooldown active"
        );
        require(
            msg.value >= depositPerHolder * holders.length,
            "MonitoringContract: insufficient deposit"
        );

        lastTriggered[key] = block.timestamp;

        for (uint256 i = 0; i < holders.length; i++) {
            claimBrain.initiateClaim{value: depositPerHolder}(
                DEFI_HACK_POLICY_ID,
                holders[i],
                protocol,
                apiUrl,
                apiSelector
            );
        }

        emit ProtocolCheckTriggered(key, holders.length, msg.sender);
    }

    function triggerFlightCheck(
        string calldata flightCode,
        string calldata apiUrl,
        string calldata apiSelector,
        uint256         depositPerHolder
    ) external payable {
        string memory key     = _toUpper(flightCode);
        address[] storage holders = _flightHolders[key];
        require(holders.length > 0, "MonitoringContract: no holders for this flight");
        require(
            msg.value >= depositPerHolder * holders.length,
            "MonitoringContract: insufficient deposit"
        );

        for (uint256 i = 0; i < holders.length; i++) {
            claimBrain.initiateClaim{value: depositPerHolder}(
                FLIGHT_DELAY_POLICY_ID,
                holders[i],
                flightCode,
                apiUrl,
                apiSelector
            );
        }

        emit FlightCheckTriggered(key, holders.length, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getProtocolHolders(string calldata protocol) external view returns (address[] memory) {
        return _protocolHolders[_toLower(protocol)];
    }

    function getFlightHolders(string calldata flightCode) external view returns (address[] memory) {
        return _flightHolders[_toUpper(flightCode)];
    }

    function getProtocolHolderCount(string calldata protocol) external view returns (uint256) {
        return _protocolHolders[_toLower(protocol)].length;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _toLower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] >= 0x41 && b[i] <= 0x5A) b[i] = bytes1(uint8(b[i]) + 32);
        }
        return string(b);
    }

    function _toUpper(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] >= 0x61 && b[i] <= 0x7A) b[i] = bytes1(uint8(b[i]) - 32);
        }
        return string(b);
    }

    receive() external payable {}
}
