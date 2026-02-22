const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Verify a shipment by reading its on-chain state.
 * Usage: SHIPMENT_ID=1 npx hardhat run scripts/verify_shipment.js --network localhost
 */
async function main() {
    const addressesPath = path.join(__dirname, "../deployments/localhost/addresses.json");
    if (!fs.existsSync(addressesPath)) {
        console.error("No deployment found. Run: npm run deploy");
        process.exit(1);
    }
    const addresses = JSON.parse(fs.readFileSync(addressesPath));
    const contract = await ethers.getContractAt(
        "SupplyChainIntegrity",
        addresses.contracts.SupplyChainIntegrity
    );

    const shipmentId = parseInt(process.env.SHIPMENT_ID || "1");
    console.log(`\nFetching shipment #${shipmentId}...`);

    try {
        const shipment = await contract.getShipment(shipmentId);
        const statusMap = ["REGISTERED", "ORIGIN_INSPECTED", "IN_TRANSIT", "DEST_VERIFIED", "TAMPERED", "DISPUTED"];
        console.log(JSON.stringify({
            id: shipment.shipmentId.toString(),
            code: shipment.shipmentCode,
            status: statusMap[shipment.status] || "UNKNOWN",
            originator: shipment.originator,
            originCID: shipment.originFingerprintCID || "N/A",
            inspectionCount: shipment.inspectionIds.length,
        }, null, 2));

        if (shipment.inspectionIds.length > 0) {
            console.log("\nInspection Records:");
            for (const id of shipment.inspectionIds) {
                const record = await contract.getInspectionRecord(id);
                const verdictMap = ["CLEAN", "SUSPICIOUS", "TAMPERED"];
                console.log(`  Record #${id}: ${verdictMap[record.verdict]} | SSIM: ${record.ssimScoreX10000 / 10000} | CID: ${record.ipfsCID}`);
            }
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main().catch(console.error);
