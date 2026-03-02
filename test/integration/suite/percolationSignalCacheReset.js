const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  await vscode.commands.executeCommand('tacos.showNow');
  await wait(150);

  const beforeReset = await vscode.commands.executeCommand('tacos.__test.getRuntimeStateSnapshot');
  assert.ok(
    (beforeReset?.percolationSignalCacheEntries ?? 0) > 0,
    'Expected percolation signal cache to be populated after generating a summary.',
  );

  await vscode.commands.executeCommand('tacos.__test.resetRuntimeWorkspaceState');
  const afterReset = await vscode.commands.executeCommand('tacos.__test.getRuntimeStateSnapshot');
  assert.equal(
    afterReset?.percolationSignalCacheEntries,
    0,
    'Expected resetRuntimeWorkspaceState to clear percolation signal cache entries.',
  );
}

module.exports = {
  run,
};
