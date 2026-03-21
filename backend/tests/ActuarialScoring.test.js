const test = require('node:test');
const assert = require('node:assert');
const ActuarialScoring = require('../src/services/ActuarialScoring');

test('Actuarial Scoring Engine Test Suite (Developer)', async (t) => {
    await t.test('1. Standard Input: High contributions return high score', () => {
        const score = ActuarialScoring.calculateDeveloperScore(1200);
        assert.strictEqual(score, 95);
    });

    await t.test('2. Zero/Null Inputs: 0 contributions returns baseline score of 0 without crashing', () => {
        const score = ActuarialScoring.calculateDeveloperScore(0);
        assert.strictEqual(score, 0, "Score must be exactly 0 for zeroed inputs");
    });

    await t.test('3. Extreme Edge Cases: Impossible numbers strictly cap output score at a maximum of 100', () => {
        const score = ActuarialScoring.calculateDeveloperScore(50000000);
        assert.ok(score <= 100, "Score MUST cap at exactly 100 and never exceed it");
    });
});
