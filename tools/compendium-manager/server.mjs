import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../');
const PACKS_SRC_DIR = path.join(ROOT_DIR, 'packs-src');
const PRESERVE_FILE = path.join(__dirname, 'preserve.json');

const PORT = 8080;

async function getGitModifiedFiles() {
    try {
        const { stdout } = await execAsync('git status --porcelain packs-src/', { cwd: ROOT_DIR });
        const modified = [];
        for (const line of stdout.split('\n')) {
            if (line.trim() === '') continue;
            const match = line.match(/^(.{2})\s+(.+)$/);
            if (match) {
                modified.push(match[2]);
            }
        }
        return modified;
    } catch (e) {
        console.error("Git error:", e);
        return [];
    }
}

async function getPacks() {
    const packs = [];
    try {
        const dirs = await fs.readdir(PACKS_SRC_DIR, { withFileTypes: true });
        const modifiedFiles = await getGitModifiedFiles();

        for (const dir of dirs) {
            if (dir.isDirectory()) {
                const packPath = path.join(PACKS_SRC_DIR, dir.name);
                const items = [];
                const files = await fs.readdir(packPath);
                
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const filePath = path.join(packPath, file);
                        const relPath = path.posix.join('packs-src', dir.name, file);
                        try {
                            const content = await fs.readFile(filePath, 'utf-8');
                            const json = JSON.parse(content);
                            items.push({
                                filename: file,
                                id: json._id,
                                name: json.name || file,
                                isModifiedInGit: modifiedFiles.includes(relPath)
                            });
                        } catch (e) {
                            // ignore
                        }
                    }
                }
                packs.push({
                    name: dir.name,
                    items: items
                });
            }
        }
    } catch (e) {
        console.error("Error reading packs:", e);
    }
    return packs;
}

const server = http.createServer(async (req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    if (url.pathname === '/') {
        try {
            const html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end(html);
        } catch (e) {
            res.writeHead(404);
            return res.end('index.html not found');
        }
    }

    if (url.pathname === '/api/packs' && req.method === 'GET') {
        const packs = await getPacks();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(packs));
    }

    if (url.pathname === '/api/preserve' && req.method === 'GET') {
        try {
            const content = await fs.readFile(PRESERVE_FILE, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(content);
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ items: [], packs: {} })); 
        }
    }

    if (url.pathname === '/api/preserve' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                JSON.parse(body);
                await fs.writeFile(PRESERVE_FILE, body, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (url.pathname === '/api/run' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { script } = JSON.parse(body);
                
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });

                let cmd, args;
                if (script === 'parse') {
                    cmd = 'python3';
                    args = ['tools/research/parse_reference.py'];
                } else if (script === 'build-packs') {
                    cmd = 'python3';
                    args = ['tools/research/build_vtt_packs.py'];
                } else if (script === 'build-compendiums') {
                    cmd = 'node';
                    args = ['tools/build-compendium.mjs'];
                } else {
                    res.end('data: Invalid script\n\n');
                    return;
                }

                res.write(`data: ${JSON.stringify({ type: 'stdout', msg: '[START] Running ' + cmd + ' ' + args.join(' ') })}\n\n`);

                const child = spawn(cmd, args, { cwd: ROOT_DIR });
                
                child.stdout.on('data', (data) => {
                    const lines = data.toString().split('\n');
                    for (const line of lines) {
                        if (line) res.write(`data: ${JSON.stringify({ type: 'stdout', msg: line })}\n\n`);
                    }
                });

                child.stderr.on('data', (data) => {
                    const lines = data.toString().split('\n');
                    for (const line of lines) {
                        if (line) res.write(`data: ${JSON.stringify({ type: 'stderr', msg: line })}\n\n`);
                    }
                });

                child.on('close', (code) => {
                    res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
                    res.end();
                });

            } catch (e) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`Compendium Manager running at http://localhost:${PORT}`);
});
