
<p align="center">

<img src="https://github.com/aurc/melview-mitsubishi-au-nz/raw/master/assets/Logo.png">

</p>

# Homebridge Melview AU/NZ Airconditioners

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

[![npm](https://img.shields.io/npm/v/homebridge-airconditioner-mitsubishi-au-nz/latest?label=latest)](https://www.npmjs.com/package/homebridge-airconditioner-mitsubishi-au-nz)
[![GitHub release](https://img.shields.io/github/release/aurc/melview-mitsubishi-au-nz.svg)](https://github.com/aurc/melview-mitsubishi-au-nz/releases)
[![npm](https://img.shields.io/npm/dt/homebridge-airconditioner-mitsubishi-au-nz)](https://www.npmjs.com/package/homebridge-airconditioner-mitsubishi-au-nz)

[![Github CI](https://github.com/aurc/melview-mitsubishi-au-nz/actions/workflows/build.yml/badge.svg)](https://github.com/aurc/melview-mitsubishi-au-nz/actions)
[![Github CD](https://github.com/aurc/melview-mitsubishi-au-nz/actions/workflows/release.yml/badge.svg)](https://github.com/aurc/melview-mitsubishi-au-nz/actions)
[![Hex.pm](https://img.shields.io/hexpm/l/plug)](https://www.apache.org/licenses/LICENSE-2.0)

Control your Mitsubishi Electric air conditioner through Apple HomeKit using Homebridge
and your existing Mitsubishi Wi-Fi Control account.

## Features

All units (standard):
- **Power** — ON / OFF
- **Mode** — Auto / Heat / Cool
- **Target temperature** — Set independently for heating and cooling modes
- **Current temperature** — Live room temperature readings
- **Fan speed** — Auto, Low, Medium-low, Medium, Medium-high, High (6 discrete stages mapped to 0–100%)
- **Vertical airflow swing** — Enabled automatically on supported models (swing vs. fixed position)

Optional / model-dependent:
- **Dry (dehumidifier) mode** — Exposed as a separate Dehumidifier accessory, with independent fan speed control
- **Fan-only mode** — Exposed as a separate Fan accessory; circulates air without heating or cooling
- **Horizontal airflow swing** — Exposed as a Switch accessory on models with a horizontal louvre motor

### Dual-path command delivery

Commands are sent via the **Melview cloud API** and, where a LAN IP is available, also
sent simultaneously to the unit's local Wi-Fi interface. This means the unit responds
faster than cloud-only integrations (no visible lag in the Home app) while still
working correctly when you're away from home.

## Compatibility

Any Mitsubishi Electric unit that works with the
[Mitsubishi Wi-Fi Control app](https://apps.apple.com/au/app/mitsubishi-wi-fi-control/id796225889)
is supported. Tested against:

| Model | Wi-Fi Module |
|---|---|
| [MSZ-GL71VGD](https://www.mitsubishielectric.com.au/assets/LEG/JG79A991H01-UM.pdf) | [MAC-568IF-E](https://www.mitsubishielectric.com.au/assets/LEG/MAC-568IF-E.pdf) |
| [MSZ-GL35VGD](https://www.mitsubishielectric.com.au/assets/LEG/JG79A991H01-UM.pdf) | [MAC-568IF-E](https://www.mitsubishielectric.com.au/assets/LEG/MAC-568IF-E.pdf) |
| [MSZ-AP25VGD](https://www.mitsubishielectric.com.au/assets/LEG/MSZ-AP-User-Manual-JG79Y333H01.pdf) | [MAC-568IF-E](https://www.mitsubishielectric.com.au/assets/LEG/MAC-568IF-E.pdf) |

## Requirements

- [Homebridge](https://homebridge.io/) v1.3.0 or later
- Node.js 18.15.0 or later
- An active Mitsubishi Wi-Fi Control account

## Installation

### Homebridge UI (recommended)

Search for `homebridge-airconditioner-mitsubishi-au-nz` in the Homebridge plugin
search, install it, then fill in your credentials in the plugin settings screen.

### CLI

```
npm install -g homebridge-airconditioner-mitsubishi-au-nz
```

## Configuration

All configuration is done via the Homebridge UI settings panel or by editing
`config.json` directly.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `user` | string | yes | — | Your Mitsubishi Wi-Fi Control email address |
| `password` | string | yes | — | Your Mitsubishi Wi-Fi Control password |
| `dry` | boolean | no | `false` | Enable Dehumidifier accessory for dry mode |
| `fanMode` | boolean | no | `false` | Enable Fan accessory for fan-only mode |
| `airflowH` | boolean | no | `false` | Enable Switch accessory for horizontal swing |

### Example `config.json`

```json
{
  "platforms": [
    {
      "platform": "MitsubishiAUNZ",
      "user": "user@example.com",
      "password": "yourpassword",
      "dry": true,
      "fanMode": true,
      "airflowH": false
    }
  ]
}
```

## HomeKit Services

Each AC unit is registered as an **Air Conditioner** accessory and can expose up to
four HomeKit services depending on the unit's capabilities and your configuration.

### Heater / Cooler (always present)

The main service. Provides:
- Active (power)
- Current state (idle / heating / cooling)
- Target state (auto / heat / cool)
- Current temperature
- Heating threshold temperature
- Cooling threshold temperature
- Fan speed (rotation speed) — see table below
- Swing mode (vertical) — shown automatically on supported models

### Fan speed mapping

Mitsubishi units have up to five physical fan stages plus an auto mode. These are
mapped to HomeKit's 0–100% rotation speed slider in steps of 20%:

| HomeKit % | Melview fan stage | Label |
|---|---|---|
| 0 % | 0 | Auto |
| 20 % | 1 | Low |
| 40 % | 2 | Medium-low |
| 60 % | 3 | Medium |
| 80 % | 5 | Medium-high |
| 100 % | 6 | High (Turbo) |

The slider is constrained to these values — dragging to any other position snaps to
the nearest valid stage.

### Vertical swing

On units where `hasswing` or `hasairdir` is reported by the API, a **Swing Mode**
toggle appears on the Heater/Cooler service automatically (no config needed):
- **Swing enabled** → continuous up/down sweep
- **Swing disabled** → fixed at top position

### Dehumidifier / Dry mode (`dry: true`)

When enabled, a **Humidifier / Dehumidifier** accessory is added for units that report
`hasdrymode` in their capabilities. It provides:
- Active (power, forces DRY mode on activation)
- Fan speed (shares the same fan speed slider)

This mode dehumidifies the room without the full heating/cooling cycle.

### Fan-only mode (`fanMode: true`)

When enabled, a **Fan** accessory is added. Activating it powers the unit in fan-only
mode (circulates air, no temperature conditioning). Fan speed is controllable
independently.

### Horizontal swing (`airflowH: true`)

When enabled and the unit reports `hasairdirh`, a **Switch** accessory is added:
- **ON** → horizontal louvre sweeps continuously left–right
- **OFF** → louvre returns to centre fixed position

## State polling

The plugin polls each unit's status every **5 seconds** to keep temperature readings
and mode indicators current in the Home app without needing manual refresh.

## Known Issues

- **LAN fallback** — The plugin always authenticates via the Melview cloud. The local
  LAN command is sent as a fast-follower after the cloud acknowledgement but cannot
  function standalone without internet.
- **Dry mode fan speed** — Fan speed changes during dry mode are sent to the unit
  but most models don't visibly acknowledge the stage change while dehumidifying.
- **Node ≥ 18.15 required** — This plugin uses the native `fetch` API introduced in
  Node 18. Earlier versions are not supported.

## Credits

- Protocol reverse engineering: [NovaGL/diy-melview](https://github.com/NovaGL/diy-melview)
- [Homebridge](https://homebridge.io/) and the [plugin template](https://github.com/homebridge/homebridge-plugin-template)

## Questions & Issues

Please open an issue **[here](https://github.com/aurc/melview-mitsubishi-au-nz/issues)**.
