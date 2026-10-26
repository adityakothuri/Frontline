import type { NeedCategory } from '@/types/need';
import type { ResourceCategory } from '@/types/resource';

/**
 * The 10 user-facing need categories don't map 1:1 to the 11 resource
 * categories. "Essentials" fans out to food + clothing; "Disability & VA
 * benefits" should see benefits-help resources; "Family / caregiver" should see
 * community support, etc. This is the single place that translation lives.
 */
const NEED_TO_RESOURCE_CATEGORIES: Record<NeedCategory, ResourceCategory[]> = {
  essentials: ['food', 'clothing'],
  housing: ['housing'],
  healthcare: ['healthcare'],
  va_benefits: ['benefits_help'],
  education_benefits: ['education', 'benefits_help'],
  jobs: ['jobs'],
  legal: ['legal'],
  transportation: ['transportation'],
  family_caregiver: ['community_support', 'healthcare'],
  emergency: ['emergency'],
};

export function needToResourceCategories(need: NeedCategory): ResourceCategory[] {
  return NEED_TO_RESOURCE_CATEGORIES[need];
}

/**
 * The reverse best-fit: a resource's category → the closest user-facing need
 * category. Used when browsing *all* opportunities (Discover), where a card has
 * no originating need, so its detail page still opens with sensible AI context.
 */
const RESOURCE_TO_NEED_CATEGORY: Record<ResourceCategory, NeedCategory> = {
  food: 'essentials',
  clothing: 'essentials',
  housing: 'housing',
  healthcare: 'healthcare',
  benefits_help: 'va_benefits',
  legal: 'legal',
  jobs: 'jobs',
  education: 'education_benefits',
  transportation: 'transportation',
  emergency: 'emergency',
  community_support: 'family_caregiver',
};

export function resourceToNeedCategory(category: ResourceCategory): NeedCategory {
  return RESOURCE_TO_NEED_CATEGORY[category];
}
