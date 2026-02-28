import * as fs from 'node:fs';
import * as path from 'node:path';

interface KeybindingContribution {
  command: string;
  key: string;
  mac?: string;
  when?: string;
}

interface ExtensionPackageJson {
  contributes?: {
    keybindings?: KeybindingContribution[];
  };
}

function getKeybindings(): KeybindingContribution[] {
  const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
  const raw = fs.readFileSync(packageJsonPath, 'utf8');
  const parsed = JSON.parse(raw) as ExtensionPackageJson;
  return parsed.contributes?.keybindings ?? [];
}

describe('package keybinding contributions', () => {
  it('declares low-conflict shortcuts for the top resume actions', () => {
    const keybindings = getKeybindings();
    const byCommand = new Map(keybindings.map((item) => [item.command, item]));

    expect(byCommand.get('tacos.showNow')).toMatchObject({
      key: 'ctrl+alt+t ctrl+alt+s',
      mac: 'cmd+alt+t cmd+alt+s',
      when: 'workbenchState != empty',
    });
    expect(byCommand.get('tacos.copyPromptAndOpenCodex')).toMatchObject({
      key: 'ctrl+alt+t ctrl+alt+p',
      mac: 'cmd+alt+t cmd+alt+p',
      when: 'workbenchState != empty',
    });
    expect(byCommand.get('tacos.addQuickCheckpointNote')).toMatchObject({
      key: 'ctrl+alt+t ctrl+alt+k',
      mac: 'cmd+alt+t cmd+alt+k',
      when: 'workbenchState != empty',
    });
    expect(byCommand.get('tacos.jumpToLastEdit')).toMatchObject({
      key: 'ctrl+alt+t ctrl+alt+j',
      mac: 'cmd+alt+t cmd+alt+j',
      when: 'workbenchState != empty',
    });
    expect(byCommand.get('tacos.restoreWorkingSet')).toMatchObject({
      key: 'ctrl+alt+t ctrl+alt+r',
      mac: 'cmd+alt+t cmd+alt+r',
      when: 'workbenchState != empty',
    });
  });

  it('uses a shared TaCoS prefix chord to minimize default conflicts', () => {
    const keybindings = getKeybindings().filter((binding) =>
      [
        'tacos.showNow',
        'tacos.copyPromptAndOpenCodex',
        'tacos.addQuickCheckpointNote',
        'tacos.jumpToLastEdit',
        'tacos.restoreWorkingSet',
      ].includes(binding.command),
    );

    expect(keybindings).toHaveLength(5);
    for (const binding of keybindings) {
      expect(binding.key.startsWith('ctrl+alt+t ')).toBe(true);
      expect((binding.mac ?? '').startsWith('cmd+alt+t ')).toBe(true);
    }
  });
});
