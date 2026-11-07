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
- **Vertical airflow swing** — Optional on supported models; enable with `swingMode: true` (disabled by default for reliability)

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

- [Homebridge](https://homebridge.io/) v1.8.0 or later (Homebridge v2 fully supported)
- Node.js ^22.12.0 or ^24 or ^26
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
| `user` | string | yes | - | Mitsubishi Wi-Fi Control email |
| `password` | string | yes | - | Mitsubishi Wi-Fi Control password |
| `fanSpeed` | boolean | no | `true` | Fan tile with Auto / Manual and 5 speeds |
| `swingMode` | boolean | no | `false` | Vertical swing on the AC tile |
| `dry` | boolean | no | `false` | Dry mode (Dehumidifier tile) |
| `outdoorTemp` | boolean | no | `false` | Outdoor temperature sensor |
| `airflowH` | boolean | no | `false` | Horizontal swing switch |
| `fanMode` | boolean | no | `false` | Fan-only mode (`WorkMode.FAN`) |
| `pollIntervalSeconds` | integer | no | `30` | Melview poll interval (`5` to `300`) |
| `perUnitOverrides` | array | no | - | Per-unit overrides keyed by `unitId` (auto-populated on discovery) |

Wi-Fi modules are detected from Melview `adaptortype` (for example `mac568` to `MAC-568IF-E`) and set as the accessory Model.

### Example `config.json`

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

## HomeKit Services

Each AC unit exposes two focused HomeKit services by default:
1. **HeaterCooler** (power, Auto / Heat / Cool, target and current temperatures in °C, fault status)
2. **Fan (`Fanv2`)** with native **Auto / Manual** (`TargetFanState`) plus a 5-stage speed slider (`20%` to `100%`) that adjusts fan speed in whichever mode the AC is running in

Why Fan is a `Fanv2` instead of `RotationSpeed` on `HeaterCooler`: in Apple Home, dragging a `HeaterCooler` speed slider to `0%` turns the whole unit off, and `HeaterCooler` has no `TargetFanState` Auto button. `Fanv2` gives a real **Auto** toggle and lets you step up/down from there.

Extra tiles (Dry dehumidifier, Outdoor sensor, Horizontal swing switch, Fan-only mode) stay off unless enabled.

### Heater / Cooler

- Active (power)
- Current / target state (auto / heat / cool)
- Current and threshold temperatures (°C)
- Status fault when offline or unit fault
- Vertical swing when `swingMode` is enabled

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

### Outdoor temperature

Linked **Outdoor** temperature sensor on the same accessory when Melview reports
`hasoutdoortemp` (or `outdoorTemp` is forced on in manual mode).

Health/offline state stays on the main tile via `StatusFault`.

### Dry mode

Linked **Dry** (Humidifier/Dehumidifier) service for units with `hasdrymode`. Turning
it Active powers the unit into Melview dry mode. In `capabilityMode: auto` this is
enabled automatically.

### Fan-only mode

Linked **Fan** service. Activating it runs Melview fan-only mode. Enabled automatically
in `capabilityMode: auto`.

### Fan speed control

On the **main HeaterCooler card** when auto mode detects fan stages (or when
`fanSpeed` / `fanSpeedOnMainTile` are set). See the mapping table above.

A 5-second startup guard ignores HomeKit RotationSpeed writes after bridge reconnect
to reduce cached-value fan-speed jumps.

### Horizontal airflow swing

Linked **Horizontal Swing** switch when Melview reports `hasairdirh` (or `airflowH`
is forced on). ON = left–right sweep; OFF = centre.

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
- **Node ≥ 22.12 required** — Homebridge v2 and this plugin require Node.js 22.12+,
  24, or 26. Node 18 and 20 are no longer supported.

## Credits

- Original plugin: [aurc/melview-mitsubishi-au-nz](https://github.com/aurc/melview-mitsubishi-au-nz)
- Protocol reverse engineering: [NovaGL/diy-melview](https://github.com/NovaGL/diy-melview)
- [Homebridge](https://homebridge.io/) and the [plugin template](https://github.com/homebridge/homebridge-plugin-template)