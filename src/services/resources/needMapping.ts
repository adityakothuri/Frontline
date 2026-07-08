import type { NeedCategory } from '@/types/need';
import type { ResourceCategory } from '@/types/resource';

/**
 * The 12 user-facing need categories don't map 1:1 to the 11 resource
 * categories. A veteran choosing "Disability benefits" should see benefits-help
 * resources; "Family / caregiver" should see community support, etc. This is the
 * single place that translation lives.
 */
const NEED_TO_RESOURCE_CATEGORIES: Record<NeedCategory, ResourceCategory[]> = {
  food: ['food'],
  clothing: ['clothing'],
  housing: ['housing'],
  healthcare: ['healthcare'],
  disability_benefits: ['benefits_help'],
  education_benefits: ['education', 'benefits_help'],
  jobs: ['jobs'],
  legal: ['legal'],
  transportation: ['transportation'],
  family_caregiver: ['community_support', 'healthcare'],
  emergency: ['emergency'],
  general_benefits: ['benefits_help'],
};

export function needToResourceCategories(need: NeedCategory): ResourceCategory[] {
  return NEED_TO_RESOURCE_CATEGORIES[need];
}
