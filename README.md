# Homebridge Melview AU/NZ Airconditioners

> Fork of [aurc/melview-mitsubishi-au-nz](https://github.com/aurc/melview-mitsubishi-au-nz), updated for Homebridge 2.0 and ESM.

Control Mitsubishi Electric air conditioners in Apple HomeKit via Homebridge and a Mitsubishi Wi-Fi Control (Melview) account.

## Features

Default HomeKit tiles per unit:
- **Heater / Cooler**: power, Auto / Heat / Cool, room temperature, heating and cooling setpoints (°C), `StatusFault` (unit fault or offline)
- **Fan (`Fanv2`)**: native **Auto / Manual** (`TargetFanState`) plus 5-stage speed slider (`20%` to `100%`)

Optional tiles (disabled by default):
- **Vertical swing** (`swingMode`): `SwingMode` on the AC tile
- **Dry mode** (`dry`): Dehumidifier tile (`WorkMode.DRY`)
- **Outdoor temperature** (`outdoorTemp`): Temperature Sensor tile
- **Horizontal swing** (`airflowH`): Switch tile (`ON` = sweep, `OFF` = centre)
- **Fan-only mode** (`fanMode`): Fan tile for `WorkMode.FAN` when `fanSpeed` is disabled

Commands go through the Melview API and, when the unit reports a LAN IP, are also POSTed to the unit's `/smart` endpoint for faster local response.

## Requirements

- [Homebridge](https://homebridge.io/) `^1.8.0 || ^2.0.0`
- Node.js `^22.12.0 || ^24.0.0 || ^26.0.0`
- Mitsubishi Wi-Fi Control account (AU/NZ)

## Installation

Install `homebridge-airconditioner-mitsubishi-au-nz-v2` from the Homebridge UI, or via CLI:

```bash
npm install -g homebridge-airconditioner-mitsubishi-au-nz-v2
```

## Configuration

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `user` | string | yes | - | Mitsubishi Wi-Fi Control email |
| `password` | string | yes | - | Mitsubishi Wi-Fi Control password |
| `fanSpeed` | boolean | no | `true` | Fan tile with Auto / Manual and 5 speeds |
| `swingMode` | boolean | no | `false` | Vertical swing on the AC tile |
| `dry` | boolean | no | `false` | Dry mode (Dehumidifier tile) |
| `outdoorTemp` | boolean | no | `false` | Outdoor temperature sensor |
| `airflowH` | boolean | no | `false` | Horizontal swing switch |
| `fanMode` | boolean | no | `false` | Fan-only mode (`WorkMode.FAN`) |
| `pollIntervalSeconds` | integer | no | `30` | Poll interval in seconds (`5` to `300`) |
| `perUnitOverrides` | array | no | - | Per-unit overrides (auto-populated with account units on discovery) |

Wi-Fi module types are mapped from Melview `adaptortype` (for example `mac568` -> `MAC-568IF-E`) and set as the accessory Model.

```json
{
  "platforms": [
    {
      "platform": "MitsubishiAUNZ",
      "name": "MitsubishiAUNZ",
      "user": "user@example.com",
      "password": "yourpassword",
      "fanSpeed": true
    }
  ]
}
```

## Fan Speed Mapping

`Fanv2` exposes `TargetFanState` (`AUTO` / `MANUAL`) alongside `RotationSpeed` in 20% steps:

| HomeKit % | Melview stage | Speed |
|---|---|---|
| 0% / Auto | 0 | Auto |
| 20% | 1 | Low |
| 40% | 2 | Medium-low |
| 60% | 3 | Medium |
| 80% | 5 | Medium-high |
| 100% | 6 | High |

Turning the Fan tile off returns the unit to Auto fan without turning the air conditioner off.

## Development

```bash
npm ci
npm run lint
npm test
```

## Publishing to npm

CI runs lint, build, and tests on every push/PR.

Publish to [npmjs](https://www.npmjs.com/package/homebridge-airconditioner-mitsubishi-au-nz-v2/) by either:
1. Creating a GitHub Release, or
2. Running **Actions -> Publish to npm -> Run workflow**

Setup once:
1. Create an npm Automation access token at https://www.npmjs.com/settings/~/tokens
2. In the GitHub repo: **Settings -> Secrets and variables -> Actions**
3. Add repository secret `NPM_TOKEN` with that token value

The publish workflow uses `npm publish --access public --provenance`.

## Credits

- [aurc/melview-mitsubishi-au-nz](https://github.com/aurc/melview-mitsubishi-au-nz)
- [NovaGL/diy-melview](https://github.com/NovaGL/diy-melview)
