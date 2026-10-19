import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/src/prisma/db';
import { requireAdministrativeAccess } from '@/src/lib/auth/admin-access';
import { AuthError } from '@/src/lib/auth/request';
import { getRequestIp } from '@/src/lib/auth/rate-limit';
import { hashAuthToken } from '@/src/lib/auth/tokens';
import { lockAuthKey, type AuthTransaction } from '@/src/lib/auth/audit';
import { legalConfiguration } from './config';
import { adultOn, businessDeadline, reportInput, adminInput } from './validation';
import type { OwnerPublication } from '@/src/lib/store/product-fields';

export class ComplianceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function requireComplianceAccess() {
  const auth = await requireAdministrativeAccess();
  if (!['OWNER', 'ADMIN'].includes(auth.membership.role)) throw new ComplianceError('Compliance access requires OWNER or ADMIN.', 403);
  return auth;
}
type ContentFields = { mediaAssetId: string; teaserMediaAssetId: string | null; thumbnailMediaAssetId: string | null; title: string; slug: string; description: string; category: string };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const mediaFingerprint = (p: ContentFields) => hash([p.mediaAssetId, p.teaserMediaAssetId, p.thumbnailMediaAssetId]);
export const contentFingerprint = (p: ContentFields) => hash([mediaFingerprint(p), p.title, p.slug, p.description, p.category]);
async function audit(tx: AuthTransaction, workspaceId: string, actorId: string | null, action: string, objectType: string, objectId: string, metadata: Record<string, string | boolean | null> = {}) {
  await tx.orm.public.AuditLog.create({ userId: actorId, action, entityType: objectType, entityId: objectId, metadata: { workspaceId, ...metadata } });
}
async function productIn(tx: AuthTransaction, workspaceId: string, id: string) {
  const product = await tx.orm.public.VideoProduct.where({ id, workspaceId }).first();
  if (!product) throw new ComplianceError('Content not found.', 404);
  return product;
}
async function latestIdentity(tx: AuthTransaction, workspaceId: string, subjectType: string, subjectId: string) {
  return tx.orm.public.ComplianceIdentity.where({ workspaceId, subjectType, subjectId }).orderBy(r => r.createdAt.desc()).first();
}
async function assertIdentity(tx: AuthTransaction, workspaceId: string, subjectType: string, subjectId: string, date: string) {
  const identity = await latestIdentity(tx, workspaceId, subjectType, subjectId);
  if (!identity || identity.status !== 'VERIFIED' || !identity.dateOfBirth || !identity.evidenceRef || !adultOn(identity.dateOfBirth, date) || (identity.expiresAt && new Date(identity.expiresAt).getTime() <= Date.now())) throw new ComplianceError('Publication requires current adult identity verification for the provider and every depicted person.', 409);
}
async function assertReviewEvidence(tx: AuthTransaction, product: Awaited<ReturnType<typeof productIn>>, review: { providerUserId: string | null; recordedOn: string | null; allPersonsConfirmed: boolean; prohibitedChecked: boolean; copyrightConfirmed: boolean }) {
  if (!review.providerUserId || !review.recordedOn || !review.allPersonsConfirmed || !review.prohibitedChecked || !review.copyrightConfirmed) throw new ComplianceError('Complete provider, recording date, all-persons, prohibited-content and copyright checks before approval.', 409);
  const membership = await tx.orm.public.WorkspaceMember.where({ workspaceId: product.workspaceId, userId: review.providerUserId }).first();
  const provider = await tx.orm.public.User.where({ id: review.providerUserId, status: 'ACTIVE' }).first();
  if (!membership || !provider) throw new ComplianceError('The content provider must be an active workspace member.', 409);
  await assertIdentity(tx, product.workspaceId, 'USER', review.providerUserId, new Date().toISOString().slice(0, 10));
  const assets = [product.mediaAssetId, product.teaserMediaAssetId, product.thumbnailMediaAssetId].filter((v): v is string => !!v);
  const links = await tx.orm.public.MediaAssetPerformer.where({ workspaceId: product.workspaceId }).where(r => r.mediaAssetId.in(assets)).all();
  const consents = await tx.orm.public.ContentConsent.where({ workspaceId: product.workspaceId, videoProductId: product.id }).orderBy(r => r.recordedAt.desc()).all();
  const latest = new Map<string, typeof consents[number]>();
  for (const consent of consents) if (!latest.has(consent.performerId)) latest.set(consent.performerId, consent);
  const people = new Set([...links.map(l => l.performerId), ...latest.keys()]);
  if (!people.size) throw new ComplianceError('Identify every depicted person, including the creator, and record consent before approval.', 409);
  for (const personId of people) {
    const performer = await tx.orm.public.Performer.where({ id: personId, workspaceId: product.workspaceId, status: 'ACTIVE' }).first();
    if (!performer) throw new ComplianceError('A depicted person is unavailable.', 409);
    await assertIdentity(tx, product.workspaceId, 'PERFORMER', personId, review.recordedOn);
    const consent = latest.get(personId);
    if (!consent || consent.status !== 'RECORDED' || !consent.depiction || !consent.distribution || !consent.publication || consent.downloads || consent.mediaFingerprint !== mediaFingerprint(product)) throw new ComplianceError('Current, content-specific consent for depiction, distribution and publication is required for every depicted person.', 409);
  }
}

// Called within the existing store transaction and lock. No Purchase/payment changes.
export async function assertCommercialPublication(tx: AuthTransaction, workspaceId: string, input: ContentFields, existing: Awaited<ReturnType<typeof productIn>> | null) {
  if (existing?.status === 'PUBLISHED' && existing.complianceStatus === 'LEGACY_UNREVIEWED' && contentFingerprint(existing) === contentFingerprint(input)) return;
  if (!existing) throw new ComplianceError('Save as draft, then complete Safety & Compliance review before publishing.', 409);
  const review = await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: existing.id, status: 'APPROVED' }).first();
  if (!review || existing.complianceStatus !== 'APPROVED' || review.fingerprint !== contentFingerprint(input)) throw new ComplianceError('This content or its metadata needs an approved Safety & Compliance review before publication.', 409);
  await assertReviewEvidence(tx, { ...existing, ...input }, review);
}

// Invoked only after server-side OWNER authorization, under the store lock.
// Reuses the same evidence checks as a manual review; never verifies identity here.
export async function completeOwnerPublication(tx: AuthTransaction, workspaceId: string, actorId: string, product: Awaited<ReturnType<typeof productIn>>, evidence?: OwnerPublication) {
  const member = await tx.orm.public.WorkspaceMember.where({ workspaceId, userId: actorId, role: 'OWNER' }).first();
  if (!member) throw new ComplianceError('Direct publication requires OWNER.', 403);
  const existing = await tx.orm.public.ContentReview.where({ workspaceId, videoProductId: product.id }).first();
  const blocked = ['REJECTED', 'SUSPENDED', 'REMOVED'];
  if (blocked.includes(product.complianceStatus) || (existing && blocked.includes(existing.status))) throw new ComplianceError('Resolve the existing safety restriction before publishing.', 409);
  if (!evidence && !existing) throw new ComplianceError('Complete the legal checks in Create Product before publishing.', 409);
  const review = evidence ? { ...evidence, providerUserId: actorId } : existing!;
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
export async function complianceAction(value: unknown) {
  const auth = await requireComplianceAccess();
  const input = adminInput.parse(value);
  const workspaceId = auth.workspace.id, actorId = auth.user.id;
  return db.transaction(async tx => {
    await lockAuthKey(tx, 'store-video-products');
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
    db.orm.public.Performer.where({ workspaceId, status: 'ACTIVE' }).select('id', 'displayName').all(),
    db.orm.public.WorkspaceMember.where({ workspaceId }).select('userId', 'role').all(),
    db.orm.public.ComplianceIdentity.where({ workspaceId }).select('id', 'subjectType', 'subjectId', 'status', 'expiresAt', 'verifiedAt', 'createdAt').orderBy(r => r.createdAt.desc()).all(),
    db.orm.public.ContentReview.where({ workspaceId }).all(),
    db.orm.public.ContentConsent.where({ workspaceId }).select('id', 'videoProductId', 'performerId', 'status', 'depiction', 'distribution', 'publication', 'recordedAt').orderBy(r => r.recordedAt.desc()).all(),
    db.orm.public.AuditLog.where(r => r.entityType.in(['COMPLIANCE_REPORT', 'COMPLIANCE_IDENTITY', 'CONTENT_CONSENT', 'VIDEO_PRODUCT'])).orderBy(r => r.createdAt.desc()).limit(1000).all(),
    db.orm.public.ComplianceNote.where({ workspaceId }).orderBy(r => r.createdAt.desc()).limit(200).all(),
  ]);
  const config = legalConfiguration();
  const pending = Object.entries(config).filter(([key, value]) => !['processor', 'billingDescriptor'].includes(key) && value === null).map(([key]) => key);
  return { asOf: new Date().toISOString(), reports, products, performers, members, identities, reviews, consents, notes, pending, events: events.filter(e => e.metadata && typeof e.metadata === 'object' && 'workspaceId' in e.metadata && e.metadata.workspaceId === workspaceId).map(({ id, action, entityType, entityId, createdAt, userId, metadata }) => ({ id, action, entityType, entityId, createdAt, userId, metadata })) };
}
export type ComplianceDashboard = Awaited<ReturnType<typeof complianceDashboard>>;
export function complianceFailure(error: unknown) {
  const status = error instanceof ComplianceError ? error.status : error instanceof AuthError ? error.status : error instanceof Error && error.name === 'ZodError' ? 400 : 500;
  return Response.json({ error: error instanceof ComplianceError ? error.message : status === 400 ? 'Check the submitted fields.' : status === 401 ? 'Sign in to continue.' : status === 403 ? 'Compliance access denied.' : 'Unable to complete this request. Please try again.' }, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...(status === 429 ? { 'Retry-After': '600' } : {}) } });
}
