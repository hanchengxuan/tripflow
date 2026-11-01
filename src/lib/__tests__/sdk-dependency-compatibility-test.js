const { describe, expect, it } = require('@jest/globals');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const path = require('node:path');
const decode = require('decode-uri-component');

const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const queryString = routerRequire('query-string');
const expoRequire = createRequire(require.resolve('expo/package.json'));
const cliRoot = path.dirname(expoRequire.resolve('@expo/cli/package.json'));
const cliRequire = createRequire(path.join(cliRoot, 'package.json'));
const { PluginSchema, DevToolsPluginOutputSchema } = cliRequire('./build/src/start/server/DevToolsPlugin.schema.js');
const { createMCPDevToolsExtensionSchema } = cliRequire('./build/src/start/server/createMCPDevToolsExtensionSchema.js');

describe('SDK security dependency compatibility', () => {
  it('keeps URL query decoding and the legacy CommonJS function contract', () => {
    expect(typeof decode).toBe('function');
    expect(decode('hello+world')).toBe('hello world');
    expect(decode('%FF%C3%A5')).toBe('%FFå');
    expect(queryString.parse('city=%E6%9D%B1%E4%BA%AC&note=hello+world&tag=a&tag=b')).toEqual({ city: '東京', note: 'hello world', tag: ['a', 'b'] });
    expect(queryString.parse(queryString.stringify({ invite: 'a+b / 東京' }))).toEqual({ invite: 'a+b / 東京' });
  });

  it('finishes malformed URI runs without recursive or repeated replacement exhaustion', () => {
    const result = spawnSync(process.execPath, ['-e', "const decode=require('decode-uri-component'); const input='%FF'.repeat(50000)+'%E6%9D%B1'; if(decode(input)!=='%FF'.repeat(50000)+'東')process.exit(1)"], {
      cwd: path.dirname(require.resolve('../../../package.json')), timeout: 3000, encoding: 'utf8',
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });

  it('parses and rejects real Expo CLI plugin commands with the patched Zod version', () => {
    const plugin = PluginSchema.parse({
      packageName: 'synthetic-plugin', packageRoot: '/tmp/synthetic-plugin',
      cliExtensions: { description: 'Synthetic command', entryPoint: 'cli.js', commands: [{ name: 'inspect', title: 'Inspect', environments: ['cli', 'mcp'], parameters: [{ name: 'count', type: 'number' }] }] },
    });
    const schema = createMCPDevToolsExtensionSchema(plugin);
    expect(schema.parse({ command: 'inspect', count: 2 })).toEqual({ command: 'inspect', count: 2 });
    expect(schema.safeParse({ command: 'inspect', count: 'two' }).success).toBe(false);
    expect(schema.safeParse({ command: 'inspect', extra: true }).success).toBe(false);
    expect(DevToolsPluginOutputSchema.parse([{ type: 'text', text: 'Ready', level: 'info' }])).toEqual([{ type: 'text', text: 'Ready', level: 'info' }]);
  });

  it('rejects oversized constrained collections before accumulating per-element errors', () => {
    const { z } = cliRequire('zod');
    const result = z.array(z.string()).max(1).safeParse(Array(5000).fill(1));
    expect(result.success).toBe(false);
    expect(result.error.issues).toHaveLength(1);
  });
});
