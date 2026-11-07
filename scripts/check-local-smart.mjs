/**
 * Guard checks for Melview lc → /smart URL building and Wi-Fi module labels.
 * Run: node scripts/check-local-smart.mjs
 */
import assert from 'node:assert/strict';

class FakeCommand {
  constructor(device) {
    this.device = device;
  }

  getLocalCommandURL() {
    const ip = this.device.capabilities?.localip?.trim();
    if (!ip) {
      throw new Error('Unit localip unavailable for /smart hop');
    }
    return 'http://' + ip + '/smart';
  }

  getLocalCommandBody(key) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<ESV>' + key + '</ESV>';
  }
}

// RFC 5737 documentation address — not a real LAN host.
const EXAMPLE_IP = '192.0.2.10';

assert.equal(
  new FakeCommand({ capabilities: { localip: EXAMPLE_IP } }).getLocalCommandURL(),
  `http://${EXAMPLE_IP}/smart`,
);
assert.throws(
  () => new FakeCommand({ capabilities: {} }).getLocalCommandURL(),
  /localip unavailable/,
);
assert.match(
  new FakeCommand({ capabilities: { localip: EXAMPLE_IP } }).getLocalCommandBody('abc'),
  /<ESV>abc<\/ESV>/,
);

const { formatWifiModule, supportsLocalSmart } = await import('../dist/wifiModule.js');
assert.equal(formatWifiModule('mac568'), 'MAC-568IF-E');
assert.equal(formatWifiModule('mac577'), 'MAC-577IF-E');
assert.equal(supportsLocalSmart('mac568'), true);
assert.equal(supportsLocalSmart('unknown-wifi'), false);

console.log('check-local-smart: ok');
