import { describe, it, expect } from 'vitest';
import { parseEnvFile } from '../src/analyzer/env-vars.js';

describe('parseEnvFile', () => {
  it('parses names and example values', () => {
    const vars = parseEnvFile('PORT=3000\nDATABASE_URL=');
    expect(vars).toHaveLength(2);
    expect(vars[0]).toMatchObject({ name: 'PORT', example: '3000', required: false });
    expect(vars[1]).toMatchObject({ name: 'DATABASE_URL', example: null, required: true });
  });

  it('captures the preceding comment as description', () => {
    const vars = parseEnvFile('# Stripe secret key\nSTRIPE_KEY=');
    expect(vars[0]?.description).toBe('Stripe secret key');
  });

  it('strips quotes and the export prefix', () => {
    const vars = parseEnvFile('export TOKEN="abc123"');
    expect(vars[0]).toMatchObject({ name: 'TOKEN', example: 'abc123' });
  });

  it('ignores blank lines and standalone comments', () => {
    const vars = parseEnvFile('\n# just a comment\n\nAPI_URL=https://x.test\n');
    expect(vars).toHaveLength(1);
    expect(vars[0]?.name).toBe('API_URL');
  });

  it('does not leak a comment onto a later variable', () => {
    const vars = parseEnvFile('# desc for A\nA=1\nB=2');
    expect(vars[0]?.description).toBe('desc for A');
    expect(vars[1]?.description).toBe('');
  });
});
