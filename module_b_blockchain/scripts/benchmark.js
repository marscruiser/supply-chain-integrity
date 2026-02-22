const { ethers } = require("hardhat");

/**
 * Blockchain Latency Benchmark — Module B
 * Measures average transaction latency for key operations.
 */
async function main() {
    const [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("SupplyChainIntegrity");
    const contract = await Factory.deploy();
    await contract.deployed();

    const NUM_RUNS = 10;
    const results = {};

    // Benchmark: registerShipment
    console.log("═══════════════════════════════════════════");
    console.log("  Blockchain Latency Benchmark");
    console.log("═══════════════════════════════════════════\n");

    const regLatencies = [];
    for (let i = 0; i < NUM_RUNS; i++) {
        const start = Date.now();
        const tx = await contract.registerShipment(`BENCH-${Date.now()}-${i}`);
        await tx.wait();
        regLatencies.push(Date.now() - start);
    }
    const avgReg = regLatencies.reduce((a, b) => a + b, 0) / regLatencies.length;
    console.log(`registerShipment    avg: ${avgReg.toFixed(1)}ms  min: ${Math.min(...regLatencies)}ms  max: ${Math.max(...regLatencies)}ms`);
    results.registerShipment = { avg: avgReg, min: Math.min(...regLatencies), max: Math.max(...regLatencies) };

    // Benchmark: storeOriginInspection
    const inspLatencies = [];
    for (let i = 0; i < NUM_RUNS; i++) {
        const shipId = i + 1;
        const hash = ethers.utils.formatBytes32String(`bench-${i}`);
        const start = Date.now();
        const tx = await contract.storeOriginInspection(shipId, hash, `phash${i}`, `QmBench${i}`, 9500 + i);
        await tx.wait();
        inspLatencies.push(Date.now() - start);
    }
    const avgInsp = inspLatencies.reduce((a, b) => a + b, 0) / inspLatencies.length;
    console.log(`storeOriginInspect  avg: ${avgInsp.toFixed(1)}ms  min: ${Math.min(...inspLatencies)}ms  max: ${Math.max(...inspLatencies)}ms`);
    results.storeOriginInspection = { avg: avgInsp, min: Math.min(...inspLatencies), max: Math.max(...inspLatencies) };

    // Benchmark: getShipment (read — no tx)
    const readLatencies = [];
    for (let i = 0; i < NUM_RUNS; i++) {
        const start = Date.now();
        await contract.getShipment(1);
        readLatencies.push(Date.now() - start);
    }
    const avgRead = readLatencies.reduce((a, b) => a + b, 0) / readLatencies.length;
    console.log(`getShipment (read)  avg: ${avgRead.toFixed(1)}ms  min: ${Math.min(...readLatencies)}ms  max: ${Math.max(...readLatencies)}ms`);
    results.getShipment = { avg: avgRead, min: Math.min(...readLatencies), max: Math.max(...readLatencies) };

    console.log("\n✅ Benchmark complete.");
    console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
