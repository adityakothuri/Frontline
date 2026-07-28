/**
 * A deterministic external id for providers that expose no stable primary key.
 *
 * Some feeds simply don't give you one. Feeding America reassigns its row ids on
 * every rebuild — 71% of 116,500 ingested rows once pointed past the feed's
 * then-current maximum, so keying on the feed id orphaned every row on each
 * refresh instead of updating it. SAMHSA's `exportsAsJson/v2` returns only
 * `_irow`, a per-page index that means nothing between runs.
 *
 * A place is identified by where it is and what it's called, so that is the key.
 */
import { createHash } from 'node:crypto';

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Hash of normalized name + address + state, 16 base64url chars.
 *
 * A collision silently DROPS a real resource — adapters skip ids they have
 * already seen — so the hash has to be wide. 32 bits would be far too narrow:
 * across ~310k national rows the birthday bound predicts ~10 collisions, i.e.
 * ~10 food banks quietly missing. 16 base64url chars is 96 bits, which is
 * negligible.
 */
export function stableKey(name: string, address: string | null, state: string): string {
  const basis = `${normalize(name)}|${normalize(address ?? '')}|${state}`;
  return createHash('sha1').update(basis).digest('base64url').slice(0, 16);
}
