# 🚂 rail-cli

[![npm version](https://img.shields.io/npm/v/@shan8851/rail-cli.svg)](https://www.npmjs.com/package/@shan8851/rail-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)

UK National Rail in your terminal. Built for AI agents, still pleasant for humans.

```bash
rail departures KGX                     # Next trains from King's Cross
rail arrivals "leeds"                   # What's arriving at Leeds?
rail departures "edinburgh" --to "york" # Edinburgh trains calling at York
rail search "waterloo"                  # Find stations by name
printf "waterloo\nvictoria\n" | rail search --stdin
rail search "waterloo" --select crs     # Return CRS codes only
```

## Install

```bash
npm install -g @shan8851/rail-cli
```

Or from source:

```bash
git clone https://github.com/shan8851/rail-cli.git
cd rail-cli
npm install && npm run build
npm link
```

## API Key

A free Darwin access token is required for departure and arrival data. Station search works without one.

Register (instant, free): https://realtime.nationalrail.co.uk/OpenLDBWSRegistration/Registration

```bash
export DARWIN_ACCESS_TOKEN=your_token
# or add to .env in your project directory
```

Optionally override the Huxley2 instance URL:

```bash
export RAIL_API_URL=https://your-huxley-instance.example.com
```

## Commands

| Command | What it does |
| --- | --- |
| `rail departures <station>` | Live departure board for any UK station |
| `rail arrivals <station>` | Live arrivals with delays and platforms |
| `rail search <query>` | Find stations by name, get CRS codes |

Supports station names ("kings cross", "leeds") and CRS codes (KGX, LDS, EDB).

### Options

```bash
rail departures KGX --to EDB            # Filter to a destination
rail arrivals "leeds" --from "london"    # Filter from an origin
rail departures KGX --expand             # Include calling points
rail departures KGX --limit 5            # Limit results
rail search "waterloo" --select crs      # Return one field per candidate
printf "waterloo\nvictoria\n" | rail search --stdin
```

## Agent Integration

The CLI defaults to **text in a TTY** and **JSON when piped** — no flag needed.

```bash
rail departures KGX --json               # Explicit JSON
rail search "waterloo" | jq              # Auto-JSON when piped
printf "waterloo\nvictoria\n" | rail search --stdin --json
```

Every response uses a stable envelope:

```json
{
  "ok": true,
  "schemaVersion": "1",
  "command": "departures",
  "requestedAt": "2026-03-24T12:00:00.000Z",
  "data": { ... }
}
```

Errors return `ok: false` with structured `error.code`, `error.message`, and `error.retryable` fields. Exit codes: `0` success, `2` bad input/ambiguity, `3` upstream failure, `4` internal error.

Works with [OpenClaw](https://github.com/openclaw/openclaw), Claude Desktop MCP, or any agent that can shell out.

### Search Ergonomics

`rail search` supports a small projection mode for agents that only need one field:

```bash
rail search "waterloo" --select crs
rail search "waterloo" --select name,crs
```

It also supports newline-delimited batch queries from stdin:

```bash
printf "waterloo\nvictoria\n" | rail search --stdin
printf "waterloo\nvictoria\n" | rail search --stdin --json
```

## Examples

```bash
# Departures from King's Cross
$ rail departures KGX --limit 5
London Kings Cross

13:00  Sunderland       Grand Central              ⚠️ Exp 13:50
13:03  Aberdeen         LNER                       🔴 Delayed
13:10  Leeds            LNER                       ✅ On time
13:15  Cambridge        Great Northern    Plat 8   ✅ On time
13:30  Edinburgh        LNER              Plat 5   ✅ On time

# Find a station
$ rail search "waterloo"
London Waterloo (WAT)
London Waterloo East (WAE)
Waterloo (Merseyside) (WLO)

# Return just CRS codes
$ rail search "waterloo" --select crs
WAT
WAE
WLO

# Batch station search from stdin
$ printf "waterloo\nvictoria\n" | rail search --stdin
Query: waterloo
London Waterloo (WAT)
London Waterloo East (WAE)
Waterloo (Merseyside) (WLO)

Query: victoria
London Victoria (VIC)
Manchester Victoria (MCV)

# Filter departures to a destination
$ rail departures leeds --to london
Leeds

14:00  London Kings Cross  LNER          Plat 11   ✅ On time
14:33  London Kings Cross  LNER                    ⚠️ Exp 14:40
15:00  London Kings Cross  LNER          Plat 11   ✅ On time
```

## Data Source

Powered by [National Rail Darwin](https://www.nationalrail.co.uk/developers/darwin-data-feeds/) via [Huxley2](https://github.com/jpsingleton/Huxley2). Real-time data covering every National Rail station in Great Britain.

## License

MIT
