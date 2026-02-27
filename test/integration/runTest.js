const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
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

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function prepareRestrictedUserDataDir() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-tacos-restricted-'));
  const settingsPath = path.join(userDataDir, 'User', 'settings.json');

  writeJsonFile(settingsPath, {
    // Keep workspace trust enabled and default new folders to Restricted Mode in test profile.
    'security.workspace.trust.enabled': true,
    'security.workspace.trust.startupPrompt': 'never',
    'security.workspace.trust.emptyWindow': false,
    'security.workspace.trust.banner': 'never',
  });

  return userDataDir;
}

async function main() {
  const fixtureWorkspace = path.resolve(__dirname, '..', 'fixtures', 'workspace');
  const multiRootWorkspace = path.resolve(__dirname, '..', 'fixtures', 'multi-root.code-workspace');
  const vscodeExecutablePath = resolveLocalVscodeExecutable();
  const restrictedUserDataDir = prepareRestrictedUserDataDir();

  try {
    await runSuite(
      'trusted',
      path.resolve(__dirname, 'suite', 'trusted.js'),
      [fixtureWorkspace, '--disable-extensions'],
      vscodeExecutablePath,
    );

    await runSuite(
      'isolated-profile-local',
      path.resolve(__dirname, 'suite', 'isolatedProfileLocal.js'),
      [fixtureWorkspace, '--disable-extensions', '--user-data-dir', restrictedUserDataDir],
      vscodeExecutablePath,
    );

    await runSuite(
      'focus-refresh-presentation',
      path.resolve(__dirname, 'suite', 'focusRefreshPresentation.js'),
      [fixtureWorkspace, '--disable-extensions'],
      vscodeExecutablePath,
    );

    await runSuite(
      'partition-scope',
      path.resolve(__dirname, 'suite', 'partitionScope.js'),
      [fixtureWorkspace, '--disable-extensions'],
      vscodeExecutablePath,
    );

    await runSuite(
      'partition-switch-reset',
      path.resolve(__dirname, 'suite', 'partitionSwitchReset.js'),
      [fixtureWorkspace, '--disable-extensions'],
      vscodeExecutablePath,
    );

    await runSuite(
      'multi-root-scope',
      path.resolve(__dirname, 'suite', 'multiRootScope.js'),
      [multiRootWorkspace, '--disable-extensions'],
      vscodeExecutablePath,
    );
  } finally {
    fs.rmSync(restrictedUserDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('Integration test run failed:', error);
  process.exit(1);
});
