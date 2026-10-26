# Frontline — Privacy Policy

_Last updated: 2026-10-24_

Frontline helps U.S. veterans find benefits and local resources. We designed it to collect **as
little as possible**. This policy explains what the app handles and why. Plain version: **there is
no account, and we never ask for your SSN, VA login, bank information, or medical diagnosis.**

## What the app keeps on your device

- **Optional profile.** You can choose to enter a first name, a ZIP code, a search radius, your
  role (for example veteran, family member, or caregiver), and a checklist of documents you
  already have, such as a DD214 or a photo ID. The checklist records only which documents you
  have. Frontline never asks you to upload them. You can clear the profile at any time in the app
  (Profile → Reset setup).
- **Saved resources, reminders, and activity.** The places you save, any "remind me when this
  opens" notifications you set (scheduled by your phone's own notification system), and which
  resources you have opened.
- **Cached AI text.** Summaries and next-step plans are cached on your device so they don't have
  to be generated again.
- **Location (optional).** If you allow it, your device location is used to search near you and
  center the map. Frontline does not store your location history. You can type a ZIP instead.

## Anonymous device backup

So that your saved resources and profile survive a reinstall, the app **automatically backs them
up** to our server. The backup is keyed to a **random identifier** created on your device and kept
in its secure keychain. It is not tied to your name, email, or any account. The backup contains
the same profile fields and saved list described above. Resetting your profile in the app clears
the profile backup, and removing saved items updates the saved-list backup. There is currently no
separate switch to turn the backup off.

## What is sent to our services

- **Resource search.** Your ZIP, or your device's coordinates if you used location, plus your
  search radius and the categories you picked, are sent to our backend (Supabase) to find nearby
  resources. We do not build a profile of you from these searches.
- **AI guidance on a resource page.** To generate a plain-English summary, a next-step plan, or a
  call script, the app sends information **about that resource** to our AI provider (Anthropic)
  through our server. For the plan and call script it also sends the type of help you are looking
  at and your profile ZIP and search radius, if you set them. The call script also includes your
  first name, if you entered one, so the script can introduce you.
- **Ask Frontline.** When you use the Ask Frontline conversation, **the messages you type** and
  the earlier replies in that conversation are sent to Anthropic through our server. So is the
  context the app uses to tailor answers: your ZIP and the state it falls in, your search radius,
  and, if you set them, your first name, role, and documents-on-hand checklist. **Please don't
  type sensitive details** (such as an SSN, account numbers, or medical information) into the
  conversation. Frontline does not save conversations, either on our servers or on your
  device. The transcript exists only while the conversation screen is open.
- **Our AI provider.** Anthropic processes these requests to return a response, under its own
  commercial terms and data policies. We do not send it your device location coordinates or your
  device identifier.
- **Ratings.** If you mark a resource as helpful or not helpful, your vote is stored with the
  resource and your random device identifier, so that each device gets one vote.
- **Abuse protection.** To rate-limit requests, our server records a one-way hash of your IP
  address with a request count for the current hour. We do not store the IP address itself.
- **Crash reports.** If the app crashes, a report is sent to our error-monitoring provider
  (Sentry) so we can fix it. Reports contain the technical error, your device model and OS
  version, the app version, and the screen you were on. They are configured to exclude your
  name, ZIP, location, and anything you typed. We do not use them to identify or track you.
- All network requests use encrypted connections (HTTPS).

## What we do NOT do

- No user accounts, logins, or passwords.
- No advertising, no ad identifiers, no third-party trackers, no selling of data.
- We never request or store SSN, VA credentials, financial information, or health diagnoses.

## AI and accuracy

Frontline is a **resource navigator, not the U.S. Department of Veterans Affairs or any government
agency**, and it is not affiliated with them. AI-generated summaries, plans, call scripts, and
Ask Frontline replies are **simplified guidance, clearly labeled, and are not legal, medical, financial, or
government-certified advice.** Always confirm details with the official source.

## Children

Frontline is intended for adults (veterans and those helping them) and is not directed at children
under 13.

## Data retention & your choices

- On-device data (profile, saved items, reminders, cached AI text) stays until you clear it or
  uninstall the app.
- The anonymous backup is kept so that a reinstall can restore it. Resetting your profile clears
  the profile backup, and clearing your saved list empties the saved-list backup.
- Because there is no account, we cannot look up "your" data by name — it is only reachable from your
  device.

## Changes

We may update this policy; the "last updated" date above will change. Material changes will be
reflected in the app's store listing.

## Contact

Questions about privacy: **adityakothuri3@gmail.com**.

---

> **Published at:** <https://adikothuri3.github.io/frontline-legal/privacy.html> — this is the URL
> given to App Store Connect (App Privacy → Privacy Policy URL). This Markdown file is the canonical
> source; the public page is HTML in the [frontline-legal](https://github.com/adikothuri3/frontline-legal)
> repo. **Edit here first, then mirror the change there** so the two never drift.
