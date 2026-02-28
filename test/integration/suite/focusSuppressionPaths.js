const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toTimeLabel(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function quietWindowIncludingNow(nowMs) {
  const date = new Date(nowMs);
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  const start = minuteOfDay - 1;
  const end = minuteOfDay + 1;
  return `${toTimeLabel(start)}-${toTimeLabel(end)}`;
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  const config = vscode.workspace.getConfiguration('tacos');
  const enabledInspected = config.inspect('enabled');
  const pauseInspected = config.inspect('pauseSummaries');
  const showOnFocusInspected = config.inspect('showOnFocus');
  const quietHoursInspected = config.inspect('summaryQuietHours');
  const originalEnabledGlobal = enabledInspected?.globalValue;
  const originalPauseGlobal = pauseInspected?.globalValue;
  const originalShowOnFocusGlobal = showOnFocusInspected?.globalValue;
  const originalQuietHoursGlobal = quietHoursInspected?.globalValue;

  try {
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await config.update('pauseSummaries', false, vscode.ConfigurationTarget.Global);
    await config.update('showOnFocus', true, vscode.ConfigurationTarget.Global);
    await config.update('summaryQuietHours', '', vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('tacos.__test.setSnoozeUntil', 0);

    await wait(1300);
    const baseline = await vscode.commands.executeCommand('tacos.__test.getFocusSuppressionSnapshot');
    assert.equal(
      baseline?.suppressionReason,
      'none',
      'Expected no focus suppression when enabled/active and outside snooze + quiet windows.',
    );

    await config.update('pauseSummaries', true, vscode.ConfigurationTarget.Global);
    const paused = await vscode.commands.executeCommand('tacos.__test.getFocusSuppressionSnapshot');
    assert.equal(
      paused?.suppressionReason,
      'disabled-or-paused',
      'Expected paused summaries to suppress focus triggers.',
    );

    await config.update('pauseSummaries', false, vscode.ConfigurationTarget.Global);
    await config.update('enabled', false, vscode.ConfigurationTarget.Global);
    const disabled = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSuppressionSnapshot',
    );
    assert.equal(
      disabled?.suppressionReason,
      'disabled-or-paused',
      'Expected disabled extension state to suppress focus triggers.',
    );

    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('tacos.__test.setSnoozeUntil', Date.now() + 10 * 60_000);
    const snoozed = await vscode.commands.executeCommand('tacos.__test.getFocusSuppressionSnapshot');
    assert.equal(
      snoozed?.suppressionReason,
      'snoozed',
      'Expected snooze window to suppress focus triggers.',
    );

    await vscode.commands.executeCommand('tacos.__test.setSnoozeUntil', 0);
    await config.update(
      'summaryQuietHours',
      quietWindowIncludingNow(Date.now()),
      vscode.ConfigurationTarget.Global,
    );
    const quietHours = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSuppressionSnapshot',
    );
    assert.equal(
      quietHours?.suppressionReason,
      'quiet-hours',
      'Expected quiet-hours window to suppress focus triggers.',
    );
  } finally {
    await vscode.commands.executeCommand('tacos.__test.setSnoozeUntil', 0);
    await config.update(
      'enabled',
      typeof originalEnabledGlobal === 'undefined' ? undefined : originalEnabledGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'pauseSummaries',
      typeof originalPauseGlobal === 'undefined' ? undefined : originalPauseGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'showOnFocus',
      typeof originalShowOnFocusGlobal === 'undefined' ? undefined : originalShowOnFocusGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'summaryQuietHours',
      typeof originalQuietHoursGlobal === 'undefined' ? undefined : originalQuietHoursGlobal,
      vscode.ConfigurationTarget.Global,
    );
  }
}

module.exports = {
  run,
};
