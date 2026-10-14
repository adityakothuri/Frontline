/**
 * Minimal XLSX reader — just enough to read a single-sheet bulk download.
 *
 * WHY NOT A LIBRARY
 *
 * The only provider that ships XLSX is CareerOneStop (American Job Centers), and
 * pulling in `xlsx`/`exceljs` for one adapter means a new production dependency
 * that needs approval, carries a real CVE history, and would sit in the repo to
 * parse exactly one file shape. An .xlsx is a zip of XML, `unzip` is already on
 * macOS and on GitHub's ubuntu runners, and the two files we need are simple.
 *
 * WHAT IT HANDLES
 *
 * Cells keyed by column letter (NOT position) — this is the part a naive reader
 * gets wrong. Excel omits empty cells entirely, so `<c r="D2">` may follow
 * `<c r="A2">` with nothing between; reading cells positionally silently shifts
 * every value after the first blank into the wrong column. Also handles the
 * shared-string table (`t="s"`), inline strings, numbers, and `&`/`<` escapes.
 *
 * WHAT IT DOES NOT
 *
 * No styles, no dates (Excel serial dates come back as raw numbers), no formulas
 * beyond their cached value, no multi-sheet selection beyond `sheet1.xml`. If a
 * future source needs any of that, that is the moment to reconsider a library.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Excel entity escapes, plus numeric character references. */
function unescapeXml(s: string): string {
  return (
    s
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      // Ampersand last, so `&amp;lt;` does not become `<`.
      .replace(/&amp;/g, '&')
  );
}

/** Concatenate the `<t>` runs inside one shared-string `<si>`. */
function textRuns(fragment: string): string {
  const runs = [...fragment.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]));
  return runs.join('');
}

async function readMember(path: string, member: string): Promise<string> {
  // `unzip -p` streams one member to stdout. The largest member we read is ~3 MB.
  const { stdout } = await run('unzip', ['-p', path, member], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf8',
  });
  return stdout;
}

/**
 * Read `xl/worksheets/sheet1.xml` as rows of `{ [columnLetter]: value }`.
 * Absent cells are simply missing from the record — callers should treat a
 * missing key and an empty string the same way.
 */
export async function readXlsxSheet(path: string): Promise<Record<string, string>[]> {
  const [sheet, sharedRaw] = await Promise.all([
    readMember(path, 'xl/worksheets/sheet1.xml'),
    // A workbook with no repeated strings has no sharedStrings.xml at all.
    readMember(path, 'xl/sharedStrings.xml').catch(() => ''),
  ]);

  const shared = sharedRaw
    ? [...sharedRaw.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1]))
    : [];

  const rows: Record<string, string>[] = [];
  for (const rowMatch of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const record: Record<string, string> = {};
    for (const cell of rowMatch[1].matchAll(
      /<c\s+r="([A-Z]+)\d+"((?:\s+[a-zA-Z:]+="[^"]*")*)\s*(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const [, column, attrs, body] = cell;
      if (body === undefined) continue; // self-closing, i.e. styled but empty
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      let value: string;
      if (type === 'inlineStr') {
        value = textRuns(body);
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (raw === undefined) continue;
        value = type === 's' ? (shared[Number(raw)] ?? '') : unescapeXml(raw);
      }
      record[column] = value;
    }
    rows.push(record);
  }
  return rows;
}

/**
 * Read a sheet and key every row by its header text instead of column letter,
 * using the first row as the header. Empty header cells are skipped.
 */
export async function readXlsxTable(path: string): Promise<Record<string, string>[]> {
  const rows = await readXlsxSheet(path);
  if (rows.length === 0) return [];
  const header = rows[0];
  const byLetter = new Map<string, string>();
  for (const [letter, text] of Object.entries(header)) {
    const name = text.trim();
    if (name) byLetter.set(letter, name);
  }
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    for (const [letter, name] of byLetter) {
      const value = row[letter];
      if (value !== undefined) record[name] = value;
    }
    return record;
  });
}
