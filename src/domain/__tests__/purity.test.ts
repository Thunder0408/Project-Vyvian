import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// CLAUDE.md hard rule: src/domain/ is pure TypeScript (no React, no Supabase).
describe('domain purity', () => {
  it('domain modules import only from each other', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(join(dir, file), 'utf8');
      const specifiers = [...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const s of specifiers) {
        expect(s, `${file} imports ${s}`).toMatch(/^\.\//);
      }
    }
  });
});
