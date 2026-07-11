import { isOpenNow, closingTimeToday } from '@/lib/hours';
import { humanizeDocument } from '@/types/need';
import type { Need } from '@/types/need';
import { RESOURCE_CATEGORY_META, type Resource, type ResourceCategory } from '@/types/resource';

import {
  AI_NOT_ADVICE_DISCLAIMER,
  type AiService,
  type BenefitSummary,
  type CallScript,
  type CallScriptTone,
  type NextStepPlan,
  type PlanStep,
} from './AiService';

/**
 * Deterministic, offline "AI" for the MVP. It composes genuinely useful,
 * category-specific guidance from the structured need + the resource fields —
 * no network, no keys. A real Claude-backed implementation replaces this behind
 * the same `AiService` interface later (see `AI Feature Design.md`).
 */

const simulateLatency = (ms = 250): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** How a veteran describes each need on the phone (standard script). */
const CATEGORY_NEED_PHRASE: Record<ResourceCategory, string> = {
  food: 'food assistance',
  clothing: 'clothing assistance',
  housing: 'housing or rent assistance',
  healthcare: 'healthcare or counseling support',
  benefits_help: 'help understanding or applying for my benefits',
  legal: 'legal help',
  jobs: 'employment or job support',
  education: 'help using my education benefits',
  transportation: 'a ride or transportation help',
  emergency: 'urgent help',
  community_support: 'to connect with veteran support',
};

/** The specific thing to ask for each category on a standard call. */
const CATEGORY_CALL_ASK: Record<ResourceCategory, string> = {
  food: 'Are you open to walk-ins, and what documents should I bring?',
  clothing: 'Do you have clothing available right now, and do I need an appointment?',
  housing: 'Are you accepting new applicants, and what information should I have ready?',
  healthcare: 'Can someone help me get started, and do I need to schedule an appointment?',
  benefits_help: 'Can someone help me review what I may qualify for, and do I need an appointment?',
  legal: 'Do you take new cases like mine, and what should I have ready for a screening?',
  jobs: 'Can someone help me with job placement, and should I bring my DD-214?',
  education: 'Can someone help me use my education benefits, and what should I bring?',
  transportation: 'How do I reserve a ride, and how far in advance do I need to book?',
  emergency: 'I need help right now — can you tell me what to do?',
  community_support: 'When can I stop by, and is it open to any veteran?',
};

/** A short phrase for the nervous-user script. */
const CATEGORY_SHORT_NEED: Record<ResourceCategory, string> = {
  food: 'food',
  clothing: 'clothing',
  housing: 'housing',
  healthcare: 'healthcare',
  benefits_help: 'my benefits',
  legal: 'a legal problem',
  jobs: 'finding work',
  education: 'school benefits',
  transportation: 'a ride',
  emergency: 'an urgent situation',
  community_support: 'support',
};

const documentList = (resource: Resource): string[] =>
  resource.documents_needed.map(humanizeDocument);

const acceptsWalkIns = (resource: Resource): boolean => resource.tags.includes('walk-in');
const needsAppointment = (resource: Resource): boolean =>
  resource.tags.some((t) => ['appointment', 'call-first', 'reserve-ahead'].includes(t));

class TemplatedAiService implements AiService {
  async buildNextStepPlan({
    need,
    resource,
  }: {
    need: Need;
    resource: Resource;
  }): Promise<NextStepPlan> {
    await simulateLatency();

    const steps: PlanStep[] = [];
    const open = isOpenNow(resource.hours);

    // 1. Make contact.
    const closesAt = open === true ? closingTimeToday(resource.hours) : null;
    if (resource.phone) {
      const timing =
        open === true
          ? closesAt
            ? `They’re open now — try to call before ${closesAt} today.`
            : 'They appear to be open now, so this is a good time to call.'
          : resource.hours
            ? `They’re closed right now. Try during their hours: ${resource.hours}.`
            : 'Call to check their hours and availability.';
      steps.push({
        title: `Call ${resource.name}`,
        detail: `Call ${resource.phone}. ${timing}`,
      });
    } else if (resource.address) {
      steps.push({
        title: `Visit ${resource.name}`,
        detail: resource.hours
          ? `Stop by during their hours: ${resource.hours}.`
          : 'Stop by during business hours.',
      });
    } else if (resource.website) {
      steps.push({
        title: `Start online with ${resource.name}`,
        detail: `This resource is online — visit ${resource.website} to get started.`,
      });
    }

    // 2. Ask the right question.
    const access = acceptsWalkIns(resource)
      ? 'They accept walk-ins.'
      : needsAppointment(resource)
        ? 'Ask about making an appointment or reserving ahead — they may not take walk-ins.'
        : 'Ask whether they accept walk-ins or need an appointment.';
    steps.push({
      title: 'Ask what you need to know',
      detail: `${access} ${CATEGORY_CALL_ASK[resource.category]}`,
    });

    // 3. Bring documents.
    const docs = documentList(resource);
    if (docs.length > 0) {
      steps.push({
        title: 'Bring your documents',
        detail: `If you have them, bring: ${docs.join(', ')}. You can still ask for help without every document.`,
      });
    }

    // 4. Urgency-aware nudge.
    if (need.urgency === 'today') {
      steps.push({
        title: 'If they can’t help today',
        detail: 'Ask who else they recommend nearby, and try the backup below.',
      });
    }

    return {
      steps,
      whatToBring:
        docs.length > 0 ? docs : ['A photo ID is usually helpful, even when nothing is required.'],
      backup: `If ${resource.name} can’t help, open another ${RESOURCE_CATEGORY_META[
        resource.category
      ].label.toLowerCase()} resource nearby in Frontline and try the same steps.`,
      disclaimer: AI_NOT_ADVICE_DISCLAIMER,
    };
  }

  async buildCallScript({
    resource,
    tone,
    firstName,
  }: {
    need: Need;
    resource: Resource;
    tone: CallScriptTone;
    firstName?: string;
  }): Promise<CallScript> {
    await simulateLatency();

    const name = firstName?.trim() ? firstName.trim() : '______';
    const script =
      tone === 'short'
        ? `Hi, I’m a veteran and I need help with ${CATEGORY_SHORT_NEED[resource.category]}. Can you tell me what I need to do?`
        : `Hi, my name is ${name}. I’m a veteran looking for ${CATEGORY_NEED_PHRASE[resource.category]}. ${CATEGORY_CALL_ASK[resource.category]}`;

    const tips =
      tone === 'short'
        ? [
            'It’s okay to keep it simple — they help people every day.',
            'If you feel overwhelmed, ask them to walk you through it step by step.',
          ]
        : [
            'Say your name and that you’re a veteran up front.',
            'It’s okay to ask them to slow down or repeat anything.',
            'Have a pen ready to write down names, times, and what to bring.',
          ];

    return { tone, script, tips, disclaimer: AI_NOT_ADVICE_DISCLAIMER };
  }

  async summarizeBenefit({ resource }: { resource: Resource }): Promise<BenefitSummary> {
    await simulateLatency();

    const meta = RESOURCE_CATEGORY_META[resource.category];
    const docs = documentList(resource);

    const warnings: string[] = [];
    if (resource.source_type !== 'official') {
      warnings.push(
        `This listing is from a ${resource.source_type} source — confirm details with the official source.`,
      );
    }
    if (needsAppointment(resource)) {
      warnings.push('You may need an appointment or to reserve ahead.');
    }

    const verificationNote =
      resource.verification_status === 'verified'
        ? `Source: ${resource.source_type}. Last checked ${resource.last_checked}.`
        : `Source: ${resource.source_type} (${resource.verification_status.replace('_', ' ')}). Last checked ${resource.last_checked} — double-check before you rely on it.`;

    return {
      whatItIs: resource.description,
      whoItHelps: `Veterans looking for ${meta.blurb.toLowerCase().replace(/\.$/, '')}.`,
      whoMayQualify:
        resource.eligibility ??
        'Eligibility varies — you may qualify, but confirm by calling or checking the official source.',
      documentsNeeded: docs,
      deadlinesOrWarnings: warnings.length > 0 ? warnings.join(' ') : null,
      whatToDoNext: resource.phone
        ? `Call ${resource.name} at ${resource.phone} to confirm details and next steps.`
        : `Visit the source link to confirm details and next steps.`,
      sourceUrl: resource.source_url,
      verificationNote,
    };
  }
}

export { TemplatedAiService };
