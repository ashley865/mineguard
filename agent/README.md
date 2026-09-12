# MineGuard Sensor Agent

Collects readings from sensors on the mine's own network and pushes them to MineGuard.

## Why this exists

The MineGuard API is cloud-hosted. It has no network route to a sensor sitting on
`192.168.x.x` inside the mine, and Modbus TCP and SNMP are LAN protocols that should not be
exposed to the internet just to make them reachable.

This agent solves both: it runs *inside* the network, reads the instruments locally, and
pushes the values up. All traffic is **outbound** from the mine, so it needs no inbound
firewall rule, no port forwarding, and no VPN.

```
  sensors (HTTP / Modbus TCP / SNMP)
        ↑ polled locally
   [ this agent ]  ── outbound HTTPS ──▶  MineGuard API
```

Sensors that can already reach the internet on their own don't need this — point them at
the push endpoint, or let the server poll them directly (HTTP only).

## Requirements

- Node.js 18 or newer
- A machine that stays on and can reach both the sensors and the internet — an existing
  SCADA box, a small PC, or a Raspberry Pi is plenty
- An agent key from MineGuard (Cyber Command Center → Sensor Provisioning → Agents)

## Install

```bash
cd agent
npm install
```

## Run

```bash
MINEGUARD_API_URL=https://your-api.onrender.com \
MINEGUARD_AGENT_KEY=mga_your_key_here \
node index.js
```

On Windows PowerShell:

```powershell
$env:MINEGUARD_API_URL = "https://your-api.onrender.com"
$env:MINEGUARD_AGENT_KEY = "mga_your_key_here"
node index.js
```

### Settings

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `MINEGUARD_API_URL` | yes | — | Base URL of the MineGuard API |
| `MINEGUARD_AGENT_KEY` | yes | — | The agent key issued in MineGuard |
| `MINEGUARD_TICK_SECONDS` | no | `10` | How often the agent checks which sensors are due |
| `MINEGUARD_REFRESH_SECONDS` | no | `300` | How often it re-reads its sensor list from MineGuard |
| `MINEGUARD_READ_TIMEOUT_SECONDS` | no | `8` | Per-sensor read timeout |

You do **not** configure sensors here. The agent asks MineGuard what to collect, so sensors
are added, re-addressed and retired from the web UI without touching this machine. A sensor
added in MineGuard starts being collected within `MINEGUARD_REFRESH_SECONDS`.

## Keeping it running

The agent is a plain long-running Node process — use whatever the host already has.

**systemd** (`/etc/systemd/system/mineguard-agent.service`):

```ini
[Unit]
Description=MineGuard Sensor Agent
After=network-online.target

[Service]
WorkingDirectory=/opt/mineguard/agent
Environment=MINEGUARD_API_URL=https://your-api.onrender.com
Environment=MINEGUARD_AGENT_KEY=mga_your_key_here
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now mineguard-agent
```

**Windows**: run it under [NSSM](https://nssm.cc/) or Task Scheduler set to "run whether
user is logged on or not", with the two environment variables set on the service.

## Per-protocol configuration

All of this is entered in MineGuard against each sensor, not here. It's documented so
whoever fills it in knows what the fields mean.

### HTTP / JSON

| Field | Example | Notes |
| --- | --- | --- |
| Target | `http://192.168.10.42/api/reading` | The URL to call |
| `jsonPath` | `data.value` | Dotted path to the number. Omit if the body *is* the number. Array indices work: `readings.0.v` |
| Method | `GET` or `POST` | Most instrument endpoints are GET; a software or AI API that needs a query body is usually POST |
| Body | `{"query": "latest"}` | Sent as the POST body when Method is POST |
| Extra headers | `X-Model-Version: 2` | Static headers beyond Accept and the authentication header, one per line |
| Authentication | API key header / Bearer token / Basic auth | For endpoints that require a credential — a real software or AI API almost always does, a plain instrument usually doesn't. The credential itself is entered in MineGuard and never touches this machine's configuration; it arrives already turned into the right header each time this agent asks for its target list. |

### Modbus TCP

| Field | Example | Notes |
| --- | --- | --- |
| Target | `192.168.10.50:502` | Port defaults to 502 |
| `unitId` | `1` | Slave/unit id |
| `register` | `40001` | Register address |
| `registerType` | `HOLDING` | or `INPUT` |
| `wordCount` | `1` | `2` for a 32-bit value across two registers, high word first |
| `scale` | `0.1` | Multiplier. Instruments usually send scaled integers — `234` meaning `23.4` |

### SNMP

| Field | Example | Notes |
| --- | --- | --- |
| Target | `192.168.10.60` | Host or IP |
| `oid` | `1.3.6.1.4.1.1.2.1` | Numeric OID to GET |
| `community` | `public` | Community string |
| `version` | `v2c` | or `v1` |
| `scale` | `1` | Multiplier |

## Checking it works

The agent logs each cycle:

```
[2026-09-08T10:00:00.000Z] INFO MineGuard sensor agent 1.0.0 starting against https://...
[2026-09-08T10:00:01.000Z] INFO Collecting 4 sensor(s) as agent "Shaft 2 Collector"
[2026-09-08T10:00:11.000Z] INFO Pushed 4 reading(s), 4 accepted
```

In MineGuard, the Sensor Provisioning tab shows each sensor's last check-in and, when a read
fails, the reason. Failures are pushed up deliberately — a sensor that can't be read shows
as failing rather than merely quiet, which is the difference between a known problem and an
unnoticed one.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Agent key was rejected` | Wrong or revoked key — reissue it in MineGuard and restart |
| `Collecting 0 sensor(s)` | No sensors assigned to this agent, or their polling is disabled |
| `Request timed out` on one sensor | Instrument unreachable from this host — check with `ping`/`curl` from the agent machine, not your laptop |
| `No numeric value at "..."` | The `jsonPath` doesn't match the response shape |
| `readings rejected ... does not own` | The sensor was reassigned to a different agent; it clears on the next refresh |
