const assert = require('node:assert/strict');
const path = require('node:path');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  const folders = vscode.workspace.workspaceFolders ?? [];
  assert.ok(folders.length >= 2, 'Expected multi-root workspace to have at least two folders.');

  const firstRoot = folders[0].uri.fsPath;
  const secondRoot = folders[1].uri.fsPath;

  const secondFile = vscode.Uri.file(path.join(secondRoot, 'src', 'index.ts'));
  const secondDocument = await vscode.workspace.openTextDocument(secondFile);
  await vscode.window.showTextDocument(secondDocument);

  const activePick = await vscode.commands.executeCommand('tacos.__test.pickWorkspaceRoot');
  assert.equal(
    activePick,
    secondRoot,
    'Expected workspace root picker to follow the active editor workspace.',
  );

  const preferredPick = await vscode.commands.executeCommand(
    'tacos.__test.pickWorkspaceRoot',
    firstRoot,
  );
  assert.equal(preferredPick, firstRoot, 'Expected explicit preferred root to win when valid.');

  const invalidPreferredPick = await vscode.commands.executeCommand(
    'tacos.__test.pickWorkspaceRoot',
    '/definitely/not/in/workspace',
  );
  assert.equal(
    invalidPreferredPick,
    secondRoot,
    'Expected invalid preferred root to be ignored in favor of active workspace root.',
  );
}

module.exports = {
  run,
};
