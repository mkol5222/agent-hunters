import express from "express"
import Database from "better-sqlite3"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import http from "http"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const dbPath = path.resolve(__dirname, "..", "..", "opencode-trace.db")
const exists = fs.existsSync(dbPath)
const db = new Database(dbPath)
db.pragma("journal_mode = WAL")

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
  console.log("Created new trace database.")
}

const app = express()

app.use(express.static(path.join(__dirname, "public")))

app.get("/api/dashboard", (req, res) => {
  try {
    const sessions = db.prepare("SELECT COUNT(DISTINCT session_id) as count FROM messages").get()
    const messages = db.prepare("SELECT COUNT(*) as count FROM messages").get()
    const toolCalls = db.prepare("SELECT COUNT(*) as count FROM tool_calls").get()
    const toolBreakdown = db.prepare(
      "SELECT tool_name, COUNT(*) as count FROM tool_calls GROUP BY tool_name ORDER BY count DESC"
    ).all()
    const recentSessions = db.prepare(`
      SELECT session_id, MAX(ts) as last_ts,
        (SELECT COUNT(*) FROM messages m2 WHERE m2.session_id = m.session_id) as message_count,
        (SELECT COUNT(*) FROM tool_calls tc2 WHERE tc2.session_id = m.session_id) as tool_call_count
      FROM messages m GROUP BY session_id ORDER BY last_ts DESC LIMIT 10
    `).all()
    const topAgents = db.prepare(
      "SELECT agent, COUNT(*) as count FROM messages WHERE agent IS NOT NULL GROUP BY agent ORDER BY count DESC LIMIT 10"
    ).all()
    const ts = db.prepare("SELECT MIN(ts) as first, MAX(ts) as last FROM messages").get()

    res.json({ sessions, messages, toolCalls, toolBreakdown, recentSessions, topAgents, ts })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/tool-calls", (req, res) => {
  try {
    const toolName = (req.query.tool_name || "").trim()
    if (!toolName) return res.status(400).json({ error: "tool_name is required" })

    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50))
    const offset = (page - 1) * limit
    const search = (req.query.q || "").trim()

    let where = "WHERE tool_name = ?"
    let params = [toolName]
    if (search) {
      where += " AND (input LIKE ? OR output LIKE ? OR session_id LIKE ? OR call_id LIKE ?)"
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM tool_calls ${where}`).get(...params)
    const calls = db.prepare(
      `SELECT * FROM tool_calls ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    res.json({
      calls,
      total: total.count,
      page,
      totalPages: Math.ceil(total.count / limit),
      tool_name: toolName,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/sessions", (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const offset = (page - 1) * limit
    const search = req.query.q || ""

    let where = ""
    let params = []
    if (search) {
      where = "WHERE (m.session_id LIKE ? OR m.content LIKE ?)"
      params = [`%${search}%`, `%${search}%`]
    }

    const total = db.prepare(
      `SELECT COUNT(DISTINCT m.session_id) as count FROM messages m ${where}`
    ).get(...params)

    const sessions = db.prepare(`
      SELECT m.session_id,
        MIN(m.ts) as first_ts,
        MAX(m.ts) as last_ts,
        (SELECT COUNT(*) FROM messages m2 WHERE m2.session_id = m.session_id) as message_count,
        (SELECT COUNT(*) FROM tool_calls tc WHERE tc.session_id = m.session_id) as tool_call_count
      FROM messages m ${where}
      GROUP BY m.session_id
      ORDER BY last_ts DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    res.json({
      sessions,
      total: total.count,
      page,
      totalPages: Math.ceil(total.count / limit),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/sessions/:id", (req, res) => {
  try {
    const { id } = req.params
    const messages = db.prepare(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC"
    ).all(id)
    const toolCalls = db.prepare(
      "SELECT * FROM tool_calls WHERE session_id = ? ORDER BY id ASC"
    ).all(id)
    res.json({
      session_id: id,
      messages: messages.map(m => ({
        ...m,
        content: m.content ? (() => { try { return JSON.parse(m.content) } catch { return m.content } })() : null,
      })),
      tool_calls: toolCalls.map(tc => ({
        ...tc,
        input: tc.input ? (() => { try { return JSON.parse(tc.input) } catch { return tc.input } })() : null,
        output: tc.output ? (() => { try { return JSON.parse(tc.output) } catch { return tc.output } })() : null,
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/search", (req, res) => {
  try {
    const q = (req.query.q || "").trim()
    if (!q) return res.json({ messages: [], tool_calls: [] })

    const like = `%${q}%`
    const messages = db.prepare(
      "SELECT * FROM messages WHERE content LIKE ? OR session_id LIKE ? ORDER BY ts DESC LIMIT 100"
    ).all(like, like)
    const toolCalls = db.prepare(
      "SELECT * FROM tool_calls WHERE tool_name LIKE ? OR input LIKE ? OR output LIKE ? OR session_id LIKE ? ORDER BY ts DESC LIMIT 100"
    ).all(like, like, like, like)

    res.json({ messages, tool_calls })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

function findFreePort(min, max) {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.listen(0, () => {
      const port = server.address().port
      server.close(() => {
        if (port > min) return resolve(port)
        const s2 = http.createServer()
        s2.listen(0, () => {
          const p = s2.address().port
          s2.close(() => resolve(p > min ? p : min + Math.floor(Math.random() * (max - min))))
        })
      })
    })
    server.on("error", reject)
  })
}

const PORT_MIN = 11150
const PORT_MAX = 65535

findFreePort(PORT_MIN, PORT_MAX).then(port => {
  app.listen(port, () => {
    const url = `http://localhost:${port}`
    console.log(`\n  OpenCode Tracer WebUI running at:\n\n    ${url}\n`)
  })
})
