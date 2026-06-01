import { Pool, PoolConfig } from 'pg';

const CONNECT_TIMEOUT_MS = 8_000;
const QUERY_TIMEOUT_MS   = 10_000;
const MAX_ROWS           = 5_000;

export interface DbConnectionConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl?: boolean;
}

export interface DbColumn {
    name: string;
    type: string;
}

export interface DbTable {
    schema: string;
    name: string;
    columns: DbColumn[];
}

export interface DbScrapeResult {
    text: string;
    rowCount: number;
    tablesMapped: string[];
}

export interface ColumnMapping {
    table: string;      // "schema.table" or just "table"
    columns: string[];  // column names to include
    labelColumn?: string; // column whose value is used as row title
}

// ── Security guard — only SELECT statements allowed ───────────────────────────

const FORBIDDEN = /^\s*(insert|update|delete|drop|alter|create|truncate|grant|revoke|exec|execute|call)\b/i;

function assertSelectOnly(sql: string) {
    if (FORBIDDEN.test(sql)) {
        throw new Error('Only SELECT statements are allowed in read-only connectors');
    }
}

// ── Connection pool (short-lived, one per call) ───────────────────────────────

function buildPool(config: DbConnectionConfig): Pool {
    const poolConfig: PoolConfig = {
        host:             config.host,
        port:             config.port,
        user:             config.user,
        password:         config.password,
        database:         config.database,
        ssl:              config.ssl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
        idleTimeoutMillis:       5_000,
        max:                     2,
    };
    return new Pool(poolConfig);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Verifies that the credentials are valid and the DB is reachable.
 */
export async function testConnection(config: DbConnectionConfig): Promise<void> {
    const pool = buildPool(config);
    try {
        const client = await pool.connect();
        client.release();
    } finally {
        await pool.end();
    }
}

/**
 * Lists all user tables and their columns (excluding system schemas).
 */
export async function listTables(config: DbConnectionConfig): Promise<DbTable[]> {
    const pool = buildPool(config);
    try {
        const sql = `
            SELECT
                c.table_schema  AS schema,
                c.table_name    AS "table",
                c.column_name   AS "column",
                c.data_type     AS "type"
            FROM information_schema.columns c
            JOIN information_schema.tables t
              ON t.table_schema = c.table_schema
             AND t.table_name   = c.table_name
            WHERE t.table_type  = 'BASE TABLE'
              AND c.table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
            ORDER BY c.table_schema, c.table_name, c.ordinal_position
        `;
        assertSelectOnly(sql);
        const { rows } = await pool.query({ text: sql, rowMode: 'array' });

        const map = new Map<string, DbTable>();
        for (const [schema, table, column, type] of rows) {
            const key = `${schema}.${table}`;
            if (!map.has(key)) map.set(key, { schema, name: table, columns: [] });
            map.get(key)!.columns.push({ name: column, type });
        }
        return [...map.values()];
    } finally {
        await pool.end();
    }
}

/**
 * Reads the mapped columns from the DB and converts them to plain text for RAG indexing.
 * Each row becomes a text paragraph.
 */
export async function scrapeDbColumns(
    config: DbConnectionConfig,
    mappings: ColumnMapping[],
): Promise<DbScrapeResult> {
    const pool = buildPool(config);
    const parts: string[] = [];
    const tablesMapped: string[] = [];
    let totalRows = 0;

    try {
        for (const mapping of mappings) {
            const cols = mapping.columns.map(c => `"${c}"`).join(', ');
            const sql = `SELECT ${cols} FROM ${mapping.table} LIMIT ${MAX_ROWS}`;
            assertSelectOnly(sql);

            const result = await pool.query(sql);
            tablesMapped.push(mapping.table);
            totalRows += result.rows.length;

            for (const row of result.rows) {
                const label = mapping.labelColumn ? `${row[mapping.labelColumn]}: ` : '';
                const values = mapping.columns
                    .filter(c => c !== mapping.labelColumn)
                    .map(c => {
                        const v = row[c];
                        if (v === null || v === undefined) return null;
                        return `${c}: ${v}`;
                    })
                    .filter(Boolean)
                    .join(' | ');

                if (label || values) {
                    parts.push(`${label}${values}`);
                }
            }
        }
    } finally {
        await pool.end();
    }

    return {
        text: parts.join('\n'),
        rowCount: totalRows,
        tablesMapped,
    };
}
