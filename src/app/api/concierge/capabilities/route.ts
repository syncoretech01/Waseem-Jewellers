import { modelIsConfigured } from '@/server/env';
import { realtimeIsConfigured } from '@/server/env';
import { enquiryReadiness } from '@/server/enquiry/sink';
import { bookingProvider } from '@/server/booking/provider';

/**
 * What the concierge is allowed to be, today, on this deployment.
 *
 * The client cannot answer this for itself. A `NEXT_PUBLIC_` flag is inlined into the bundle
 * at build time, so switching the model on would mean rebuilding — and the requirement is
 * that adding one server variable and redeploying the *same build* activates it. So the
 * server decides and the client asks, once, when the panel first opens.
 *
 * The bundle is byte-identical whether the key is present or not. That is what makes shipping
 * the model dark meaningful rather than notional.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const enquiry = enquiryReadiness();
  return Response.json(
    {
      intelligence: modelIsConfigured() ? 'model' : 'keyless',
      /** The languages the keyless engine owns outright; the model widens the phrasing, not the list. */
      languages: ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru'],
      /**
       * 'native' — the Live voice session, offered when the credential is set and
       * `CONCIERGE_LIVE` is not off. 'none' is the shipped state: no voice, no stage, the
       * composer is the door. There is no tier beneath the session.
       */
      voice: realtimeIsConfigured() ? 'native' : 'none',
      /**
       * 'local' means a consultation request never leaves the visitor's device: the form
       * hands them a reference and their own WhatsApp message, which is all it has ever
       * done. It becomes 'server' when Waseem supplies a destination — and that must not
       * happen before there is a privacy statement and a privacy contact to point at.
       */
      enquiry: enquiry.ready ? 'server' : 'local',
      /**
       * The disclosure travels with the permission. When the form may post, it must show the
       * visitor where the privacy statement is and whom to write to — and it must not be able
       * to post without them, which is why they are part of the same readiness decision.
       */
      privacy: enquiry.ready ? { url: enquiry.config.privacyUrl, contact: enquiry.config.privacyContact } : null,
      /**
       * 'none' — no booking system: an appointment request is prepared or delivered, and a
       * person confirms the time. Only a provider that books (`src/server/booking`) may
       * ever let the concierge say "booked", and none exists today.
       */
      booking: bookingProvider().kind,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
