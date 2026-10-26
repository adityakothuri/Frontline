import { describe, expect, it } from 'vitest';
import { parseCsvStream } from './csv.ts';

/**
 * Both bulk providers this parser feeds (HRSA sites, the 1.98M-row IRS Business
 * Master File) carry quoted fields with embedded commas, newlines and doubled
 * quotes, so those are the cases that matter — a naive `split(',')` silently
 * shifts every column after the first quoted comma, which would put a city name
 * in the phone field on thousands of rows.
 */

/** Feed a string through in small chunks, to exercise chunk-boundary handling. */
function stream(text: string, chunkSize = 7): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

async function collect(text: string, chunkSize?: number) {
  const rows: Record<string, string>[] = [];
  let skipped = 0;
  for await (const row of parseCsvStream(stream(text, chunkSize), (n) => (skipped = n))) {
    rows.push(row);
  }
  return { rows, skipped };
}

describe('parseCsvStream', () => {
  it('keys records by the header row', async () => {
    const { rows } = await collect('NAME,CITY,STATE\nVeterans Inc,Worcester,MA\n');
    expect(rows).toEqual([{ NAME: 'Veterans Inc', CITY: 'Worcester', STATE: 'MA' }]);
  });

  it('keeps commas inside quoted fields', async () => {
    const { rows } = await collect('NAME,ADDRESS\n"Smith, Jones and Co","1 Main St, Suite 4"\n');
    expect(rows[0].NAME).toBe('Smith, Jones and Co');
    expect(rows[0].ADDRESS).toBe('1 Main St, Suite 4');
  });

  it('unescapes doubled quotes', async () => {
    const { rows } = await collect('NAME\n"The ""Vet Center"" Program"\n');
    expect(rows[0].NAME).toBe('The "Vet Center" Program');
  });

  it('keeps newlines inside quoted fields', async () => {
    const { rows } = await collect('NAME,NOTE\n"A House","line one\nline two"\n');
    expect(rows).toHaveLength(1);
    expect(rows[0].NOTE).toBe('line one\nline two');
  });

  it('handles CRLF line endings', async () => {
    const { rows } = await collect('A,B\r\n1,2\r\n3,4\r\n');
    expect(rows).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: '4' },
    ]);
  });

  it('strips a UTF-8 BOM from the first header cell', async () => {
    const { rows } = await collect('﻿EIN,NAME\n123,Post 1\n');
    expect(rows[0].EIN).toBe('123');
  });

  it('yields the final row when the file has no trailing newline', async () => {
    const { rows } = await collect('A,B\n1,2');
    expect(rows).toEqual([{ A: '1', B: '2' }]);
  });

  it('does not count a trailing newline as a skipped row', async () => {
    const { rows, skipped } = await collect('A,B\n1,2\n');
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it('pads short rows, which federal bulk files produce routinely', async () => {
    // HRSA declares 56 header columns and every data row has 55.
    const { rows, skipped } = await collect('A,B,C\n1,2,3\n4,5\n');
    expect(rows).toEqual([
      { A: '1', B: '2', C: '3' },
      { A: '4', B: '5', C: '' },
    ]);
    expect(skipped).toBe(0);
  });

  it('drops over-long rows, because those mean the columns have shifted', async () => {
    const { rows, skipped } = await collect('A,B,C\n1,2,3\n4,5,6,7\n8,9,10\n');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.A)).toEqual(['1', '8']);
    expect(skipped).toBe(1);
  });

  it('parses identically regardless of chunk boundaries', async () => {
    const csv = 'NAME,ADDRESS\n"Quoted, Name","With ""quotes"" and, commas"\nPlain,Simple\n';
    const oneChunk = await collect(csv, 4096);
    const tinyChunks = await collect(csv, 1);
    expect(tinyChunks.rows).toEqual(oneChunk.rows);
    expect(oneChunk.rows[0].ADDRESS).toBe('With "quotes" and, commas');
  });

  it('preserves empty fields', async () => {
    const { rows } = await collect('A,B,C\n1,,3\n');
    expect(rows[0]).toEqual({ A: '1', B: '', C: '3' });
  });
});
