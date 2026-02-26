const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');

  await extension.activate();
  assert.equal(extension.isActive, true, 'Expected extension to be active after activation.');

  await vscode.commands.executeCommand('tacos.slash');

  const activeEditor = vscode.window.activeTextEditor;
  assert.ok(activeEditor, 'Expected summary editor to be opened by tacos.slash.');
  assert.equal(activeEditor.document.languageId, 'markdown');
  assert.ok(
    activeEditor.document.getText().includes('# TaCoS Resume Summary'),
    'Expected generated summary markdown to contain TaCoS header.',
  );

  await vscode.commands.executeCommand('tacos.showLastSummary');

  // Allow panel reveal pipeline to finish; command should resolve without throwing.
  await wait(250);
}

module.exports = {
  run,
};
