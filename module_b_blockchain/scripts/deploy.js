const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment script for Supply Chain Integrity smart contracts.
 * Deploys:
 *   1. SupplyChainIntegrity.sol (main contract)
 *   2. InspectionRegistry.sol (global registry)
 *
 * Saves deployed addresses to:
 *   - deployments/<network>/addresses.json
 *   - ../module_c_integration/api/config/contract_addresses.json (for API)
 */

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const balance = await ethers.provider.getBalance(deployer.address);

    console.log("════════════════════════════════════════════════");
    console.log("   Supply Chain Integrity — Contract Deployment");
    console.log("════════════════════════════════════════════════");
    console.log(`Network:   ${network.name} (chainId: ${network.chainId})`);
    console.log(`Deployer:  ${deployer.address}`);
    console.log(`Balance:   ${ethers.formatEther(balance)} ETH`);
    console.log("");

    // ── Deploy SupplyChainIntegrity ──────────────────────────────────────────
    console.log("Deploying SupplyChainIntegrity...");
    const SupplyChainIntegrity = await ethers.getContractFactory("SupplyChainIntegrity");
    const supplyChain = await SupplyChainIntegrity.deploy();
    await supplyChain.waitForDeployment();
    const supplyChainAddr = await supplyChain.getAddress();
    console.log(`✅ SupplyChainIntegrity deployed at: ${supplyChainAddr}`);

    // ── Deploy InspectionRegistry ────────────────────────────────────────────
    console.log("Deploying InspectionRegistry...");
    const InspectionRegistry = await ethers.getContractFactory("InspectionRegistry");
    const registry = await InspectionRegistry.deploy();
    await registry.waitForDeployment();
    const registryAddr = await registry.getAddress();
    console.log(`✅ InspectionRegistry deployed at: ${registryAddr}`);

    // ── Grant Registry Roles ─────────────────────────────────────────────────
    const REGISTRAR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REGISTRAR_ROLE"));
    await registry.grantRole(REGISTRAR_ROLE, supplyChainAddr);
    console.log("✅ Granted REGISTRAR_ROLE to SupplyChainIntegrity");

    // ── Save Addresses ───────────────────────────────────────────────────────
    const addresses = {
        network: network.name,
        chainId: network.chainId.toString(),
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            SupplyChainIntegrity: supplyChainAddr,
            InspectionRegistry: registryAddr,
        }
    };

    const deploymentsDir = path.join(__dirname, "../deployments", network.name);
    fs.mkdirSync(deploymentsDir, { recursive: true });
    const addressPath = path.join(deploymentsDir, "addresses.json");
    fs.writeFileSync(addressPath, JSON.stringify(addresses, null, 2));
    console.log(`\n📄 Addresses saved to: ${addressPath}`);

    // Also save for Module C API
    const apiConfigPath = path.join(__dirname, "../../module_c_integration/api/config/contract_addresses.json");
    fs.mkdirSync(path.dirname(apiConfigPath), { recursive: true });
    fs.writeFileSync(apiConfigPath, JSON.stringify(addresses, null, 2));
    console.log(`📄 Addresses saved for API: ${apiConfigPath}`);

    console.log("\n✅ Deployment complete!");
    console.log("════════════════════════════════════════════════\n");

    return addresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
