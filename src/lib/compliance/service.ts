import { withProductCreator } from '@/src/lib/store/product-creator';
import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/src/prisma/db';
import { requireAdministrativeAccess } from '@/src/lib/auth/admin-access';
import { AuthError } from '@/src/lib/auth/request';
import { getRequestIp } from '@/src/lib/auth/rate-limit';
import { hashAuthToken } from '@/src/lib/auth/tokens';
import { lockAuthKey, type AuthTransaction } from '@/src/lib/auth/audit';
import { legalConfiguration } from './config';
import { adultOn, businessDeadline, reportInput, adminInput, dateOnly } from './validation';
import type { OwnerPublication } from '@/src/lib/store/product-fields';

export class ComplianceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function requireComplianceAccess() {
  const auth = await requireAdministrativeAccess();
  if (!['OWNER', 'ADMIN'].includes(auth.membership.role)) throw new ComplianceError('Compliance access requires OWNER or ADMIN.', 403);
  return auth;
}
type ContentFields = { creatorId?: string | null; mediaAssetId: string; teaserMediaAssetId: string | null; thumbnailMediaAssetId: string | null; title: string; slug: string; description: string; category: string };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const mediaFingerprint = (p: ContentFields) => hash([p.mediaAssetId, p.teaserMediaAssetId, p.thumbnailMediaAssetId]);
export const contentFingerprint = (p: ContentFields) => { const fields = [mediaFingerprint(p), p.title, p.slug, p.description, p.category]; return hash(p.creatorId ? [...fields, p.creatorId] : fields); };
async function audit(tx: AuthTransaction, workspaceId: string, actorId: string | null, action: string, objectType: string, objectId: string, metadata: Record<string, string | boolean | null> = {}) {
  await tx.orm.public.AuditLog.create({ userId: actorId, action, entityType: objectType, entityId: objectId, metadata: { workspaceId, ...metadata } });
}
async function productIn(tx: AuthTransaction, workspaceId: string, id: string) {
  const product = await tx.orm.public.VideoProduct.where({ id, workspaceId }).first();
  if (!product) throw new ComplianceError('Content not found.', 404);
  return withProductCreator(tx, product);
}
async function latestIdentity(tx: Pick<AuthTransaction, 'orm'>, workspaceId: string, subjectType: string, subjectId: string) {
  return tx.orm.public.ComplianceIdentity.where({ workspaceId, subjectType, subjectId }).orderBy(r => r.createdAt.desc()).first();
}
type IdentityRecord = Awaited<ReturnType<typeof latestIdentity>>;
function identityProblem(identity: IdentityRecord, date: string) {
  return !identity ? 'No identity verification is recorded for this account or person.'
    : identity.status !== 'VERIFIED' ? 'The latest identity verification is ' + identity.status + '.'
    : !identity.dateOfBirth || !dateOnly.safeParse(identity.dateOfBirth).success ? 'The identity verification is missing a valid date of birth.'
    : !identity.evidenceRef?.trim() ? 'The identity verification is missing a protected evidence reference.'
    : !adultOn(identity.dateOfBirth, date) ? 'The identity verification does not establish adult age on the required date.'
    : identity.expiresAt && (!Number.isFinite(new Date(identity.expiresAt).getTime()) || new Date(identity.expiresAt).getTime() <= Date.now()) ? 'The identity verification has expired or has an invalid expiry date.' : null;
}
async function sharedIdentitySubject(tx: Pick<AuthTransaction, 'orm'>, workspaceId: string, subjectType: string, subjectId: string) {
  const owners = await tx.orm.public.WorkspaceMember.where({ workspaceId, role: 'OWNER' }).all();
  if (owners.length !== 1) return null;
  const ownerId = owners[0].userId;
  const personId = await creatorLink(tx, workspaceId, ownerId);
  if (!personId || (subjectType === 'USER' ? subjectId !== ownerId : subjectType !== 'PERFORMER' || subjectId !== personId)) return null;
  const person = await tx.orm.public.Performer.where({ workspaceId, id: personId, status: 'ACTIVE' }).first();
  if (!person || !await tx.orm.public.User.where({ id: ownerId, status: 'ACTIVE' }).first()) return null;
  return { type: subjectType === 'USER' ? 'PERFORMER' : 'USER', id: subjectType === 'USER' ? personId : ownerId, birthDate: person.dateOfBirth };
}
async function assertIdentity(tx: Pick<AuthTransaction, 'orm'>, workspaceId: string, subjectType: string, subjectId: string, date: string) {
  const direct = await latestIdentity(tx, workspaceId, subjectType, subjectId);
  const shared = await sharedIdentitySubject(tx, workspaceId, subjectType, subjectId);
  const counterpart = shared ? await latestIdentity(tx, workspaceId, shared.type, shared.id) : null;
  if (shared && direct?.dateOfBirth && counterpart?.dateOfBirth && direct.dateOfBirth !== counterpart.dateOfBirth) throw new ComplianceError('The linked account and creator have conflicting birth dates. Resolve the identity mismatch in Creator Verification.', 409);
  const identity = direct ?? counterpart;
  if (shared?.birthDate && identity?.dateOfBirth && shared.birthDate !== identity.dateOfBirth) throw new ComplianceError('The linked creator profile birth date conflicts with the reviewed identity. Resolve the mismatch in Creator Verification.', 409);
  // A reviewed link shares evidence, never erases a rejection, expiry or incomplete newer record.
  const reason = identityProblem(identity, date) ?? (counterpart ? identityProblem(counterpart, date) : null);
  if (reason) throw new ComplianceError(reason, 409);
  for (const record of [identity, counterpart]) {
    if (!record?.evidenceRef?.startsWith('document:')) continue;
    const document = await tx.orm.public.PerformerDocument.where({ workspaceId, id: record.evidenceRef.slice(9), status: 'ACTIVE' }).first();
    const linkedProfileId = subjectType === 'PERFORMER' ? subjectId : shared?.id;
    if (!document || (linkedProfileId && document.performerId !== linkedProfileId)) throw new ComplianceError('The reviewed identity document is no longer available for this creator. Update the protected document and review identity again.', 409);
    if (document.expiresAt && new Date(document.expiresAt).getTime() <= Date.now()) throw new ComplianceError('The reviewed identity document has expired. Update it and review identity again.', 409);
  }
}
async function assertReviewEvidence(tx: AuthTransaction, product: Awaited<ReturnType<typeof productIn>>, review: { providerUserId: string | null; recordedOn: string | null; allPersonsConfirmed: boolean; prohibitedChecked: boolean; copyrightConfirmed: boolean }) {
  const missing = [!review.providerUserId && 'verified content provider', !review.recordedOn && 'recording date', !review.allPersonsConfirmed && 'review identifying all depicted participants', !review.prohibitedChecked && 'content safety review', !review.copyrightConfirmed && 'distribution rights evidence'].filter(Boolean);
  if (missing.length) throw new ComplianceError('Publication pending: ' + missing.join('; ') + '. Resolve these records in Safety & Compliance.', 409);
  if (!dateOnly.safeParse(review.recordedOn).success || review.recordedOn! > new Date().toISOString().slice(0, 10)) throw new ComplianceError('Publication pending: the content review needs a valid recording date that is not in the future.', 409);
  const providerId = review.providerUserId!;
  const membership = await tx.orm.public.WorkspaceMember.where({ workspaceId: product.workspaceId, userId: providerId }).first();
  const provider = await tx.orm.public.User.where({ id: providerId, status: 'ACTIVE' }).first();
  if (!membership || !provider) throw new ComplianceError('The content provider must be an active workspace member.', 409);
  try { await assertIdentity(tx, product.workspaceId, 'USER', providerId, new Date().toISOString().slice(0, 10)); }
  catch (error) { if (!(error instanceof ComplianceError)) throw error; throw new ComplianceError('Content provider: ' + error.message + ' Update the existing account verification in Safety & Compliance > Age & identity.', error.status); }
  const assets = [product.mediaAssetId, product.teaserMediaAssetId, product.thumbnailMediaAssetId].filter((v): v is string => !!v);
  const links = await tx.orm.public.MediaAssetPerformer.where({ workspaceId: product.workspaceId }).where(r => r.mediaAssetId.in(assets)).all();
  const consents = await tx.orm.public.ContentConsent.where({ workspaceId: product.workspaceId, videoProductId: product.id }).orderBy(r => r.recordedAt.desc()).all();
  const latest = new Map<string, typeof consents[number]>();
  for (const consent of consents) if (!latest.has(consent.performerId)) latest.set(consent.performerId, consent);
  const people = new Set([...links.map(l => l.performerId), ...latest.keys(), ...(product.creatorId ? [product.creatorId] : [])]);
  if (!people.size) throw new ComplianceError('Identify every depicted person, including the creator, and record consent before approval.', 409);
  for (const personId of people) {
    const performer = await tx.orm.public.Performer.where({ id: personId, workspaceId: product.workspaceId, status: 'ACTIVE' }).first();
    if (!performer) throw new ComplianceError('Depicted participant ' + personId + ' is unavailable. Update the participant record in Safety & Compliance.', 409);
    try { await assertIdentity(tx, product.workspaceId, 'PERFORMER', personId, review.recordedOn!); }
    catch (error) { if (!(error instanceof ComplianceError)) throw error; throw new ComplianceError(performer.displayName + ': ' + error.message, error.status); }
    const consent = latest.get(personId);
    if (!consent || consent.status !== 'RECORDED' || !consent.evidenceRef?.trim() || !consent.depiction || !consent.distribution || !consent.publication || consent.downloads || consent.mediaFingerprint !== mediaFingerprint(product)) throw new ComplianceError(performer.displayName + ': current content-specific consent evidence for depiction, distribution and publication is required in Safety & Compliance' + (consent ? ' (current record: ' + consent.status + ').' : ' (no consent record).'), 409);
  }
}

// Called within the existing store transaction and lock. No Purchase/payment changes.
export async function assertCommercialPublication(tx: AuthTransaction, workspaceId: string, input: ContentFields, existing: Awaited<ReturnType<typeof productIn>> | null) {
  if (existing?.status === 'PUBLISHED' && existing.complianceStatus === 'LEGACY_UNREVIEWED' && contentFingerprint(existing) === contentFingerprint(input)) return;
  if (!existing) throw new ComplianceError('Save as draft, then complete Safety & Compliance review before publishing.', 409);
  const review = await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: existing.id }).first();
  if (['REJECTED', 'SUSPENDED', 'REMOVED'].includes(existing.complianceStatus) || (review && ['REJECTED', 'SUSPENDED', 'REMOVED'].includes(review.status))) throw new ComplianceError('Publication blocked by the existing safety restriction. Resolve it in Safety & Compliance.', 409);
  if (!review || review.status !== 'APPROVED' || existing.complianceStatus !== 'APPROVED') throw new ComplianceError('Publication pending: no approved content review is on file. Save Draft and complete the content review in Safety & Compliance.', 409);
  if (review.fingerprint !== contentFingerprint(existing) || (mediaFingerprint(existing) !== mediaFingerprint(input) || (existing.creatorId ?? null) !== (input.creatorId ?? null))) throw new ComplianceError('Publication pending: the selected media do not match the approved content review. Review these media in Safety & Compliance.', 409);
  await assertReviewEvidence(tx, { ...existing, ...input }, review);
}

// Existing registries remain the source of truth; never infer consent for a different upload.
export async function ownerPublicationContext(tx: AuthTransaction, workspaceId: string, actorId: string, product: ContentFields & { id?: string; complianceStatus?: string }) {
  const stored = product.id ? await tx.orm.public.VideoProduct.where({ workspaceId, id: product.id }).first() : null;
  const original = stored ? await withProductCreator(tx, stored) : null;
  const review = original ? await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: original.id }).first() : null;
  const reusableReview = review?.status === 'APPROVED' && original && review.fingerprint === contentFingerprint(original) && mediaFingerprint(original) === mediaFingerprint(product) && original.creatorId === (product.creatorId ?? null) ? review : null;
  const recordedOn = original && mediaFingerprint(original) === mediaFingerprint(product) ? review?.recordedOn ?? null : null;
  const assets = [product.mediaAssetId, product.teaserMediaAssetId, product.thumbnailMediaAssetId].filter((id): id is string => !!id);
  const links = assets.length ? await tx.orm.public.MediaAssetPerformer.where({ workspaceId }).where(row => row.mediaAssetId.in(assets)).all() : [];
  const records = original ? await tx.orm.public.ContentConsent.where({ workspaceId, videoProductId: original.id }).orderBy(row => row.recordedAt.desc()).all() : [];
  const latest = new Map<string, typeof records[number]>();
  for (const row of records) if (!latest.has(row.performerId)) latest.set(row.performerId, row);
  const people = [...new Set([...links.map(row => row.performerId), ...latest.keys(), ...(product.creatorId ? [product.creatorId] : [])])];
  const missingConsentIds = people.filter(id => { const row = latest.get(id); return !row || row.status !== 'RECORDED' || !row.evidenceRef || !row.depiction || !row.distribution || !row.publication || row.downloads || row.mediaFingerprint !== mediaFingerprint(product); });
  const pending: string[] = [];
  if (['REJECTED', 'SUSPENDED', 'REMOVED'].includes(product.complianceStatus ?? '') || (review && ['REJECTED', 'SUSPENDED', 'REMOVED'].includes(review.status))) pending.push('Resolve the existing safety restriction in Safety & Compliance.');
  let accountIdentityPending = false;
  try { await assertIdentity(tx, workspaceId, 'USER', actorId, new Date().toISOString().slice(0, 10)); }
  catch (error) { if (!(error instanceof ComplianceError)) throw error; accountIdentityPending = true; pending.push('Creator: ' + error.message + ' Complete one real identity review in Creator Verification (/app/compliance). Valid evidence is reused for the explicitly linked account and creator profile.'); }
  for (const id of people) {
    const performer = await tx.orm.public.Performer.where({ workspaceId, id, status: 'ACTIVE' }).first();
    if (!performer) { pending.push('A depicted participant is unavailable.'); continue; }
    try { await assertIdentity(tx, workspaceId, 'PERFORMER', id, recordedOn ?? new Date().toISOString().slice(0, 10)); }
    catch (error) { if (!(error instanceof ComplianceError)) throw error; const shared = await sharedIdentitySubject(tx, workspaceId, 'PERFORMER', id); if (!accountIdentityPending || shared?.id !== actorId) pending.push(performer.displayName + ': ' + error.message); }
    if (latest.get(id) && latest.get(id)!.status !== 'RECORDED') pending.push(performer.displayName + ': resolve disputed or revoked consent in Safety & Compliance.');
  }
  return { recordedOn, needsAttestation: !reusableReview, people, missingConsentIds, pending, reusableReview };
}

// Invoked only after server-side OWNER authorization, under the store lock.
// Reuses the same evidence checks as a manual review; never verifies identity here.
export async function completeOwnerPublication(tx: AuthTransaction, workspaceId: string, actorId: string, product: Awaited<ReturnType<typeof productIn>>, evidence?: OwnerPublication) {
  const member = await tx.orm.public.WorkspaceMember.where({ workspaceId, userId: actorId, role: 'OWNER' }).first();
  if (!member) throw new ComplianceError('Direct publication requires OWNER.', 403);
  const existing = await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: product.id }).first();
  const blocked = ['REJECTED', 'SUSPENDED', 'REMOVED'];
  if (blocked.includes(product.complianceStatus) || (existing && blocked.includes(existing.status))) throw new ComplianceError('Resolve the existing safety restriction before publishing.', 409);
  // A valid content review belongs to its actual provider, not whoever clicks Publish.
  // Metadata edits do not replace evidence, reviewer decisions or content-specific consent.
  const stored = await tx.orm.public.VideoProduct.where({ workspaceId, id: product.id }).first();
  const original = stored ? await withProductCreator(tx, stored) : null;
  if (!evidence && existing?.status === 'APPROVED' && original?.complianceStatus === 'APPROVED' && existing.fingerprint === contentFingerprint(original) && mediaFingerprint(original) === mediaFingerprint(product)) {
    await assertReviewEvidence(tx, product, existing);
    if (existing.fingerprint !== contentFingerprint(product)) await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: product.id }).updateAndCount({ fingerprint: contentFingerprint(product) });
    return;
  }
  const context = await ownerPublicationContext(tx, workspaceId, actorId, product);
  if (context.pending.length) throw new ComplianceError(context.pending.join(' '), 409);
  if (!evidence && context.needsAttestation) {
    const missing: string[] = [];
    if (!context.recordedOn) missing.push('recording date');
    if (!context.people.length) missing.push('identified depicted participants');
    for (const personId of context.missingConsentIds) {
      const person = await tx.orm.public.Performer.where({ workspaceId, id: personId }).first();
      missing.push('content-specific consent for ' + (person?.displayName ?? personId));
    }
    missing.push('approved content review covering distribution rights');
    throw new ComplianceError('Publication pending: ' + missing.join('; ') + '. Save Draft and resolve these records in Safety & Compliance, then retry Publish.', 409);
  }
  const changesEvidence = !!evidence?.consents.length || (!!evidence?.recordedOn && evidence.recordedOn !== context.recordedOn);
  if ((context.needsAttestation || changesEvidence) && !evidence?.attest) throw new ComplianceError('Confirm the pending content review before publishing.', 409);
  const review = { providerUserId: actorId, recordedOn: evidence?.recordedOn ?? context.recordedOn,
    allPersonsConfirmed: !!evidence?.attest || !!context.reusableReview?.allPersonsConfirmed,
    prohibitedChecked: !!evidence?.attest || !!context.reusableReview?.prohibitedChecked,
    copyrightConfirmed: !!evidence?.attest || !!context.reusableReview?.copyrightConfirmed };
  if (!review.recordedOn || review.recordedOn > new Date().toISOString().slice(0, 10)) throw new ComplianceError('A valid recording date, not in the future, is required.', 409);
  if (evidence) {
    for (const consent of evidence.consents) {
      const performer = await tx.orm.public.Performer.where({ id: consent.performerId, workspaceId, status: 'ACTIVE' }).first();
      if (!performer) throw new ComplianceError('A depicted person is unavailable.', 409);
      const latest = await tx.orm.public.ContentConsent.where({ workspaceId, videoProductId: product.id, performerId: consent.performerId }).orderBy(r => r.recordedAt.desc()).first();
      if (latest && latest.status !== 'RECORDED') throw new ComplianceError('Resolve the disputed or revoked consent before publishing.', 409);
      const record = await tx.orm.public.ContentConsent.create({ workspaceId, videoProductId: product.id, performerId: consent.performerId, evidenceRef: consent.evidenceRef, mediaFingerprint: mediaFingerprint(product), depiction: true, distribution: true, publication: true, downloads: false, status: 'RECORDED', recordedBy: actorId });
      await audit(tx, workspaceId, actorId, 'CONSENT_RECORD_UPDATED', 'CONTENT_CONSENT', record.id, { productId: product.id, performerId: consent.performerId, source: 'OWNER_DIRECT_PUBLICATION' });
    }
  }
  await assertReviewEvidence(tx, product, review);
  const data = { providerUserId: review.providerUserId, recordedOn: review.recordedOn, allPersonsConfirmed: review.allPersonsConfirmed, prohibitedChecked: review.prohibitedChecked, copyrightConfirmed: review.copyrightConfirmed, status: 'APPROVED', fingerprint: contentFingerprint(product), decision: 'Owner publication: mandatory evidence validated in Videos for Sale.', reviewedBy: actorId, reviewedAt: new Date().toISOString() };
  if (existing) await tx.orm.public.ContentReview.where({ id: existing.id, workspaceId }).updateAndCount(data);
  else await tx.orm.public.ContentReview.create({ ...data, workspaceId, videoProductId: product.id });
  await tx.orm.public.VideoProduct.where({ id: product.id, workspaceId }).updateAndCount({ complianceStatus: 'APPROVED' });
  await audit(tx, workspaceId, actorId, 'CONTENT_APPROVED', 'VIDEO_PRODUCT', product.id, { source: 'OWNER_DIRECT_PUBLICATION', evidenceValidated: true });
}

function safeContentUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['hotwifesonyc.com', 'www.hotwifesonyc.com'].includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash) throw new ComplianceError('Use a public hotwifesonyc.com page URL without query parameters; never submit a signed media URL.');
  return url;
}
export async function submitReport(value: unknown, request: Request) {
  const input = reportInput.parse(value);
  const url = safeContentUrl(input.contentUrl);
  const slug = /^\/videos\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  const product = slug ? await db.orm.public.VideoProduct.where({ slug }).first() : null;
  let workspaceId = product?.workspaceId ?? process.env.COMPLIANCE_WORKSPACE_ID?.trim();
  if (!workspaceId) {
    const workspaces = await db.orm.public.Workspace.where({ status: 'ACTIVE' }).limit(2).all();
    if (workspaces.length === 1) workspaceId = workspaces[0].id;
  }
  if (!workspaceId || !await db.orm.public.Workspace.where({ id: workspaceId, status: 'ACTIVE' }).first()) throw new ComplianceError('Reporting is temporarily unavailable. Please use a configured safety contact on /contact, or try again later.', 503);
  const priority = ['Underage concern', 'Non-consensual content', 'Trafficking/exploitation concern'].includes(input.reason) || input.kind === 'DEPICTED_PERSON' ? 'HIGH' : 'NORMAL';
  const ip = getRequestIp(request);
  const buckets = [{ key: hashAuthToken('compliance:email:' + input.reporterEmail), limit: 5 }, ...(ip ? [{ key: hashAuthToken('compliance:ip:' + ip), limit: 20 }] : [])].sort((a, b) => a.key.localeCompare(b.key));
  return db.transaction(async tx => {
    for (const bucket of buckets) await lockAuthKey(tx, 'compliance-rate:' + bucket.key);
    for (const bucket of buckets) {
      const records = await tx.orm.public.AuditLog.where({ entityType: 'COMPLIANCE_RATE', entityId: bucket.key }).where(r => r.createdAt.gte(new Date(Date.now() - 600000).toISOString())).limit(bucket.limit).all();
      if (records.length >= bucket.limit) throw new ComplianceError('Too many submissions. Please try again in 10 minutes.', 429);
    }
    const report = await tx.orm.public.ComplianceReport.create({ workspaceId, videoProductId: product?.id ?? null, kind: input.kind, contentUrl: url.href, reason: input.reason, reporterName: input.reporterName, reporterEmail: input.reporterEmail, depictedPerson: input.depictedPerson || input.kind === 'DEPICTED_PERSON', description: input.description, supportingInfo: input.supportingInfo || null, priority, dueAt: businessDeadline(new Date()) });
    for (const bucket of buckets) await tx.orm.public.AuditLog.create({ action: 'COMPLIANCE_SUBMISSION_RATE', entityType: 'COMPLIANCE_RATE', entityId: bucket.key });
    await audit(tx, workspaceId, null, input.kind === 'DEPICTED_PERSON' ? 'DEPICTED_PERSON_APPEAL_RECEIVED' : 'COMPLAINT_OPENED', 'COMPLIANCE_REPORT', report.id, { priority, kind: input.kind });
    return { reference: report.id, status: 'OPEN', dueAt: report.dueAt };
  });
}

async function suspend(tx: AuthTransaction, workspaceId: string, productId: string, actorId: string, status: 'SUSPENDED' | 'REMOVED', note: string) {
  await productIn(tx, workspaceId, productId);
  await tx.orm.public.VideoProduct.where({ id: productId, workspaceId }).updateAndCount({ status: 'ARCHIVED', complianceStatus: status });
  const review = await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: productId }).first();
  if (review) await tx.orm.public.ContentReview.where({ id: review.id }).updateAndCount({ status, decision: note, reviewedBy: actorId, reviewedAt: new Date().toISOString() });
  else await tx.orm.public.ContentReview.create({ workspaceId, videoProductId: productId, status, decision: note, reviewedBy: actorId, reviewedAt: new Date().toISOString() });
  await audit(tx, workspaceId, actorId, 'CONTENT_' + status, 'VIDEO_PRODUCT', productId);
}
// Explicit, workspace-scoped link in the existing protected compliance registry.
async function creatorAccount(tx: Pick<AuthTransaction, 'orm'>, workspaceId: string) {
  const owners = await tx.orm.public.WorkspaceMember.where({ workspaceId, role: 'OWNER' }).all();
  if (owners.length !== 1) throw new ComplianceError('Creator setup requires exactly one OWNER account. Resolve account ownership before linking a person.', 409);
  if (!await tx.orm.public.User.where({ id: owners[0].userId, status: 'ACTIVE' }).first()) throw new ComplianceError('The OWNER account must be active before creator verification.', 409);
  return owners[0].userId;
}
async function creatorLink(tx: Pick<AuthTransaction, 'orm'>, workspaceId: string, ownerId: string) {
  const record = await tx.orm.public.ComplianceNote.where({ workspaceId, objectType: 'CREATOR_LINK', objectId: ownerId }).orderBy(row => row.createdAt.desc()).first();
  if (!record) return null;
  try { const value = JSON.parse(record.body); return value.samePersonReviewed === true && typeof value.performerId === 'string' ? value.performerId as string : null; } catch { return null; }
}
async function assertCreatorDocument(tx: Pick<AuthTransaction, 'orm'>, workspaceId: string, performerId: string, reference: string) {
  const id = /^document:([0-9a-f-]{36})$/i.exec(reference)?.[1];
  const document = id ? await tx.orm.public.PerformerDocument.where({ id, workspaceId, performerId, status: 'ACTIVE' }).first() : null;
  if (!document || (document.expiresAt && new Date(document.expiresAt).getTime() <= Date.now())) throw new ComplianceError('Select an available, current protected document belonging to the linked creator.', 409);
}
export async function complianceAction(value: unknown) {
  const auth = await requireComplianceAccess();
  const input = adminInput.parse(value);
  const workspaceId = auth.workspace.id, actorId = auth.user.id;
  return db.transaction(async tx => {
    await lockAuthKey(tx, 'store-video-products');
    if (input.action === 'creatorProfile') {
      const person = await tx.orm.public.Performer.where({ workspaceId, id: input.performerId }).first();
      if (!person) throw new ComplianceError('Creator profile not found.', 404);
      await tx.orm.public.Performer.where({ workspaceId, id: person.id }).updateAndCount({ displayName: input.displayName, ...(input.status ? { status: input.status } : {}), ...(input.legalName !== undefined ? { legalName: input.legalName || null } : {}) });
      await audit(tx, workspaceId, actorId, 'CREATOR_PROFILE_UPDATED', 'PERFORMER', person.id);
      return { ok: true };
    }
    if (input.action === 'creatorDocumentReplacement') {
      const person = await tx.orm.public.Performer.where({ workspaceId, id: input.performerId, status: 'ACTIVE' }).first();
      if (!person) throw new ComplianceError('Creator profile not found.', 404);
      const document = await tx.orm.public.PerformerDocument.where({ workspaceId, performerId: person.id, id: input.documentId, status: 'ACTIVE' }).first();
      if (!document || document.documentType !== 'PHOTO_ID') throw new ComplianceError('Select an active identity document for this creator.', 409);
      const shared = await sharedIdentitySubject(tx, workspaceId, 'PERFORMER', person.id);
      const source = await latestIdentity(tx, workspaceId, 'PERFORMER', person.id) ?? (shared ? await latestIdentity(tx, workspaceId, shared.type, shared.id) : null);
      const reference = 'document:' + document.id;
      const subjects = [['PERFORMER', person.id], ...(shared ? [[shared.type, shared.id]] : [])];
      for (const [subjectType, subjectId] of subjects) {
        const latest = await latestIdentity(tx, workspaceId, subjectType, subjectId);
        if (latest?.evidenceRef === reference) continue; // A retry must not invalidate a completed review of this same document.
        await tx.orm.public.ComplianceIdentity.create({ workspaceId, subjectType, subjectId, status: 'NOT_VERIFIED', dateOfBirth: source?.dateOfBirth ?? null, evidenceRef: reference, expiresAt: document.expiresAt, verifiedBy: null, verifiedAt: null });
      }
      const reviews = await tx.orm.public.ContentReview.where({ workspaceId, status: 'APPROVED' }).all();
      for (const review of reviews) {
        if ((shared && review.providerUserId === shared.id) || await tx.orm.public.ContentConsent.where({ workspaceId, videoProductId: review.videoProductId, performerId: person.id }).first()) {
          await tx.orm.public.VideoProduct.where({ workspaceId, id: review.videoProductId, status: 'PUBLISHED' }).updateAndCount({ status: 'ARCHIVED' });
        }
      }
      await audit(tx, workspaceId, actorId, 'IDENTITY_DOCUMENT_REPLACED', 'PERFORMER', person.id, { documentId: document.id });
      return { ok: true };
    }
    if (input.action === 'creatorIdentity' || input.action === 'creatorLink') {
      const ownerId = await creatorAccount(tx, workspaceId);
      const linked = await creatorLink(tx, workspaceId, ownerId);
      if (linked && input.performerId && linked !== input.performerId) throw new ComplianceError('The creator is already linked to a different profile. Review that link before making changes.', 409);
      const today = new Date().toISOString().slice(0, 10);
      if (input.action === 'creatorIdentity' && (!adultOn(input.dateOfBirth, today) || (input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now()))) throw new ComplianceError('Review requires an adult and current identity evidence.', 409);
      let person = linked || input.performerId ? await tx.orm.public.Performer.where({ workspaceId, id: linked ?? input.performerId!, status: 'ACTIVE' }).first() : null;
      if ((linked || input.performerId) && !person) throw new ComplianceError('The selected creator profile is unavailable.', 409);
      if (!person) {
        if (!input.displayName) throw new ComplianceError('Enter the creator name or select an existing profile.');
        const matches = (await tx.orm.public.Performer.where({ workspaceId, status: 'ACTIVE' }).all()).filter(row => row.displayName.trim().toLowerCase() === input.displayName!.trim().toLowerCase());
        if (matches.length > 1) throw new ComplianceError('More than one profile has this name. Select the existing creator profile.');
        person = matches[0] ?? await tx.orm.public.Performer.create({ workspaceId, displayName: input.displayName, status: 'ACTIVE' });
      }
      if (!linked) await tx.orm.public.ComplianceNote.create({ workspaceId, objectType: 'CREATOR_LINK', objectId: ownerId, actorId, body: JSON.stringify({ performerId: person.id, samePersonReviewed: true }) });
      if (input.action === 'creatorLink') {
        // Reuse actual reviewed account evidence only after the explicit same-person link.
        // Never override a participant's rejected, expired or otherwise existing record.
        const source = await latestIdentity(tx, workspaceId, 'USER', ownerId);
        const target = await latestIdentity(tx, workspaceId, 'PERFORMER', person.id);
        if (source && !target) {
          let valid = true;
          try { await assertIdentity(tx, workspaceId, 'USER', ownerId, today); } catch (error) { if (!(error instanceof ComplianceError)) throw error; valid = false; }
          if (valid) {
            if (person.dateOfBirth && person.dateOfBirth !== source.dateOfBirth) throw new ComplianceError('The profile birth date differs from the reviewed OWNER identity. Resolve the mismatch before linking.', 409);
            const reused = await tx.orm.public.ComplianceIdentity.create({ workspaceId, subjectType: 'PERFORMER', subjectId: person.id, status: 'VERIFIED', dateOfBirth: source.dateOfBirth, evidenceRef: source.evidenceRef, expiresAt: source.expiresAt, verifiedBy: source.verifiedBy, verifiedAt: source.verifiedAt });
            await audit(tx, workspaceId, actorId, 'IDENTITY_EVIDENCE_REUSED', 'COMPLIANCE_IDENTITY', reused.id, { ownerId, sourceIdentityId: source.id });
          }
        }
        await audit(tx, workspaceId, actorId, 'CREATOR_LINK_REVIEWED', 'PERFORMER', person.id, { ownerId }); return { ok: true };
      }
      await assertCreatorDocument(tx, workspaceId, person.id, input.evidenceRef);
      const accountIdentity = await latestIdentity(tx, workspaceId, 'USER', ownerId);
      const personIdentity = await latestIdentity(tx, workspaceId, 'PERFORMER', person.id);
      const current = accountIdentity ?? personIdentity;
      if (current && [accountIdentity, personIdentity].filter(Boolean).every(record => record!.status === 'VERIFIED' && record!.dateOfBirth === input.dateOfBirth && record!.evidenceRef === input.evidenceRef && (record!.expiresAt ?? null) === input.expiresAt)) {
        await assertIdentity(tx, workspaceId, 'USER', ownerId, today);
        await assertIdentity(tx, workspaceId, 'PERFORMER', person.id, today);
        return { ok: true, reused: true };
      }
      for (const [subjectType, subjectId] of [['USER', ownerId], ['PERFORMER', person.id]]) {
        const previous = await latestIdentity(tx, workspaceId, subjectType, subjectId);
        if (previous?.dateOfBirth && previous.dateOfBirth !== input.dateOfBirth) throw new ComplianceError('The birth date differs from the existing identity record. Resolve this using the advanced identity review.', 409);
        const identity = await tx.orm.public.ComplianceIdentity.create({ workspaceId, subjectType, subjectId, status: 'VERIFIED', dateOfBirth: input.dateOfBirth, evidenceRef: input.evidenceRef, expiresAt: input.expiresAt, verifiedBy: actorId, verifiedAt: new Date().toISOString() });
        await audit(tx, workspaceId, actorId, 'AGE_VERIFICATION_UPDATED', 'COMPLIANCE_IDENTITY', identity.id, { subjectType, subjectId, source: 'CREATOR_REVIEW' });
      }
      await audit(tx, workspaceId, actorId, 'CREATOR_LINK_REVIEWED', 'PERFORMER', person.id, { ownerId });
      return { ok: true };
    }
    if (input.action === 'creatorReview') {
      const ownerId = await creatorAccount(tx, workspaceId);
      const personId = await creatorLink(tx, workspaceId, ownerId);
      if (!personId) throw new ComplianceError('Complete Creator Verification before reviewing a video.', 409);
      const product = await productIn(tx, workspaceId, input.productId);
      if (product.creatorId && product.creatorId !== personId) throw new ComplianceError('The selected product creator is not the linked creator. Use the additional-people review for this profile.', 409);
      const oldReview = await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: product.id }).first();
      if (['REJECTED', 'SUSPENDED', 'REMOVED'].includes(product.complianceStatus) || (oldReview && ['REJECTED', 'SUSPENDED', 'REMOVED'].includes(oldReview.status))) throw new ComplianceError('Resolve the safety restriction using the advanced review before approving this video.', 409);
      if (input.recordedOn > new Date().toISOString().slice(0, 10)) throw new ComplianceError('The recording date cannot be in the future.');
      const assets = [product.mediaAssetId, product.teaserMediaAssetId, product.thumbnailMediaAssetId].filter((id): id is string => !!id);
      const links = await tx.orm.public.MediaAssetPerformer.where({ workspaceId }).where(row => row.mediaAssetId.in(assets)).all();
      const records = await tx.orm.public.ContentConsent.where({ workspaceId, videoProductId: product.id }).orderBy(row => row.recordedAt.desc()).all();
      if (links.some(row => row.performerId !== personId) || records.some(row => row.performerId !== personId)) throw new ComplianceError('This video includes other participants. Use the additional-people review.', 409);
      const consent = records[0];
      if (consent && consent.status !== 'RECORDED') throw new ComplianceError('Resolve the revoked or disputed consent before review.', 409);
      const reusable = oldReview?.status === 'APPROVED' && oldReview.fingerprint === contentFingerprint(product) && oldReview.providerUserId === ownerId && oldReview.recordedOn === input.recordedOn;
      if (!input.rightsEvidenceRef && !reusable) throw new ComplianceError('Add the protected distribution-rights evidence reference for this video.', 409);
      const validConsent = consent && consent.evidenceRef?.trim() && consent.depiction && consent.distribution && consent.publication && !consent.downloads && consent.mediaFingerprint === mediaFingerprint(product);
      if (!validConsent && !input.consentEvidenceRef) throw new ComplianceError('Add the signed consent evidence reference covering this video and its previews.', 409);
      if (input.rightsEvidenceRef) await assertCreatorDocument(tx, workspaceId, personId, input.rightsEvidenceRef);
      if (input.consentEvidenceRef) {
        await assertCreatorDocument(tx, workspaceId, personId, input.consentEvidenceRef);
        const record = await tx.orm.public.ContentConsent.create({ workspaceId, videoProductId: product.id, performerId: personId, evidenceRef: input.consentEvidenceRef, mediaFingerprint: mediaFingerprint(product), depiction: true, distribution: true, publication: true, downloads: false, status: 'RECORDED', recordedBy: actorId });
        await audit(tx, workspaceId, actorId, 'CONSENT_RECORD_UPDATED', 'CONTENT_CONSENT', record.id, { productId: product.id });
      }
      const review = { providerUserId: ownerId, recordedOn: input.recordedOn, allPersonsConfirmed: true, prohibitedChecked: true, copyrightConfirmed: true };
      await assertReviewEvidence(tx, product, review);
      if (reusable && !input.consentEvidenceRef && !input.rightsEvidenceRef) return { ok: true };
      const data = { ...review, status: 'APPROVED', fingerprint: contentFingerprint(product), decision: input.rightsEvidenceRef ? 'Reviewed creator-only video. Protected distribution-rights evidence: ' + input.rightsEvidenceRef : oldReview!.decision, reviewedBy: actorId, reviewedAt: new Date().toISOString() };
      if (oldReview) await tx.orm.public.ContentReview.where({ workspaceId, id: oldReview.id }).updateAndCount(data);
      else await tx.orm.public.ContentReview.create({ ...data, workspaceId, videoProductId: product.id });
      await tx.orm.public.VideoProduct.where({ workspaceId, id: product.id }).updateAndCount({ complianceStatus: 'APPROVED', ...(product.status === 'PUBLISHED' ? { status: 'ARCHIVED' } : {}) });
      await audit(tx, workspaceId, actorId, 'CONTENT_APPROVED', 'VIDEO_PRODUCT', product.id, { source: 'CREATOR_REVIEW' });
      return { ok: true };
    }
    if (input.action === 'report') {
      const report = await tx.orm.public.ComplianceReport.where({ id: input.id, workspaceId }).first();
      if (!report) throw new ComplianceError('Complaint not found.', 404);
      if (input.productId) await productIn(tx, workspaceId, input.productId);
      const note = await tx.orm.public.ComplianceNote.create({ workspaceId, objectType: 'COMPLIANCE_REPORT', objectId: report.id, actorId, body: input.note });
      await tx.orm.public.ComplianceReport.where({ id: report.id, workspaceId }).updateAndCount({ status: input.status, decision: input.note, resolvedAt: ['RESOLVED', 'REJECTED'].includes(input.status) ? new Date().toISOString() : null, ...(input.productId ? { videoProductId: input.productId } : {}) });
      await audit(tx, workspaceId, actorId, input.status === 'RESOLVED' ? 'COMPLAINT_RESOLVED' : 'COMPLAINT_UPDATED', 'COMPLIANCE_REPORT', report.id, { status: input.status, noteId: note.id });
      return { ok: true };
    }
    if (input.action === 'identity') {
      const subject = input.subjectType === 'USER'
        ? await tx.orm.public.WorkspaceMember.where({ workspaceId, userId: input.subjectId }).first()
        : await tx.orm.public.Performer.where({ workspaceId, id: input.subjectId }).first();
      if (!subject) throw new ComplianceError('Verification subject not found.', 404);
      const today = new Date().toISOString().slice(0, 10);
      if (input.status === 'VERIFIED' && (!adultOn(input.dateOfBirth, today) || (input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now()))) throw new ComplianceError('Verification requires an adult and a current identity document.');
      const identity = await tx.orm.public.ComplianceIdentity.create({ workspaceId, subjectType: input.subjectType, subjectId: input.subjectId, status: input.status, dateOfBirth: input.dateOfBirth, evidenceRef: input.evidenceRef, expiresAt: input.expiresAt, verifiedBy: actorId, verifiedAt: input.status === 'VERIFIED' ? new Date().toISOString() : null });
      await audit(tx, workspaceId, actorId, 'AGE_VERIFICATION_UPDATED', 'COMPLIANCE_IDENTITY', identity.id, { subjectType: input.subjectType, subjectId: input.subjectId, status: input.status });
      {
        const reviews = await tx.orm.public.ContentReview.where({ workspaceId, status: 'APPROVED' }).all();
        for (const review of reviews) {
          const involved = input.subjectType === 'USER' ? review.providerUserId === input.subjectId : !!await tx.orm.public.ContentConsent.where({ workspaceId, videoProductId: review.videoProductId, performerId: input.subjectId }).first();
          if (involved) await suspend(tx, workspaceId, review.videoProductId, actorId, 'SUSPENDED', 'Identity verification requires review.');
        }
      }
      return { ok: true };
    }
    const product = await productIn(tx, workspaceId, input.productId);
    if (input.action === 'moderate') {
      await suspend(tx, workspaceId, product.id, actorId, input.status, input.note);
      await tx.orm.public.ComplianceNote.create({ workspaceId, objectType: 'VIDEO_PRODUCT', objectId: product.id, actorId, body: input.note });
      return { ok: true };
    }
    if (input.action === 'consent') {
      if (!await tx.orm.public.Performer.where({ workspaceId, id: input.performerId }).first()) throw new ComplianceError('Depicted person not found.', 404);
      const consent = await tx.orm.public.ContentConsent.create({ workspaceId, videoProductId: product.id, performerId: input.performerId, evidenceRef: input.evidenceRef, mediaFingerprint: mediaFingerprint(product), depiction: input.depiction, distribution: input.distribution, publication: input.publication, downloads: false, status: input.status, recordedBy: actorId });
      await audit(tx, workspaceId, actorId, 'CONSENT_RECORD_UPDATED', 'CONTENT_CONSENT', consent.id, { productId: product.id, performerId: input.performerId, status: input.status });
      if (product.status === 'PUBLISHED') await suspend(tx, workspaceId, product.id, actorId, 'SUSPENDED', 'Consent changed; review is required before republication.');
      return { ok: true };
    }
    if (input.recordedOn > new Date().toISOString().slice(0, 10)) throw new ComplianceError('The recording date cannot be in the future.');
    if (input.status === 'SUSPENDED' || input.status === 'REMOVED') {
      await suspend(tx, workspaceId, product.id, actorId, input.status, input.note);
    } else {
      if (input.status === 'APPROVED') await assertReviewEvidence(tx, product, input);
      if (product.status === 'PUBLISHED') await tx.orm.public.VideoProduct.where({ id: product.id, workspaceId }).updateAndCount({ status: 'ARCHIVED' });
      const existing = await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: product.id }).first();
      const data = { providerUserId: input.providerUserId, recordedOn: input.recordedOn, allPersonsConfirmed: input.allPersonsConfirmed, prohibitedChecked: input.prohibitedChecked, copyrightConfirmed: input.copyrightConfirmed, status: input.status, fingerprint: input.status === 'APPROVED' ? contentFingerprint(product) : null, decision: input.note, reviewedBy: actorId, reviewedAt: new Date().toISOString() };
      if (existing) await tx.orm.public.ContentReview.where({ id: existing.id }).updateAndCount(data);
      else await tx.orm.public.ContentReview.create({ ...data, workspaceId, videoProductId: product.id });
      await tx.orm.public.VideoProduct.where({ id: product.id, workspaceId }).updateAndCount({ complianceStatus: input.status });
      await audit(tx, workspaceId, actorId, 'CONTENT_' + input.status, 'VIDEO_PRODUCT', product.id);
    }
    await tx.orm.public.ComplianceNote.create({ workspaceId, objectType: 'VIDEO_PRODUCT', objectId: product.id, actorId, body: input.note });
    return { ok: true };
  });
}

export async function complianceDashboard(status?: string) {
  const auth = await requireComplianceAccess();
  const workspaceId = auth.workspace.id;
  let reportsQuery = db.orm.public.ComplianceReport.where({ workspaceId });
  if (status) reportsQuery = reportsQuery.where({ status });
  const [reports, products, performers, members, identities, reviews, consents, events, notes] = await Promise.all([
    reportsQuery.orderBy(r => r.createdAt.desc()).limit(200).all(),
    db.orm.public.VideoProduct.where({ workspaceId }).select('id', 'title', 'slug', 'status', 'complianceStatus').orderBy(r => r.createdAt.desc()).all(),
    db.orm.public.Performer.where({ workspaceId, status: 'ACTIVE' }).select('id', 'displayName', 'legalName').all(),
    db.orm.public.WorkspaceMember.where({ workspaceId }).select('userId', 'role').all(),
    db.orm.public.ComplianceIdentity.where({ workspaceId }).select('id', 'subjectType', 'subjectId', 'status', 'expiresAt', 'verifiedAt', 'createdAt').orderBy(r => r.createdAt.desc()).all(),
    db.orm.public.ContentReview.where({ workspaceId }).all(),
    db.orm.public.ContentConsent.where({ workspaceId }).select('id', 'videoProductId', 'performerId', 'status', 'depiction', 'distribution', 'publication', 'recordedAt').orderBy(r => r.recordedAt.desc()).all(),
    db.orm.public.AuditLog.where(r => r.entityType.in(['COMPLIANCE_REPORT', 'COMPLIANCE_IDENTITY', 'CONTENT_CONSENT', 'VIDEO_PRODUCT'])).orderBy(r => r.createdAt.desc()).limit(1000).all(),
    db.orm.public.ComplianceNote.where({ workspaceId }).orderBy(r => r.createdAt.desc()).limit(200).all(),
  ]);
  let creator: { ownerId: string | null; performerId: string | null; status: 'Verified' | 'Action Required' | 'Expired'; missing: string[] } = { ownerId: null, performerId: null, status: 'Action Required', missing: [] };
  try {
    const ownerId = await creatorAccount(db, workspaceId);
    const performerId = await creatorLink(db, workspaceId, ownerId);
    creator.ownerId = ownerId; creator.performerId = performerId;
    if (!performerId) creator.missing.push('Link the OWNER account to the creator after checking they are the same person.');
    else if (!performers.some(person => person.id === performerId)) creator.missing.push('The linked creator profile is inactive or unavailable.');
    for (const [type, id] of [['USER', ownerId], ...(performerId ? [['PERFORMER', performerId]] : [])]) {
      try { await assertIdentity(db, workspaceId, type, id, new Date().toISOString().slice(0, 10)); }
      catch (error) { if (!(error instanceof ComplianceError)) throw error; creator.missing.push(error.message); if (error.message.includes('expired')) creator.status = 'Expired'; }
    }
    if (!creator.missing.length) creator.status = 'Verified';
  } catch (error) { if (!(error instanceof ComplianceError)) throw error; creator.missing.push(error.message); }
  creator.missing = [...new Set(creator.missing)];
  const cardProfiles = await db.orm.public.Performer.where({ workspaceId }).select('id', 'displayName', 'legalName', 'status').all();
  const creatorProfiles = await Promise.all(cardProfiles.map(async person => {
    const history = await db.orm.public.ComplianceIdentity.where({ workspaceId, subjectType: 'PERFORMER', subjectId: person.id }).orderBy(row => row.createdAt.desc()).all();
    const direct = history[0] ?? null;
    const shared = await sharedIdentitySubject(db, workspaceId, 'PERFORMER', person.id);
    const identity = direct ?? (shared ? await latestIdentity(db, workspaceId, shared.type, shared.id) : null);
    let status: 'Verified' | 'Action Required' | 'Expired' = 'Verified';
    let pending: string | null = null;
    try { if (person.status !== 'ACTIVE') throw new ComplianceError('This creator profile is inactive. Use Edit Profile to activate it before reviewing identity.', 409); await assertIdentity(db, workspaceId, 'PERFORMER', person.id, new Date().toISOString().slice(0, 10)); }
    catch (error) { if (!(error instanceof ComplianceError)) throw error; pending = error.message; status = pending.includes('expired') ? 'Expired' : 'Action Required'; }
    const documents = await db.orm.public.PerformerDocument.where({ workspaceId, performerId: person.id }).select('id', 'documentType', 'title', 'status', 'expiresAt', 'createdAt').orderBy(row => row.createdAt.desc()).all();
    const evidenceDocumentId = identity?.evidenceRef?.startsWith('document:') ? identity.evidenceRef.slice(9) : null;
    return { id: person.id, displayName: person.displayName, legalName: person.legalName, profileStatus: person.status, status, pending, documents, evidenceDocumentId, dateOfBirth: identity?.dateOfBirth ?? null, expiresAt: identity?.expiresAt ?? null, reviewedAt: identity?.verifiedAt ?? history.find(record => record.verifiedAt)?.verifiedAt ?? null, linkedToOwner: creator.performerId === person.id };
  }));
  const config = legalConfiguration();
  const pending = Object.entries(config).filter(([key, value]) => !['processor', 'billingDescriptor'].includes(key) && value === null).map(([key]) => key);
  return { creatorProfiles, creator, currentUserId: auth.user.id, asOf: new Date().toISOString(), reports, products: await Promise.all(products.map(product => withProductCreator(db, { ...product, workspaceId }))), performers, members, identities, reviews, consents, notes, pending, events: events.filter(e => e.metadata && typeof e.metadata === 'object' && 'workspaceId' in e.metadata && e.metadata.workspaceId === workspaceId).map(({ id, action, entityType, entityId, createdAt, userId, metadata }) => ({ id, action, entityType, entityId, createdAt, userId, metadata })) };
}
export type ComplianceDashboard = Awaited<ReturnType<typeof complianceDashboard>>;
export function complianceFailure(error: unknown) {
  const status = error instanceof ComplianceError ? error.status : error instanceof AuthError ? error.status : error instanceof Error && error.name === 'ZodError' ? 400 : 500;
  return Response.json({ error: error instanceof ComplianceError ? error.message : status === 400 ? 'Check the submitted fields.' : status === 401 ? 'Sign in to continue.' : status === 403 ? 'Compliance access denied.' : 'Unable to complete this request. Please try again.' }, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...(status === 429 ? { 'Retry-After': '600' } : {}) } });
}
