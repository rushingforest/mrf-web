import { MRFModel } from './mrf_model.js';

// ---- Helpers ----

let testNumber = 0;
let passed = 0;
let failed = 0;

function assert(condition, message) {
    testNumber++;
    if (condition) {
        passed++;
        console.log(`  ✓ Test ${testNumber}: ${message}`);
    } else {
        failed++;
        console.error(`  ✗ Test ${testNumber}: ${message}`);
    }
}

function assertThrows(fn, expectedSubstring, message) {
    testNumber++;
    try {
        fn();
        failed++;
        console.error(`  ✗ Test ${testNumber}: ${message} (no error thrown)`);
    } catch (e) {
        if (expectedSubstring && !e.message.includes(expectedSubstring)) {
            failed++;
            console.error(`  ✗ Test ${testNumber}: ${message} (wrong error: "${e.message}", expected "${expectedSubstring}")`);
        } else {
            passed++;
            console.log(`  ✓ Test ${testNumber}: ${message}`);
        }
    }
}

function approxEqual(a, b, tol = 1e-4) {
    return Math.abs(a - b) < tol;
}

// ---- Test Suite ----

async function testVariableManagement() {
    console.log("\n=== Variable Management ===");
    const model = new MRFModel();

    // Add a variable
    model.addVariable('Weather', ['sunny', 'rainy', 'cloudy']);
    assert(model.getDimension('Weather') === 3, 'Weather has 3 levels');
    assert(model.getLevelIndex('Weather', 'sunny') === 0, 'sunny is index 0');
    assert(model.getLevelIndex('Weather', 'rainy') === 1, 'rainy is index 1');
    assert(model.getLevelIndex('Weather', 'cloudy') === 2, 'cloudy is index 2');

    // Add a second variable
    model.addVariable('Mood', ['happy', 'sad', 'calm']);
    assert(model.getDimension('Mood') === 3, 'Mood has 3 levels');
    assert(model.variables.size === 2, 'Model has 2 variables');

    // Duplicate variable name
    assertThrows(
        () => model.addVariable('Weather', ['a', 'b']),
        'already exists',
        'Reject duplicate variable name'
    );

    // Empty variable name
    assertThrows(
        () => model.addVariable('', ['a']),
        'cannot be empty',
        'Reject empty variable name'
    );

    // Empty levels
    assertThrows(
        () => model.addVariable('Empty', []),
        'at least one level',
        'Reject variable with no levels'
    );

    // Duplicate level names
    assertThrows(
        () => model.addVariable('Bad', ['x', 'x']),
        'duplicate level',
        'Reject duplicate level names'
    );

    // Empty level name
    assertThrows(
        () => model.addVariable('Bad2', ['good', '']),
        'empty level',
        'Reject empty level name'
    );

    // Nonexistent variable
    assertThrows(
        () => model.getDimension('Nonexistent'),
        'not found',
        'Reject nonexistent variable for getDimension'
    );

    assertThrows(
        () => model.getLevelIndex('Weather', 'snowy'),
        'not found',
        'Reject nonexistent level name'
    );

    // Remove variable
    model.addVariable('Temp', ['hot', 'cold']);
    model.removeVariable('Temp');
    assert(!model.variables.has('Temp'), 'Temp removed');
    assert(model.variables.size === 2, 'Back to 2 variables');

    // Remove variable cascades to factors and evidence
    model.addVariable('Wind', ['strong', 'weak']);
    model.addBinaryFactor('Weather', 'Wind', { 'sunny,strong': 0.5, 'rainy,weak': 3 });
    model.setEvidence('Wind', 'strong');
    model.removeVariable('Wind');
    assert(model.binaryFactors.length === 0, 'Removing Wind cascades to binary factors');
    assert(!model.evidence.has('Wind'), 'Removing Wind cascades to evidence');
}

async function testUnaryFactors() {
    console.log("\n=== Unary Factors ===");
    const model = new MRFModel();
    model.addVariable('Weather', ['sunny', 'rainy', 'cloudy']);

    // Add a sparse unary factor
    const idx = model.addUnaryFactor('Weather', { rainy: 5, sunny: 2 });
    assert(idx === 0, 'First unary factor has index 0');
    assert(model.unaryFactors.length === 1, 'Model has 1 unary factor');

    // Validate entries
    const factor = model.unaryFactors[0];
    assert(factor.entries.get('rainy') === 5, 'rainy = 5');
    assert(factor.entries.get('sunny') === 2, 'sunny = 2');
    assert(!factor.entries.has('cloudy'), 'cloudy not specified (defaults to 1)');

    // Invalid variable
    assertThrows(
        () => model.addUnaryFactor('Nonexistent', { a: 1 }),
        'not found',
        'Reject unary factor on nonexistent variable'
    );

    // Invalid level name
    assertThrows(
        () => model.addUnaryFactor('Weather', { snowy: 2 }),
        'not found',
        'Reject unary factor with nonexistent level'
    );

    // Negative value
    assertThrows(
        () => model.addUnaryFactor('Weather', { sunny: -1 }),
        'non-negative',
        'Reject negative factor value'
    );

    // Remove factor
    model.removeUnaryFactor(0);
    assert(model.unaryFactors.length === 0, 'Unary factor removed');
}

async function testBinaryFactors() {
    console.log("\n=== Binary Factors ===");
    const model = new MRFModel();
    model.addVariable('Weather', ['sunny', 'rainy']);
    model.addVariable('Mood', ['happy', 'sad']);

    // Add a sparse binary factor
    const idx = model.addBinaryFactor('Weather', 'Mood', {
        'sunny,happy': 5,
        'rainy,sad': 3
    });
    assert(idx === 0, 'First binary factor has index 0');
    assert(model.binaryFactors.length === 1, 'Model has 1 binary factor');

    const factor = model.binaryFactors[0];
    assert(factor.var1 === 'Weather', 'var1 is Weather');
    assert(factor.var2 === 'Mood', 'var2 is Mood');
    assert(factor.entries.get('sunny,happy') === 5, 'sunny,happy = 5');
    assert(factor.entries.get('rainy,sad') === 3, 'rainy,sad = 3');

    // Self-loop
    assertThrows(
        () => model.addBinaryFactor('Weather', 'Weather', { 'sunny,rainy': 2 }),
        'itself',
        'Reject self-loop binary factor'
    );

    // Invalid variable
    assertThrows(
        () => model.addBinaryFactor('Weather', 'Nonexistent', { 'sunny,a': 1 }),
        'not found',
        'Reject binary factor with nonexistent var2'
    );

    // Invalid level
    assertThrows(
        () => model.addBinaryFactor('Weather', 'Mood', { 'snowy,happy': 2 }),
        'not found',
        'Reject binary factor with nonexistent level'
    );

    // Negative value
    assertThrows(
        () => model.addBinaryFactor('Weather', 'Mood', { 'sunny,happy': -1 }),
        'non-negative',
        'Reject negative binary factor value'
    );

    // Remove factor
    model.removeBinaryFactor(0);
    assert(model.binaryFactors.length === 0, 'Binary factor removed');
}

async function testEvidence() {
    console.log("\n=== Evidence ===");
    const model = new MRFModel();
    model.addVariable('Weather', ['sunny', 'rainy']);

    model.setEvidence('Weather', 'sunny');
    assert(model.evidence.get('Weather') === 'sunny', 'Evidence set');

    model.clearEvidence('Weather');
    assert(!model.evidence.has('Weather'), 'Evidence cleared');

    // Invalid variable
    assertThrows(
        () => model.setEvidence('Nonexistent', 'a'),
        'not found',
        'Reject evidence on nonexistent variable'
    );

    // Invalid level
    assertThrows(
        () => model.setEvidence('Weather', 'snowy'),
        'not found',
        'Reject evidence with nonexistent level'
    );
}

async function testSparseExpansion() {
    console.log("\n=== Sparse Factor Expansion ===");
    const model = new MRFModel();
    model.addVariable('A', ['a0', 'a1', 'a2']);
    model.addVariable('B', ['b0', 'b1']);

    // Unary expansion
    const uFactor = { type: 'unary', variable: 'A', entries: new Map([['a1', 5], ['a0', 2]]) };
    const uDense = model._expandUnary(uFactor, 3);
    assert(uDense.length === 3, 'Unary dense has 3 entries');
    assert(uDense[0] === 2, 'a0 = 2');
    assert(uDense[1] === 5, 'a1 = 5');
    assert(uDense[2] === 1, 'a2 defaults to 1');

    // Binary expansion
    const info1 = model.variables.get('A');
    const info2 = model.variables.get('B');
    const bFactor = {
        type: 'binary',
        var1: 'A',
        var2: 'B',
        entries: new Map([['a0,b0', 10], ['a2,b1', 7]])
    };
    const bDense = model._expandBinary(bFactor, info1, info2);
    assert(bDense.length === 6, 'Binary dense has 6 entries (3x2)');

    // Row-major: a0,b0 = row0*2+0 = 0
    assert(bDense[0] === 10, 'a0,b0 = 10');
    // a0,b1 = row0*2+1 = 1
    assert(bDense[1] === 1, 'a0,b1 defaults to 1');
    // a1,b0 = row1*2+0 = 2
    assert(bDense[2] === 1, 'a1,b0 defaults to 1');
    // a1,b1 = row1*2+1 = 3
    assert(bDense[3] === 1, 'a1,b1 defaults to 1');
    // a2,b0 = row2*2+0 = 4
    assert(bDense[4] === 1, 'a2,b0 defaults to 1');
    // a2,b1 = row2*2+1 = 5
    assert(bDense[5] === 7, 'a2,b1 = 7');
}

async function testDegreeComputation() {
    console.log("\n=== Degree Computation ===");
    const model = new MRFModel();
    model.addVariable('A', ['a0', 'a1']);
    model.addVariable('B', ['b0', 'b1']);
    model.addVariable('C', ['c0', 'c1']);

    model.addBinaryFactor('A', 'B', { 'a0,b0': 2 });
    model.addBinaryFactor('B', 'C', { 'b0,c0': 3 });

    const degrees = model._computeDegrees();
    assert(degrees.get('A') === 1, 'A has degree 1');
    assert(degrees.get('B') === 2, 'B has degree 2');
    assert(degrees.get('C') === 1, 'C has degree 1');
}

async function testInferenceBasic() {
    console.log("\n=== Inference: Basic ===");
    const model = new MRFModel();
    model.addVariable('A', ['a0', 'a1']);
    model.addVariable('B', ['b0', 'b1']);

    // Uniform priors, identity-like coupling
    model.addUnaryFactor('A', { a0: 1, a1: 1 });
    model.addUnaryFactor('B', { b0: 1, b1: 1 });
    model.addBinaryFactor('A', 'B', {
        'a0,b0': 10,
        'a1,b1': 10,
        'a0,b1': 0.1,
        'a1,b0': 0.1
    });

    const marginals = await model.infer(20);

    // With uniform priors and strong diagonal coupling,
    // marginals should still be roughly uniform
    const mA = marginals.get('A');
    const mB = marginals.get('B');

    assert(approxEqual(mA.get('a0'), 0.5, 0.05), 'A.a0 ≈ 0.5');
    assert(approxEqual(mA.get('a1'), 0.5, 0.05), 'A.a1 ≈ 0.5');
    assert(approxEqual(mB.get('b0'), 0.5, 0.05), 'B.b0 ≈ 0.5');
    assert(approxEqual(mB.get('b1'), 0.5, 0.05), 'B.b1 ≈ 0.5');

    // Probabilities should sum to 1
    const sumA = mA.get('a0') + mA.get('a1');
    const sumB = mB.get('b0') + mB.get('b1');
    assert(approxEqual(sumA, 1.0), 'A marginals sum to 1');
    assert(approxEqual(sumB, 1.0), 'B marginals sum to 1');
}

async function testInferenceWithEvidence() {
    console.log("\n=== Inference: With Evidence ===");
    const model = new MRFModel();
    model.addVariable('Weather', ['sunny', 'rainy']);
    model.addVariable('Mood', ['happy', 'sad']);

    // Uniform priors
    model.addUnaryFactor('Weather', { sunny: 1, rainy: 1 });
    model.addUnaryFactor('Mood', { happy: 1, sad: 1 });

    // Strong coupling: sunny→happy, rainy→sad
    model.addBinaryFactor('Weather', 'Mood', {
        'sunny,happy': 10,
        'rainy,sad': 10,
        'sunny,sad': 0.1,
        'rainy,happy': 0.1
    });

    // Without evidence: roughly uniform
    const m1 = await model.infer(20);
    const moodBefore = m1.get('Mood');
    assert(approxEqual(moodBefore.get('happy'), 0.5, 0.05), 'Mood happy ≈ 0.5 before evidence');

    // Set evidence: Weather = rainy
    model.setEvidence('Weather', 'rainy');
    const m2 = await model.infer(20);
    const moodAfter = m2.get('Mood');
    assert(moodAfter.get('sad') > 0.8, 'Mood sad > 0.8 after Weather=rainy');
    assert(moodAfter.get('happy') < 0.2, 'Mood happy < 0.2 after Weather=rainy');

    // Weather marginal should be concentrated on rainy
    const weatherAfter = m2.get('Weather');
    assert(approxEqual(weatherAfter.get('rainy'), 1.0, 0.01), 'Weather rainy ≈ 1.0 (evidence)');
}

async function testInferenceChain() {
    console.log("\n=== Inference: Chain (3 variables) ===");
    const model = new MRFModel();
    model.addVariable('A', ['a0', 'a1']);
    model.addVariable('B', ['b0', 'b1']);
    model.addVariable('C', ['c0', 'c1']);

    model.addUnaryFactor('A', { a0: 1, a1: 1.1 });
    model.addUnaryFactor('B', { b0: 1, b1: 1.1 });
    model.addUnaryFactor('C', { c0: 1, c1: 1.1 });

    // Strong diagonal coupling along the chain
    model.addBinaryFactor('A', 'B', { 'a0,b0': 10, 'a1,b1': 10, 'a0,b1': 1, 'a1,b0': 1 });
    model.addBinaryFactor('B', 'C', { 'b0,c0': 10, 'b1,c1': 10, 'b0,c1': 1, 'b1,c0': 1 });

    // Set evidence at A, check propagation to C
    model.setEvidence('A', 'a0');
    const marginals = await model.infer(30);

    const mC = marginals.get('C');
    assert(mC.get('c0') > 0.8, 'C.c0 > 0.8 (propagated from A=a0)');
    assert(mC.get('c1') < 0.2, 'C.c1 < 0.2 (propagated from A=a0)');
}

async function testInferenceIsolatedVariable() {
    console.log("\n=== Inference: Isolated Variable Error ===");
    const model = new MRFModel();
    model.addVariable('A', ['a0', 'a1']);
    model.addVariable('B', ['b0', 'b1']);
    model.addVariable('Lonely', ['l0', 'l1']);

    model.addBinaryFactor('A', 'B', { 'a0,b0': 2 });

    // Must await the promise to catch the rejection
    await assertThrowsAsync(
        () => model.infer(10),
        'degree 0',
        'Reject inference with isolated variable'
    );
}

async function testInferenceNoVariables() {
    console.log("\n=== Inference: No Variables Error ===");
    const model = new MRFModel();

    await assertThrowsAsync(
        () => model.infer(10),
        'No variables',
        'Reject inference with no variables'
    );
}

// Helper for async assertions
async function assertThrowsAsync(fn, expectedSubstring, message) {
    testNumber++;
    try {
        await fn();
        failed++;
        console.error(`  ✗ Test ${testNumber}: ${message} (no error thrown)`);
    } catch (e) {
        if (expectedSubstring && !e.message.includes(expectedSubstring)) {
            failed++;
            console.error(`  ✗ Test ${testNumber}: ${message} (wrong error: "${e.message}", expected "${expectedSubstring}")`);
        } else {
            passed++;
            console.log(`  ✓ Test ${testNumber}: ${message}`);
        }
    }
}

async function testReset() {
    console.log("\n=== Reset ===");
    const model = new MRFModel();
    model.addVariable('A', ['a0', 'a1']);
    model.addVariable('B', ['b0', 'b1']);
    model.addBinaryFactor('A', 'B', { 'a0,b0': 2 });
    model.setEvidence('A', 'a0');

    model.reset();

    assert(model.variables.size === 0, 'Variables cleared');
    assert(model.unaryFactors.length === 0, 'Unary factors cleared');
    assert(model.binaryFactors.length === 0, 'Binary factors cleared');
    assert(model.evidence.size === 0, 'Evidence cleared');
    assert(model._lastMarginals === null, 'Last marginals cleared');
}

async function testGetMarginalsCache() {
    console.log("\n=== Get Marginals Cache ===");
    const model = new MRFModel();
    model.addVariable('A', ['a0', 'a1']);
    model.addVariable('B', ['b0', 'b1']);
    model.addBinaryFactor('A', 'B', { 'a0,b0': 2, 'a1,b1': 2 });

    // Before inference
    assert(model.getMarginals() === null, 'No marginals before inference');

    // After inference
    await model.infer(10);
    assert(model.getMarginals() !== null, 'Marginals cached after inference');
    assert(model.getMarginals().has('A'), 'Cached marginals have A');
}

async function testMultipleUnaryFactors() {
    console.log("\n=== Multiple Unary Factors on Same Variable ===");
    const model = new MRFModel();
    model.addVariable('A', ['a0', 'a1']);
    model.addVariable('B', ['b0', 'b1']);

    // Two unary factors on A — the second one replaces the first
    // (since setPrior overwrites)
    model.addUnaryFactor('A', { a0: 10, a1: 1 });
    model.addUnaryFactor('A', { a0: 1, a1: 10 }); // This one wins
    model.addBinaryFactor('A', 'B', { 'a0,b0': 1, 'a1,b1': 1, 'a0,b1': 1, 'a1,b0': 1 });

    const marginals = await model.infer(20);
    const mA = marginals.get('A');

    // The second prior dominates: a1 should be more probable
    assert(mA.get('a1') > mA.get('a0'), 'Second unary factor overrides first: a1 > a0');
}

// ---- Runner ----

async function runAllTests() {
    console.log("=== MRFModel Tests ===");

    await testVariableManagement();
    await testUnaryFactors();
    await testBinaryFactors();
    await testEvidence();
    await testSparseExpansion();
    await testDegreeComputation();
    await testInferenceBasic();
    await testInferenceWithEvidence();
    await testInferenceChain();
    await testInferenceIsolatedVariable();
    await testInferenceNoVariables();
    await testReset();
    await testGetMarginalsCache();
    await testMultipleUnaryFactors();

    console.log("\n=== Summary ===");
    console.log(`Passed: ${passed}/${testNumber}`);
    console.log(`Failed: ${failed}/${testNumber}`);

    if (failed > 0) {
        process.exit(1);
    } else {
        console.log("✅ All tests passed!");
        process.exit(0);
    }
}

runAllTests().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});