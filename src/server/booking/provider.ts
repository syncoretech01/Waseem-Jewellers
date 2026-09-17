import 'server-only';

/**
 * Where a booking system would plug in, if Waseem had one.
 *
 * Today there is none, and the concierge is built to say so. An appointment request is a
 * request: it is kept on the visitor's device with a reference, or delivered to the enquiry
 * sink when that is configured, and a person confirms the time. Nothing in the site books a
 * slot, and no reply may say "booked" or "confirmed" unless a provider here has returned
 * `booked: true` — which the only provider that exists never does.
 *
 * The seam is deliberately small. A real provider would:
 *
 *   calendly   read `BOOKING_PROVIDER=calendly` and a `CALENDLY_TOKEN`, map each showroom id
 *              to an event type, answer `availability` from the event type's available
 *              times for the date, and `book` by creating a scheduling link or an invitee
 *              — returning the invitee's URI as the reference.
 *   webhook    read `BOOKING_PROVIDER=webhook` and a `BOOKING_WEBHOOK_URL`, post the input
 *              and take `{ booked, reference }` from the reply; availability stays null
 *              unless the endpoint publishes it.
 *
 * Either would be selected in `bookingProvider()` below by the same environment variable,
 * read here and nowhere in the browser. The capabilities route exposes only `kind`, so the
 * client knows whether times can be checked without learning how.
 */

export interface BookingInput {
  /** A showroom id from `SITE.showrooms`. */
  showroom: string;
  /** YYYY-MM-DD. */
  date: string;
  /** afternoon or evening — the form's two windows. */
  window?: string;
  name: string;
  phone: string;
  email?: string;
  occasion: string;
  /** Our own reference, issued before the provider is asked, so the two can be reconciled. */
  reference: string;
}

export interface BookingProvider {
  readonly kind: string;
  /** Free times for a showroom on a date, or null when the provider publishes none. */
  availability(input: { showroom: string; date: string }): Promise<{ slots: { start: string; end: string }[] } | null>;
  book(input: BookingInput): Promise<{ booked: true; reference: string; provider: string } | { booked: false; reason: string }>;
}

/** No provider: no times are published, and nothing is ever booked. */
export class NullProvider implements BookingProvider {
  readonly kind = 'none';
  availability(): Promise<null> {
    return Promise.resolve(null);
  }
  book(): Promise<{ booked: false; reason: string }> {
    return Promise.resolve({ booked: false, reason: 'no booking provider configured' });
  }
}

const none = new NullProvider();

/**
 * The provider this deployment has, by `BOOKING_PROVIDER`. Only `none` exists; any other
 * value is treated as none rather than as a promise the code cannot keep, and is noted in
 * the server log so a misspelt variable is not mistaken for a working integration.
 */
export function bookingProvider(): BookingProvider {
  const wanted = process.env.BOOKING_PROVIDER?.trim().toLowerCase() || 'none';
  if (wanted !== 'none') console.warn(`[booking] BOOKING_PROVIDER=${wanted} is not implemented; no provider is active`);
  return none;
}
