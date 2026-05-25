// test_mrf_js.js
import { createMRFGraph } from './mrf_graph.js';

function arraysClose(a, b, tolerance = 1e-5) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i] - b[i]) > tolerance) return false;
    }
    return true;
}

async function testBasicCreation() {
    console.log("Running test: Basic Creation & Destruction...");
    const graph = await createMRFGraph('./mrf.js');

    try {
        // Chain: 0 -- 1 -- 2
        // Node 0: degree 1 (connected to 1)
        // Node 1: degree 2 (connected to 0 and 2)
        // Node 2: degree 1 (connected to 1)
        graph.addNode(0, 1, 2);
        graph.addNode(1, 2, 4);
        graph.addNode(2, 1, 3);

        graph.setPrior(0, [0.5, 0.5]);
        graph.setPrior(1, [0.25, 0.25, 0.25, 0.25]);
        graph.setPrior(2, [1/3, 1/3, 1/3]);

        const f12 = Array(2 * 4).fill(1.0 / 8);
        graph.addEdge(0, 1, f12);

        const f23 = Array(4 * 3).fill(1.0 / 12);
        graph.addEdge(1, 2, f23);

        graph.runBeliefPropagation([0, 1, 2], 10);

        const m0 = graph.getMarginal(0);
        const m1 = graph.getMarginal(1);
        const m2 = graph.getMarginal(2);

        const sum0 = m0.reduce((a, b) => a + b, 0);
        const sum1 = m1.reduce((a, b) => a + b, 0);
        const sum2 = m2.reduce((a, b) => a + b, 0);

        if (Math.abs(sum0 - 1.0) > 1e-4 || Math.abs(sum1 - 1.0) > 1e-4 || Math.abs(sum2 - 1.0) > 1e-4) {
            throw new Error(`Marginals do not sum to 1.0: ${sum0}, ${sum1}, ${sum2}`);
        }

        console.log("  ✓ Graph created, BP ran, and marginals sum to 1.0.");
        console.log(`    Node 0: [${m0.map(v => v.toFixed(4)).join(', ')}]`);

        graph.destroy();
        console.log("  ✓ Test passed: Basic Creation & Destruction.");
        return true;
    } catch (err) {
        console.error("  ✗ Test failed:", err.message);
        graph.destroy();
        return false;
    }
}

async function testEvidenceAndInference() {
    console.log("Running test: Evidence Conditioning...");
    const graph = await createMRFGraph('./mrf.js');

    try {
        // Chain: 0 -- 1 -- 2
        graph.addNode(0, 1, 2);
        graph.addNode(1, 2, 4);
        graph.addNode(2, 1, 3);

        graph.setPrior(0, [0.1, 0.9]);
        graph.setPrior(1, [0.25, 0.25, 0.25, 0.25]);
        graph.setPrior(2, [1/3, 1/3, 1/3]);

        const f12 = new Array(8).fill(2.0);
        f12[0] = 10.0;
        f12[5] = 10.0;
        graph.addEdge(0, 1, f12);

        const f23 = new Array(12).fill(2.0);
        f23[0] = 10.0;
        f23[5] = 10.0;
        f23[8] = 10.0;
        graph.addEdge(1, 2, f23);

        graph.runBeliefPropagation([0, 1, 2], 20);

        const m1_before = graph.getMarginal(1);
        console.log("  Marginal Node 1 (before evidence):", m1_before.map(v => v.toFixed(3)));

        graph.setEvidence(0, 0);
        graph.resetMessages();
        graph.runBeliefPropagation([0, 1, 2], 20);

        const m1_after = graph.getMarginal(1);
        console.log("  Marginal Node 1 (after Node 0=0):", m1_after.map(v => v.toFixed(3)));

        if (m1_after[1] > 0.2) {
            throw new Error(`Expected Node 1 state 1 to be <= 0.2, got ${m1_after[1]}`);
        }

        console.log("  ✓ Evidence propagation successful.");

        graph.destroy();
        console.log("  ✓ Test passed: Evidence Conditioning.");
        return true;
    } catch (err) {
        console.error("  ✗ Test failed:", err.message);
        graph.destroy();
        return false;
    }
}

async function testMemoryLeak() {
    console.log("Running test: Memory Leak Check (Rapid Allocation)...");

    for (let i = 0; i < 10; i++) {
        const graph = await createMRFGraph('./mrf.js');
        graph.addNode(0, 1, 2);
        graph.addNode(1, 1, 2);
        graph.setPrior(0, [0.5, 0.5]);
        graph.setPrior(1, [0.5, 0.5]);
        graph.addEdge(0, 1, [1, 0, 0, 1]);
        graph.runBeliefPropagation([0, 1], 5);
        graph.destroy();
    }

    console.log("  ✓ 10 graphs created and destroyed without crash.");
    console.log("  ✓ Test passed: Memory Leak Check.");
    return true;
}

async function runAllTests() {
    console.log("=== Starting MRF JavaScript Tests ===\n");

    const results = [];

    results.push(await testBasicCreation());
    results.push(await testEvidenceAndInference());
    results.push(await testMemoryLeak());

    console.log("\n=== Test Summary ===");
    const passed = results.filter(r => r).length;
    const total = results.length;

    if (passed === total) {
        console.log(`✅ All ${total} tests passed!`);
        process.exit(0);
    } else {
        console.log(`❌ ${total - passed} / ${total} tests failed.`);
        process.exit(1);
    }
}

runAllTests().catch(err => {
    console.error("Fatal error running tests:", err);
    process.exit(1);
});