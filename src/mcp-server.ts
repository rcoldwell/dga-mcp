import "dotenv/config";
import { FastMCP } from "fastmcp";
import { z } from "zod";

const apiUrl = process.env.API_URL || "https://digitalguitararchive.com/archive/api";
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || "15000", 10);

const mcp = new FastMCP({
    name: "GuitarArchiveAPI",
    version: "1.2.0"
});

// Helper to call the API with a configurable timeout
async function apiCall(endpoint: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${apiUrl}${endpoint}`, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

// Mapping of Local ID values to human-readable collection names.
// The "Source" field is a RISM library sigla, but many collections are not
// libraries (private holdings, journals). The "Local ID" column carries the
// actual collection identifier; this map resolves it to a readable name.
const COLLECTION_NAMES: Record<string, string> = {
    etude: "The Etude - music journal 1930-1943 (text)",
    ribs: "Rischel & Birket-Smith - Royal Library of Denmark",
    fvg: "Freie Vereinigung - Augsburg State Library",
    krick_colo: "Krick - University of Colorado, Boulder",
    krick_wash: "Krick - Washington University",
    nakano: "Nakano - Doshisha University",
    boije: "Boije - Music Library of Sweden",
    hudleston: "Hudleston - Royal Irish Academy of Music",
    loc_nation: "Music for the Nation - Library of Congress",
    loc_edison: "Historic Sheet Music - Library of Congress",
    levy: "Levy - Johns Hopkins University",
    gam: "Gitarristisches Archiv - Munich State Library",
    gfa: "GFA Archive - Guitar Foundation of America",
    ricca: "Luigi Ricca - Comune di Codogno",
    Ricordi: "Catalogo Numerico Ricordi",
    seville: "Seville - Conservatorio Superior de Música Manuel Castillo",
    sparr: "Kenneth Sparr - Private Collection",
    swingle: "Mary Belle Swingle - Yale University",
    coldwell: "Vorhauer Collection",
    "Walter-Wiedemann": "Gitarristische Sammlung Fritz Walter und Gabriele Wiedemann",
    scheit: "Scheit Archive"
};

// Resolve a Local ID to a human-readable collection name.
// Returns null when the Local ID is empty or unknown. Matching falls back to
// case-insensitive, since DB values may vary in case.
function resolveCollectionName(localId: unknown): string | null {
    if (localId === null || localId === undefined) return null;
    const key = String(localId).trim();
    if (key === "") return null;
    if (COLLECTION_NAMES[key]) return COLLECTION_NAMES[key];
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(COLLECTION_NAMES)) {
        if (k.toLowerCase() === lower) return v;
    }
    return null;
}

// Helper to format a list of search/browse results
function formatRecordList(data: any, offset: number): string {
    const total = data.total ?? 0;
    const results = data.results ?? [];

    if (results.length === 0) {
        return total === 0
            ? "No records found matching criteria."
            : `No records returned for offset ${offset} (total: ${total}).`;
    }

    const showingFrom = offset + 1;
    const showingTo = Math.min(offset + results.length, total);

    const output = [`Found ${total} records (showing ${showingFrom}–${showingTo}):`];
    for (const r of results) {
        const source = r.source || "unknown";
        const collection = resolveCollectionName(r.local_ID);
        const suffix = collection ? ` — ${collection}` : "";
        output.push(
            `- [ID: ${r.id}] ${r.title} by ${r.author} (${r.publish_date || "n.d."}) [${source}${suffix}]`
        );
    }

    return output.join("\n");
}

// Tool: Search the archive
mcp.addTool({
    name: "search_guitar_archive",
    description:
        "Search the Digital Guitar Archive for records. Supports full-text search, field-specific filters, and pagination.",
    parameters: z.object({
        q: z.string().optional().describe("Full text search across all fields"),
        title: z.string().optional().describe("Search by title only"),
        author: z.string().optional().describe("Search by author only"),
        source: z.string().optional().describe("Filter by source/library (RISM sigla, e.g. US:Wc)"),
        publisher: z.string().optional().describe("Search by publisher"),
        limit: z
            .number()
            .min(1)
            .max(100)
            .default(10)
            .describe("Max results to return (default 10, max 100)"),
        offset: z.number().min(0).default(0).describe("Offset for pagination (default 0)")
    }),
    execute: async (args) => {
        const params = new URLSearchParams();
        if (args.q) params.append("q", args.q);
        if (args.title) params.append("title", args.title);
        if (args.author) params.append("author", args.author);
        if (args.source) params.append("source", args.source);
        if (args.publisher) params.append("publisher", args.publisher);
        params.append("limit", String(args.limit));
        params.append("offset", String(args.offset));

        try {
            const data = await apiCall(`/search?${params.toString()}`);
            return formatRecordList(data, args.offset);
        } catch (error) {
            throw new Error(`API error: ${error}`);
        }
    }
});

// Tool: Browse records by source library
mcp.addTool({
    name: "browse_by_source",
    description:
        "Browse records from a specific source library by its RISM sigla. Supports pagination.",
    parameters: z.object({
        source: z.string().describe("RISM sigla of the source library (e.g. US:Wc)"),
        limit: z
            .number()
            .min(1)
            .max(100)
            .default(10)
            .describe("Max results to return (default 10, max 100)"),
        offset: z.number().min(0).default(0).describe("Offset for pagination (default 0)")
    }),
    execute: async (args) => {
        const params = new URLSearchParams();
        params.append("source", args.source);
        params.append("limit", String(args.limit));
        params.append("offset", String(args.offset));

        try {
            const data = await apiCall(`/search?${params.toString()}`);
            return formatRecordList(data, args.offset);
        } catch (error) {
            throw new Error(`API error: ${error}`);
        }
    }
});

// Tool: Get full details for a specific record
mcp.addTool({
    name: "get_record_details",
    description: "Get full bibliographic details for a specific record by its ID",
    parameters: z.object({
        record_id: z.number().describe("The ID of the record to retrieve")
    }),
    execute: async (args) => {
        try {
            const r = await apiCall(`/record/${args.record_id}`);

            if (!r || r.error) {
                return `Record ID ${args.record_id} not found.`;
            }

            const fields: [string, any][] = [
                ["ID", r.id],
                ["Title", r.title],
                ["Other Title", r.other_title],
                ["Author", r.author],
                ["Other Author", r.other_author],
                ["Publisher", r.publisher],
                ["Publish Location", r.publish_location],
                ["Date", r.publish_date],
                ["Opus", r.opus],
                ["Pages", r.pages],
                ["Format", r.format],
                ["Instruments", r.instruments],
                ["Language", r.language],
                ["Contents", r.contents],
                ["Plate Number", r.plate_number],
                ["ISBN", r.ISBN],
                ["Printer", r.printer],
                ["Printer Location", r.printer_location],
                ["Edition", r.edition],
                ["Series Title", r.series_title],
                ["Series Number", r.series_number],
                ["Volume Title", r.volume_title],
                ["Volume Number", r.volume_number],
                ["Source", r.source],
                ["Source ID", r.source_ID],
                ["Source Call", r.source_Call],
                ["Local ID", r.local_ID],
                ["Collection", resolveCollectionName(r.local_ID)],
                ["Source Notes 1", r.source_notes1],
                ["Source Notes 2", r.source_notes2],
                ["Source Notes 3", r.source_notes3],
                ["Local Notes", r.local_notes],
                ["Digital File", r.digital_file],
                ["Images Thumb", r.images_thumb],
                ["Images Full", r.images_full],
                ["Audio File", r.audio_file],
                ["Timestamp", r.timestamp]
            ];

            const details = fields
                .filter(([, val]) => val !== null && val !== undefined && String(val).trim() !== "")
                .map(([label, val]) => `${label}: ${val}`);

            return details.join("\n");
        } catch (error) {
            throw new Error(`API error: ${error}`);
        }
    }
});

// Tool: List all sources/libraries
mcp.addTool({
    name: "list_sources",
    description:
        "Get a list of all source libraries (RISM sigla) in the archive with record counts and location info",
    parameters: z.object({}),
    execute: async () => {
        try {
            const data = await apiCall("/sources");

            if (!data.sources || data.sources.length === 0) {
                return "No sources found.";
            }

            const output = [`Found ${data.total} sources:`];
            for (const r of data.sources) {
                const location = r.name ? `${r.name}, ${r.country}` : "Unknown location";
                output.push(`- ${r.source}: ${location} (${r.record_count} records)`);
            }

            return output.join("\n");
        } catch (error) {
            throw new Error(`API error: ${error}`);
        }
    }
});

// Tool: List known collections (Local ID → collection name)
mcp.addTool({
    name: "list_collections",
    description:
        "List the known collections in the archive, mapping each Local ID to its human-readable collection name and institution. Use this to interpret the Local ID field in record details: many collections are private holdings or journals rather than RISM library sigla, so the Source field alone does not identify them.",
    parameters: z.object({}),
    execute: async () => {
        const entries = Object.entries(COLLECTION_NAMES);
        const output = [`Found ${entries.length} known collections:`];
        for (const [id, name] of entries) {
            output.push(`- ${id}: ${name}`);
        }
        return output.join("\n");
    }
});

// Prompt: Guided research workflow
mcp.addPrompt({
    name: "research_library_collection",
    description:
        "Guided workflow to research guitar repertoire from a specific library or collection",
    arguments: [
        {
            name: "library",
            description: "RISM sigla or library name to research (leave empty to explore all sources)",
            required: false
        }
    ],
    load: async (args) => {
        const libraryHint = args.library ? ` from ${args.library}` : "";
        return {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `I'd like to research guitar archive materials${libraryHint}. Please start by listing available sources if needed, then help me browse or search the collection.`
                    }
                }
            ]
        };
    }
});

// Resource template: Direct record access by URI
mcp.addResourceTemplate({
    name: "archive_record",
    uriTemplate: "archive://record/{id}",
    arguments: [{ name: "id", description: "Record ID", required: true }],
    mimeType: "application/json",
    description: "Direct access to a single archive record by ID",
    load: async (args) => {
        const record = await apiCall(`/record/${args.id}`);
        return {
            text: JSON.stringify(record, null, 2),
            mimeType: "application/json"
        };
    }
});

mcp.start({
    transportType: "stdio"
});
