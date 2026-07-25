import type { NeedCategory } from '@/types/need';

/**
 * Curated **official / trusted online** backups shown as a supporting widget on
 * each category page — never the main experience. Prioritizes VA.gov and federal
 * benefit pages, state/county veteran-service directories, and verified
 * nonprofits. Descriptions are plain-English summaries; links go to the official
 * sites. This is static reference data (not a live directory) — replace with a
 * verified feed in Phase 10.
 */

export type SourceTrust = 'va' | 'federal' | 'state' | 'county' | 'nonprofit';

export interface OfficialSource {
  title: string;
  sourceName: string;
  description: string;
  url: string;
  trust: SourceTrust;
}

export const SOURCE_TRUST_LABELS: Record<SourceTrust, string> = {
  va: 'Official VA Source',
  federal: 'Federal Resource',
  state: 'State Resource',
  county: 'County Resource',
  nonprofit: 'Verified Nonprofit',
};

/** Tint per trust type (reuses the app's category color hues). */
export const SOURCE_TRUST_COLORS: Record<SourceTrust, string> = {
  va: '#2E7D32',
  federal: '#3D8BC7',
  state: '#5567C7',
  county: '#3AA0B5',
  nonprofit: '#C99A33',
};

const OFFICIAL_SOURCES: Record<NeedCategory, OfficialSource[]> = {
  essentials: [
    {
      title: 'SNAP food assistance (food stamps)',
      sourceName: 'USDA · FNS',
      description: 'Check eligibility and apply for monthly grocery benefits through your state.',
      url: 'https://www.fns.usda.gov/snap/recipient/eligibility',
      trust: 'federal',
    },
    {
      title: 'Find your local food bank',
      sourceName: 'Feeding America',
      description: 'Search food banks and free pantries near you by ZIP code.',
      url: 'https://www.feedingamerica.org/find-your-local-foodbank',
      trust: 'nonprofit',
    },
    {
      title: 'Free & low-cost clothing',
      sourceName: 'Goodwill',
      description: 'Locate nearby Goodwill stores and community assistance programs.',
      url: 'https://www.goodwill.org/',
      trust: 'nonprofit',
    },
    {
      title: 'Clothing & essential-item assistance',
      sourceName: 'The Salvation Army',
      description: 'Find local centers offering clothing vouchers and basic-need support.',
      url: 'https://www.salvationarmyusa.org/usn/',
      trust: 'nonprofit',
    },
    {
      title: 'Food, clothing & everyday basics',
      sourceName: '211 · United Way',
      description: 'Free, confidential help finding food, meals, clothing, and other basics nearby.',
      url: 'https://www.211.org/',
      trust: 'nonprofit',
    },
  ],
  housing: [
    {
      title: 'Help for homeless & at-risk veterans',
      sourceName: 'VA.gov',
      description: 'HUD-VASH housing, the 24/7 homeless hotline, and rapid-rehousing help.',
      url: 'https://www.va.gov/homeless/',
      trust: 'va',
    },
    {
      title: 'VA home loan benefits',
      sourceName: 'VA.gov',
      description: 'Understand and apply for VA-backed home loans and your Certificate of Eligibility.',
      url: 'https://www.va.gov/housing-assistance/home-loans/',
      trust: 'va',
    },
    {
      title: 'Rental assistance & housing programs',
      sourceName: 'HUD',
      description: 'Find local public housing agencies, vouchers, and rental help.',
      url: 'https://www.hud.gov/topics/rental_assistance',
      trust: 'federal',
    },
    {
      title: 'National Coalition for Homeless Veterans',
      sourceName: 'NCHV',
      description: 'A veteran-focused directory of housing and support programs nationwide.',
      url: 'https://nchv.org/',
      trust: 'nonprofit',
    },
  ],
  healthcare: [
    {
      title: 'Apply for VA health care',
      sourceName: 'VA.gov',
      description: 'Check eligibility, enroll, and manage your VA medical benefits.',
      url: 'https://www.va.gov/health-care/',
      trust: 'va',
    },
    {
      title: 'VA mental health services',
      sourceName: 'VA.gov',
      description: 'Counseling, PTSD care, and mental-health support for veterans and families.',
      url: 'https://www.mentalhealth.va.gov/',
      trust: 'va',
    },
    {
      title: 'Vet Centers (readjustment counseling)',
      sourceName: 'VA.gov',
      description: 'Confidential community-based counseling for combat, MST, and transition.',
      url: 'https://www.vetcenter.va.gov/',
      trust: 'va',
    },
    {
      title: 'Marketplace health coverage',
      sourceName: 'HealthCare.gov',
      description: 'Compare and enroll in health insurance if you don’t use VA care.',
      url: 'https://www.healthcare.gov/',
      trust: 'federal',
    },
  ],
  disability_benefits: [
    {
      title: 'VA disability compensation',
      sourceName: 'VA.gov',
      description: 'File a claim and learn what conditions may qualify for monthly compensation.',
      url: 'https://www.va.gov/disability/',
      trust: 'va',
    },
    {
      title: 'How VA disability ratings work',
      sourceName: 'VA.gov',
      description: 'Understand ratings, combined ratings, and how they affect your payment.',
      url: 'https://www.va.gov/disability/about-disability-ratings/',
      trust: 'va',
    },
    {
      title: 'Get free help from an accredited rep',
      sourceName: 'VA.gov',
      description: 'Find a VSO or accredited representative to help file your claim — at no cost.',
      url: 'https://www.va.gov/get-help-from-accredited-representative/',
      trust: 'va',
    },
    {
      title: 'Claims & benefits assistance',
      sourceName: 'DAV',
      description: 'Free help from Disabled American Veterans with filing and appeals.',
      url: 'https://www.dav.org/',
      trust: 'nonprofit',
    },
  ],
  education_benefits: [
    {
      title: 'GI Bill & education benefits',
      sourceName: 'VA.gov',
      description: 'Apply for the GI Bill and see school, training, and housing benefits.',
      url: 'https://www.va.gov/education/',
      trust: 'va',
    },
    {
      title: 'GI Bill Comparison Tool',
      sourceName: 'VA.gov',
      description: 'Compare schools and estimate your benefits before you enroll.',
      url: 'https://www.va.gov/education/gi-bill-comparison-tool/',
      trust: 'va',
    },
    {
      title: 'Federal student aid (FAFSA)',
      sourceName: 'StudentAid.gov',
      description: 'Apply for grants, loans, and work-study to cover education costs.',
      url: 'https://studentaid.gov/',
      trust: 'federal',
    },
    {
      title: 'Student Veterans of America',
      sourceName: 'SVA',
      description: 'Campus chapters and support for veterans in higher education.',
      url: 'https://studentveterans.org/',
      trust: 'nonprofit',
    },
  ],
  jobs: [
    {
      title: 'VA careers & employment help',
      sourceName: 'VA.gov',
      description: 'Job resources, VR&E vocational rehab, and hiring support for veterans.',
      url: 'https://www.va.gov/careers-employment/',
      trust: 'va',
    },
    {
      title: 'Veteran job tools & training',
      sourceName: 'CareerOneStop · DOL',
      description: 'Résumé help, skills-to-careers matching, and local job centers.',
      url: 'https://www.careeronestop.org/Veterans/',
      trust: 'federal',
    },
    {
      title: 'Veterans’ Employment & Training (VETS)',
      sourceName: 'U.S. Dept. of Labor',
      description: 'Employment rights, priority services, and reemployment protections.',
      url: 'https://www.dol.gov/agencies/vets',
      trust: 'federal',
    },
    {
      title: 'Free job placement for veterans',
      sourceName: 'Hire Heroes USA',
      description: 'Personalized coaching, résumé help, and employer connections at no cost.',
      url: 'https://www.hireheroesusa.org/',
      trust: 'nonprofit',
    },
  ],
  legal: [
    {
      title: 'Discharge upgrade instructions',
      sourceName: 'VA.gov',
      description: 'Step-by-step help to request a discharge upgrade or correction.',
      url: 'https://www.va.gov/discharge-upgrade-instructions/',
      trust: 'va',
    },
    {
      title: 'Legal help for veterans',
      sourceName: 'Stateside Legal',
      description: 'Plain-language legal info and a finder for veteran legal-aid programs.',
      url: 'https://www.statesidelegal.org/',
      trust: 'nonprofit',
    },
    {
      title: 'Find free civil legal aid',
      sourceName: 'Legal Services Corporation',
      description: 'Locate local legal-aid offices for housing, benefits, and family issues.',
      url: 'https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help',
      trust: 'federal',
    },
    {
      title: 'National Veterans Legal Services Program',
      sourceName: 'NVLSP',
      description: 'Advocacy and legal help with VA benefits and claims appeals.',
      url: 'https://www.nvlsp.org/',
      trust: 'nonprofit',
    },
  ],
  transportation: [
    {
      title: 'VA travel pay & beneficiary travel',
      sourceName: 'VA.gov',
      description: 'Get reimbursed for mileage to and from VA health appointments.',
      url: 'https://www.va.gov/health-care/get-reimbursed-for-travel-pay/',
      trust: 'va',
    },
    {
      title: 'Free rides to VA appointments',
      sourceName: 'DAV',
      description: 'The DAV volunteer driver network offers rides to medical care.',
      url: 'https://www.dav.org/veterans/i-need-a-ride/',
      trust: 'nonprofit',
    },
    {
      title: 'Local transportation assistance',
      sourceName: '211 · United Way',
      description: 'Find rides, transit help, and medical transportation near you.',
      url: 'https://www.211.org/',
      trust: 'nonprofit',
    },
  ],
  family_caregiver: [
    {
      title: 'VA Caregiver Support Program',
      sourceName: 'VA.gov',
      description: 'Training, respite, a support line, and stipend programs for caregivers.',
      url: 'https://www.caregiver.va.gov/',
      trust: 'va',
    },
    {
      title: 'Family member benefits',
      sourceName: 'VA.gov',
      description: 'Health care, education, and survivor benefits for spouses and dependents.',
      url: 'https://www.va.gov/family-member-benefits/',
      trust: 'va',
    },
    {
      title: 'Military OneSource',
      sourceName: 'U.S. Dept. of Defense',
      description: 'Free confidential counseling and support for families 24/7.',
      url: 'https://www.militaryonesource.mil/',
      trust: 'federal',
    },
    {
      title: 'Elizabeth Dole Foundation',
      sourceName: 'Hidden Heroes',
      description: 'Resources and community for military and veteran caregivers.',
      url: 'https://www.elizabethdolefoundation.org/',
      trust: 'nonprofit',
    },
  ],
  emergency: [
    {
      title: 'Veterans Crisis Line',
      sourceName: 'VA.gov',
      description: 'Free 24/7 confidential support — dial 988 then press 1, or chat online.',
      url: 'https://www.veteranscrisisline.net/',
      trust: 'va',
    },
    {
      title: '988 Suicide & Crisis Lifeline',
      sourceName: '988lifeline.org',
      description: 'Call or text 988 anytime for free, confidential crisis support.',
      url: 'https://988lifeline.org/',
      trust: 'federal',
    },
    {
      title: 'Homeless veterans — get help now',
      sourceName: 'VA.gov',
      description: 'The National Call Center for Homeless Veterans: 1-877-4AID-VET, 24/7.',
      url: 'https://www.va.gov/homeless/',
      trust: 'va',
    },
    {
      title: 'Find urgent help near you',
      sourceName: 'SAMHSA',
      description: 'Locate crisis, mental-health, and substance-use help lines and services.',
      url: 'https://www.samhsa.gov/find-help',
      trust: 'federal',
    },
  ],
  general_benefits: [
    {
      title: 'Explore all VA benefits',
      sourceName: 'VA.gov',
      description: 'The official home for health care, disability, education, and more.',
      url: 'https://www.va.gov/',
      trust: 'va',
    },
    {
      title: 'Find VA forms',
      sourceName: 'VA.gov',
      description: 'Search and download official VA application and claim forms.',
      url: 'https://www.va.gov/find-forms/',
      trust: 'va',
    },
    {
      title: 'Get free help from an accredited rep',
      sourceName: 'VA.gov',
      description: 'Find a VSO or accredited representative to guide you through benefits.',
      url: 'https://www.va.gov/get-help-from-accredited-representative/',
      trust: 'va',
    },
    {
      title: 'Your state’s veterans affairs office',
      sourceName: 'NASDVA directory',
      description: 'Find your state veterans office — many offer added state-level benefits.',
      url: 'https://www.nasdva.us/',
      trust: 'state',
    },
    {
      title: 'Your county veteran service officer',
      sourceName: 'NACVSO directory',
      description: 'Locate a county VSO for free, local, one-on-one benefits help.',
      url: 'https://www.nacvso.org/',
      trust: 'county',
    },
  ],
};

/** The curated official/trusted online sources for a category (may be empty). */
export function officialSourcesFor(category: NeedCategory): OfficialSource[] {
  return OFFICIAL_SOURCES[category] ?? [];
}
