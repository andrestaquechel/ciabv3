import { getDb } from "@/lib/db/sqlite";

export async function registerSlackThreadWorkflow(
  channel: string,
  threadTs: string,
  workflowId: string,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO slack_thread_workflows (channel, thread_ts, workflow_id, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(channel, thread_ts) DO UPDATE SET
            workflow_id = excluded.workflow_id,
            updated_at = excluded.updated_at`,
    args: [channel, threadTs, workflowId, now],
  });
}

export async function findSlackThreadWorkflowId(
  channel: string,
  threadTs: string,
): Promise<string | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT workflow_id FROM slack_thread_workflows WHERE channel = ? AND thread_ts = ?",
    args: [channel, threadTs],
  });
  const row = result.rows[0];
  return row ? String(row.workflow_id) : null;
}

export async function registerCalendarWait(
  workflowId: string,
  channel: string,
  threadTs: string,
  boxType: "mini-box" | "ciab",
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO slack_calendar_waits (workflow_id, channel, thread_ts, box_type, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(workflow_id) DO UPDATE SET
            channel = excluded.channel,
            thread_ts = excluded.thread_ts,
            box_type = excluded.box_type,
            created_at = excluded.created_at`,
    args: [workflowId, channel, threadTs, boxType, now],
  });
}

export async function clearCalendarWait(workflowId: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM slack_calendar_waits WHERE workflow_id = ?",
    args: [workflowId],
  });
}

export async function findCalendarWaitByThread(
  channel: string,
  threadTs: string,
): Promise<{ workflowId: string; boxType: "mini-box" | "ciab" } | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT workflow_id, box_type FROM slack_calendar_waits
          WHERE channel = ? AND thread_ts = ?
          ORDER BY created_at DESC LIMIT 1`,
    args: [channel, threadTs],
  });
  const row = result.rows[0];
  if (!row) return null;
  const boxType = String(row.box_type);
  if (boxType !== "mini-box" && boxType !== "ciab") return null;
  return { workflowId: String(row.workflow_id), boxType };
}
