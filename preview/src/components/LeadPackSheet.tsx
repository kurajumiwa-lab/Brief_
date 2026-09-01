import React from 'react';
import { FeePaySheet } from './FeePaySheet';

/**
 * LEAD INTRO SHEET — pay for a priority, operator-made introduction to the
 * person behind one Mshikano post.
 *
 * Trust invariants that must not drift:
 * - The sheet NEVER shows the other person's contact details. Contact is
 *   exchanged only when both sides agree to cooperate (the coop model's
 *   both-confirm rule). What the fee buys is a human arranging the intro,
 *   not a way to peek around consent.
 * - The fee is pending until an operator confirms the M-Pesa code; the intro
 *   is then made personally (concierge phase). Refund/refusal paths are the
 *   existing service-fee ones.
 */
export interface LeadPackSheetProps {
  postId: string;
  postTitle: string;
  onClose: () => void;
  onPaid?: () => void;
}

export function LeadPackSheet({ postId, postTitle, onClose, onPaid }: LeadPackSheetProps) {
  return (
    <FeePaySheet
      title="Get introduced"
      intro={`A Brief operator will introduce you to the person behind “${postTitle}” — personally, once payment is confirmed. Their contact details stay private until you both agree to work together; what you are buying is the warm introduction, not a number.`}
      serviceKeys={['lead_intro']}
      target={{ kind: 'coop_post', id: postId, title: postTitle }}
      afterSubmit="The operator confirms the code, then makes the introduction — watch your notifications."
      onClose={onClose}
      onPaid={onPaid}
    />
  );
}
