import { execFileSync, execSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { chmod, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { get as httpsGet } from 'node:https';
import path from 'node:path';

const projectRoot = process.cwd();
const whisperVersion = 'v1.8.4';
const nativeRoot = path.join(projectRoot, 'electron', 'native');
const cacheRoot = path.join(projectRoot, '.tmp', 'whisper-runtime');
const archivePath = path.join(cacheRoot, `${whisperVersion}.tar.gz`);
const extractRoot = path.join(cacheRoot, `src-${whisperVersion}`);
const buildRoot = path.join(cacheRoot, `build-${getNativeArchTag()}`);
const outputDir = path.join(nativeRoot, 'bin', getNativeArchTag());
const manifestPath = path.join(outputDir, 'whisper-runtime.json');

function getNativeArchTag() {
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  }

  if (process.platform === 'win32') {
    return process.arch === 'arm64' ? 'win32-arm64' : 'win32-x64';
  }

  if (process.platform === 'linux') {
    return process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  }

  throw new Error(`[build-whisper-runtime] Unsupported platform: ${process.platform}/${process.arch}`);
}

function getSourceArchiveUrl() {
  return `https://github.com/ggml-org/whisper.cpp/archive/refs/tags/${whisperVersion}.tar.gz`;
}

function findCmake() {
  try {
    execSync('cmake --version', { stdio: 'pipe' });
    return 'cmake';
  } catch {
    // not on PATH
  }

  if (process.platform === 'win32') {
    const vsEditions = ['Community', 'Professional', 'Enterprise', 'BuildTools'];
    for (const edition of vsEditions) {
      const cmakePath = path.join(
        'C:',
        'Program Files',
        'Microsoft Visual Studio',
        '2022',
        edition,
        'Common7',
        'IDE',
        'CommonExtensions',
        'Microsoft',
        'CMake',
        'CMake',
        'bin',
        'cmake.exe',
      );
      if (existsSync(cmakePath)) {
        return cmakePath;
      }
    }
  }

  return null;
}

function ensureTarAvailable() {
  try {
    execSync('tar --version', { stdio: 'pipe' });
  } catch {
    throw new Error('[build-whisper-runtime] tar is required to unpack whisper.cpp sources.');
  }
}

async function downloadFile(url, destinationPath) {
  await mkdir(path.dirname(destinationPath), { recursive: true });

  await new Promise((resolve, reject) => {
    const request = (currentUrl, redirectCount = 0) => {
      const req = httpsGet(currentUrl, (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          if (redirectCount >= 5) {
            reject(new Error('[build-whisper-runtime] Too many redirects while downloading whisper.cpp source.'));
            return;
          }
          request(new URL(location, currentUrl).toString(), redirectCount + 1);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`[build-whisper-runtime] Failed to download whisper.cpp source: HTTP ${statusCode}`));
          return;
        }

        const fileStream = createWriteStream(destinationPath);
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
        response.on('error', reject);
        response.pipe(fileStream);
      });

      req.on('error', reject);
    };

    request(url);
  });
}

async function ensureSourceTree() {
  const extractedSourceDir = path.join(extractRoot, `whisper.cpp-${whisperVersion.replace(/^v/, '')}`);
  if (existsSync(path.join(extractedSourceDir, 'CMakeLists.txt'))) {
    return extractedSourceDir;
  }

  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });

  if (!existsSync(archivePath)) {
    console.log(`[build-whisper-runtime] Downloading whisper.cpp ${whisperVersion} source...`);
    await downloadFile(getSourceArchiveUrl(), archivePath);
  }

  ensureTarAvailable();
  execFileSync('tar', ['-xzf', archivePath, '-C', extractRoot], { stdio: 'inherit' });

  if (!existsSync(path.join(extractedSourceDir, 'CMakeLists.txt'))) {
    throw new Error(`[build-whisper-runtime] Extracted whisper.cpp source not found at ${extractedSourceDir}`);
  }

  return extractedSourceDir;
}

async function shouldSkipBuild() {
  if (!existsSync(manifestPath)) {
    return false;
  }

  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const binaryName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    const binaryPath = path.join(outputDir, binaryName);
    return manifest.version === whisperVersion && existsSync(binaryPath);
  } catch {
    return false;
  }
}

function getConfigureArgs(sourceDir) {
  const args = [
    '-S', sourceDir,
    '-B', buildRoot,
    '-DWHISPER_BUILD_TESTS=OFF',
    '-DWHISPER_BUILD_SERVER=OFF',
    '-DBUILD_SHARED_LIBS=OFF',
  ];

  if (process.platform !== 'win32') {
    args.push('-DCMAKE_BUILD_TYPE=Release');
  } else {
    args.push('-G', 'Visual Studio 17 2022', '-A', process.arch === 'arm64' ? 'ARM64' : 'x64');
  }

  return args;
}

function getBuildArgs() {
  const args = ['--build', buildRoot, '--config', 'Release'];

  if (process.platform !== 'win32') {
    args.push('--parallel');
  }

  return args;
}

async function findRuntimeArtifacts() {
  const candidateDirs = process.platform === 'win32'
    ? [path.join(buildRoot, 'bin', 'Release'), path.join(buildRoot, 'bin')]
    : [path.join(buildRoot, 'bin')];

  for (const candidateDir of candidateDirs) {
    if (!existsSync(candidateDir)) {
      continue;
    }

    const entries = await readdir(candidateDir);
    const runtimeEntries = entries.filter((entry) => /^(whisper|ggml|libwhisper|libggml)/i.test(entry));
    if (runtimeEntries.length > 0) {
      return {
        candidateDir,
        runtimeEntries,
      };
    }
  }

  throw new Error('[build-whisper-runtime] Built whisper runtime artifacts were not found.');
}

async function stageRuntimeArtifacts(candidateDir, runtimeEntries) {
  await mkdir(outputDir, { recursive: true });

  for (const entry of runtimeEntries) {
    const sourcePath = path.join(candidateDir, entry);
    const destinationPath = path.join(outputDir, entry);
    const entryStats = await stat(sourcePath);

    if (entryStats.isDirectory()) {
      await rm(destinationPath, { recursive: true, force: true });
      await cp(sourcePath, destinationPath, { recursive: true });
      continue;
    }

    await cp(sourcePath, destinationPath, { force: true });
    if (process.platform !== 'win32') {
      await chmod(destinationPath, 0o755).catch(() => undefined);
    }
  }

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        version: whisperVersion,
        platform: process.platform,
        arch: process.arch,
        binary: process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli',
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function main() {
  const cmake = findCmake();
  if (!cmake) {
    throw new Error('[build-whisper-runtime] CMake is required to build the bundled Whisper runtime.');
  }

  if (await shouldSkipBuild()) {
    console.log(`[build-whisper-runtime] Whisper runtime ${whisperVersion} already staged for ${getNativeArchTag()}.`);
    return;
  }

  const sourceDir = await ensureSourceTree();
  await mkdir(buildRoot, { recursive: true });

  console.log(`[build-whisper-runtime] Configuring whisper.cpp ${whisperVersion} for ${getNativeArchTag()}...`);
  try {
    execFileSync(cmake, getConfigureArgs(sourceDir), { stdio: 'inherit', timeout: 300000 });
  } catch (error) {
    if (process.platform === 'win32' && process.arch !== 'arm64') {
      console.log('[build-whisper-runtime] VS 2022 generator unavailable, retrying with VS 2019...');
      execFileSync(cmake, [
        '-S', sourceDir,
        '-B', buildRoot,
        '-G', 'Visual Studio 16 2019',
        '-A', 'x64',
        '-DWHISPER_BUILD_TESTS=OFF',
        '-DWHISPER_BUILD_SERVER=OFF',
        '-DBUILD_SHARED_LIBS=OFF',
      ], { stdio: 'inherit', timeout: 300000 });
    } else {
      throw error;
    }
  }

  console.log('[build-whisper-runtime] Building bundled whisper runtime...');
  execFileSync(cmake, getBuildArgs(), { stdio: 'inherit', timeout: 900000 });

  const { candidateDir, runtimeEntries } = await findRuntimeArtifacts();
  await stageRuntimeArtifacts(candidateDir, runtimeEntries);
  console.log(`[build-whisper-runtime] Staged whisper runtime -> ${outputDir}`);
}

await main();