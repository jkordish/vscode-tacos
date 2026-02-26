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

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '..', '..');
  const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.js');
  const fixtureWorkspace = path.resolve(__dirname, '..', 'fixtures', 'workspace');
  const vscodeExecutablePath = resolveLocalVscodeExecutable();

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    ...(vscodeExecutablePath ? { vscodeExecutablePath } : {}),
    launchArgs: [fixtureWorkspace, '--disable-extensions'],
  });
}

main().catch((error) => {
  console.error('Integration test run failed:', error);
  process.exit(1);
});
