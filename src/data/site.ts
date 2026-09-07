import type { SiteInfo } from './types';

/** Facts as published on waseemjewellers.com. Nothing here is inferred. */
export const SITE: SiteInfo = {
  name: 'Waseem Jewellers',
  since: 1952,
  founder: 'Chaudhry Muhammad Afzal',
  successor: 'Chaudhry Waseem Afzal',
  showrooms: [
    {
      id: 'mm-alam',
      name: 'MM Alam Road',
      address: 'MM Alam Road, Lahore',
      mapsUrl: 'https://maps.app.goo.gl/A4U9i5JLjdFYJtLd7',
    },
    {
      id: 'liberty',
      name: 'Liberty Market',
      address: '22 Commercial Zone, Liberty Market, Gulberg 3, Lahore',
      mapsUrl: 'https://maps.app.goo.gl/A4U9i5JLjdFYJtLd7',
    },
    {
      id: 'dha',
      name: 'DHA',
      address: 'Block Z-1, DHA, Lahore',
      mapsUrl: 'https://maps.app.goo.gl/A4U9i5JLjdFYJtLd7',
    },
  ],
  hours: '12:00 – 21:30',
  phone: '042 111 13 14 15',
  whatsapp: '+92 300 7122859',
  whatsappHref: 'https://api.whatsapp.com/send?phone=923007122859',
  email: 'Info@waseemjewellers.com',
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/waseem_jewelers/' },
    { label: 'Facebook', href: 'https://www.facebook.com/waseemjewellerspk/' },
    { label: 'YouTube', href: 'https://www.youtube.com/channel/UCAtqec2lPaUY97InHARpkAQ' },
    { label: 'Snapchat', href: 'https://t.snapchat.com/y7X5huE1' },
  ],
};

export function whatsappHref(text: string) {
  return `${SITE.whatsappHref}&text=${encodeURIComponent(text)}`;
}
