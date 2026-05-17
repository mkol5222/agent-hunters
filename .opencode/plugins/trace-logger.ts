import type { Plugin } from "@opencode-ai/plugin"
import { Database } from "bun:sqlite"
import path from "path"

const db = new Database(path.join(process.cwd(), "opencode-trace.db"))

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    agent TEXT,
    role TEXT,
    content TEXT,
    ts TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    call_id TEXT,
    tool_name TEXT NOT NULL,
    input TEXT,
    output TEXT,
    ts TEXT DEFAULT (datetime('now'))
  );
`)

const insertMsg = db.prepare(
  "INSERT INTO messages (session_id, agent, role, content) VALUES (?, ?, ?, ?)"
)
const insertToolBefore = db.prepare(
  "INSERT INTO tool_calls (session_id, call_id, tool_name, input) VALUES (?, ?, ?, ?)"
)
const insertToolAfter = db.prepare(
  "INSERT INTO tool_calls (session_id, call_id, tool_name, input, output) VALUES (?, ?, ?, ?, ?)"
)

export const TraceLogger: Plugin = async () => {
  return {
    "chat.message": async (
      input: { sessionID: string; agent?: string },
      output: { message: { role: string; content?: string }; parts: any[] }
    ) => {
      insertMsg.run(
        input.sessionID,
        input.agent ?? null,
        output.message.role,
        typeof output.message.content === "string"
          ? output.message.content
          : JSON.stringify(output.parts)
      )
    },

    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: any }
    ) => {
      insertToolBefore.run(
        input.sessionID,
        input.callID,
        input.tool,
        JSON.stringify(output.args)
      )
    },

    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string; args: any },
      output: { title: string; output: string; metadata: any }
    ) => {
      insertToolAfter.run(
        input.sessionID,
        input.callID,
        input.tool,
        JSON.stringify(input.args),
        output.output
      )
    },
  }
}
