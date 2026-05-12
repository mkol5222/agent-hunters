

```bash
# start coding agent
opencode

# start coding agent on web
opencode web --port 4601

# prompt
opencode run "serve reports on port 17766 with npx http-server"

opencode run "find postman collect"

# GUI will open at http://localhost:6080
```

### MCP configuration

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "quantum-management": {
      "type": "local",
      "command": ["npx", "@chkp/quantum-management-mcp"],
      "enabled": true,
      "environment": {
        "MANAGEMENT_HOST": "18.159.62.63",
        "USERNAME": "admin",
        "PASSWORD": "demo123"
      }
    },
    "management-logs": {
      "type": "local",
      "command": ["npx", "@chkp/management-logs-mcp"],
      "enabled": true,
      "environment": {
        "MANAGEMENT_HOST": "18.159.62.63",
        "USERNAME": "admin",
        "PASSWORD": "demo123"
      }
    }
  }
}

```