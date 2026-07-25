import { describe, expect, it } from 'vitest';
import { needToResourceCategories, resourceToNeedCategory } from './needMapping';

describe('needToResourceCategories', () => {
  it('fans "essentials" out to food + clothing', () => {
    expect(needToResourceCategories('essentials')).toEqual(['food', 'clothing']);
  });

  it('maps one-to-one needs directly', () => {
    expect(needToResourceCategories('housing')).toEqual(['housing']);
    expect(needToResourceCategories('legal')).toEqual(['legal']);
  });

  it('maps a need to several resource categories where appropriate', () => {
    expect(needToResourceCategories('education_benefits')).toEqual(['education', 'benefits_help']);
  });
});

describe('resourceToNeedCategory', () => {
  it('maps both food and clothing back to the merged essentials need', () => {
    expect(resourceToNeedCategory('food')).toBe('essentials');
    expect(resourceToNeedCategory('clothing')).toBe('essentials');
  });

  it('maps benefits/community resource categories to their best-fit need', () => {
    expect(resourceToNeedCategory('benefits_help')).toBe('general_benefits');
    expect(resourceToNeedCategory('community_support')).toBe('family_caregiver');
  });
});
