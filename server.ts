import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const cliPort = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1], 10) : null;
const hostIndex = args.indexOf('--host');
const cliHost = hostIndex !== -1 && args[hostIndex + 1] ? args[hostIndex + 1] : null;

const PORT = cliPort || (process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 3000);
const HOST = cliHost || '0.0.0.0';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper to sanitize Wialon host
function getWialonHost(host?: string): string {
  if (!host || typeof host !== 'string') return 'hst-api.wialon.com';
  let cleaned = host.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return cleaned || 'hst-api.wialon.com';
}

// Proxy endpoint for Wialon Remote API
app.all('/api/wialon', async (req: Request, res: Response) => {
  try {
    const host = getWialonHost((req.query.host as string) || req.body?.host);
    const svc = (req.query.svc as string) || req.body?.svc;
    const sid = (req.query.sid as string) || req.body?.sid;
    const rawParams = req.body?.params ?? req.query.params;

    if (!svc) {
      res.status(400).json({ error: 4, reason: 'MISSING_SERVICE_NAME' });
      return;
    }

    const paramsStr = typeof rawParams === 'string' ? rawParams : JSON.stringify(rawParams || {});

    const formParams = new URLSearchParams();
    formParams.set('svc', svc);
    formParams.set('params', paramsStr);
    if (sid) {
      formParams.set('sid', sid);
    }

    const wialonRes = await fetch(`https://${host}/wialon/ajax.html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formParams.toString(),
    });

    const data = await wialonRes.json();
    res.json(data);
  } catch (err: any) {
    console.error('Wialon proxy error:', err);
    res.status(502).json({
      error: 6,
      reason: 'PROXY_NETWORK_ERROR',
      message: err.message || 'Failed to reach Wialon server',
    });
  }
});

// Serve static files from public directory
app.use(express.static(path.resolve(__dirname, 'public')));

// Calibrations JSON endpoint
app.get('/api/calibrations', (_req: Request, res: Response) => {
  try {
    const filePath = path.resolve(__dirname, 'public', 'calibrations.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.send(data);
    } else {
      res.json({});
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read calibrations.json', message: err.message });
  }
});

// Save calibrations endpoint (writes to both public and src/data calibrations.json)
app.post('/api/calibrations/save', (req: Request, res: Response) => {
  try {
    const { calibrations } = req.body;
    if (!calibrations || typeof calibrations !== 'object') {
      res.status(400).json({ error: 'Invalid calibrations payload' });
      return;
    }

    const jsonStr = JSON.stringify(calibrations, null, 2);
    const pubPath = path.resolve(__dirname, 'public', 'calibrations.json');
    const srcPath = path.resolve(__dirname, 'src', 'data', 'calibrations.json');

    fs.writeFileSync(pubPath, jsonStr, 'utf-8');
    if (fs.existsSync(path.dirname(srcPath))) {
      fs.writeFileSync(srcPath, jsonStr, 'utf-8');
    }

    res.json({
      success: true,
      count: Object.keys(calibrations).length,
      message: `Saved ${Object.keys(calibrations).length} vehicle calibration tables`,
      calibrations,
    });
  } catch (err: any) {
    console.error('Error saving calibrations.json:', err);
    res.status(500).json({ error: 'Failed to write calibrations.json', message: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

function startServer(serverApp: express.Express, port: number, host: string, maxRetries = 10): Promise<any> {
  return new Promise((resolve, reject) => {
    let retries = 0;
    function tryListen() {
      const server = serverApp.listen(port, host, () => {
        console.log(`Application server running on http://${host}:${port}`);
        resolve(server);
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE' && retries < maxRetries) {
          retries++;
          console.warn(`Port ${port} in use, retrying in 500ms... (attempt ${retries}/${maxRetries})`);
          setTimeout(tryListen, 500);
        } else {
          reject(err);
        }
      });
    }

    tryListen();
  });
}

let viteInstance: any = null;

async function main() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    viteInstance = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(viteInstance.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = await startServer(app, PORT, HOST);

  const shutdown = async () => {
    console.log('Shutting down server...');
    if (viteInstance) {
      await viteInstance.close().catch(() => {});
    }
    server.close(() => {
      console.log('Server stopped cleanly.');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
