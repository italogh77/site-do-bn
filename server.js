/**
 * Servidor Local e Sincronizador com o GitHub
 * Grupo Solutions - Controle de Veículos
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const REPO_NAME = 'italogh77/site-do-bn';
const BRANCH_NAME = 'main';

// Localizar o Git do GitHub Desktop ou do sistema
function getGitEnv() {
  const desktopRoot = path.join(process.env.LOCALAPPDATA || '', 'GitHubDesktop');
  let gitCmd = '';
  let gitMingw = '';

  try {
    if (fs.existsSync(desktopRoot)) {
      const candidates = fs.readdirSync(desktopRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('app-'))
        .map((entry) => {
          const cPath = path.join(desktopRoot, entry.name, 'resources', 'app', 'git', 'cmd');
          const mPath = path.join(desktopRoot, entry.name, 'resources', 'app', 'git', 'mingw64', 'bin');
          return {
            cPath,
            mPath,
            updatedAt: fs.statSync(path.join(desktopRoot, entry.name)).mtimeMs,
          };
        })
        .filter(({ cPath }) => fs.existsSync(path.join(cPath, 'git.exe')))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      if (candidates.length > 0) {
        gitCmd = candidates[0].cPath;
        gitMingw = candidates[0].mPath;
      }
    }
  } catch (err) {
    // Silencioso
  }

  const pathParts = [];
  if (gitCmd) pathParts.push(gitCmd);
  if (gitMingw) pathParts.push(gitMingw);
  pathParts.push(process.env.PATH || '');

  return {
    ...process.env,
    PATH: pathParts.join(';'),
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never',
  };
}

function runGit(command) {
  return new Promise((resolve, reject) => {
    const env = getGitEnv();
    exec(command, { cwd: __dirname, env }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.trim() || stdout.trim() || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // Limite de 10MB
        reject(new Error('Corpo da requisição muito grande'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Rotas de API
  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      running: true,
      repository: REPO_NAME,
      branch: BRANCH_NAME,
      time: new Date().toISOString()
    }));
    return;
  }

  if (pathname === '/api/git-status') {
    try {
      const statusOutput = await runGit('git status --porcelain');
      const branchStatus = await runGit('git status -sb');
      const hasChanges = statusOutput.trim().length > 0;
      const ahead = branchStatus.includes('ahead');
      const behind = branchStatus.includes('behind');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        clean: !hasChanges && !ahead,
        hasChanges,
        ahead,
        behind,
        details: statusOutput,
        summary: branchStatus
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/salvar' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const { html, dados, autoPush } = data;

      if (dados) {
        fs.writeFileSync(path.join(__dirname, 'dados.json'), JSON.stringify(dados, null, 2), 'utf8');
      }

      if (html && typeof html === 'string') {
        fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
        fs.writeFileSync(path.join(__dirname, 'controle_veiculos_prototipo_v5.html'), html, 'utf8');
      }

      let pushResult = null;
      if (autoPush) {
        try {
          await runGit('git add index.html controle_veiculos_prototipo_v5.html dados.json');
          const hora = new Date().toLocaleString('pt-BR');
          await runGit(`git commit -m "Atualizações salvas pelo site em ${hora}"`);
          await runGit(`git push origin ${BRANCH_NAME}`);
          pushResult = 'Sincronizado com o GitHub!';
        } catch (gitErr) {
          pushResult = 'Salvo localmente. Erro no envio Git: ' + gitErr.message;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        savedAt: new Date().toISOString(),
        pushResult
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/git-push' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const mensagem = data.message || `Atualizações realizadas no site em ${new Date().toLocaleString('pt-BR')}`;

      // Salva html/dados se enviados no payload
      if (data.html) {
        fs.writeFileSync(path.join(__dirname, 'index.html'), data.html, 'utf8');
        fs.writeFileSync(path.join(__dirname, 'controle_veiculos_prototipo_v5.html'), data.html, 'utf8');
      }
      if (data.dados) {
        fs.writeFileSync(path.join(__dirname, 'dados.json'), JSON.stringify(data.dados, null, 2), 'utf8');
      }

      // Adiciona arquivos modificados
      await runGit('git add -A');

      // Verifica se há algo para commitar
      const status = await runGit('git status --porcelain');
      if (status) {
        await runGit(`git commit -m "${mensagem.replace(/"/g, '\\"')}"`);
      }

      // Puxa eventuais alterações antes do push
      try {
        await runGit(`git pull --rebase origin ${BRANCH_NAME}`);
      } catch (pullErr) {
        // Ignora se não houver rebase limpo
      }

      // Envia para o repositório remoto
      const pushOut = await runGit(`git push origin ${BRANCH_NAME}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Alterações enviadas para o repositório com sucesso!',
        repository: `https://github.com/${REPO_NAME}`,
        details: pushOut
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: e.message
      }));
    }
    return;
  }

  if (pathname === '/api/git-pull' && req.method === 'POST') {
    try {
      const pullOut = await runGit(`git pull origin ${BRANCH_NAME}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Repositório atualizado com o GitHub!',
        details: pullOut
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: e.message
      }));
    }
    return;
  }

  // Servir arquivos estáticos
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Se pedir controle_veiculos_prototipo_v5.html ou index.html
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Arquivo não encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('========================================================');
  console.log('   GRUPO SOLUTIONS — CONTROLE DE VEÍCULOS & SINCRONIZAÇÃO');
  console.log('========================================================');
  console.log(`🌐 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📦 Repositório GitHub: https://github.com/${REPO_NAME}`);
  console.log(`🌿 Ramo (branch): ${BRANCH_NAME}`);
  console.log('========================================================\n');
});
