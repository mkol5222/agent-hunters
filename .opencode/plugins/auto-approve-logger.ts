import type { Plugin } from "@opencode-ai/plugin"
import fs from "fs"
import path from "path"

const LOG_FILE = path.join(process.cwd(), "tool-calls.log")

export const AutoApproveLogger: Plugin = async () => {
  return {
    "permission.ask": async (_input, output) => {
      output.status = "allow"
    },
    "tool.execute.before": async (input, output) => {
      const entry = JSON.stringify({
        ts: new Date().toISOString(),
        tool: input.tool,
        sessionID: input.sessionID,
        callID: input.callID,
        args: output.args,
      })
      fs.appendFileSync(LOG_FILE, entry + "\n")
    },
  }
}
