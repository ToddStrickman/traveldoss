import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
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
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus } from "lucide-react";
import type { Block } from "../types";
import type { TripMeta } from "../types";
import type { PartOfDay } from "./itinerary";

/* ------------------------------------------------------------------ */
/* Editing context                                                     */
/* ------------------------------------------------------------------ */

export type EditingCtx = {
  editing: boolean;
  onBlockChange: (index: number, patch: Partial<Block>) => void;
  onBlockRemove: (index: number) => void;
  onBlockAdd: (
    afterIndex: number,
    kind: Block["kind"],
    seed?: Partial<Block>,
  ) => void;
  /** Replace the full blocks array. Used by the blank scaffold to
   *  materialize a real day skeleton from a ghost click. */
  onBlocksReplace?: (next: Block[]) => void;
  onReorder: (from: number, to: number) => void;
  onTripChange: (field: "destination" | "subtitle", value: string) => void;
  /** Update top-level trip dates (free-form strings or ISO). */
  onTripDatesChange?: (start: string, end: string) => void;
  /** Update the dossier-level preferences (travelers/pace/budget/interests). */
  onMetaChange?: (patch: Partial<TripMeta>) => void;
  /** Move an activity to a different day/part-of-day (horizontal kanban DnD). */
  onMoveActivity: (
    srcIndex: number,
    dayIndex: number,
    part: PartOfDay,
    beforeIndex?: number,
  ) => void;
};

const noop = () => {};
const Ctx = createContext<EditingCtx>({
  editing: false,
  onBlockChange: noop,
  onBlockRemove: noop,
  onBlockAdd: noop,
  onReorder: noop,
  onTripChange: noop,
  onMoveActivity: noop,
});

export function EditingProvider({ value, children }: { value: EditingCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEditing() {
  return useContext(Ctx);
}

/* ------------------------------------------------------------------ */
/* EditableText                                                        */
/* ------------------------------------------------------------------ */

type EditableTextProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4";
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
};

/**
 * Renders text in place. When editing is off, it's a plain element.
 * When editing is on, the same element is contentEditable; commit happens
 * on blur and on Enter (single-line) / Cmd-Enter (multiline).
 */
export const EditableText = forwardRef<HTMLElement, EditableTextProps>(function EditableText(
  { value, onChange, placeholder, as = "span", multiline = false, className, style, ariaLabel },
  ref,
) {
  const { editing } = useEditing();
  const localRef = useRef<HTMLElement | null>(null);

  // Keep DOM text in sync with prop changes when not focused.
  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value, editing]);

  const commit = useCallback(() => {
    const el = localRef.current;
    if (!el) return;
    const next = (el.textContent ?? "").replace(/\u00a0/g, " ").trimEnd();
    if (next !== value) onChange(next);
  }, [value, onChange]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tag = as as any;
  const setRef = (n: HTMLElement | null) => {
    localRef.current = n;
    if (typeof ref === "function") ref(n);
    else if (ref) (ref as { current: HTMLElement | null }).current = n;
  };

  if (!editing) {
    return (
      <Tag ref={setRef} className={className} style={style}>
        {value}
      </Tag>
    );
  }

  return (
    <Tag
      ref={setRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel ?? placeholder}
      data-placeholder={placeholder}
      className={`tds-edit${value ? "" : " tds-edit-empty"}${className ? ` ${className}` : ""}`}
      style={style}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter") {
          if (!multiline || e.metaKey || e.ctrlKey) {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          const el = localRef.current;
          if (el) el.textContent = value;
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
    />
  );
});

/* ------------------------------------------------------------------ */
/* Sortable block wrapper                                              */
/* ------------------------------------------------------------------ */

function useStableIds(blocks: Block[]): { id: string; block: Block }[] {
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
        return { id, block: b };
      }),
    [blocks],
  );
}

export function SortableBlocks({
  blocks,
  renderBlock,
}: {
  blocks: Block[];
  renderBlock: (block: Block, index: number, dragHandle: ReactNode | null) => ReactNode;
}) {
  const { editing, onReorder } = useEditing();
  const items = useStableIds(blocks);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (!editing) {
    return <>{blocks.map((b, i) => renderBlock(b, i, null))}</>;
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((it) => it.id === active.id);
    const to = items.findIndex((it) => it.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        {items.map((it, i) => (
          <SortableShell key={it.id} id={it.id} index={i}>
            {(handle) => renderBlock(it.block, i, handle)}
          </SortableShell>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableShell({
  id,
  index,
  children,
}: {
  id: string;
  index: number;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { onBlockRemove, onBlockAdd } = useEditing();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative",
  };
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="tds-block-handle"
      aria-label="Drag to reorder"
    >
      <GripVertical size={14} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} className="tds-block-shell" data-block-shell>
      <div className="tds-block-tools" data-print="hide">
        {handle}
        <button
          type="button"
          onClick={() => onBlockAdd(index, "paragraph")}
          className="tds-block-tool"
          aria-label="Add paragraph below"
          title="Add paragraph below"
        >
          <Plus size={14} />
          <span className="tds-block-tool-label">Add paragraph</span>
        </button>
        <button
          type="button"
          onClick={() => onBlockRemove(index)}
          className="tds-block-tool tds-block-tool-danger"
          aria-label="Delete block"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {children(null)}
    </div>
  );
}

/* Re-export so skins can import everything from one place. */
export { arrayMove };
