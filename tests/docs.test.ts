import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { samplePlan, explainPlan } from './fixtures/plans.js';

it('declares MIT in package metadata and LICENSE', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { license?: string; files?: string[] };
  const license = readFileSync(new URL('../LICENSE', import.meta.url), 'utf8');
  expect(pkg.license).toBe('MIT');
  expect(pkg.files).toEqual(
    expect.arrayContaining(['LICENSE', 'CHANGELOG.md']),
  );
  expect(license).toMatch(/^MIT License\b/);
});

it('keeps the README examples identical to the shared fixtures', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  expect(readme).toContain(samplePlan);
  expect(readme).toContain(explainPlan);
  const examples = [...readme.matchAll(/```json\n([\s\S]*?)\n```/g)].map(
    (match) => JSON.parse(match[1]!),
  );
  for (const format of ['.excalidraw', '.png']) {
    expect(examples).toContainEqual({
      name: 'visualize',
      arguments: { plan: samplePlan, format },
    });
  }
});
