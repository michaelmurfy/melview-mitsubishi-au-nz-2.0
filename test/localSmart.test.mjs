import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

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

// RFC 5737 documentation address, not a real LAN host.
const EXAMPLE_IP = '192.0.2.10';

describe('local /smart hop helpers', () => {
  it('builds /smart URL from localip', () => {
    assert.equal(
      new FakeCommand({ capabilities: { localip: EXAMPLE_IP } }).getLocalCommandURL(),
      `http://${EXAMPLE_IP}/smart`,
    );
  });

  it('rejects missing localip', () => {
    assert.throws(
      () => new FakeCommand({ capabilities: {} }).getLocalCommandURL(),
      /localip unavailable/,
    );
  });

  it('wraps Melview lc ciphertext in an ESV envelope', () => {
    assert.match(
      new FakeCommand({ capabilities: { localip: EXAMPLE_IP } }).getLocalCommandBody('abc'),
      /<ESV>abc<\/ESV>/,
    );
  });
});
