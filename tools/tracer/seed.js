import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

const dbPath = path.join(process.cwd(), "opencode-trace.db")
const exists = fs.existsSync(dbPath)
const db = new Database(dbPath)

if (!exists) {
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
}

const now = new Date()

function ts(minutesAgo) {
  const d = new Date(now.getTime() - minutesAgo * 60000)
  return d.toISOString().replace("T", " ").replace("Z", "")
}

function randSid() {
  return "session_" + Math.random().toString(36).substring(2, 10)
}

const sessions = [randSid(), randSid(), randSid(), randSid(), randSid()]
const agents = ["explore", "general", "default"]
const tools = ["read", "grep", "bash", "glob", "write", "edit", "task", "websearch"]
const roles = ["user", "assistant", "user", "assistant", "system", "user", "assistant"]

const insertMsg = db.prepare("INSERT INTO messages (session_id, agent, role, content, ts) VALUES (?, ?, ?, ?, ?)")
const insertTc = db.prepare("INSERT INTO tool_calls (session_id, call_id, tool_name, input, output, ts) VALUES (?, ?, ?, ?, ?, ?)")

const insertMany = db.transaction(() => {
  sessions.forEach((sid, si) => {
    let agent = agents[si % agents.length]
    const msgCount = 3 + si * 2
    for (let i = 0; i < msgCount; i++) {
      const role = roles[i % roles.length]
      const content = [
        `Hello, can you help me with task ${i}?`,
        `Sure! Here is my analysis of the codebase for request #${i}. The module handles routing and middleware configuration.`,
        `Thanks, please implement the changes.`,
        `Here is the implementation:\n\n\`\`\`javascript\nfunction hello() {\n  return "world";\n}\n\`\`\`\n\nI've also added tests.`,
        `System: processing request ${i} for session ${si}`,
        `Can you also check for edge cases?`,
        `Done. I've verified all edge cases. The code handles:\n- Empty input\n- Null values\n- Large payloads\n- Concurrent access`,
      ][i % 7]

      insertMsg.run(sid, agent, role, content, ts(msgCount * 2 - i * 2))
    }

    const tcCount = 2 + si * 2
    for (let i = 0; i < tcCount; i++) {
      const tool = tools[i % tools.length]
      const callId = "call_" + Math.random().toString(36).substring(2, 10)
      const input = { arg1: "value" + i, path: `/some/path/file${i}.ts` }
      const output = { result: `output from ${tool} call ${i}`, success: true }

      insertTc.run(sid, callId, tool, JSON.stringify(input), JSON.stringify(output), ts(tcCount * 2 - i * 2))
    }
  })
})

insertMany()
console.log("Seeded test data for", sessions.length, "sessions")
