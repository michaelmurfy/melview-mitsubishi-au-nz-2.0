import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatWifiModule, supportsLocalSmart } from '../dist/wifiModule.js';

describe('wifiModule', () => {
  it('maps known Melview adaptortype values', () => {
    assert.equal(formatWifiModule('mac568'), 'MAC-568IF-E');
    assert.equal(formatWifiModule('mac577'), 'MAC-577IF-E');
    assert.equal(formatWifiModule('MAC-577IF-2E'), 'MAC-577IF-2E');
  });

  it('falls back for unknown / empty values', () => {
    assert.equal(formatWifiModule(undefined), 'Unknown');
    assert.equal(formatWifiModule(''), 'Unknown');
    assert.equal(formatWifiModule('custom'), 'CUSTOM');
  });

  it('detects /smart-capable adapters', () => {
    assert.equal(supportsLocalSmart('mac568'), true);
    assert.equal(supportsLocalSmart('mac577'), true);
    assert.equal(supportsLocalSmart('unknown-wifi'), false);
  });
});
