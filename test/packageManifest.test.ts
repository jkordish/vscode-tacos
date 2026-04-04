import * as fs from 'node:fs';
import * as path from 'node:path';

interface CommandContribution {
  command: string;
  title: string;
}

interface ConfigurationProperty {
  type?: string;
  default?: unknown;
  minimum?: number;
  description?: string;
}

interface ExtensionPackageJson {
  activationEvents?: string[];
  contributes?: {
    commands?: CommandContribution[];
    configuration?: {
      properties?: Record<string, ConfigurationProperty>;
    };
  };
}

function readPackageJson(): ExtensionPackageJson {
  const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as ExtensionPackageJson;
}

describe('package manifest resume safety contributions', () => {
  it('declares the manual Resume Safety Check command and activation event', () => {
    const manifest = readPackageJson();
    const commands = new Map(
      (manifest.contributes?.commands ?? []).map((entry) => [entry.command, entry]),
    );

    expect(commands.get('tacos.showResumeSafetyCheck')).toMatchObject({
      title: 'TaCoS: Show Resume Safety Check',
    });
    expect(manifest.activationEvents ?? []).toContain('onCommand:tacos.showResumeSafetyCheck');
  });

  it('declares the resume safety settings with sane defaults', () => {
    const manifest = readPackageJson();
    const properties = manifest.contributes?.configuration?.properties ?? {};

    expect(properties['tacos.resumeSafety.enabled']).toMatchObject({
      type: 'boolean',
      default: true,
    });
    expect(properties['tacos.resumeSafety.idleMinutes']).toMatchObject({
      type: 'number',
      default: 10,
      minimum: 1,
    });
    expect(properties['tacos.resumeSafety.strict']).toMatchObject({
      type: 'boolean',
      default: false,
    });
    expect(properties['tacos.taskCheckpoint.enabled']).toMatchObject({
      type: 'boolean',
      default: true,
    });
    expect(properties['tacos.taskCheckpoint.promptOnLikelySwitch']).toMatchObject({
      type: 'boolean',
      default: true,
    });
  });

  it('declares the cognitive observability commands and activation events', () => {
    const manifest = readPackageJson();
    const commands = new Map(
      (manifest.contributes?.commands ?? []).map((entry) => [entry.command, entry]),
    );

    expect(commands.get('tacos.captureTaskCheckpoint')).toMatchObject({
      title: 'TaCoS: Capture Task Checkpoint',
    });
    expect(commands.get('tacos.markTaskResolved')).toMatchObject({
      title: 'TaCoS: Mark Task Resolved',
    });
    expect(commands.get('tacos.confirmTaskSwitch')).toMatchObject({
      title: 'TaCoS: Confirm Task Switch',
    });
    expect(commands.get('tacos.showCognitiveDebrief')).toMatchObject({
      title: 'TaCoS: Show Cognitive Debrief',
    });
    expect(manifest.activationEvents ?? []).toContain('onCommand:tacos.captureTaskCheckpoint');
    expect(manifest.activationEvents ?? []).toContain('onCommand:tacos.markTaskResolved');
    expect(manifest.activationEvents ?? []).toContain('onCommand:tacos.confirmTaskSwitch');
    expect(manifest.activationEvents ?? []).toContain('onCommand:tacos.showCognitiveDebrief');
  });

  it('declares the showSessionFrictionSummary command and activation event (P16)', () => {
    const manifest = readPackageJson();
    const commands = new Map(
      (manifest.contributes?.commands ?? []).map((entry) => [entry.command, entry]),
    );

    expect(commands.get('tacos.showSessionFrictionSummary')).toMatchObject({
      title: 'TaCoS: Show Session Friction Summary',
    });
    expect(manifest.activationEvents ?? []).toContain('onCommand:tacos.showSessionFrictionSummary');
  });
});
