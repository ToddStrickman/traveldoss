import { createContext, useContext } from "react";

/**
 * True only for the trip owner's own authenticated view.
 *
 * Booking references are private by default: a shared/public dossier link is
 * readable by anyone who has the URL, so confirmation numbers must never
 * render there. The dossier route provides `isOwner`; every other surface
 * (landing rails, gallery thumbnails, export/print of a shared link) keeps
 * the default `false`.
 */
export const TrustedViewerContext = createContext(false);

export const TrustedViewerProvider = TrustedViewerContext.Provider;

export function useTrustedViewer(): boolean {
  return useContext(TrustedViewerContext);
}
