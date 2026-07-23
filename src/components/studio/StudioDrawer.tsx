import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, ChevronRight } from "lucide-react";
import { SKINS } from "@/lib/skins/registry";
import type { Block } from "@/lib/skins/types";

type BlockId = string;
type IndexedBlock = Block & { __id: BlockId };

/** Mint a stable per-instance id for each Block object. Re-used across renders
 *  so dnd-kit + editor rows don't remount on reorder/edit. */
function useBlockIds(blocks: Block[]): IndexedBlock[] {
  const map = useRef<WeakMap<Block, string>>(new WeakMap());
  const counter = useRef(0);
  return useMemo(
    () =>
      blocks.map((b) => {
        let id = map.current.get(b);
        if (!id) {
          id = `blk-${++counter.current}`;
          map.current.set(b, id);
        }
        return Object.assign({ __id: id }, b as object) as IndexedBlock;
      }),
    [blocks],
  );
}

export function StudioDrawer({
  blocks,
  templateId,
  savedAt,
  saving,
  onBlocksChange,
  onTemplateChange,
  onClose,
}: {
  blocks: Block[];
  templateId: string;
  savedAt: string | null;
  saving: boolean;
  onBlocksChange: (next: Block[]) => void;
  onTemplateChange: (id: string) => void;
  onClose: () => void;
}) {
  const tagged = useBlockIds(blocks);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = tagged.findIndex((b) => b.__id === active.id);
    const to = tagged.findIndex((b) => b.__id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(blocks, from, to);
    onBlocksChange(next);
  }

  function updateBlock(i: number, patch: Partial<Block>) {
    const next = blocks.slice();
    next[i] = { ...(next[i] as object), ...(patch as object) } as Block;
    onBlocksChange(next);
  }
  function removeBlock(i: number) {
    onBlocksChange(blocks.filter((_, j) => j !== i));
  }
  function addBlock(kind: Block["kind"]) {
    const fresh: Block =
      kind === "day"
        ? { kind: "day", n: blocks.filter((b) => b.kind === "day").length + 1, label: "New day" }
        : kind === "place"
        ? { kind: "place", name: "New place", category: "other" }
        : kind === "section"
        ? { kind: "section", title: "New section" }
        : kind === "note"
        ? { kind: "note", text: "" }
        : { kind: "paragraph", text: "" };
    onBlocksChange([...blocks, fresh]);
  }

  return (
    <aside data-print="hide" className="fixed left-0 top-0 z-40 flex h-dvh w-[380px] flex-col border-r border-white/10 bg-paper/95 text-ink backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.4em] text-ink/45">Live Studio</p>
          <h2 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
            Edit dossier
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] uppercase tracking-[0.3em] text-ink/50 hover:text-seal"
          aria-label="Close studio"
        >
          Close
        </button>
      </header>

      <div className="border-b border-white/10 px-5 py-3 text-[11px] text-ink-soft">
        <label className="mb-1 block text-[9px] uppercase tracking-[0.35em] text-ink/40">
          Dossier Template
        </label>
        <select
          value={templateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="w-full rounded-md border border-white/10 bg-paper/40 px-3 py-2 text-ink outline-none focus:border-seal"
        >
          {SKINS.map((s) => (
            <option key={s.meta.id} value={s.meta.id}>
              {s.meta.codename}
            </option>
          ))}
        </select>
        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-ink/40">
          <span>{saving ? "Saving…" : savedAt ? `Saved · ${new Date(savedAt).toLocaleTimeString()}` : "Not saved yet"}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-seal" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <DndContext id="tds-studio-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tagged.map((b) => b.__id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {tagged.map((b, i) => (
                <SortableRow
                  key={b.__id}
                  id={b.__id}
                  block={b}
                  onChange={(patch) => updateBlock(i, patch)}
                  onRemove={() => removeBlock(i)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <footer className="border-t border-white/10 px-3 py-3">
        <p className="px-2 pb-2 text-[9px] uppercase tracking-[0.35em] text-ink/40">Add block</p>
        <div className="flex flex-wrap gap-1">
          {(["paragraph", "day", "place", "section", "note"] as const).map((k) => (
            <button
              key={k}
              onClick={() => addBlock(k)}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-paper/40 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-ink-soft transition-elegant hover:border-seal hover:text-seal"
            >
              <Plus className="h-3 w-3" /> {k}
            </button>
          ))}
        </div>
      </footer>
    </aside>
  );
}

function SortableRow({
  id,
  block,
  onChange,
  onRemove,
}: {
  id: string;
  block: IndexedBlock;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (isDragging) setOpen(false); }, [isDragging]);

  return (
    <li
      ref={(n) => {
        setNodeRef(n);
        ref.current = n;
      }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="surface-card rounded-md px-2 py-2 text-[12px]"
    >
      <div className="flex items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 text-ink/35 hover:text-seal"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="text-[9px] uppercase tracking-[0.35em] text-seal/80">{block.kind}</span>
          <span className="truncate text-ink">{summary(block)}</span>
          <ChevronRight className={`h-3 w-3 text-ink/40 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        <button onClick={onRemove} className="p-1 text-ink/35 hover:text-red-400" aria-label="Delete block">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && <Editor block={block} onChange={onChange} />}
    </li>
  );
}

function summary(b: Block): string {
  switch (b.kind) {
    case "hero": return b.title;
    case "section": return b.title;
    case "paragraph": return b.text.slice(0, 60);
    case "day": return `Day ${b.n} — ${b.label}`;
    case "place": return b.name;
    case "flight": return `${b.from ?? "?"} → ${b.to ?? "?"}`;
    case "quote": return `"${b.text.slice(0, 50)}"`;
    case "note": return b.text.slice(0, 60);
  }
  return "";
}

const inputCls =
  "w-full rounded border border-white/10 bg-paper/40 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-seal";

function Editor({ block, onChange }: { block: Block; onChange: (patch: Partial<Block>) => void }) {
  return (
    <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
      {block.kind === "paragraph" && (
        <textarea className={inputCls} rows={3} value={block.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)} />
      )}
      {block.kind === "section" && (
        <input className={inputCls} value={block.title} onChange={(e) => onChange({ title: e.target.value } as Partial<Block>)} />
      )}
      {block.kind === "note" && (
        <textarea className={inputCls} rows={2} value={block.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)} />
      )}
      {block.kind === "hero" && (
        <>
          <input className={inputCls} value={block.title} placeholder="Title" onChange={(e) => onChange({ title: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.subtitle ?? ""} placeholder="Subtitle" onChange={(e) => onChange({ subtitle: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.eyebrow ?? ""} placeholder="Eyebrow" onChange={(e) => onChange({ eyebrow: e.target.value } as Partial<Block>)} />
        </>
      )}
      {block.kind === "day" && (
        <>
          <div className="flex gap-1.5">
            <input className={`${inputCls} w-16`} type="number" value={block.n} onChange={(e) => onChange({ n: Number(e.target.value) } as Partial<Block>)} />
            <input className={inputCls} value={block.label} onChange={(e) => onChange({ label: e.target.value } as Partial<Block>)} />
          </div>
          <textarea className={inputCls} rows={2} placeholder="Notes" value={block.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value } as Partial<Block>)} />
        </>
      )}
      {block.kind === "place" && (
        <>
          <input className={inputCls} value={block.name} placeholder="Name" onChange={(e) => onChange({ name: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.address ?? ""} placeholder="Address" onChange={(e) => onChange({ address: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.note ?? ""} placeholder="Note" onChange={(e) => onChange({ note: e.target.value } as Partial<Block>)} />
        </>
      )}
      {block.kind === "quote" && (
        <>
          <textarea className={inputCls} rows={2} value={block.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.attribution ?? ""} placeholder="— attribution" onChange={(e) => onChange({ attribution: e.target.value } as Partial<Block>)} />
        </>
      )}
      {block.kind === "flight" && (
        <div className="grid grid-cols-2 gap-1.5">
          <input className={inputCls} value={block.airline ?? ""} placeholder="Airline" onChange={(e) => onChange({ airline: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.flightNumber ?? ""} placeholder="Flight #" onChange={(e) => onChange({ flightNumber: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.from ?? ""} placeholder="From (IATA)" onChange={(e) => onChange({ from: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.to ?? ""} placeholder="To (IATA)" onChange={(e) => onChange({ to: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.date ?? ""} placeholder="Date" onChange={(e) => onChange({ date: e.target.value } as Partial<Block>)} />
          <input className={inputCls} value={block.confirmation ?? ""} placeholder="Conf #" onChange={(e) => onChange({ confirmation: e.target.value } as Partial<Block>)} />
        </div>
      )}
    </div>
  );
}