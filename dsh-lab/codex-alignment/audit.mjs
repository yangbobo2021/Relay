import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { CodexAppServerClient } from '../../integrations/codex/app-server-client.mjs';
import { CodexSessionRuntime } from '../../integrations/codex/session-runtime.mjs';

// Metadata only: never export raw config, credentials, prompt bodies, or reasoning.
const [command, cwd, output] = process.argv.slice(2);
assert.ok(command && cwd && output, 'usage: node audit.mjs CODEX CWD OUTPUT.json');
const client = new CodexAppServerClient({ command });
const runtime = new CodexSessionRuntime({ client, cwd });
try {
  await runtime.initialize();
  const { config } = await client.request('config/read', { cwd, includeLayers:false });
  const session = await runtime.createSession({ model:config.model, effort:config.model_reasoning_effort,
    sandbox:'read-only', approvalPolicy:'never', ephemeral:true });
  const result = {
    binaryVersion:execFileSync(command,['--version'],{encoding:'utf8'}).trim(),
    binarySha256:createHash('sha256').update(await readFile(command)).digest('hex'),
    identity:client.clientInfo, launchArgs:client.appServerArgs,
    advertisedCapabilities:{experimentalApi:client.capabilities.experimentalApi,requestAttestation:client.capabilities.requestAttestation,
      mcpAppHtml:Boolean(client.capabilities.extensions?.['io.modelcontextprotocol/ui'])},
    configured:{model:config.model,effort:config.model_reasoning_effort,serviceTier:config.service_tier},
    acknowledged:session.nativeSettings,
    checks:{serviceTierInherited:session.nativeSettings.serviceTier===(config.service_tier??'default'),
      truthfulIdentity:client.clientInfo.name==='relay_codex',noUnsupportedAttestation:client.capabilities.requestAttestation===false},
  };
  await writeFile(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  assert.ok(Object.values(result.checks).every(Boolean));
} finally { await runtime.close(); }
