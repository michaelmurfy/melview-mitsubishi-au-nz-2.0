import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fanStageToPercent, percentToFanStage } from '../dist/fanSpeed.js';

describe('fanSpeed', () => {
  it('maps Melview stages to HomeKit percentages', () => {
    assert.equal(fanStageToPercent(0), 0);
    assert.equal(fanStageToPercent(1), 20);
    assert.equal(fanStageToPercent(2), 40);
    assert.equal(fanStageToPercent(3), 60);
    assert.equal(fanStageToPercent(5), 80);
    assert.equal(fanStageToPercent(6), 100);
  });

  it('maps HomeKit percentages back to Melview stages', () => {
    assert.equal(percentToFanStage(0), 0);
    assert.equal(percentToFanStage(10), 1);
    assert.equal(percentToFanStage(20), 1);
    assert.equal(percentToFanStage(40), 2);
    assert.equal(percentToFanStage(60), 3);
    assert.equal(percentToFanStage(80), 5);
    assert.equal(percentToFanStage(100), 6);
  });

  it('round-trips stage -> percent -> stage', () => {
    for (const stage of [0, 1, 2, 3, 5, 6]) {
      assert.equal(percentToFanStage(fanStageToPercent(stage)), stage);
    }
  });
});
