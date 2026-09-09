const { packager } = require('@electron/packager');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');

const outDir = path.resolve('/mnt/documents/asherin-ide-releases/electron-release');
const assetOutDir = path.resolve('/mnt/documents/asherin-ide-releases/archives');
const installDir = path.resolve('public/asherin.ide/install');
const distInstallDir = path.resolve('dist/asherin.ide/install');

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('error', reject);
    s.on('data', (d) => hash.update(d));
    s.on('end', () => resolve(hash.digest('hex')));
  });
}

function runLovableAssets(file, filename) {
  return new Promise((resolve, reject) => {
    const contentType = filename.endsWith('.tar.gz')
      ? 'application/gzip'
      : filename.endsWith('.zip')
        ? 'application/zip'
        : 'application/octet-stream';
    const args = [
      'create',
      '--file', file,
      '--filename', filename,
      '--content-type', contentType,
    ];
    const proc = spawn('lovable-assets', args, {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const chunks = [];
    proc.stdout.on('data', (c) => chunks.push(c));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`lovable-assets exited ${code}`));
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`failed to parse asset JSON: ${err.message}\n${raw.slice(0, 500)}`));
      }
    });
  });
}

async function main() {
  if (!fs.existsSync('dist')) {
    console.error('dist/ does not exist. run `bun run build:electron` first.');
    process.exit(1);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(assetOutDir, { recursive: true });
  fs.mkdirSync(installDir, { recursive: true });

  const platforms = [
    { key: 'linux', platform: 'linux', arch: 'x64', ext: 'tar.gz' },
    { key: 'windows', platform: 'win32', arch: 'x64', ext: 'zip' },
    { key: 'macos', platform: 'darwin', arch: 'x64', ext: 'zip' },
  ];
  const releases = {};

  for (const { key, platform, arch, ext } of platforms) {
    const appPaths = await packager({
      dir: path.resolve('.'),
      name: 'Asherin IDE',
      executableName: 'Asherin IDE',
      platform,
      arch,
      out: outDir,
      overwrite: true,
      prune: true,
      ignore: [
        /^\/node_modules/,
        /^\/src/,
        /^\/public/,
        /^\/electron-release/,
        /^\/supabase/,
        /^\/scripts/,
        /^\/.lovable/,
        /^\.git/,
        /^\/tests?/,
        /^\/coverage/,
        /^\/playwright/,
        /^\/tmp/,
        /^\/\.env/,
        /^\/vite\.config\.ts/,
        /^\/tsconfig/,
        /^\/eslint/,
        /^\/postcss/,
        /^\/tailwind/,
      ],
    });

    const builtPath = appPaths[0];
    if (!builtPath) {
      throw new Error(`packaging failed for ${platform} ${arch}`);
    }
    console.log('packaged', builtPath);

    const fileName = `asherin-ide-${key}-x64.${ext}`;
    const archivePath = path.join(assetOutDir, fileName);

    if (platform === 'linux') {
      execSync(`tar czf "${archivePath}" -C "${path.dirname(builtPath)}" "${path.basename(builtPath)}"`, {
        stdio: 'inherit',
      });
    } else {
      execSync(
        `cd "${path.dirname(builtPath)}" && zip -r -9 "${archivePath}" "${path.basename(builtPath)}"`,
        { stdio: 'inherit' },
      );
    }

    const size = fs.statSync(archivePath).size;
    const hash = await sha256(archivePath);
    console.log('archive', archivePath, `size=${size}`, `sha256=${hash}`);

    const asset = await runLovableAssets(archivePath, fileName);
    const assetFile = path.join(installDir, `${fileName}.asset.json`);
    fs.writeFileSync(assetFile, JSON.stringify(asset, null, 2));
    console.log('asset pointer', assetFile, asset.url);

    releases[key] = {
      url: asset.url,
      size,
      sha256: hash,
      fileName,
      contentType: asset.content_type,
    };
  }

  const today = new Date().toISOString();
  const version = `0.0.0-${today.slice(0, 10).replace(/-/g, '')}`;
  const latest = {
    version,
    channel: 'stable',
    releaseDate: today,
    platforms: {
      linux: releases.linux,
      windows: releases.windows,
      macos: releases.macos,
    },
  };

  fs.writeFileSync(path.join(installDir, 'latest.json'), JSON.stringify(latest, null, 2));

  // Copy the small pointer files and manifest into the production bundle so the
  // deployed site can serve them from /asherin.ide/install/.
  fs.mkdirSync(distInstallDir, { recursive: true });
  for (const file of fs.readdirSync(installDir)) {
    if (file.endsWith('.asset.json') || file === 'latest.json') {
      fs.copyFileSync(path.join(installDir, file), path.join(distInstallDir, file));
    }
  }

  // The binaries themselves are hosted by Lovable assets; do not keep them in
  // the project tree (they exceed the per-file commit limit).
  fs.rmSync(outDir, { recursive: true, force: true });

  console.log('done. manifest:', path.join(installDir, 'latest.json'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
