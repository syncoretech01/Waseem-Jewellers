import 'server-only';

/**
 * Where a consultation request goes — and, today, the fact that it goes nowhere.
 *
 * Waseem has not supplied a destination, and the site has no privacy statement or privacy
 * contact yet. Both are required before a visitor's name and telephone number may travel off
 * their own device, so the shipped sink is `NullSink` and the client does not post at all: the
 * form still hands the visitor their reference and their own WhatsApp message, exactly as it
 * did before this file existed. Today's behaviour is the floor, and this is never a regression.
 *
 * When a destination arrives it is one environment variable. Nothing in the form changes.
 */

export interface Enquiry {
  reference: string;
  name: string;
  phone: string;
  email?: string;
  showroom: string;
  occasion: string;
  date?: string;
  window?: string;
  /** Slugs the visitor was discussing. Validated against the listable set before it gets here. */
  pieceSlugs: string[];
  message?: string;
  /** Written by the concierge, not typed by the visitor. */
  budgetPkr?: number;
  specQuestion?: string;
  /** So a consultant knows to telephone in Urdu. */
  preferredLanguage?: string;
  receivedAt: string;
}

export interface EnquirySink {
  readonly id: 'null' | 'webhook';
  deliver(enquiry: Enquiry): Promise<void>;
}

/**
 * The shipped default: accepts and discards.
 *
 * It exists so the route is real and testable rather than hypothetical, and so that turning
 * delivery on is a configuration change instead of a code change. It deliberately does not log
 * the enquiry — a server log is a destination too, and an unannounced one.
 */
const nullSink: EnquirySink = {
  id: 'null',
  async deliver() {
    /* nowhere, on purpose */
  },
};

/**
 * A webhook — a Sheet, an Airtable, a form relay. Lowest friction for a jeweller with no CRM,
 * and the one destination that needs no credential of ours beyond the URL itself.
 */
function webhookSink(url: string): EnquirySink {
  return {
    id: 'webhook',
    async deliver(enquiry) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(enquiry),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`enquiry sink ${res.status}`);
    },
  };
}

export function enquirySink(): EnquirySink {
  const url = process.env.ENQUIRY_WEBHOOK_URL?.trim();
  return url ? webhookSink(url) : nullSink;
}

/** Whether a visitor's details may leave their device at all. */
export const enquiryIsConfigured = () => Boolean(process.env.ENQUIRY_WEBHOOK_URL?.trim());
