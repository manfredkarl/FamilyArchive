#!/usr/bin/env node

/**
 * generate-docs.ts
 *
 * Parses Gherkin .feature files and matches them with Playwright screenshots
 * to produce MkDocs-compatible markdown pages — one page per feature,
 * each scenario rendered as a visual step-by-step walkthrough.
 *
 * Usage:  npx ts-node scripts/generate-docs.ts
 *
 * Input:
 *   specs/features/*.feature        — Gherkin source files
 *   docs/screenshots/{feature}/     — screenshots captured by Cucumber hooks
 *
 * Output:
 *   docs/features/{feature-slug}.md — one MkDocs page per feature
 *   docs/nav.yml                    — auto-generated navigation partial
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Gherkin from '@cucumber/gherkin';
import * as Messages from '@cucumber/messages';

// ── Paths ──────────────────────────────────────────────────────
const ROOT = process.cwd();
const FEATURES_DIR = path.join(ROOT, 'specs', 'features');
const SCREENSHOTS_DIR = path.join(ROOT, 'docs', 'screenshots');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'features');
const INDEX_FILE = path.join(ROOT, 'docs', 'index.md');

// ── Helpers ────────────────────────────────────────────────────
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function findScreenshots(featureSlug: string, scenarioSlug: string): string[] {
  const dir = path.join(SCREENSHOTS_DIR, featureSlug, scenarioSlug);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.png') && !f.startsWith('999-'))
    .sort();
}

function findFinalScreenshot(featureSlug: string, scenarioSlug: string): string | undefined {
  const dir = path.join(SCREENSHOTS_DIR, featureSlug, scenarioSlug);
  if (!fs.existsSync(dir)) return undefined;
  const finals = fs.readdirSync(dir).filter(f => f.startsWith('999-'));
  return finals[0];
}

function stepTextFromFilename(filename: string): string {
  // "001-the-user-logs-in.png" → "The user logs in"
  const withoutExt = filename.replace(/\.png$/, '');
  const withoutIndex = withoutExt.replace(/^\d+-/, '');
  const words = withoutIndex.split('-').filter(Boolean);
  if (words.length === 0) return filename;
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ');
}

// ── Gherkin Parsing ────────────────────────────────────────────
interface ParsedScenario {
  name: string;
  slug: string;
  tags: string[];
  steps: { keyword: string; text: string }[];
  description: string;
}

interface ParsedFeature {
  name: string;
  slug: string;
  description: string;
  tags: string[];
  scenarios: ParsedScenario[];
  sourceFile: string;
  rawGherkin: string;
}

function parseFeatureFile(filepath: string): ParsedFeature | null {
  const source = fs.readFileSync(filepath, 'utf-8');

  const uuidFn = Messages.IdGenerator.uuid();
  const builder = new Gherkin.AstBuilder(uuidFn);
  const matcher = new Gherkin.GherkinClassicTokenMatcher();

  let gherkinDoc: Messages.GherkinDocument;
  try {
    const parser = new Gherkin.Parser(builder, matcher);
    gherkinDoc = parser.parse(source) as unknown as Messages.GherkinDocument;
  } catch (e) {
    console.warn(`  ⚠ Could not parse ${filepath}: ${(e as Error).message}`);
    return null;
  }

  const feature = gherkinDoc.feature;
  if (!feature) return null;

  const scenarios: ParsedScenario[] = (feature.children || [])
    .filter(child => child.scenario)
    .map(child => {
      const sc = child.scenario!;
      return {
        name: sc.name,
        slug: slugify(sc.name),
        tags: (sc.tags || []).map(t => t.name),
        steps: (sc.steps || []).map(s => ({
          keyword: (s.keyword || '').trim(),
          text: s.text,
        })),
        description: sc.description?.trim() || '',
      };
    });

  return {
    name: feature.name,
    slug: slugify(feature.name),
    description: feature.description?.trim() || '',
    tags: (feature.tags || []).map(t => t.name),
    scenarios,
    sourceFile: path.basename(filepath),
    rawGherkin: source,
  };
}

// ── Markdown Generation ────────────────────────────────────────
function generateFeaturePage(feature: ParsedFeature): string {
  const lines: string[] = [];

  lines.push(`# ${feature.name}`);
  lines.push('');

  if (feature.tags.length > 0) {
    lines.push(feature.tags.map(t => `\`${t}\``).join(' '));
    lines.push('');
  }

  if (feature.description) {
    lines.push(feature.description);
    lines.push('');
  }

  // Collapsible Gherkin source
  lines.push('<details>');
  lines.push('<summary><strong>📄 Gherkin Source</strong> — click to expand</summary>');
  lines.push('');
  lines.push('```gherkin');
  lines.push(feature.rawGherkin.trim());
  lines.push('```');
  lines.push('</details>');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Scenario table of contents
  if (feature.scenarios.length > 1) {
    lines.push('## Scenarios');
    lines.push('');
    for (const sc of feature.scenarios) {
      lines.push(`- [${sc.name}](#${sc.slug})`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Each scenario
  for (const scenario of feature.scenarios) {
    lines.push(`## ${scenario.name} {#${scenario.slug}}`);
    lines.push('');

    if (scenario.tags.length > 0) {
      lines.push(scenario.tags.map(t => `\`${t}\``).join(' '));
      lines.push('');
    }

    if (scenario.description) {
      lines.push(scenario.description);
      lines.push('');
    }

    const screenshots = findScreenshots(feature.slug, scenario.slug);
    const finalScreenshot = findFinalScreenshot(feature.slug, scenario.slug);

    if (screenshots.length > 0) {
      // Step-by-step walkthrough with screenshots
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        const matchingScreenshot = screenshots.find(s => s.startsWith(String(i + 1).padStart(3, '0')));
        const relPath = matchingScreenshot
          ? `../screenshots/${feature.slug}/${scenario.slug}/${matchingScreenshot}`
          : undefined;

        lines.push(`**${step.keyword}** ${step.text}`);
        lines.push('');
        if (relPath) {
          lines.push(`![${step.keyword} ${step.text}](${relPath})`);
          lines.push('');
        }
      }

      if (finalScreenshot) {
        const relPath = `../screenshots/${feature.slug}/${scenario.slug}/${finalScreenshot}`;
        const label = finalScreenshot.includes('failure') ? '❌ Final State (Failure)' : '✅ Final State';
        lines.push(`### ${label}`);
        lines.push('');
        lines.push(`![Final state](${relPath})`);
        lines.push('');
      }
    } else {
      // No screenshots yet — show steps as a list
      lines.push('!!! note "Screenshots not yet captured"');
      lines.push('    Run the test suite to generate step-by-step screenshots.');
      lines.push('');
      for (const step of scenario.steps) {
        lines.push(`- **${step.keyword}** ${step.text}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function generateIndex(features: ParsedFeature[]): string {
  const lines: string[] = [];

  lines.push('# Application User Manual');
  lines.push('');
  lines.push('This documentation is auto-generated from Gherkin feature specifications');
  lines.push('and Playwright test screenshots. Each page shows a feature as a visual');
  lines.push('step-by-step walkthrough — the living specification of how the application works.');
  lines.push('');
  lines.push('## Features');
  lines.push('');

  for (const f of features) {
    const scenarioCount = f.scenarios.length;
    const tagsStr = f.tags.length > 0 ? ` ${f.tags.join(' ')}` : '';
    lines.push(`- [**${f.name}**](features/${f.slug}.md) — ${scenarioCount} scenario${scenarioCount !== 1 ? 's' : ''}${tagsStr}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Generated by spec2cloud. Re-run `npm run docs:generate` after test execution to update.*');

  return lines.join('\n');
}

function generateMkDocsNav(features: ParsedFeature[]): string {
  const lines: string[] = [];
  lines.push('nav:');
  lines.push('  - Home: index.md');
  lines.push('  - Features:');
  for (const f of features) {
    lines.push(`    - "${f.name}": features/${f.slug}.md`);
  }
  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────
function main() {
  console.log('📖 Generating documentation from Gherkin features...');
  console.log(`   Features dir:    ${FEATURES_DIR}`);
  console.log(`   Screenshots dir: ${SCREENSHOTS_DIR}`);
  console.log(`   Output dir:      ${OUTPUT_DIR}`);
  console.log('');

  // Ensure output dir exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Find all .feature files
  if (!fs.existsSync(FEATURES_DIR)) {
    console.log('   No specs/features/ directory found. Nothing to generate.');
    return;
  }

  const featureFiles = fs.readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('.feature'))
    .sort();

  if (featureFiles.length === 0) {
    console.log('   No .feature files found. Nothing to generate.');
    return;
  }

  console.log(`   Found ${featureFiles.length} feature file(s):`);

  const features: ParsedFeature[] = [];
  for (const file of featureFiles) {
    const filepath = path.join(FEATURES_DIR, file);
    const parsed = parseFeatureFile(filepath);
    if (parsed) {
      features.push(parsed);
      console.log(`   ✓ ${file} → ${parsed.scenarios.length} scenario(s)`);
    }
  }

  // Generate feature pages
  for (const feature of features) {
    const md = generateFeaturePage(feature);
    const outPath = path.join(OUTPUT_DIR, `${feature.slug}.md`);
    fs.writeFileSync(outPath, md, 'utf-8');
  }

  // Generate index
  const indexMd = generateIndex(features);
  fs.writeFileSync(INDEX_FILE, indexMd, 'utf-8');

  // Generate nav partial
  const nav = generateMkDocsNav(features);
  fs.writeFileSync(path.join(ROOT, 'docs', 'nav.yml'), nav, 'utf-8');

  console.log('');
  console.log(`   ✅ Generated ${features.length} feature page(s)`);
  console.log(`   ✅ Updated docs/index.md`);
  console.log(`   ✅ Updated docs/nav.yml`);
  console.log('');
  console.log('   Run "npm run docs:serve" to preview the documentation site.');
}

main();
