import { useMemo, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import type { Block } from "../../types";
import { buildItinerary, type PartOfDay } from "../itinerary";
import { useEditing } from "../Editable";
import { partOrder } from "./parts";

/** Stable DnD ids for activities and day/part-of-day buckets. */
export const cardId = (i: number) => `act:${i}`;
export const bucketId = (dayIndex: number, part: PartOfDay) => `bkt:${dayIndex}:${part}`;

export function parseCardId(id: string): number | null {
  const m = /^act:(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}
export function parseBucketId(id: string): { dayIndex: number; part: PartOfDay } | null {
  const m = /^bkt:(\d+):(morning|afternoon|evening)$/.exec(id);
  return m ? { dayIndex: Number(m[1]), part: m[2] as PartOfDay } : null;
}

/** Shared DnD shell. Wraps children in a DndContext that routes drops to
 *  `onMoveActivity` from the editing context. Used by every view so that
 *  activity cards can be reordered/moved across day & part-of-day buckets
 *  regardless of which layout the user is currently looking at. */
export function ActivityDndContext({
  blocks,
  children,
}: {
  blocks: Block[];
  children: ReactNode;
}) {
  const { editing, onMoveActivity } = useEditing();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const cardLocation = useMemo(() => {
    const it = buildItinerary(blocks);
    const m = new Map<number, { dayIndex: number; part: PartOfDay }>();
    for (const d of it.days) {
      for (const part of partOrder) {
        for (const { index } of d[part]) m.set(index, { dayIndex: d.dayIndex, part });
      }
    }
    return m;
  }, [blocks]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const srcIndex = parseCardId(String(active.id));
    if (srcIndex == null) return;
    const overStr = String(over.id);
    const overBucket = parseBucketId(overStr);
    const overCard = parseCardId(overStr);
    if (overBucket) {
      onMoveActivity(srcIndex, overBucket.dayIndex, overBucket.part);
      return;
    }
    if (overCard != null && overCard !== srcIndex) {
      const loc = cardLocation.get(overCard);
      if (loc) onMoveActivity(srcIndex, loc.dayIndex, loc.part, overCard);
    }
  }

  if (!editing) return <>{children}</>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}

/** Wraps an activity in draggable+droppable handlers (drop = insert-before). */
export function DraggableActivity({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const { editing } = useEditing();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: cardId(index),
    disabled: !editing,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: cardId(index),
    disabled: !editing,
  });
  const ref = (n: HTMLDivElement | null) => {
    setNodeRef(n);
    setDropRef(n);
  };
  const style = {
    transform: transform ? DndCSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
    outline: isOver ? "1px solid var(--tds-accent)" : undefined,
    touchAction: editing ? ("none" as const) : undefined,
  };
  return (
    <div
      ref={ref}
      className={className}
      style={style}
      {...(editing ? listeners : {})}
      {...(editing ? attributes : {})}
    >
      {children}
    </div>
  );
}

/** Wraps a container as a drop target for a (dayIndex, part) bucket. */
export function DroppableBucket({
  dayIndex,
  part,
  className,
  as = "div",
  children,
}: {
  dayIndex: number;
  part: PartOfDay;
  className?: string;
  as?: "div" | "td";
  children: ReactNode;
}) {
  const { editing } = useEditing();
  const { setNodeRef, isOver } = useDroppable({
    id: bucketId(dayIndex, part),
    disabled: !editing,
  });
  const dataProps = {
    "data-part": part,
    "data-drop-over": isOver ? "true" : undefined,
  } as const;
  if (as === "td") {
    return (
      <td ref={setNodeRef} className={className} {...dataProps}>
        {children}
      </td>
    );
  }
  return (
    <div ref={setNodeRef} className={className} {...dataProps}>
      {children}
    </div>
  );
}