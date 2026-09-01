import React from 'react';
import { FeePaySheet } from './FeePaySheet';

/**
 * BOOST SHEET — pay to promote one listing. The entry point a seller sees
 * from their VendorPanel ("Promote" on an active listing).
 *
 * Concierge-phase truth: a confirmed operator applies the boost by hand in
 * the discovery/admin tooling. The sheet promises exactly that and nothing
 * more — there is no pretend automation, and no price is ever named by the
 * client.
 */
export interface BoostSheetProps {
  listingId: string;
  listingTitle: string;
  onClose: () => void;
  onPaid?: () => void;
}

export function BoostSheet({ listingId, listingTitle, onClose, onPaid }: BoostSheetProps) {
  return (
    <FeePaySheet
      title="Promote this listing"
      intro={`“${listingTitle}” will be shown ahead of ordinary listings once a confirmed operator applies the boost. Pick how long for, pay by M-PESA, and paste the confirmation code.`}
      serviceKeys={['promotion_daily', 'promotion_weekly']}
      target={{ kind: 'listing', id: listingId, title: listingTitle }}
      afterSubmit="The operator confirms the code and applies the boost — you get a notification when it is live."
      onClose={onClose}
      onPaid={onPaid}
    />
  );
}
