import { describe, expect, it } from 'vitest';
import { normaliseWebsiteUrl } from './urls';

describe('normaliseWebsiteUrl', () => {
  it('prefixes https on a bare host, which is how directories record websites', () => {
    expect(normaliseWebsiteUrl('www.example.org')).toBe('https://www.example.org');
    expect(normaliseWebsiteUrl('example.org/help')).toBe('https://example.org/help');
  });

  it('leaves a real scheme alone, whatever its case', () => {
    expect(normaliseWebsiteUrl('http://example.org')).toBe('http://example.org');
    expect(normaliseWebsiteUrl('HTTPS://example.org')).toBe('HTTPS://example.org');
    expect(normaliseWebsiteUrl('mailto:help@example.org')).toBe('mailto:help@example.org');
    expect(normaliseWebsiteUrl('tel:988')).toBe('tel:988');
  });

  it('does not mistake a port for a scheme', () => {
    expect(normaliseWebsiteUrl('example.org:8080/page')).toBe('https://example.org:8080/page');
  });

  it('trims, and refuses to open nothing', () => {
    expect(normaliseWebsiteUrl('  example.org  ')).toBe('https://example.org');
    expect(normaliseWebsiteUrl('')).toBeNull();
    expect(normaliseWebsiteUrl('   ')).toBeNull();
  });
});
