import { spawnSync } from 'node:child_process';

const networkName = 'shifts-supabase';
const optionName = 'com.docker.network.bridge.host_binding_ipv4';
const expectedBinding = '127.0.0.1';
const format = `{{ index .Options "${optionName}" }}`;

const inspection = spawnSync('docker', ['network', 'inspect', networkName, '--format', format], {
  encoding: 'utf8',
});

if (inspection.error) {
  throw inspection.error;
}

if (inspection.status === 0) {
  const currentBinding = inspection.stdout.trim();

  if (currentBinding !== expectedBinding) {
    throw new Error(
      `A Docker network ${networkName} já existe com ${optionName}=${currentBinding || '<ausente>'}; ` +
        `esperado ${expectedBinding}. Não remova nem recrie a rede sem aprovação.`,
    );
  }

  process.exit(0);
}

const inspectionError = `${inspection.stdout}\n${inspection.stderr}`;
if (!/no such network|not found/i.test(inspectionError)) {
  process.stderr.write(inspection.stderr);
  process.exit(inspection.status ?? 1);
}

const creation = spawnSync(
  'docker',
  [
    'network',
    'create',
    '--driver',
    'bridge',
    '--opt',
    `${optionName}=${expectedBinding}`,
    networkName,
  ],
  { stdio: 'inherit' },
);

if (creation.error) {
  throw creation.error;
}

process.exit(creation.status ?? 1);
