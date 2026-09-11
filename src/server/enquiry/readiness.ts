/**
 * Whether a visitor's details may leave their device — decided once, and only when everything
 * that has to be true is true.
 *
 * A destination alone is not enough. This site transmits nothing personal today, and the rule
 * for changing that was stated up front: a delivery destination **and** a privacy disclosure
 * **and** a privacy contact, plus a canonical origin so the route can refuse requests from
 * anywhere else. `enquiryIsConfigured` used to return true on the webhook alone, which meant one
 * environment variable set in a hurry would have started sending names and telephone numbers
 * with no privacy statement anywhere for the visitor to read.
 *
 * Pure, and deliberately so: it takes the environment as an argument rather than reading
 * `process.env`, which is what lets `scripts/dev/enquiry-check.mjs` prove — as part of
 * `npm run check` — that the webhook by itself still leaves the form on the device.
 * `sink.ts` is the only caller that hands it the real environment, and both the capabilities
 * endpoint and `/api/enquiry` go through that one function, so the two cannot disagree.
 */

export const ENQUIRY_ENV = {
  /** Where an enquiry is delivered. A Sheet, an Airtable, a relay — the one credential-free sink. */
  destination: 'ENQUIRY_WEBHOOK_URL',
  /** The only origin the route accepts a submission from. Also the site's own canonical URL. */
  origin: 'NEXT_PUBLIC_SITE_URL',
  /** Where the privacy statement lives. Shown to the visitor beside the button that sends. */
  privacyUrl: 'ENQUIRY_PRIVACY_URL',
  /** Who to write to about their data. An address, shown with the statement. */
  privacyContact: 'ENQUIRY_PRIVACY_CONTACT',
} as const;

export type EnquiryRequirement = keyof typeof ENQUIRY_ENV;

export interface EnquiryConfig {
  destination: string;
  origin: string;
  privacyUrl: string;
  privacyContact: string;
}

/** A discriminated union, so `ready` narrows `config` and a caller cannot read one without checking. */
export type EnquiryReadiness =
  | { ready: true; missing: []; config: EnquiryConfig }
  | { ready: false; /** Every requirement absent or malformed. */ missing: EnquiryRequirement[]; config: null };

type Env = Record<string, string | undefined>;

const trimmed = (env: Env, key: string): string => env[key]?.trim() ?? '';

/** An absolute URL. `https` anywhere; `http` only on a loopback host, for a local run. */
function absoluteUrl(value: string, opts: { allowHttpLocalhost: boolean }): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol === 'https:') return url.href;
  if (url.protocol === 'http:' && opts.allowHttpLocalhost && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return url.href;
  return null;
}

/** An email address, or a telephone number with at least seven digits in it. */
function contact(value: string): string | null {
  if (!value) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value;
  if ((value.match(/\d/g) ?? []).length >= 7 && /^[+\d\s()-]+$/.test(value)) return value;
  return null;
}

export function assessEnquiryReadiness(env: Env): EnquiryReadiness {
  const destination = absoluteUrl(trimmed(env, ENQUIRY_ENV.destination), { allowHttpLocalhost: true });
  const origin = absoluteUrl(trimmed(env, ENQUIRY_ENV.origin), { allowHttpLocalhost: true });
  const privacyUrl = absoluteUrl(trimmed(env, ENQUIRY_ENV.privacyUrl), { allowHttpLocalhost: true });
  const privacyContact = contact(trimmed(env, ENQUIRY_ENV.privacyContact));

  const missing: EnquiryRequirement[] = [];
  if (!destination) missing.push('destination');
  if (!origin) missing.push('origin');
  if (!privacyUrl) missing.push('privacyUrl');
  if (!privacyContact) missing.push('privacyContact');

  if (missing.length) return { ready: false, missing, config: null };
  return {
    ready: true,
    missing: [],
    config: { destination: destination!, origin: new URL(origin!).origin, privacyUrl: privacyUrl!, privacyContact: privacyContact! },
  };
}
