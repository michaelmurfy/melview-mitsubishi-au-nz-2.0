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
- **Outdoor temperature** — Live outdoor unit temperature, exposed as a separate Temperature Sensor tile (optional, enable with `outdoorTemp: true`)
- **Vertical airflow swing** — Enabled automatically on supported models (swing vs. fixed position)

Optional / model-dependent:
- **Fan speed** — Auto, Low, Medium-low, Medium, Medium-high, High (6 discrete stages mapped to 0–100%)
- **Dry (dehumidifier) mode** — Exposed as a separate Dehumidifier accessory, with independent fan speed control
- **Fan-only mode** — Exposed as a separate Fan accessory; circulates air without heating or cooling
- **Horizontal airflow swing** — Exposed as a Switch accessory on models with a horizontal louvre motor
- **Fault sensor** — Exposed as a Contact Sensor accessory when fault reporting is enabled

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
| `airflowH` | boolean | no | `false` | Enable Switch accessory for horizontal swing |
| `fanSpeed` | boolean | no | `false` | *(experimental)* Enable fan speed slider on a separate Fan accessory (auto-added) |
| `fanSpeedOnMainTile` | boolean | no | `false` | *(advanced)* Also show fan speed slider on the main AC tile (requires `fanSpeed: true`) |
| `outdoorTemp` | boolean | no | `false` | Enable outdoor temperature sensor (when reported by the unit) |
| `showFaultSensor` | boolean | no | `false` | Add a Contact Sensor accessory for unit fault status |
| `pollIntervalSeconds` | integer | no | `5` | State polling interval in seconds (range `5` to `300`) |

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
      "airflowH": false,
      "fanSpeed": false,
      "fanSpeedOnMainTile": false,
      "outdoorTemp": false,
      "showFaultSensor": false,
      "pollIntervalSeconds": 5
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

### Outdoor Temperature Sensor (`outdoorTemp: true`)

When enabled, a read-only **Temperature Sensor** tile is added alongside the main
Heater/Cooler accessory showing the live outdoor unit temperature. The sensor is
only registered when the Melview API returns a numeric value for that unit — if your
unit does not report outdoor temperature it is silently skipped even when the option
is on.

### Fault Sensor (`showFaultSensor: true`)

When enabled, a **Contact Sensor** tile is added to represent fault state from the
Melview payload:
- **Detected / Open** → fault currently reported
- **Not detected / Closed** → normal

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

### Horizontal swing (`airflowH: true`)

When enabled and the unit reports `hasairdirh`, a **Switch** accessory is added:
- **ON** → horizontal louvre sweeps continuously left–right
- **OFF** → louvre returns to centre fixed position

## State polling

The plugin polls each unit's status every **5 seconds** by default (configurable via
`pollIntervalSeconds`, from 5 to 300) to keep readings and mode indicators current
in the Home app without needing manual refresh.

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