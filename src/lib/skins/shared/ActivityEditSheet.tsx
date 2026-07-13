/**
 * ActivityEditSheet + FlightEditSheet — the "nothing locked" editors.
 *
 * Before these, structured fields (time, category, address, phone, website,
 * hours) were settable only at creation or by AI enrichment, horizontal
 * cards couldn't edit notes or delete, grid cells couldn't edit at all,
 * and flights were entirely read-only. One shared sheet per block kind,
 * opened from a pencil in ANY view, edits every field — with Delete
 * included so views without inline delete still offer it.
 *
 * Field writes flow through onBlockChange, which the route coalesces per
 * block+field — a typing session is one undo step.
 */
import * as React from "react";
import { Trash2 } from "lucide-react";
import { TdSheet } from "@/components/mobile/TdSheet";
import { useEditing } from "./Editable";
import type { Block } from "../types";

type ActivityBlock = Extract<Block, { kind: "place" }>;
type FlightBlock = Extract<Block, { kind: "flight" }>;

const CATEGORY_OPTIONS: Array<{ value: NonNullable<ActivityBlock["category"]>; label: string }> = [
  { value: "transit", label: "Transit" },
  { value: "restaurant", label: "Restaurant" },
  { value: "walk", label: "Walk / Hike" },
  { value: "event", label: "Event" },
  { value: "accommodation", label: "Accommodation" },
  { value: "culture", label: "Culture / Museum" },
  { value: "other", label: "Other" },
];

const inputCls =
  "w-full rounded-md border border-white/10 bg-paper/40 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-soft/50 focus:border-seal";
const labelCls = "text-[9px] font-medium uppercase tracking-[0.3em] text-ink-soft";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function SheetFooter({
  onDelete,
  onDone,
  deleteLabel,
}: {
  onDelete: () => void;
  onDone: () => void;
  deleteLabel: string;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex min-h-11 items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] text-red-400/80 transition-colors hover:text-red-400"
      >
        <Trash2 size={13} aria-hidden /> {deleteLabel}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="inline-flex min-h-11 items-center rounded-full bg-seal px-6 text-[10px] font-semibold uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-90"
      >
        Done
      </button>
    </div>
  );
}

export function ActivityEditSheet({
  activity,
  index,
  open,
  onOpenChange,
}: {
  activity: ActivityBlock;
  index: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { onBlockChange, onBlockRemove } = useEditing();
  const set = (patch: Partial<ActivityBlock>) =>
    onBlockChange(index, patch as Partial<Block>);

  const handleDelete = () => {
    const label = activity.name?.trim() || "this activity";
    if (typeof window !== "undefined" && !window.confirm(`Delete "${label}"?`)) return;
    onOpenChange(false);
    onBlockRemove(index);
  };

  return (
    <TdSheet open={open} onOpenChange={onOpenChange} title="Edit place" snapHeight="full">
      <div className="flex flex-col gap-4 overflow-y-auto pb-2">
        <Field label="Name">
          <input
            className={inputCls}
            value={activity.name ?? ""}
            placeholder="Place or activity"
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time">
            <input
              className={inputCls}
              value={activity.time ?? ""}
              placeholder="e.g. 2:30 PM"
              onChange={(e) => set({ time: e.target.value || undefined })}
            />
          </Field>
          <Field label="Category">
            <select
              className={inputCls}
              value={activity.category ?? "other"}
              onChange={(e) => set({ category: e.target.value as ActivityBlock["category"] })}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Address">
          <input
            className={inputCls}
            value={activity.address ?? ""}
            placeholder="Street, city"
            onChange={(e) => set({ address: e.target.value || undefined })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input
              className={inputCls}
              value={activity.phone ?? ""}
              placeholder="+39 …"
              onChange={(e) => set({ phone: e.target.value || undefined })}
            />
          </Field>
          <Field label="Website">
            <input
              className={inputCls}
              value={activity.website ?? ""}
              placeholder="https://…"
              onChange={(e) => set({ website: e.target.value || undefined })}
            />
          </Field>
        </div>
        <Field label="Hours">
          <input
            className={inputCls}
            value={activity.hours ?? ""}
            placeholder="e.g. Tue–Sun 9:00–18:00"
            onChange={(e) => set({ hours: e.target.value || undefined })}
          />
        </Field>
        <Field label="Note">
          <textarea
            className={`${inputCls} min-h-20 resize-y leading-relaxed`}
            value={activity.note ?? ""}
            placeholder="Why this stop earns its slot…"
            onChange={(e) => set({ note: e.target.value || undefined })}
          />
        </Field>
        <SheetFooter onDelete={handleDelete} onDone={() => onOpenChange(false)} deleteLabel="Delete place" />
      </div>
    </TdSheet>
  );
}

export function FlightEditSheet({
  flight,
  index,
  open,
  onOpenChange,
}: {
  flight: FlightBlock;
  index: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { onBlockChange, onBlockRemove } = useEditing();
  const set = (patch: Partial<FlightBlock>) =>
    onBlockChange(index, patch as Partial<Block>);

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm("Delete this flight?")) return;
    onOpenChange(false);
    onBlockRemove(index);
  };

  return (
    <TdSheet open={open} onOpenChange={onOpenChange} title="Edit flight" snapHeight="full">
      <div className="flex flex-col gap-4 overflow-y-auto pb-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Direction">
            <select
              className={inputCls}
              value={flight.direction ?? "outbound"}
              onChange={(e) => set({ direction: e.target.value as FlightBlock["direction"] })}
            >
              <option value="outbound">Outbound</option>
              <option value="inbound">Return</option>
            </select>
          </Field>
          <Field label="Date">
            <input
              className={inputCls}
              value={flight.date ?? ""}
              placeholder="e.g. Nov 20, 2026"
              onChange={(e) => set({ date: e.target.value || undefined })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input
              className={inputCls}
              value={flight.from ?? ""}
              placeholder="JFK"
              onChange={(e) => set({ from: e.target.value || undefined })}
            />
          </Field>
          <Field label="To">
            <input
              className={inputCls}
              value={flight.to ?? ""}
              placeholder="FCO"
              onChange={(e) => set({ to: e.target.value || undefined })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Airline">
            <input
              className={inputCls}
              value={flight.airline ?? ""}
              placeholder="Delta"
              onChange={(e) => set({ airline: e.target.value || undefined })}
            />
          </Field>
          <Field label="Flight no.">
            <input
              className={inputCls}
              value={flight.flightNumber ?? ""}
              placeholder="DL 182"
              onChange={(e) => set({ flightNumber: e.target.value || undefined })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Departs">
            <input
              className={inputCls}
              value={flight.departTime ?? ""}
              placeholder="5:25 PM"
              onChange={(e) => set({ departTime: e.target.value || undefined })}
            />
          </Field>
          <Field label="Arrives">
            <input
              className={inputCls}
              value={flight.arriveTime ?? ""}
              placeholder="7:45 AM"
              onChange={(e) => set({ arriveTime: e.target.value || undefined })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seat">
            <input
              className={inputCls}
              value={flight.seat ?? ""}
              placeholder="14C"
              onChange={(e) => set({ seat: e.target.value || undefined })}
            />
          </Field>
          <Field label="Confirmation">
            <input
              className={inputCls}
              value={flight.confirmation ?? ""}
              placeholder="GH4HDK"
              onChange={(e) => set({ confirmation: e.target.value || undefined })}
            />
          </Field>
        </div>
        <SheetFooter onDelete={handleDelete} onDone={() => onOpenChange(false)} deleteLabel="Delete flight" />
      </div>
    </TdSheet>
  );
}
