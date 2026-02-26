const path = require('node:path');
const fs = require('node:fs');
const { runTests } = require('@vscode/test-electron');

function resolveLocalVscodeExecutable() {
  const byEnv = process.env.VSCODE_TEST_BINARY;
  if (byEnv && fs.existsSync(byEnv)) {
    return byEnv;
  }

  const candidates = [];
  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
      '/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Electron',
    );
  } else if (process.platform === 'linux') {
    candidates.push('/usr/bin/code', '/snap/bin/code', '/usr/bin/code-insiders');
  } else if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      'C:\\Program Files\\Microsoft VS Code Insiders\\Code - Insiders.exe',
    );
  }

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function runSuite(name, extensionTestsPath, launchArgs, vscodeExecutablePath) {
  process.stdout.write(`\nRunning integration suite: ${name}\n`);
  await runTests({
    extensionDevelopmentPath: path.resolve(__dirname, '..', '..'),
    extensionTestsPath,
    ...(vscodeExecutablePath ? { vscodeExecutablePath } : {}),
    launchArgs,
  });
}

async function main() {
  const fixtureWorkspace = path.resolve(__dirname, '..', 'fixtures', 'workspace');
  const vscodeExecutablePath = resolveLocalVscodeExecutable();

  await runSuite(
    'trusted',
    path.resolve(__dirname, 'suite', 'trusted.js'),
    [fixtureWorkspace, '--disable-extensions'],
    vscodeExecutablePath,
  );

  await runSuite(
    'restricted',
    path.resolve(__dirname, 'suite', 'restricted.js'),
    [fixtureWorkspace, '--disable-extensions', '--disable-workspace-trust'],
    vscodeExecutablePath,
  );
}

main().catch((error) => {
  console.error('Integration test run failed:', error);
  process.exit(1);
});
