'use strict';

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

  // 1. Open the panel so checkpoint card is rendered.
  await vscode.commands.executeCommand('tacos.showNow');
  await wait(200);

  const runtime = await vscode.commands.executeCommand('tacos.__test.getRuntimeStateSnapshot');
  assert.equal(runtime?.panelOpen, true, 'Expected panel to be open after tacos.showNow.');

  // 2. Seed a checkpoint note into the current partition scope.
  const seeded = await vscode.commands.executeCommand('tacos.__test.seedCheckpointNote', {
    text: 'Verify rollback guard passes before proceeding',
  });
  assert.ok(seeded, 'Expected seedCheckpointNote to return a note descriptor.');
  assert.equal(typeof seeded.id, 'string', 'Expected seeded note to have an id.');
  assert.equal(seeded.status, 'open', 'Expected seeded note to have open status.');

  await wait(100);

  // 3. Assert: note is reflected in the panel checkpoint snapshot.
  const beforeDismiss = await vscode.commands.executeCommand(
    'tacos.__test.getPanelCheckpointSnapshot',
  );
  assert.ok(
    beforeDismiss,
    'Expected getPanelCheckpointSnapshot to return a snapshot.',
  );
  assert.equal(
    beforeDismiss.primaryNoteId,
    seeded.id,
    'Expected panel primary note to match the seeded note id.',
  );
  assert.equal(
    beforeDismiss.primaryNoteStatus,
    'open',
    'Expected panel primary note status to be open.',
  );
  assert.equal(
    beforeDismiss.panelHasCheckpointDismissAction,
    true,
    'Expected panel HTML to contain checkpointDismiss action.',
  );
  assert.equal(
    beforeDismiss.panelHasNoteIdAttr,
    true,
    'Expected panel HTML to contain data-note-id attribute for the seeded note.',
  );

  // 4. Assert: undo buffer is null before any dismiss.
  assert.equal(
    beforeDismiss.undoBufferNoteId,
    null,
    'Expected undo buffer to be null before any dismiss.',
  );

  // 5. Dismiss the note via the test command surface (exercises extension-side dismiss logic
  //    including undo buffer population and TTL timer setup — same code path as the webview
  //    checkpointDismiss message handler).
  const dismissResult = await vscode.commands.executeCommand(
    'tacos.__test.dismissCheckpointNote',
  );
  assert.ok(dismissResult, 'Expected dismissCheckpointNote to return a result.');
  assert.equal(dismissResult.ok, true, 'Expected dismiss to succeed.');
  assert.equal(dismissResult.noteId, seeded.id, 'Expected dismissed note id to match seeded id.');

  await wait(50);

  // 6. Assert: undo buffer is now populated with the dismissed note id.
  const afterDismiss = await vscode.commands.executeCommand(
    'tacos.__test.getPanelCheckpointSnapshot',
  );
  assert.ok(afterDismiss, 'Expected getPanelCheckpointSnapshot after dismiss to return a snapshot.');
  assert.equal(
    afterDismiss.undoBufferNoteId,
    seeded.id,
    'Expected undo buffer note id to match the dismissed note id.',
  );
  assert.equal(
    afterDismiss.undoBufferExpired,
    false,
    'Expected undo buffer to not be expired immediately after dismiss.',
  );
  // The dismissed note should no longer be the primary open note.
  assert.equal(
    afterDismiss.primaryNoteId,
    null,
    'Expected primary note to be cleared after dismiss.',
  );

  // 7. Undo the dismiss via the test command surface (exercises extension-side undoDeleteNote logic
  //    including buffer consumption, note restoration to open status, and metric increment).
  const undoResult = await vscode.commands.executeCommand(
    'tacos.__test.undoCheckpointNoteDismiss',
    { noteId: seeded.id },
  );
  assert.ok(undoResult, 'Expected undoCheckpointNoteDismiss to return a result.');
  assert.equal(undoResult.ok, true, 'Expected undo to succeed.');
  assert.equal(undoResult.noteId, seeded.id, 'Expected undone note id to match seeded id.');

  await wait(50);

  // 8. Assert: note is restored to open status and undo buffer is cleared.
  const afterUndo = await vscode.commands.executeCommand(
    'tacos.__test.getPanelCheckpointSnapshot',
  );
  assert.ok(afterUndo, 'Expected getPanelCheckpointSnapshot after undo to return a snapshot.');
  assert.equal(
    afterUndo.undoBufferNoteId,
    null,
    'Expected undo buffer to be cleared after undo.',
  );
  assert.equal(
    afterUndo.primaryNoteId,
    seeded.id,
    'Expected restored note to be the primary note again.',
  );
  assert.equal(
    afterUndo.primaryNoteStatus,
    'open',
    'Expected restored note status to be open.',
  );

  // 9. Reset runtime state to confirm a clean teardown path.
  await vscode.commands.executeCommand('tacos.__test.resetRuntimeWorkspaceState');
  await wait(50);

  const afterReset = await vscode.commands.executeCommand(
    'tacos.__test.getPanelCheckpointSnapshot',
  );
  assert.equal(afterReset?.primaryNoteId, null, 'Expected primary note to be cleared after reset.');
  assert.equal(
    afterReset?.undoBufferNoteId,
    null,
    'Expected undo buffer to be cleared after reset.',
  );
}

module.exports = {
  run,
};
