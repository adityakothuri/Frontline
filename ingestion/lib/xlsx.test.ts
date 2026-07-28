import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readXlsxSheet, readXlsxTable } from './xlsx.ts';

const run = promisify(execFile);

/**
 * The case that matters is the sparse row. Excel omits empty cells entirely, so
 * a reader that walks cells positionally shifts every later value one column
 * left — which in the American Job Centers file would put a city name in the
 * phone column on any row with a blank Address2. These fixtures are built with
 * `zip` so they are real .xlsx containers, not mocks of one.
 */

let dir: string;

const SHARED_STRINGS = `<?xml version="1.0"?>
<sst count="6" uniqueCount="6">
  <si><t>Name</t></si>
  <si><t>Addr2</t></si>
  <si><t>City</t></si>
  <si><t>Smith &amp; Jones &lt;Center&gt;</t></si>
  <si><t>Anchorage</t></si>
  <si><r><t>Split </t></r><r><t>Runs</t></r></si>
</sst>`;

// Row 2 deliberately SKIPS column B (a blank Address2), and row 3 uses an
// inline string plus a self-closing styled-but-empty cell.
const SHEET = `<?xml version="1.0"?>
<worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
  <row r="2"><c r="A2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row>
  <row r="3"><c r="A3" t="inlineStr"><is><t>Inline &amp; Co</t></is></c><c r="B3" s="1"/><c r="C3"><v>42.5</v></c></row>
  <row r="4"><c r="A4" t="s"><v>5</v></c></row>
</sheetData></worksheet>`;

async function buildXlsx(name: string, sheet: string, shared: string | null): Promise<string> {
  const stage = join(dir, name);
  await run('mkdir', ['-p', join(stage, 'xl', 'worksheets')]);
  await writeFile(join(stage, 'xl', 'worksheets', 'sheet1.xml'), sheet);
  if (shared !== null) await writeFile(join(stage, 'xl', 'sharedStrings.xml'), shared);
  const path = `${stage}.xlsx`;
  await run('zip', ['-r', '-q', path, 'xl'], { cwd: stage });
  return path;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'xlsx-test-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('readXlsxSheet', () => {
  it('keys cells by column letter so a skipped cell cannot shift later columns', async () => {
    const path = await buildXlsx('sparse', SHEET, SHARED_STRINGS);
    const rows = await readXlsxSheet(path);
    // Row 2 has no B cell at all; C must still be C.
    expect(rows[1]).toEqual({ A: 'Smith & Jones <Center>', C: 'Anchorage' });
    expect(rows[1].B).toBeUndefined();
  });

  it('resolves shared strings and unescapes XML entities', async () => {
    const path = await buildXlsx('entities', SHEET, SHARED_STRINGS);
    const rows = await readXlsxSheet(path);
    expect(rows[1].A).toBe('Smith & Jones <Center>');
  });

  it('concatenates multi-run shared strings', async () => {
    const path = await buildXlsx('runs', SHEET, SHARED_STRINGS);
    const rows = await readXlsxSheet(path);
    expect(rows[3].A).toBe('Split Runs');
  });

  it('reads inline strings, numbers, and skips self-closing empty cells', async () => {
    const path = await buildXlsx('inline', SHEET, SHARED_STRINGS);
    const rows = await readXlsxSheet(path);
    expect(rows[2].A).toBe('Inline & Co');
    expect(rows[2].B).toBeUndefined();
    expect(rows[2].C).toBe('42.5');
  });

  it('works when the workbook has no sharedStrings.xml', async () => {
    const sheet = `<?xml version="1.0"?><worksheet><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t>Only</t></is></c><c r="B1"><v>7</v></c></row>
    </sheetData></worksheet>`;
    const path = await buildXlsx('noshared', sheet, null);
    const rows = await readXlsxSheet(path);
    expect(rows[0]).toEqual({ A: 'Only', B: '7' });
  });
});

describe('readXlsxTable', () => {
  it('keys rows by header text and omits absent cells', async () => {
    const path = await buildXlsx('table', SHEET, SHARED_STRINGS);
    const rows = await readXlsxTable(path);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ Name: 'Smith & Jones <Center>', City: 'Anchorage' });
    expect(rows[0].Addr2).toBeUndefined();
    expect(rows[1]).toEqual({ Name: 'Inline & Co', City: '42.5' });
  });
});
