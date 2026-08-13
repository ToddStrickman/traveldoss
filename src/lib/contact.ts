/**
 * Contact form categories. Shared by the /contact route and the server
 * function's zod validator so the two can never drift.
 */
export const CONTACT_CATEGORIES = [
  { id: "general", label: "General" },
  { id: "support", label: "Support" },
  { id: "legal_notice", label: "Legal notice" },
  { id: "arbitration_opt_out", label: "Arbitration opt-out" },
] as const;

export type ContactCategoryId = (typeof CONTACT_CATEGORIES)[number]["id"];

export const CONTACT_CATEGORY_IDS = CONTACT_CATEGORIES.map((c) => c.id) as [
  ContactCategoryId,
  ...ContactCategoryId[],
];

export const CONTACT_MESSAGE_MAX = 5000;
