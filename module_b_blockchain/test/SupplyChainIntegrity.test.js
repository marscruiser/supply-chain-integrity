const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChainIntegrity", function () {
    let contract, owner, inspector, verifier, outsider;

    beforeEach(async function () {
        [owner, inspector, verifier, outsider] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("SupplyChainIntegrity");
        contract = await Factory.deploy();
        await contract.deployed();

        // Grant roles
        const INSPECTOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INSPECTOR_ROLE"));
        const VERIFIER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VERIFIER_ROLE"));
        await contract.grantRole(INSPECTOR_ROLE, inspector.address);
        await contract.grantRole(VERIFIER_ROLE, verifier.address);
    });

    describe("Shipment Registration", function () {
        it("Should register a shipment successfully", async function () {
            const tx = await contract.registerShipment("SHP-2025-001");
            const receipt = await tx.wait();
            const event = receipt.events.find((e) => e.event === "ShipmentRegistered");
            expect(event).to.not.be.undefined;
            expect(event.args.shipmentCode).to.equal("SHP-2025-001");
        });

        it("Should reject duplicate shipment codes", async function () {
            await contract.registerShipment("SHP-DUP");
            await expect(contract.registerShipment("SHP-DUP")).to.be.revertedWith(
                "Shipment code already registered"
            );
        });

        it("Should reject empty shipment code", async function () {
            await expect(contract.registerShipment("")).to.be.revertedWith(
                "Shipment code cannot be empty"
            );
        });

        it("Should increment shipment counter", async function () {
            await contract.registerShipment("SHP-A");
            await contract.registerShipment("SHP-B");
            const stats = await contract.getSystemStats();
            expect(stats._totalShipments).to.equal(2);
        });
    });

    describe("Origin Inspection", function () {
        beforeEach(async function () {
            await contract.registerShipment("SHP-ORIGIN");
        });

        it("Should store origin inspection with valid data", async function () {
            const hash = ethers.utils.formatBytes32String("test-hash");
            const tx = await contract
                .connect(inspector)
                .storeOriginInspection(1, hash, "abc123phash", "QmTestCID123", 9800);
            const receipt = await tx.wait();
            expect(receipt.events.find((e) => e.event === "OriginInspectionStored")).to.not.be.undefined;
        });

        it("Should reject origin inspection for non-existent shipment", async function () {
            const hash = ethers.utils.formatBytes32String("test");
            await expect(
                contract.connect(inspector).storeOriginInspection(999, hash, "ph", "cid", 9500)
            ).to.be.revertedWith("Shipment not found");
        });
    });

    describe("Destination Verification", function () {
        beforeEach(async function () {
            await contract.registerShipment("SHP-DEST");
            const hash = ethers.utils.formatBytes32String("origin-hash");
            await contract
                .connect(inspector)
                .storeOriginInspection(1, hash, "originphash", "QmOriginCID", 10000);
        });

        it("Should verify CLEAN with low hamming and high SSIM", async function () {
            const newHash = ethers.utils.formatBytes32String("dest-hash");
            await contract
                .connect(verifier)
                .verifyDestinationInspection(1, newHash, "destphash", "QmDestCID", 9700, 3, "all good");
            const shipment = await contract.getShipment(1);
            expect(shipment.status).to.equal(3); // DESTINATION_VERIFIED
        });

        it("Should detect TAMPERED with high hamming and low SSIM", async function () {
            const newHash = ethers.utils.formatBytes32String("bad-hash");
            await contract
                .connect(verifier)
                .verifyDestinationInspection(1, newHash, "badphash", "QmBadCID", 2000, 50, "tampered!");
            const shipment = await contract.getShipment(1);
            expect(shipment.status).to.equal(4); // TAMPERED
        });
    });

    describe("Access Control", function () {
        it("Should reject unauthorized shipment registration", async function () {
            await expect(
                contract.connect(outsider).registerShipment("UNAUTH")
            ).to.be.reverted;
        });
    });

    describe("System Stats", function () {
        it("Should return correct aggregate counts", async function () {
            const stats = await contract.getSystemStats();
            expect(stats._totalShipments).to.equal(0);
            expect(stats._totalInspections).to.equal(0);
            expect(stats._totalAlerts).to.equal(0);
        });
    });
});
