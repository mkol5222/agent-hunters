import { tool, type ToolResult } from "@opencode-ai/plugin"
import { z } from "zod"

export const add = tool({
  description: "Add two numbers",
  args: {
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  },
  async execute(args: { a: number; b: number }): Promise<ToolResult> {
    return String(args.a + args.b)
  },
})

export const multiply = tool({
  description: "Multiply two numbers",
  args: {
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  },
  async execute(args: { a: number; b: number }, _context: import("@opencode-ai/plugin").ToolContext): Promise<ToolResult> {
    return String(args.a * args.b)
  },
})