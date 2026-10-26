/**
 * Streaming RFC 4180 CSV reader for the bulk-download sources.
 *
 * Two of the audit's new providers ship whole files rather than paginated APIs:
 * HRSA's health-centre site file is ~14 MB, and the IRS Exempt Organizations
 * Business Master File is four regional files totalling ~1.98M rows. Loading
 * either into memory as one string and splitting on newlines is how you get a
 * heap blow-up on a CI runner, and neither file is safe to split on `\n` anyway —
 * both carry quoted fields containing commas, newlines and escaped quotes.
 *
 * So this is a proper incremental parser fed by a byte stream: it yields one
 * record at a time as an object keyed by the header row, and never holds more
 * than the current row plus a partial chunk.
 */

/** Split one CSV line's worth of text, honouring quotes and `""` escapes. */
function pushChar(state: ParseState, ch: string): void {
  if (state.inQuotes) {
    if (ch === '"') {
      // A doubled quote inside a quoted field is a literal quote.
      if (state.pendingQuote) {
        state.field += '"';
        state.pendingQuote = false;
      } else {
        state.pendingQuote = true;
      }
      return;
    }
    if (state.pendingQuote) {
      // The quote that closed the field; reprocess this char outside quotes.
      state.inQuotes = false;
      state.pendingQuote = false;
      pushChar(state, ch);
      return;
    }
    state.field += ch;
    return;
  }

  if (ch === '"' && state.field === '') {
    state.inQuotes = true;
    return;
  }
  if (ch === ',') {
    state.row.push(state.field);
    state.field = '';
    return;
  }
  if (ch === '\n') {
    state.row.push(state.field);
    state.field = '';
    state.complete.push(state.row);
    state.row = [];
    return;
  }
  if (ch === '\r') return; // CRLF, and a bare CR is never meaningful here
  state.field += ch;
}

interface ParseState {
  field: string;
  row: string[];
  inQuotes: boolean;
  pendingQuote: boolean;
  complete: string[][];
}

const newState = (): ParseState => ({
  field: '',
  row: [],
  inQuotes: false,
  pendingQuote: false,
  complete: [],
});

/**
 * Parse a CSV byte stream into records keyed by the header row.
 *
 * FIELD-COUNT MISMATCHES ARE NOT SYMMETRIC, so they are not treated the same way.
 *
 * A row with FEWER fields than the header is normal in federal bulk files and
 * benign: HRSA's health-centre file declares 56 header columns and every one of
 * its 18,963 data rows has 55, because the last column is never populated.
 * Python's `csv.DictReader` pads these, which is why the file looks fine in every
 * other tool. Short rows are padded with empty strings.
 *
 * A row with MORE fields than the header is a different animal — that is the
 * signature of a quoting failure, where an unescaped comma has split one field in
 * two and shifted every column after it. Padding that would silently put a city
 * name in the phone column, so those rows are dropped.
 *
 * Both counts are reported through `onSkipped` (dropped) so a caller can fail
 * loudly when the number is large rather than ingesting a mangled file.
 */
export async function* parseCsvStream(
  stream: ReadableStream<Uint8Array>,
  onSkipped?: (count: number) => void,
): AsyncGenerator<Record<string, string>> {
  const decoder = new TextDecoder('utf-8');
  const state = newState();
  let header: string[] | null = null;
  let skipped = 0;

  const drain = function* (): Generator<Record<string, string>> {
    for (const row of state.complete) {
      if (header === null) {
        // Strip a UTF-8 BOM from the first header cell; IRS files carry one.
        header = row.map((h, i) => (i === 0 ? h.replace(/^﻿/, '') : h).trim());
        continue;
      }
      // A trailing newline yields one empty row; that is not a skip.
      if (row.length === 1 && row[0] === '') continue;
      // Too many fields means the columns have shifted — see the note above.
      if (row.length > header.length) {
        skipped += 1;
        continue;
      }
      const record: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) record[header[i]] = row[i] ?? '';
      yield record;
    }
    state.complete = [];
  };

  for await (const chunk of stream) {
    const text = decoder.decode(chunk as Uint8Array, { stream: true });
    for (const ch of text) pushChar(state, ch);
    yield* drain();
  }

  // Flush whatever the last chunk left mid-row.
  const tail = decoder.decode();
  for (const ch of tail) pushChar(state, ch);
  if (state.field !== '' || state.row.length > 0) {
    state.row.push(state.field);
    state.complete.push(state.row);
  }
  yield* drain();

  onSkipped?.(skipped);
}
