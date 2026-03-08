# Homebridge Melview AU/NZ Airconditioners

> Based on the excellent work of aurc (https://github.com/aurc) who unfortunately has not been active in quite some time hence the partial rewrite for Homebridge 2.0.

Control your Mitsubishi Electric air conditioner through Apple HomeKit using Homebridge
and your existing Mitsubishi Wi-Fi Control account.

## Features

All units (standard):
- **Power** — ON / OFF
- **Mode** — Auto / Heat / Cool
- **Target temperature** — Set independently for heating and cooling modes
- **Current temperature** — Live room temperature readings
- **Issue status** — Integrated on the main tile via `StatusFault` (fault or offline)
- **Outdoor temperature** — Live outdoor unit temperature, exposed as a separate Temperature Sensor tile (optional, enable with `outdoorTemp: true`)
- **Vertical airflow swing** — Enabled automatically on supported models (swing vs. fixed position)

Optional / model-dependent:
- **Fan speed** — Auto, Low, Medium-low, Medium, Medium-high, High (6 discrete stages mapped to 0–100%)
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

- [Homebridge](https://homebridge.io/) v1.6.0 or later (v2.0.0 supported)
- Node.js ^18.20.4 or ^20.15.1 or ^22 or ^24
- An active Mitsubishi Wi-Fi Control account

## Installation

### Homebridge UI (recommended)

Search for `homebridge-airconditioner-mitsubishi-au-nz-v2` in the Homebridge plugin
search, install it, then fill in your credentials in the plugin settings screen.

### CLI

```
npm install -g homebridge-airconditioner-mitsubishi-au-nz-v2
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
| `swingMode` | boolean | no | `false` | Enable vertical airflow swing on the main AC tile. Enable only if needed; some units reject swing commands during power transitions. |
| `airflowH` | boolean | no | `false` | Enable horizontal airflow swing. Horizontal swing is not supported by many units. |
| `fanSpeed` | boolean | no | `false` | *(experimental)* Enable fan speed slider on a separate Fan accessory (auto-added) |
| `fanSpeedOnMainTile` | boolean | no | `false` | *(advanced)* Also show fan speed slider on the main AC tile (requires `fanSpeed: true`) |
| `outdoorTemp` | boolean | no | `false` | Enable outdoor temperature sensor (when reported by the unit) |
| `pollIntervalSeconds` | integer | no | `30` | State polling interval in seconds (range `5` to `300`) |
| `perUnitOverrides` | array | no | — | Optional per-unit override objects keyed by `unitId` |

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
      "swingMode": false,
      "airflowH": false,
      "fanSpeed": false,
      "fanSpeedOnMainTile": false,
      "outdoorTemp": false,
      "pollIntervalSeconds": 30,
      "perUnitOverrides": [
        {
          "unitId": "1234567890",
          "fanSpeed": true,
          "fanSpeedOnMainTile": true,
          "pollIntervalSeconds": 15
        }
      ]
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
- Status fault (`StatusFault`) — shows an issue when the unit reports an error or is offline
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

### Vertical airflow swing (`swingMode: true`)

On units where `hasswing` or `hasairdir` is reported by the API, a **Swing Mode**
toggle can be added to the Heater/Cooler service by setting `swingMode: true`
(disabled by default):
- **Swing enabled** → continuous up/down sweep
- **Swing disabled** → fixed at top position

**Note:** Swing mode control is disabled by default because some units reject swing
commands during power state transitions, which can interfere with tile toggle
reliability. If you don't enable `swingMode` in the config, simply set your unit to
**Auto** swing mode using your physical remote or the Mitsubishi app, and it will
automatically manage vertical airflow without HomeKit involvement.

### Outdoor Temperature Sensor (`outdoorTemp: true`)

When enabled, a read-only **Temperature Sensor** tile is added alongside the main
Heater/Cooler accessory showing the live outdoor unit temperature. The sensor is
only registered when the Melview API returns a numeric value for that unit — if your
unit does not report outdoor temperature it is silently skipped even when the option
is on.

Health/offline state is integrated into the main **Air Conditioner** tile via
`StatusFault` instead of a separate health accessory tile.

### Dehumidifier / Dry mode (`dry: true`)

When enabled, a **Humidifier / Dehumidifier** accessory is added for units that report
`hasdrymode` in their capabilities. It provides:
- Active (power, forces DRY mode on activation)
- Fan speed (shares the same fan speed slider)

This mode dehumidifies the room without the full heating/cooling cycle.

### Fan-only mode (`fanMode: true`)

When enabled, a **Fan** accessory is added. Activating it powers the unit in fan-only
mode (circulates air, no temperature conditioning).

### Fan speed control (`fanSpeed: true`, experimental)

Disabled by default. When enabled, a fan speed slider (Auto / Low / Medium / High)
appears on a separate **Fan** service, which is added automatically even if
`fanMode` is left disabled.

To also show fan speed on the main **Air Conditioner** tile, set:
- `fanSpeed: true`
- `fanSpeedOnMainTile: true`

> **Note:** Due to the way HomeKit caches characteristic values, enabling fan speed
> can cause the unit to briefly jump to a high fan stage on startup. The plugin
> includes a 5-second startup guard that ignores incoming set commands during
> bridge reconnect, which mitigates but may not fully eliminate this behaviour on
> all controllers.

### Horizontal airflow swing (`airflowH: true`)

When enabled and the unit reports `hasairdirh`, a **Switch** accessory is added:
- **ON** → horizontal louvre sweeps continuously left–right
- **OFF** → louvre returns to centre fixed position

Horizontal airflow swing is not supported by many Mitsubishi units, so this option
may not appear even when enabled.

## State polling

The plugin polls each unit's status every **30 seconds** by default (configurable via
`pollIntervalSeconds`, from 5 to 300) to keep readings and mode indicators current
in the Home app without needing manual refresh.

### Per-unit overrides (`perUnitOverrides`)

Use `perUnitOverrides` to apply different options per unit ID (for example, enabling
fan speed only in one room, or polling one critical unit more frequently).

Each override object supports these optional keys:
- `dry`
- `fanMode`
- `airflowH`
- `fanSpeed`
- `fanSpeedOnMainTile`
- `outdoorTemp`
- `pollIntervalSeconds`

## Known Issues

- **LAN fallback** — The plugin always authenticates via the Melview cloud. The local
  LAN command is sent as a fast-follower after the cloud acknowledgement but cannot
  function standalone without internet.
- **Dry mode fan speed** — Fan speed changes during dry mode are sent to the unit
  but most models don't visibly acknowledge the stage change while dehumidifying.
- **Node ≥ 18.15 required** — This plugin uses the native `fetch` API introduced in
  Node 18. Earlier versions are not supported.

## Credits

- Original plugin: [aurc/melview-mitsubishi-au-nz](https://github.com/aurc/melview-mitsubishi-au-nz)
- Protocol reverse engineering: [NovaGL/diy-melview](https://github.com/NovaGL/diy-melview)
- [Homebridge](https://homebridge.io/) and the [plugin template](https://github.com/homebridge/homebridge-plugin-template)