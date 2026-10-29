import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const app = express();
app.use(express.json({ limit: '1mb' }));

const editableFiles = new Set(['index.html', 'style.css']);
const readableFiles = new Set(['index.html', 'style.css', 'script.js']);

function getGitHubConfig() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } =
    process.env;

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_BRANCH) {
    throw new Error('GitHub environment variables are not configured.');
  }

  return {
    token: GITHUB_TOKEN,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH
  };
}

async function githubRequest(endpoint, options = {}) {
  const config = getGitHubConfig();

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}${endpoint}`,
    {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    }
  );

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`GitHub returned an unreadable response (${response.status}).`);
  }

  if (!response.ok) {
    console.error('GitHub API error:', response.status, data.message || 'Request failed');
    throw new Error(
      `GitHub request failed (${response.status}). Check repository permissions and branch settings.`
    );
  }

  return data;
}

function validateFileName(fileName, allowedFiles) {
  if (typeof fileName !== 'string' || !allowedFiles.has(fileName)) {
    throw new Error(`Allowed files: ${[...allowedFiles].join(', ')}`);
  }

  return `frontend/${fileName}`;
}

async function readGitHubFile(fileName) {
  const config = getGitHubConfig();
  const repoPath = validateFileName(fileName, readableFiles);

  const file = await githubRequest(
    `/contents/${repoPath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(config.branch)}`
  );

  if (file.type !== 'file' || !file.content) {
    throw new Error(`frontend/${fileName} is not a readable file.`);
  }

  return Buffer.from(file.content, 'base64').toString('utf8');
}

function authenticate(req, res, next) {
  const expected = process.env.MCP_AUTH_TOKEN;
  const supplied = req.headers.authorization;

  if (!expected || supplied !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

function createMcpServer() {
  const server = new McpServer({
    name: 'studenthub-frontend-editor',
    version: '1.1.0'
  });

  server.tool(
    'list_frontend_files',
    'List frontend files available for StudentHub UI work.',
    {},
    async () => ({
      content: [{
        type: 'text',
        text: [
          'Repository: configured StudentHub GitHub repository.',
          'Branch: configured GITHUB_BRANCH.',
          'Readable files: frontend/index.html, frontend/style.css, frontend/script.js.',
          'Publishable files: frontend/index.html, frontend/style.css.',
          'All other files are excluded from publishing.'
        ].join('\n')
      }]
    })
  );

  server.tool(
    'read_frontend_file',
    'Read the latest version of an allowed StudentHub frontend file from GitHub.',
    {
      fileName: z.enum(['index.html', 'style.css', 'script.js'])
    },
    async ({ fileName }) => {
      try {
        const content = await readGitHubFile(fileName);

        return {
          content: [{
            type: 'text',
            text: `Latest GitHub file: frontend/${fileName}\n\n${content}`
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: error.message }]
        };
      }
    }
  );

  server.tool(
    'publish_frontend_changes',
    'Publish reviewed HTML/CSS changes to the configured GitHub branch in one commit. Only index.html and style.css can be changed.',
    {
      changeSummary: z.string().min(1).max(500),
      files: z.array(z.object({
        fileName: z.enum(['index.html', 'style.css']),
        content: z.string().min(1).max(200000)
      })).min(1).max(2)
    },
    async ({ changeSummary, files }) => {
      try {
        const config = getGitHubConfig();
        const seen = new Set();

        for (const file of files) {
          validateFileName(file.fileName, editableFiles);

          if (seen.has(file.fileName)) {
            throw new Error(`Duplicate file supplied: ${file.fileName}`);
          }

          seen.add(file.fileName);
        }

        // Read the current branch head immediately before preparing the commit.
        const ref = await githubRequest(
          `/git/ref/heads/${encodeURIComponent(config.branch)}`
        );
        const parentSha = ref.object.sha;

        const parentCommit = await githubRequest(
          `/git/commits/${parentSha}`
        );
        const baseTreeSha = parentCommit.tree.sha;

        // Create blobs for the approved files.
        const treeEntries = [];

        for (const file of files) {
          const repoPath = validateFileName(file.fileName, editableFiles);

          const blob = await githubRequest('/git/blobs', {
            method: 'POST',
            body: JSON.stringify({
              content: file.content,
              encoding: 'utf-8'
            })
          });

          treeEntries.push({
            path: repoPath,
            mode: '100644',
            type: 'blob',
            sha: blob.sha
          });
        }

        // Create a new tree based on the existing repository tree.
        const tree = await githubRequest('/git/trees', {
          method: 'POST',
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: treeEntries
          })
        });

        const safeSummary = changeSummary
          .replace(/[\r\n]+/g, ' ')
          .trim()
          .slice(0, 500);

        const commit = await githubRequest('/git/commits', {
          method: 'POST',
          body: JSON.stringify({
            message: `Update StudentHub frontend: ${safeSummary}`,
            tree: tree.sha,
            parents: [parentSha]
          })
        });

        // Non-force update: do not overwrite a newer branch head.
        await githubRequest(
          `/git/refs/heads/${encodeURIComponent(config.branch)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              sha: commit.sha,
              force: false
            })
          }
        );

        return {
          content: [{
            type: 'text',
            text: [
              'GitHub publish successful.',
              `Branch: ${config.branch}`,
              `Files: ${files.map(f => `frontend/${f.fileName}`).join(', ')}`,
              `Commit: ${commit.sha}`,
              `Summary: ${safeSummary}`,
              'Netlify should start its configured deployment if the main branch is connected to the site.',
              'Check the GitHub commit and Netlify deploy status to confirm completion.'
            ].join('\n')
          }]
        };
      } catch (error) {
        console.error('Frontend publish failed:', error.message);

        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Publish failed: ${error.message}`
          }]
        };
      }
    }
  );

  return server;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'studenthub-mcp-server'
  });
});

app.post('/mcp', authenticate, async (req, res) => {
  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request failed:', error.message);

    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP request failed' });
    }
  }
});

app.get('/mcp', authenticate, (_req, res) => {
  res.status(405).set('Allow', 'POST').send('Use POST for MCP requests.');
});

app.delete('/mcp', authenticate, (_req, res) => {
  res.status(405).send('Stateless MCP sessions are not supported.');
});

const port = Number(process.env.PORT || 3000);

app.listen(port, '0.0.0.0', () => {
  console.log(`StudentHub MCP server listening on port ${port}`);
});