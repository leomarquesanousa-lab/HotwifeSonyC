# Safety & Compliance implementation

Implementation date: October 11, 2026. Policies are original English text for HotwifeSonyC. This work does not guarantee processor approval. No commit, push, deployment or production database modification was performed.

## Public routes

`/privacy`, `/terms`, `/acceptable-use`, `/anti-trafficking`, `/child-safety`, `/age-verification`, `/consent`, `/content-moderation`, `/report-content`, `/content-removal`, `/depicted-person-removal`, `/dmca`, `/2257`, `/refunds`, `/billing`, `/contact`, `/compliance`.

The existing privacy, terms and data-deletion URLs are retained, with their implementations moved into the shared legal route group. `/data-deletion` remains available. Shared components supply metadata/canonical URLs, related links, desktop contents navigation, mobile layout, updated dates and the legal footer. The footer adds safety/reporting access without replacing the home hero. Product prices display currency and personal streaming terms. Checkout changes are policy links only.

The entry acknowledgment covers home/catalog/product/checkout pages and persists for the browser session. It requires legal-age and voluntary-access confirmations. It is not identity verification and does not block public safety/reporting pages.

## Database: prepared, NOT applied

The configured Neon database is production. Do not run schema writes, seed or cleanup against it as part of this work. The generated migration is `migrations/app/20261012T0208_safety_compliance/`. Its 30 operations are additive:

- Five tables: `complianceReport`, `complianceIdentity`, `contentConsent`, `contentReview`, `complianceNote`.
- One column: `videoProduct.complianceStatus`, default `LEGACY_UNREVIEWED`.
- Associated primary keys, checks, foreign keys and indexes. Identity/consent histories are append-only; the current content-review record is unique per product.

The existing Purchase schema, payment states and purchase history are unchanged. No existing product is automatically approved or removed. Existing catalog rows receive an explicit unreviewed legacy marker. New products start at DRAFT; new publication or changed content requires current approval. Existing unchanged legacy publications remain available and must be manually audited before processor submission.

Source contract hash: `c84b413e7a38092b8187b7e13347b071097f9d151b82e7e29c6f54a30040b686`.
Target contract hash: `38d015faa8523a0445906b9b9da4c7e82aac77d6a5aa9899f13a9f8954e1c115`.
Migration hash: `c2c458021dc6dddf7df8d669cbd02f2573a2a67c6aa7bc58bc6a55d7a023542e`.

`compliance-migration-review.sql` is an offline extraction of generated SQL, not an instruction to execute SQL manually. The migration retains its generated pre/postchecks. SQL/schema/contract were reviewed offline; actual PostgreSQL execution remains untested. Before deployment, apply and verify the migration on a separate nonproduction database, exercise persistence and recovery, then obtain separate approval for production. Do not deploy the new contract before the matching migration: live reports/admin/publication/playback queries depend on the new schema. The current production database cannot support these new flows yet.

## Reporting and administration

Public POST `/api/compliance/reports` stores content, depicted-person and support requests transactionally with a reference, state, priority, five-weekday target and audit event. No account is required. Validation rejects external/signed URLs, oversized input, honeypot submissions and cross-origin requests. Persistent throttling uses email and trusted client IP when available. Invalid submissions do not receive success. No automatic email delivery is claimed. Supporting documentation is described as text; raw IDs or unlawful media must not be uploaded through the public form.

`/app/compliance` and `/api/admin/compliance` require an active workspace and OWNER/ADMIN, independently enforced on the backend. OPERATOR has no Compliance permission. Administrators can filter reports, inspect requests, append notes, record decisions, suspend/remove products, record identity/consent evidence references and approve/reject content. Scope is restricted to their workspace. Audit records contain actor/action/time/object and safe metadata, excluding DOB, evidence references and reporter email. The dashboard shows the latest 200 requests; filter by state to reduce the list.

Complaints are prioritized for minors, non-consent, trafficking and depicted-person disputes. The target is five business days where reasonably possible; weekends are excluded, jurisdiction-specific holidays are not configured. Staff must monitor the queue, contact reporters, preserve evidence when lawful, and decide appropriate emergency action. No 24/7 monitoring or automatic legal resolution is implemented. A SUSPENDED/REMOVED product is archived and new watch sessions are blocked for every role, without changing the ordinary admin/paid-purchase authorization rule. Already issued R2 signed URLs retain their existing 900-second expiry; this change does not revoke URLs or change R2/player/download settings.

## Verification, consent and moderation

Backend publication requires a verified active adult provider, a recording date, all depicted performers identified and verified as adults on that date, current consent covering depiction/upload/public distribution, and explicit prohibited-content/copyright review. Evidence references must identify genuine protected records reviewed by staff. Downloads remain unavailable and are not required consent scope. These controls do not authenticate government IDs by themselves; there is no third-party ID vendor integrated.

Media and public metadata are fingerprinted. Changed evidence, consent, identity or reviewed content invalidates approval and requires review. Identity and consent entries preserve their prior history. Serious consent disputes and moderation suspensions disable new playback sessions. DRAFT/PENDING_REVIEW/APPROVED/REJECTED/SUSPENDED/REMOVED are supported; LEGACY_UNREVIEWED describes preserved preexisting publications, not approval.

## Configuration and operational prerequisites

`src/lib/compliance/config.ts` is the sole public legal-data helper. `docs/compliance-config.example` lists keys without secrets. The known brand/domain are used; all legal entity/address/jurisdiction, support/billing/safety/abuse emails, DMCA designation, 2257 custodian/address/producer status/record location and processor/descriptor values remain pending. No fallback derives these from SMTP or other internal credentials. General intake needs `COMPLIANCE_WORKSPACE_ID` when multiple active workspaces exist. Legal pages are statically generated, so changes to public configuration require rebuilding.

Before formal underwriting:

1. Obtain legal advice on the actual entity, applicable jurisdictions, privacy/retention, consumer rights, age-assurance obligations, DMCA designation and 2257 producer/records obligations. Register/designate the real DMCA agent where applicable; do not treat the generic page as designation or safe-harbor certification.
2. Establish actual protected identity and consent records, a 2257 custodian and compliant records-location statement where applicable. The current generic `/2257` page does not certify compliance or claim records already exist.
3. Define secure evidence storage/access/retention/deletion, trained reviewers, escalation, lawful reporting, independent appeal/dispute handling where required, and periodic complaint/takedown reporting required by the acquirer. The UI records decisions but does not replace these operational processes.
4. Audit the preserved legacy catalog, verify every provider/person and consent record, review every title/tag/URL/content item, and address missing evidence. Integrate an ID-verification vendor if chosen/required; staff attestations alone are not vendor verification.
5. Configure real public contacts and test responses. Configure/confirm the actual payment processor, descriptor, tax and dispute rules. The existing demo checkout was not converted into a live processor integration.
6. Complete separate staging database execution, migration/recovery verification and persistent end-to-end tests before authorized production rollout.

## Restricted underwriting review procedure

Verify the processor representative through an established merchant channel. Agree the scope and duration, ordinarily no more than seven days when credentials are required by the acquirer. Prefer a scheduled owner-supervised screen-sharing review using the existing authenticated player: the owner signs in locally, retains control and does not disclose credentials, evidence records or administrative secrets. Share policy links through the verified merchant channel; log representative, scope, time and completion in internal records. End the session promptly.

There is currently no isolated, expiring read-only underwriting role. Do not hand out OWNER/ADMIN/OPERATOR accounts or create fake PAID purchases to simulate review access. If unattended credentials are mandatory, prepare a separately approved scoped review environment with only cleared content, individual expiring credentials, no production/admin/document access, and automatic expiry/revocation before submission. This unattended-access mechanism is pending; normal authentication and purchase protection have not been weakened.

## Validation

- `node scripts/test-compliance.mjs`: isolated real handlers/services with transactional in-memory fixtures; no environment credentials or database network access. Covers public intake, validation, CSRF, rate limiting, rollback, deadline, role/workspace isolation, notes/audit, identity/consent, publication gates, stale approval, legacy preservation, takedowns/playback denial and safe responses.
- `node scripts/test-video-access.mjs`: existing administrative/customer access regression, paid/unpaid/canceled/refunded states, temporary signed URL and unavailable download controls.
- TypeScript, scoped ESLint and full Next production build.
- `node scripts/test-compliance-pages.mjs` against local Next: all 18 public routes, canonical/description, footer targets, desktop/mobile screenshots, both complaint form interfaces, anonymous admin denial and rejection of local-origin writes. Valid form responses are intercepted in this browser suite; actual persistence logic is tested separately by the isolated service suite, never against production.
- `node scripts/test-age-gate.mjs`: isolated browser fixture validates both acknowledgments, ESC resistance, scroll restoration, session persistence, reporting exemption and mobile fit.
- Client artifact scan compared 140 generated JavaScript artifacts with configured sensitive environment values; no matches. Values were not printed. This is a targeted leak check, not a complete security audit.
- Existing `npm run test:auth` has a preexisting harness failure resolving `server-only`; auth code and its test harness were not changed. Relevant Compliance authorization is covered by the isolated suite.

Offline tests do not certify legal compliance, prove government identity, execute the migration against PostgreSQL or guarantee payment processor approval. Formal submission remains pending the prerequisites above.

## Official sources reviewed

Policies are original, not copied from these references. Processor/acquirer requirements must be confirmed for the actual merchant agreement and jurisdiction.

- [CCBill merchant requirements](https://ccbill.com/merchants) and [Acceptable Use Policy](https://ccbill.com/cs/client/policies/ccbill/acceptable_use.html).
- [Visa Network Integrity](https://corporate.visa.com/en/about-visa/visa-network-integrity.html).
- [Mastercard Security Rules and Procedures, Merchant Edition](https://www.mastercard.com/content/dam/mccom/shared/business/support/rules-pdfs/SPME-Manual.pdf), August 4, 2026, adult-content requirements in section 9.4.1.
- [28 CFR Part 75](https://www.ecfr.gov/current/title-28/chapter-I/part-75), including records and statement requirements; applicability requires legal determination.
- [U.S. Copyright Office Section 512](https://www.copyright.gov/512/) and [DMCA designated-agent FAQ](https://www.copyright.gov/dmca-directory/faq.html).
