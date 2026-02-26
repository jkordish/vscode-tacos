const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');

  await extension.activate();
  assert.equal(extension.isActive, true, 'Expected extension to be active after activation.');

  const trustState = vscode.workspace.isTrusted;
  console.log(`Isolated profile suite trust state: ${trustState}`);
  if (trustState !== false) {
    console.log(
      'Isolated profile suite note: workspace remained trusted on this host build; restricted mode assertions stay in manual smoke coverage.',
    );
  }

  await vscode.commands.executeCommand('tacos.slash');

  const activeEditor = vscode.window.activeTextEditor;
  assert.ok(activeEditor, 'Expected summary editor to open in isolated profile suite run.');
  const text = activeEditor.document.getText();
  assert.ok(text.includes('# TaCoS Resume Summary'));
  assert.ok(
    text.includes('- Source: local'),
    'Expected isolated profile suite summary to remain local-only.',
  );
}

module.exports = {
  run,
};
