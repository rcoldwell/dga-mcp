# Digital Guitar Archive MCP Server

This MCP (Model Context Protocol) server provides AI assistants with tools to search and retrieve records from the Digital Guitar Archive.

The server is pre-configured to connect to the Digital Guitar Archive API at `https://digitalguitararchive.com/archive/api`.

## Features

The server exposes three tools:

- **search_guitar_archive** - Search for records with full-text search and field-specific filters
- **get_record_details** - Get full details for a specific record by ID
- **list_sources** - List all source libraries (RISM sigla) with record counts

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

Replace `/path/to/mcp/` with the absolute path to your `mcp` folder. For example:

**macOS**:
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

After updating the configuration, **restart Claude Desktop** for the changes to take effect.

## Development

To test the server manually:

```bash
npx ts-node src/mcp-server.ts
```

Note: When running with stdio transport, the server communicates via stdin/stdout and won't produce visible output. The server acts as a proxy to the live production API.

## License

ISC
