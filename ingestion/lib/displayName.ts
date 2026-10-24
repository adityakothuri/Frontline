/**
 * Display name tidying for sources that shout. Federal and aggregated feeds
 * store names in upper case ("COL ROBERT L. HOWARD STATE VETERANS HOME");
 * mixed-case input is left alone, since second-guessing it only adds errors.
 */

/** Joining words that stay lower-case unless they lead. */
const SMALL = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in', 'on', 'at', 'to', 'by']);

/** Tokens to leave exactly as they are. Acronyms only — never ordinary words ("AMERICAN Legion"). */
const ACRONYM =
  /^(?:VFW|DAV|AMVETS|VVA|VA|USA|US|POW|MIA|LLC|HIV|AIDS|WIC|FQHC|YMCA|YWCA|MTA|RTA|RTD|HUD|PHA|HA|II|III|IV|[A-Z]&[A-Z])$/;

/** Trailing punctuation should not stop a token being recognised as an acronym. */
const bare = (word: string): string => word.replace(/[^A-Za-z&]/g, '').toUpperCase();

/**
 * ALL-CAPS input → Title Case. Anything already mixed-case is returned unchanged.
 */
export function titleCaseName(raw: string): string {
  const name = raw.trim();
  if (!name || name !== name.toUpperCase()) return name;

  return name
    .split(/\s+/)
    .map((word, i) => {
      if (ACRONYM.test(bare(word))) return word;
      const lower = word.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      // Capitalise after a word boundary but NOT after an apostrophe: "MARY'S"
      // must become "Mary's", not "Mary'S". The cost is that "O'BRIEN" comes out
      // as "O'brien" — the lesser of the two wrong answers, and possessives are
      // far more common in these names than Irish prefixes.
      return lower.replace(
        /(^|[^a-z'])([a-z])/g,
        (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
      );
    })
    .join(' ');
}
