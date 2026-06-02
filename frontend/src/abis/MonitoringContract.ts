export const MONITORING_ABI = [
  "function registerProtocol(string protocol, address holder)",
  "function registerFlight(string flightCode, address holder)",
  "function triggerProtocolCheck(string protocol, string apiUrl, string apiSelector, uint256 depositPerHolder) payable",
  "function triggerFlightCheck(string flightCode, string apiUrl, string apiSelector, uint256 depositPerHolder) payable",
  "function getProtocolHolderCount(string protocol) view returns (uint256)",
  "function getProtocolHolders(string protocol) view returns (address[])",
  "function lastTriggered(string) view returns (uint256)",
  "event ProtocolRegistered(string indexed protocol, address indexed holder)",
  "event FlightRegistered(string indexed flightCode, address indexed holder)",
  "event ProtocolCheckTriggered(string indexed protocol, uint256 holderCount, address triggeredBy)",
  "event FlightCheckTriggered(string indexed flightCode, uint256 holderCount, address triggeredBy)",
] as const;
