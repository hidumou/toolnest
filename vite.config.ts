import { defineConfig, type Plugin } from 'vite';
import { resolve, dirname, join } from 'node:path';
import { promises as fs } from 'node:fs';

const TOOLS = ['timestamp', 'watermark', 'json', 'base64', 'url', 'jwt'] as const;

/**
 * 让 /<tool>/ URL 在 dev 与 build 中都映射到 src/pages/<tool>/index.html。
 * - dev：中间件把 /<tool>/ 内部改写到 /src/pages/<tool>/index.html
 * - build：closeBundle 把 dist/src/pages/<tool>/index.html 搬到 dist/<tool>/index.html
 */
function toolnestMpa(): Plugin {
  const matcher = new RegExp(`^/(${TOOLS.join('|')})/?(\\?.*)?$`);
  return {
    name: 'toolnest-mpa',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const m = req.url.match(matcher);
        if (m) {
          req.url = `/src/pages/${m[1]}/index.html${m[2] ?? ''}`;
        }
        next();
      });
    },
    async closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      for (const t of TOOLS) {
        const from = join(outDir, 'src', 'pages', t, 'index.html');
        const to = join(outDir, t, 'index.html');
        try {
          await fs.mkdir(dirname(to), { recursive: true });
          await fs.rename(from, to);
        } catch {
          // 文件不存在 / 已搬移 —— 忽略
        }
      }
      // 清掉空的 dist/src 目录
      try {
        await fs.rm(join(outDir, 'src'), { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [toolnestMpa()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        timestamp: resolve(__dirname, 'src/pages/timestamp/index.html'),
        watermark: resolve(__dirname, 'src/pages/watermark/index.html'),
        json: resolve(__dirname, 'src/pages/json/index.html'),
        base64: resolve(__dirname, 'src/pages/base64/index.html'),
        url: resolve(__dirname, 'src/pages/url/index.html'),
        jwt: resolve(__dirname, 'src/pages/jwt/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
});
