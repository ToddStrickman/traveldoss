/**
 * Clickwrap gate shown at mint time. Before a dossier is actually created,
 * the signed-in user must have accepted the current Terms of Service and
 * Privacy Policy. If the ledger already has an acceptance for the current
 * Terms version we skip the modal; otherwise we present an interstitial
 * with links to both documents and a required checkbox, and record the
 * acceptance server-side before allowing the mint to proceed.
 */
import {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getTermsStatus,
  recordTermsAcceptance,
} from "@/lib/legal/acceptance.functions";

export interface MintTermsGateHandle {
  /**
   * Returns true if the caller may proceed with the mint (already accepted,
   * or accepted in the modal), false if the user cancelled.
   */
  ensureAccepted: () => Promise<boolean>;
}

export const MintTermsGate = forwardRef<MintTermsGateHandle>(function MintTermsGate(_, ref) {
  const statusFn = useServerFn(getTermsStatus);
  const recordFn = useServerFn(recordTermsAcceptance);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const checkboxId = useId();
  const descId = useId();
  const checkboxRef = useRef<HTMLButtonElement>(null);

  const resolve = (ok: boolean) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    setChecked(false);
    setBusy(false);
    if (r) r(ok);
  };

  useImperativeHandle(ref, () => ({
    ensureAccepted: async () => {
      try {
        const status = await statusFn();
        if (status.accepted) return true;
      } catch (err) {
        // Status check failed (network/cold fn). Rather than block the
        // user's mint, surface the modal so they can affirm and continue.
        console.error("[mint-terms] status check failed", err);
      }
      return await new Promise<boolean>((res) => {
        resolverRef.current = res;
        setChecked(false);
        setOpen(true);
      });
    },
  }));

  const onAgree = async () => {
    if (!checked || busy) return;
    setBusy(true);
    try {
      await recordFn({
        data: {
          method: "onboarding_clickwrap",
          acceptedAt: new Date().toISOString(),
          locale: typeof navigator !== "undefined" ? navigator.language : undefined,
        },
      });
      resolve(true);
    } catch (err) {
      console.error("[mint-terms] failed to record acceptance", err);
      toast.error("Couldn't record your agreement", {
        description: err instanceof Error ? err.message : String(err),
      });
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) resolve(false);
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          // Focus the checkbox first so keyboard users land on the required control
          // instead of the close button.
          e.preventDefault();
          checkboxRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Before we mint your dossier</DialogTitle>
          <DialogDescription>
            Minting creates a live URL for your trip. Please confirm you agree
            to how TravelDoss handles your dossier and personal data.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-start gap-3 text-sm text-ink">
          <Checkbox
            ref={checkboxRef}
            id={checkboxId}
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            aria-describedby={descId}
            className="mt-0.5"
          />
          {/* htmlFor keeps clicking the label text toggling the box, while the
              anchor tags below sit outside the <label> so opening a link never
              accidentally toggles the checkbox. */}
          <div id={descId}>
            <label htmlFor={checkboxId} className="cursor-pointer select-none">
              I agree to the Terms of Service and Privacy Policy.
            </label>
            <div className="mt-1 text-xs text-ink/70">
              Read:{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted underline-offset-4 hover:text-seal focus-visible:outline-2 focus-visible:outline-seal"
              >
                Terms of Service
                <span className="sr-only"> (opens in a new tab)</span>
                <span aria-hidden="true"> ↗</span>
              </a>
              {" · "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted underline-offset-4 hover:text-seal focus-visible:outline-2 focus-visible:outline-seal"
              >
                Privacy Policy
                <span className="sr-only"> (opens in a new tab)</span>
                <span aria-hidden="true"> ↗</span>
              </a>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => !busy && resolve(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onAgree}
            disabled={!checked || busy}
          >
            {busy ? "Recording…" : "Agree & mint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});