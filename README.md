# Digital Guitar Archive MCP Server

This MCP (Model Context Protocol) server provides AI assistants with tools to search, browse, and retrieve records from the Digital Guitar Archive.

The server is pre-configured to connect to the Digital Guitar Archive API at `https://digitalguitararchive.com/archive/api`.

## Features

### Tools

- **search_guitar_archive** — Search for records with full-text search, field-specific filters, and pagination
- **browse_by_source** — Browse records from a specific source library (RISM sigla) with pagination
- **get_record_details** — Get full bibliographic details for a specific record by ID
- **list_sources** — List all source libraries (RISM sigla) with record counts and location info

### Prompts

- **research_library_collection** — Guided workflow to research guitar repertoire from a specific library or collection

### Resources

- **archive://record/{id}** — Direct access to a single archive record by ID

## Configuration

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| `API_URL` | Base URL of the Digital Guitar Archive API | `https://digitalguitararchive.com/archive/api` |
| `REQUEST_TIMEOUT_MS` | Timeout for API requests in milliseconds | `15000` |

## Prerequisites

- Node.js 18+ (with native fetch support)
- npm

## Installation

```bash
cd mcp
npm install
npm run build
```

## Claude Desktop Configuration

Claude Desktop launches the MCP server automatically. Add the following to your configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
    "mcpServers": {
        "guitar-archive": {
            "command": "node",
            "args": ["/path/to/mcp/dist/mcp-server.js"]
        }
    }
}
```

Replace `/path/to/mcp/` with the absolute path to your `mcp` folder.

### With Custom Environment Variables

```json
{
    "mcpServers": {
        "guitar-archive": {
            "command": "node",
            "args": ["/path/to/mcp/dist/mcp-server.js"],
            "env": {
                "REQUEST_TIMEOUT_MS": "30000"
            }
        }
    }
}
```

After updating the configuration, **restart Claude Desktop** for the changes to take effect.

## Development

To test the server manually:

```bash
npx ts-node src/mcp-server.ts
```

Note: When running with stdio transport, the server communicates via stdin/stdout and won't produce visible output. The server acts as a proxy to the live production API.

## Pagination

Search and browse tools support pagination via `limit` (max 100) and `offset` (0-based). The result summary indicates the range of records returned out of the total matching set.

## License

ISC
