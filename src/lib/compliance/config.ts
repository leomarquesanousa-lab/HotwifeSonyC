import 'server-only';

// Public legal data only. Never expose process.env or authentication/storage configuration.
const setting = (name: string) => process.env[name]?.trim() || null;
const email = (name: string) => {
  const value = setting(name);
  return value && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) ? value : null;
};
export function legalConfiguration() {
  return {
    brand: 'HotwifeSonyC',
    origin: 'https://hotwifesonyc.com',
    updated: 'October 11, 2026',
    entity: setting('LEGAL_ENTITY_NAME'),
    address: setting('LEGAL_BUSINESS_ADDRESS'),
    governingLaw: setting('LEGAL_GOVERNING_LAW'),
    jurisdiction: setting('LEGAL_JURISDICTION'),
    supportEmail: email('LEGAL_SUPPORT_EMAIL'),
    billingEmail: email('LEGAL_BILLING_EMAIL'),
    safetyEmail: email('LEGAL_SAFETY_EMAIL'),
    abuseEmail: email('LEGAL_ABUSE_EMAIL'),
    dmcaAgent: setting('LEGAL_DMCA_AGENT_NAME'),
    dmcaAddress: setting('LEGAL_DMCA_AGENT_ADDRESS'),
    dmcaEmail: email('LEGAL_DMCA_AGENT_EMAIL'),
    custodian: setting('LEGAL_2257_CUSTODIAN'),
    recordsAddress: setting('LEGAL_2257_ADDRESS'),
    producerStatus: setting('LEGAL_2257_PRODUCER_STATUS'),
    recordsLocation: setting('LEGAL_2257_RECORD_LOCATION'),
    processor: setting('LEGAL_PAYMENT_PROCESSOR'),
    billingDescriptor: setting('LEGAL_BILLING_DESCRIPTOR'),
  };
}
