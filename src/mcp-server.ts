import { FastMCP } from "fastmcp";
import { z } from "zod";
const apiUrl = 'https://digitalguitararchive.com/archive/api';

const mcp = new FastMCP({
    name: "GuitarArchiveAPI",
    version: "2.0.0"
});

// Helper to call the API
async function apiCall(endpoint: string): Promise<any> {
    const response = await fetch(`${apiUrl}${endpoint}`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

// Tool: Search the archive
mcp.addTool({
    name: "search_guitar_archive",
    description: "Search the Digital Guitar Archive for records. Supports full-text search and field-specific filters.",
    parameters: z.object({
        q: z.string().optional().describe("Full text search across all fields"),
        title: z.string().optional().describe("Search by title only"),
        author: z.string().optional().describe("Search by author only"),
        source: z.string().optional().describe("Filter by source/library (RISM sigla, e.g. US:Wc)"),
        publisher: z.string().optional().describe("Search by publisher"),
        limit: z.number().default(10).describe("Max results to return (default 10)")
    }),
    execute: async (args) => {
        const params = new URLSearchParams();
        if (args.q) params.append('q', args.q);
        if (args.title) params.append('title', args.title);
        if (args.author) params.append('author', args.author);
        if (args.source) params.append('source', args.source);
        if (args.publisher) params.append('publisher', args.publisher);
        params.append('limit', String(args.limit));

        try {
            const data = await apiCall(`/search?${params.toString()}`);

            if (data.results.length === 0) {
                return "No records found matching criteria.";
            }

            const output = [`Found ${data.total} records:`];
            for (const r of data.results) {
                output.push(`- [ID: ${r.id}] ${r.title} by ${r.author} (${r.publish_date || 'n.d.'}) [${r.source || 'unknown'}]`);
            }

            return output.join("\n");
        } catch (error) {
            throw new Error(`API error: ${error}`);
        }
    }
});

// Tool: Get full details for a specific record
mcp.addTool({
    name: "get_record_details",
    description: "Get full details for a specific record by its ID",
    parameters: z.object({
        record_id: z.number().describe("The ID of the record to retrieve")
    }),
    execute: async (args) => {
        try {
            const r = await apiCall(`/record/${args.record_id}`);

            if (r.error) {
                return `Record ID ${args.record_id} not found.`;
            }

            const details = [
                `ID: ${r.id}`,
                `Title: ${r.title}`,
                `Other Title: ${r.other_title || ''}`,
                `Author: ${r.author}`,
                `Other Author: ${r.other_author || ''}`,
                `Publisher: ${r.publisher}`,
                `Publish Location: ${r.publish_location || ''}`,
                `Date: ${r.publish_date || ''}`,
                `Opus: ${r.opus || ''}`,
                `Pages: ${r.pages || ''}`,
                `Format: ${r.format || ''}`,
                `Instruments: ${r.instruments || ''}`,
                `Language: ${r.language || ''}`,
                `Contents: ${r.contents || ''}`,
                `Source: ${r.source || ''}`,
                `Source ID: ${r.source_ID || ''}`,
                `Source Call: ${r.source_call || ''}`,
                `Digital File: ${r.digital_file || ''}`
            ];

            return details.filter(d => !d.endsWith(': ')).join("\n");
        } catch (error) {
            throw new Error(`API error: ${error}`);
        }
    }
});

// Tool: List all sources/libraries
mcp.addTool({
    name: "list_sources",
    description: "Get a list of all source libraries (RISM sigla) in the archive with record counts and location info",
    parameters: z.object({}),
    execute: async () => {
        try {
            const data = await apiCall('/sources');

            if (data.sources.length === 0) {
                return "No sources found.";
            }

            const output = [`Found ${data.total} sources:`];
            for (const r of data.sources) {
                const location = r.name ? `${r.name}, ${r.country}` : 'Unknown location';
                output.push(`- ${r.source}: ${location} (${r.record_count} records)`);
            }

            return output.join("\n");
        } catch (error) {
            throw new Error(`API error: ${error}`);
        }
    }
});

mcp.start({
    transportType: "stdio"
});
