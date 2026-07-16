import { createClient, type Client } from "@libsql/client";
import fs from "fs";
import path from "path";

let client: Client | null = null;

function databasePath(): string {
  if (process.env.DATABASE_PATH?.trim()) {
    return process.env.DATABASE_PATH.trim();
  }
  if (process.env.VERCEL) {
    return "/tmp/ciab.sqlite";
  }
  return path.join(process.cwd(), "data", "ciab.sqlite");
}

function databaseUrl(): string {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) return tursoUrl;
  const filePath = databasePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return `file:${filePath}`;
}

async function initSchema(db: Client) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS annual_calendars (
      year INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      parsed_at TEXT NOT NULL,
      source TEXT NOT NULL,
      source_file_name TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS slack_thread_workflows (
      channel TEXT NOT NULL,
      thread_ts TEXT NOT NULL,
      workflow_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (channel, thread_ts)
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS slack_calendar_waits (
      workflow_id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      thread_ts TEXT NOT NULL,
      box_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export async function getDb(): Promise<Client> {
  if (client) return client;

  client = createClient({
    url: databaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  await initSchema(client);
  return client;
}
