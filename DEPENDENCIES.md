```bash

# secrets management
curl -sfS "https://dotenvx.sh" | sudo sh 

# coding agent
npm install -g opencode-ai

# agent-browser
npm install -g agent-browser

# Chromium needed for agent-browser
npx -y playwright install chromium

# skills
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser

# Management API postman collection
# via https://sc1.checkpoint.com/documents/latest/api_reference/index.html
curl -o management-api-postman-collection.json -L https://sc1.checkpoint.com/documents/latest/APIs/data/postman_collection.json