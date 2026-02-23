// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title InspectionRegistry
 * @dev Secondary contract: maintains a global registry of all inspection records
 * across multiple shipment contracts. Supports pagination and filtering.
 */

import "@openzeppelin/contracts/access/AccessControl.sol";

contract InspectionRegistry is AccessControl {

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct RegistryEntry {
        uint256 entryId;
        address contractAddress;  // Which SupplyChainIntegrity contract
        uint256 shipmentId;
        uint256 inspectionId;
        bytes32 imageHash;
        string ipfsCID;
        uint256 timestamp;
    }

    uint256 private _entryCounter;
    mapping(uint256 => RegistryEntry) public entries;
    uint256[] public entryIds;

    event EntryRegistered(uint256 indexed entryId, address indexed contractAddress, uint256 shipmentId, uint256 timestamp);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
    }

    function register(
        address contractAddress,
        uint256 shipmentId,
        uint256 inspectionId,
        bytes32 imageHash,
        string calldata ipfsCID
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        _entryCounter++;
        entries[_entryCounter] = RegistryEntry({
            entryId: _entryCounter,
            contractAddress: contractAddress,
            shipmentId: shipmentId,
            inspectionId: inspectionId,
            imageHash: imageHash,
            ipfsCID: ipfsCID,
            timestamp: block.timestamp
        });
        entryIds.push(_entryCounter);
        emit EntryRegistered(_entryCounter, contractAddress, shipmentId, block.timestamp);
        return _entryCounter;
    }

    function getEntry(uint256 entryId) external view returns (RegistryEntry memory) {
        return entries[entryId];
    }

    function getTotal() external view returns (uint256) {
        return _entryCounter;
    }

    function getPage(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256 end = offset + limit;
        if (end > entryIds.length) end = entryIds.length;
        uint256[] memory page = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = entryIds[i];
        }
        return page;
    }
}
