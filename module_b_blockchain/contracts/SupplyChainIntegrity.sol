// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SupplyChainIntegrity
 * @dev Core smart contract for immutable X-ray inspection hash logging.
 *
 * Architecture:
 *   - Shipments are registered by authorized Originators
 *   - Each inspection event stores: pHash, SHA256, IPFS CID, SSIM score, verdict
 *   - Destination verifies by comparing new inspection hash to stored hash
 *   - Events emitted for all state changes (indexable by frontend)
 *   - Role-based access control (ORIGINATOR, INSPECTOR, VERIFIER, ADMIN)
 *
 * Storage Strategy:
 *   - Only hashes + CIDs stored on-chain (cost-efficient)
 *   - Full inspection data stored on IPFS
 *   - On-chain record references IPFS CID
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract SupplyChainIntegrity is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORIGINATOR_ROLE = keccak256("ORIGINATOR_ROLE");
    bytes32 public constant INSPECTOR_ROLE = keccak256("INSPECTOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // ─── Enums ────────────────────────────────────────────────────────────────
    enum ShipmentStatus {
        REGISTERED,         // 0: Shipment registered, not yet inspected
        ORIGIN_INSPECTED,   // 1: Origin inspection complete, hash stored
        IN_TRANSIT,         // 2: Shipment in transit
        DESTINATION_VERIFIED, // 3: Destination inspection passed
        TAMPERED,           // 4: Tampering detected at destination
        DISPUTED            // 5: Dispute raised by any party
    }

    enum InspectionType {
        ORIGIN,
        IN_TRANSIT,
        DESTINATION
    }

    enum IntegrityVerdict {
        CLEAN,
        SUSPICIOUS,
        TAMPERED
    }

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct InspectionRecord {
        uint256 recordId;
        uint256 shipmentId;
        InspectionType inspectionType;
        bytes32 imageHash;          // SHA-256 of raw X-ray image (bytes32)
        string pHash;               // Perceptual hash hex string
        string ipfsCID;             // IPFS content identifier for full data
        uint32 ssimScoreX10000;     // SSIM * 10000 (e.g., 9750 = 0.9750) - no floats in Solidity
        uint32 hammingDistance;     // pHash Hamming distance (0 if origin)
        IntegrityVerdict verdict;
        address inspector;
        uint256 timestamp;
        string notes;
    }

    struct Shipment {
        uint256 shipmentId;
        string shipmentCode;        // Human-readable code (e.g., "SHP-2025-001")
        address originator;
        address currentHolder;      // Logistics party currently holding it
        ShipmentStatus status;
        uint256 registeredAt;
        uint256 lastUpdatedAt;
        uint256[] inspectionIds;    // All inspection record IDs
        string originFingerprintCID; // IPFS CID of origin fingerprint
        bytes32 originImageHash;    // SHA-256 of origin X-ray image
        string originPHash;         // Origin perceptual hash
        bool exists;
    }

    struct TamperingAlert {
        uint256 alertId;
        uint256 shipmentId;
        uint256 inspectionId;
        uint32 hammingDistance;
        uint32 ssimScoreX10000;
        string ipfsDiffCID;         // IPFS CID of visual diff report
        address detectedBy;
        uint256 timestamp;
    }

    // ─── State Variables ──────────────────────────────────────────────────────
    Counters.Counter private _shipmentCounter;
    Counters.Counter private _inspectionCounter;
    Counters.Counter private _alertCounter;

    mapping(uint256 => Shipment) public shipments;
    mapping(string => uint256) public shipmentCodeToId;   // code => ID
    mapping(uint256 => InspectionRecord) public inspectionRecords;
    mapping(uint256 => TamperingAlert) public tamperingAlerts;
    mapping(uint256 => uint256[]) public shipmentAlerts;  // shipmentId => alertIds

    uint256 public totalShipments;
    uint256 public totalInspections;
    uint256 public totalTamperingAlerts;

    // Configuration
    uint32 public pHashThreshold = 10;       // Hamming distance threshold
    uint32 public ssimThresholdX10000 = 8500; // 0.85 * 10000

    // ─── Events ───────────────────────────────────────────────────────────────
    event ShipmentRegistered(uint256 indexed shipmentId, string shipmentCode, address indexed originator, uint256 timestamp);
    event OriginInspectionStored(uint256 indexed shipmentId, uint256 indexed recordId, bytes32 imageHash, string ipfsCID, uint256 timestamp);
    event DestinationVerified(uint256 indexed shipmentId, uint256 indexed recordId, IntegrityVerdict verdict, uint256 timestamp);
    event TamperingDetected(uint256 indexed shipmentId, uint256 indexed alertId, uint32 hammingDistance, uint32 ssimScore, uint256 timestamp);
    event ShipmentStatusUpdated(uint256 indexed shipmentId, ShipmentStatus newStatus, address updatedBy, uint256 timestamp);
    event InspectionAdded(uint256 indexed shipmentId, uint256 indexed recordId, InspectionType inspectionType, uint256 timestamp);
    event ThresholdUpdated(string parameter, uint32 oldValue, uint32 newValue);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORIGINATOR_ROLE, msg.sender);
        _grantRole(INSPECTOR_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────
    function setPHashThreshold(uint32 _threshold) external onlyRole(ADMIN_ROLE) {
        emit ThresholdUpdated("pHashThreshold", pHashThreshold, _threshold);
        pHashThreshold = _threshold;
    }

    function setSSIMThreshold(uint32 _thresholdX10000) external onlyRole(ADMIN_ROLE) {
        emit ThresholdUpdated("ssimThreshold", ssimThresholdX10000, _thresholdX10000);
        ssimThresholdX10000 = _thresholdX10000;
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ─── Shipment Registration ────────────────────────────────────────────────
    /**
     * @dev Register a new shipment before it is inspected.
     */
    function registerShipment(string calldata shipmentCode) 
        external 
        onlyRole(ORIGINATOR_ROLE) 
        whenNotPaused 
        returns (uint256) 
    {
        require(bytes(shipmentCode).length > 0, "Shipment code cannot be empty");
        require(shipmentCodeToId[shipmentCode] == 0, "Shipment code already registered");

        _shipmentCounter.increment();
        uint256 shipmentId = _shipmentCounter.current();

        shipments[shipmentId] = Shipment({
            shipmentId: shipmentId,
            shipmentCode: shipmentCode,
            originator: msg.sender,
            currentHolder: msg.sender,
            status: ShipmentStatus.REGISTERED,
            registeredAt: block.timestamp,
            lastUpdatedAt: block.timestamp,
            inspectionIds: new uint256[](0),
            originFingerprintCID: "",
            originImageHash: bytes32(0),
            originPHash: "",
            exists: true
        });

        shipmentCodeToId[shipmentCode] = shipmentId;
        totalShipments++;

        emit ShipmentRegistered(shipmentId, shipmentCode, msg.sender, block.timestamp);
        return shipmentId;
    }

    // ─── Origin Inspection ────────────────────────────────────────────────────
    /**
     * @dev Store the origin inspection hash — the "ground truth" fingerprint.
     */
    function storeOriginInspection(
        uint256 shipmentId,
        bytes32 imageHash,
        string calldata pHash,
        string calldata ipfsCID,
        uint32 ssimScoreX10000
    ) 
        external 
        onlyRole(INSPECTOR_ROLE)
        whenNotPaused 
        nonReentrant
        returns (uint256)
    {
        require(shipments[shipmentId].exists, "Shipment not found");
        require(shipments[shipmentId].status == ShipmentStatus.REGISTERED, "Invalid status for origin inspection");
        require(bytes(ipfsCID).length > 0, "IPFS CID required");
        require(imageHash != bytes32(0), "Image hash required");

        _inspectionCounter.increment();
        uint256 recordId = _inspectionCounter.current();

        inspectionRecords[recordId] = InspectionRecord({
            recordId: recordId,
            shipmentId: shipmentId,
            inspectionType: InspectionType.ORIGIN,
            imageHash: imageHash,
            pHash: pHash,
            ipfsCID: ipfsCID,
            ssimScoreX10000: ssimScoreX10000,
            hammingDistance: 0,
            verdict: IntegrityVerdict.CLEAN,
            inspector: msg.sender,
            timestamp: block.timestamp,
            notes: ""
        });

        // Store origin fingerprint on shipment
        shipments[shipmentId].originImageHash = imageHash;
        shipments[shipmentId].originPHash = pHash;
        shipments[shipmentId].originFingerprintCID = ipfsCID;
        shipments[shipmentId].status = ShipmentStatus.ORIGIN_INSPECTED;
        shipments[shipmentId].lastUpdatedAt = block.timestamp;
        shipments[shipmentId].inspectionIds.push(recordId);
        totalInspections++;

        emit OriginInspectionStored(shipmentId, recordId, imageHash, ipfsCID, block.timestamp);
        emit InspectionAdded(shipmentId, recordId, InspectionType.ORIGIN, block.timestamp);
        return recordId;
    }

    // ─── Destination Verification ─────────────────────────────────────────────
    /**
     * @dev Verify shipment at destination by comparing new hash to origin hash.
     * Smart contract automatically determines verdict based on thresholds.
     */
    function verifyDestinationInspection(
        uint256 shipmentId,
        bytes32 newImageHash,
        string calldata newPHash,
        string calldata ipfsCID,
        uint32 newSsimScoreX10000,
        uint32 hammingDist,
        string calldata notes
    ) 
        external 
        onlyRole(VERIFIER_ROLE)
        whenNotPaused 
        nonReentrant
        returns (uint256, IntegrityVerdict)
    {
        require(shipments[shipmentId].exists, "Shipment not found");
        require(
            shipments[shipmentId].status == ShipmentStatus.ORIGIN_INSPECTED ||
            shipments[shipmentId].status == ShipmentStatus.IN_TRANSIT,
            "Shipment not ready for destination verification"
        );

        // Determine verdict based on thresholds
        IntegrityVerdict verdict;
        if (hammingDist <= pHashThreshold && newSsimScoreX10000 >= ssimThresholdX10000) {
            verdict = IntegrityVerdict.CLEAN;
        } else if (hammingDist <= pHashThreshold * 2 || newSsimScoreX10000 >= ssimThresholdX10000 / 2) {
            verdict = IntegrityVerdict.SUSPICIOUS;
        } else {
            verdict = IntegrityVerdict.TAMPERED;
        }

        _inspectionCounter.increment();
        uint256 recordId = _inspectionCounter.current();

        inspectionRecords[recordId] = InspectionRecord({
            recordId: recordId,
            shipmentId: shipmentId,
            inspectionType: InspectionType.DESTINATION,
            imageHash: newImageHash,
            pHash: newPHash,
            ipfsCID: ipfsCID,
            ssimScoreX10000: newSsimScoreX10000,
            hammingDistance: hammingDist,
            verdict: verdict,
            inspector: msg.sender,
            timestamp: block.timestamp,
            notes: notes
        });

        shipments[shipmentId].inspectionIds.push(recordId);
        shipments[shipmentId].lastUpdatedAt = block.timestamp;
        totalInspections++;

        if (verdict == IntegrityVerdict.TAMPERED || verdict == IntegrityVerdict.SUSPICIOUS) {
            // Create tampering alert
            _alertCounter.increment();
            uint256 alertId = _alertCounter.current();
            tamperingAlerts[alertId] = TamperingAlert({
                alertId: alertId,
                shipmentId: shipmentId,
                inspectionId: recordId,
                hammingDistance: hammingDist,
                ssimScoreX10000: newSsimScoreX10000,
                ipfsDiffCID: ipfsCID,
                detectedBy: msg.sender,
                timestamp: block.timestamp
            });
            shipmentAlerts[shipmentId].push(alertId);
            totalTamperingAlerts++;

            shipments[shipmentId].status = ShipmentStatus.TAMPERED;
            emit TamperingDetected(shipmentId, alertId, hammingDist, newSsimScoreX10000, block.timestamp);
        } else {
            shipments[shipmentId].status = ShipmentStatus.DESTINATION_VERIFIED;
        }

        emit DestinationVerified(shipmentId, recordId, verdict, block.timestamp);
        emit InspectionAdded(shipmentId, recordId, InspectionType.DESTINATION, block.timestamp);

        return (recordId, verdict);
    }

    // ─── View Functions ───────────────────────────────────────────────────────
    function getShipment(uint256 shipmentId) external view returns (Shipment memory) {
        require(shipments[shipmentId].exists, "Shipment not found");
        return shipments[shipmentId];
    }

    function getInspectionRecord(uint256 recordId) external view returns (InspectionRecord memory) {
        return inspectionRecords[recordId];
    }

    function getShipmentInspections(uint256 shipmentId) external view returns (uint256[] memory) {
        require(shipments[shipmentId].exists, "Shipment not found");
        return shipments[shipmentId].inspectionIds;
    }

    function getShipmentByCode(string calldata code) external view returns (Shipment memory) {
        uint256 id = shipmentCodeToId[code];
        require(id != 0, "Shipment code not found");
        return shipments[id];
    }

    function getShipmentAlerts(uint256 shipmentId) external view returns (uint256[] memory) {
        return shipmentAlerts[shipmentId];
    }

    function getTamperingAlert(uint256 alertId) external view returns (TamperingAlert memory) {
        return tamperingAlerts[alertId];
    }

    function getShipmentCount() external view returns (uint256) {
        return _shipmentCounter.current();
    }

    function getSystemStats() external view returns (
        uint256 _totalShipments,
        uint256 _totalInspections,
        uint256 _totalAlerts
    ) {
        return (totalShipments, totalInspections, totalTamperingAlerts);
    }
}
