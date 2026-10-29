# StudentHub Frontend MCP

This MCP server lets a compatible Claude client read the StudentHub frontend and write visual/layout updates to `frontend/index.html` and `frontend/style.css` when you ask in natural language.

## Setup

Requirements: Node.js 20+ and a compatible MCP client (for example, Claude Code).

1. Open a terminal at the StudentHub project root.
2. Install the MCP server dependencies:

   ```bash
   cd mcp-server
   npm install
   cd ..
   ```

3. Open the project root in Claude Code. The included `.mcp.json` config registers the server as `studenthub-frontend`. If the client asks to approve the project MCP server, review and approve it.
4. Ask Claude for a change, for example: `Change StudentHub to a dark navy and purple theme. Keep the student CRUD form and table working.`
5. Preview the local `frontend/index.html` using Live Server or another local static server.

## Available tools

- `list_frontend_files` — shows the available frontend files.
- `read_frontend_file` — reads `index.html`, `style.css`, or `script.js`.
- `write_frontend_file` — writes `index.html` or `style.css`.

Writes are intentionally restricted to HTML and CSS; `script.js`, backend code, and database settings cannot be changed through this MCP server. This reduces the chance that a design prompt accidentally damages student CRUD behavior or configuration.

## Important

- MCP provides tools to Claude; it is not itself the AI model.
- This configuration is for a local MCP-compatible Claude client. It does not add a prompt box to the deployed Netlify site and does not edit the live website directly.
- Changes are saved to your local project files. Review them, then commit/push to GitHub and redeploy on Netlify to publish.
- Do not put API keys, MongoDB credentials, or other secrets into frontend files or prompts.
