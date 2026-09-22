import { z } from "zod";
import type { Block } from "@/lib/skins/types";

export const ItemType = z.enum([
  "flight",
  "lodging",
  "dining",
  "rail",
  "bus",
  "ferry",
  "car",
  "transfer",
  "parking",
  "activity",
  "event",
  "lounge",
  "insurance",
  "visa",
  "document",
  "other",
]);
export type ItemType = z.infer<typeof ItemType>;
export const Category = z.enum([
  "flights",
  "weather",
  "transit",
  "reservations",
  "preparation",
  "local",
]);
export type Category = z.infer<typeof Category>;
export const Tier = z.enum(["critical", "important", "helpful"]);
export type Tier = z.infer<typeof Tier>;
export const ScanScope = z.enum(["30", "90", "all", "new"]);
export type ScanScope = z.infer<typeof ScanScope>;
export type EmailProvider = "gmail" | "outlook" | "imap";
export type Phase = "planning" | "live" | "paused" | "ended";
export type TripPulseStatus =
  | "All clear"
  | "Updated"
  | "Attention needed"
  | "Disrupted"
  | "Needs review";
export type LocationPermissionState = "unknown" | "granted" | "denied" | "disabled";

export const ZonedTime = z.string().datetime({ offset: true });
export const ReservationSchema = z
  .object({
    type: ItemType,
    title: z.string().min(1).max(240),
    provider: z.string().min(1).max(160),
    confirmation: z.string().max(120).optional(),
    traveler: z.string().max(160).optional(),
    startAt: ZonedTime.optional(),
    endAt: ZonedTime.optional(),
    timezone: z
      .string()
      .max(80)
      .refine((s) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: s });
          return true;
        } catch {
          return false;
        }
      }, "Use an IANA timezone"),
    origin: z.string().max(180).optional(),
    destination: z.string().max(180).optional(),
    location: z.string().max(240).optional(),
    address: z.string().max(400).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    outdoor: z.boolean().optional(),
    status: z.enum(["confirmed", "cancelled"]),
    details: z.record(z.string().max(80), z.string().max(1200)).default({}),
  })
  .refine(
    (r) => !r.endAt || !r.startAt || Date.parse(r.endAt) >= Date.parse(r.startAt),
    "End must follow start",
  );
export type Reservation = z.infer<typeof ReservationSchema>;
export type ExtractedTravelEntity = {
  key: string;
  reservation: Partial<Reservation> &
    Pick<Reservation, "type" | "title" | "provider" | "status" | "details">;
  confidence: number;
  rationale: string;
  replacesConfirmation?: string;
};
export type ImportedEmailMessage = {
  id: string;
  accountId: string;
  provider: EmailProvider;
  receivedAt: string;
  subject: string;
  sender: string;
  text: string;
  html?: string;
  authenticatedSender: boolean;
  attachments?: { name: string; mimeType: string; text?: string }[];
};
export type ItineraryItemEmailSource = {
  id: string;
  messageId: string;
  accountId: string;
  provider: EmailProvider;
  receivedAt: string;
  subject: string;
  sender: string;
  excerpt: string;
  confidence: number;
  rationale: string;
};
export type ItineraryItemVersion = {
  id: string;
  itemId: string;
  at: string;
  actor: "email" | "user" | "restore";
  sourceId?: string;
  reservation: Reservation;
};
export type CanonicalItineraryItem = {
  id: string;
  tripId: string;
  reservation: Reservation;
  original: Reservation;
  sourceKind: "email" | "user";
  sourceIds: string[];
  confidence: number;
  userEditedFields: string[];
  lastSyncedAt?: string;
  latestEvidenceAt?: string;
  createdAt: string;
  updatedAt: string;
  replacesItemId?: string;
  replacedByItemId?: string;
  legacyBlockIndex?: number;
};
export type ItineraryChangeEvent = {
  id: string;
  itemId?: string;
  tripId?: string;
  at: string;
  kind: string;
  summary: string;
  rationale: string;
  sourceId?: string;
  actor: "email" | "live" | "user" | "system";
};
export type ReviewQueueItem = {
  id: string;
  sourceId?: string;
  entity?: ExtractedTravelEntity;
  signal?: LiveSignal;
  tripId?: string;
  candidateIds: string[];
  reason: string;
  status: "open" | "applied" | "dismissed";
  at: string;
  resolvedAt?: string;
};
export type NotificationPreference = {
  push: boolean;
  tiers: Record<Tier, boolean>;
  categories: Record<Category, boolean>;
  quietHours: {
    enabled: boolean;
    start: number;
    end: number;
    timezone: string;
    criticalException: boolean;
  };
  criticalBeforeDeparture: boolean;
};
export type TripMonitoringPreference = {
  autoActivate: boolean;
  activationHours: number;
  preparation: boolean;
  location: LocationPermissionState;
  /**
   * Whether confirmed reservations are copied to the shared dossier page.
   * "ask" = the traveler has not been asked yet, "auto" = keep the shared page
   * updated from now on, "off" = the workspace stays entirely private.
   */
  sharing: "ask" | "auto" | "off";
  notifications: NotificationPreference;
};
export type LiveTripSession = {
  phase: Phase;
  startedAt?: string;
  endedAt?: string;
  extendedUntil?: string;
  automatic?: boolean;
};
export type Trip = {
  id: string;
  slug: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  preferences: TripMonitoringPreference;
  session: LiveTripSession;
};
export type LiveSignalSource = {
  id: string;
  name: string;
  kind: "provider" | "official" | "email" | "demo";
  authoritative: boolean;
  url?: string;
};
export const SignalSchema = z.object({
  id: z.string().min(1).max(180),
  itemId: z.string().min(1).max(180),
  category: Category,
  kind: z.enum([
    "delay",
    "cancellation",
    "gate",
    "terminal",
    "schedule",
    "weather",
    "traffic",
    "transit",
    "access",
    "closure",
    "advisory",
    "preparation",
    "rebooking",
  ]),
  source: z.object({
    id: z.string().max(120),
    name: z.string().max(160),
    kind: z.enum(["provider", "official", "email", "demo"]),
    authoritative: z.boolean(),
    url: z.string().url().optional(),
  }),
  observedAt: ZonedTime,
  validFrom: ZonedTime,
  validUntil: ZonedTime,
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(500),
  action: z.string().max(500).optional(),
  severity: z.enum(["minor", "meaningful", "severe"]),
  // Association evidence is mandatory; itemId alone never establishes relevance.
  association: z.object({
    startAt: ZonedTime,
    location: z.string().min(1).max(240),
    provider: z.string().max(160).optional(),
    confirmation: z.string().max(120).optional(),
    flightNumber: z.string().max(30).optional(),
  }),
  values: z
    .object({
      departure: ZonedTime.optional(),
      arrival: ZonedTime.optional(),
      gate: z.string().max(40).optional(),
      terminal: z.string().max(40).optional(),
      boarding: ZonedTime.optional(),
      baggage: z.string().max(60).optional(),
      temperatureC: z.number().optional(),
      rainProbability: z.number().min(0).max(100).optional(),
      windKph: z.number().optional(),
      uv: z.number().optional(),
      airQuality: z.number().optional(),
      departureBy: ZonedTime.optional(),
    })
    .default({}),
});
export type LiveSignal = z.infer<typeof SignalSchema>;
export type ItineraryItemLiveStatus = {
  itemId: string;
  updatedAt: string;
  signalIds: string[];
  cancelled: boolean;
  values: LiveSignal["values"];
};
export type ItineraryDependency = {
  fromId: string;
  toId: string;
  bufferMinutes: number;
  reason: string;
  confidence: number;
  explicit: boolean;
};
export type ItineraryImpactAssessment = {
  signalId: string;
  itemId: string;
  relevance: number;
  urgency: "now" | "soon" | "informational";
  impact: "minor" | "meaningful" | "disrupting";
  actionability: number;
  confidence: number;
  tier: Tier;
  rationale: string;
  downstream: { itemId: string; reason: string }[];
};
export type TravelRecommendation = {
  id: string;
  itemId: string;
  signalId: string;
  text: string;
  kind: "preparation" | "action";
  generated: true;
  dismissedAt?: string;
};
export type NotificationEvent = {
  id: string;
  tripId: string;
  itemId: string;
  signalId: string;
  sourceId: string;
  at: string;
  expiresAt: string;
  tier: Tier;
  category: Category;
  text: string;
  rationale: string;
  fingerprint: string;
  status: "dashboard" | "pending" | "sent" | "suppressed";
  suppression?: string;
  dismissedAt?: string;
  deliveredAt?: string;
};
export type LiveUpdateAuditEvent = {
  id: string;
  itemId: string;
  signalId: string;
  at: string;
  before?: ItineraryItemLiveStatus;
  after: ItineraryItemLiveStatus;
  rationale: string;
};
export type SyncProcessingLog = {
  id: string;
  at: string;
  accountId: string;
  processed: number;
  reviewed: number;
  status: "ok" | "error";
  message: string;
};
export type EmailSyncState = {
  scope: ScanScope;
  connectedAt: string;
  historyId?: string;
  baselineHistoryId?: string;
  pageToken?: string;
  scanning: boolean;
  lastSyncedAt?: string;
  processed: number;
  error?: string;
};
export type EmailAccountConnection = {
  id: string;
  provider: EmailProvider;
  email: string;
  status: "connected" | "paused" | "disconnected" | "error";
  sync: EmailSyncState;
};

// One transactional aggregate per owner. Reservations remain separate from the public design blocks.
// Explicit size limits fail safely rather than silently pruning travel history.
export type TravelDossier = {
  schemaVersion: 1;
  lastBackgroundAt?: string;
  trips: Trip[];
  items: CanonicalItineraryItem[];
  /**
   * One undo snapshot per trip: the shared dossier's blocks as they were
   * immediately before the last share ran. Never more than one per trip.
   */
  shares?: { tripId: string; at: string; previousBlocks: Block[] }[];
  sources: ItineraryItemEmailSource[];
  versions: ItineraryItemVersion[];
  changes: ItineraryChangeEvent[];
  reviews: ReviewQueueItem[];
  processed: string[];
  signals: LiveSignal[];
  live: ItineraryItemLiveStatus[];
  dependencies: ItineraryDependency[];
  assessments: ItineraryImpactAssessment[];
  recommendations: TravelRecommendation[];
  notifications: NotificationEvent[];
  audit: LiveUpdateAuditEvent[];
  logs: SyncProcessingLog[];
};
export const PreferenceSchema = z.object({
  autoActivate: z.boolean(),
  activationHours: z.number().int().min(1).max(168),
  preparation: z.boolean(),
  location: z.enum(["unknown", "granted", "denied", "disabled"]),
  // Defaulted so dossiers saved before sharing existed keep validating.
  sharing: z.enum(["ask", "auto", "off"]).default("ask"),
  notifications: z.object({
    push: z.boolean(),
    tiers: z.object({ critical: z.boolean(), important: z.boolean(), helpful: z.boolean() }),
    categories: z.object({
      flights: z.boolean(),
      weather: z.boolean(),
      transit: z.boolean(),
      reservations: z.boolean(),
      preparation: z.boolean(),
      local: z.boolean(),
    }),
    quietHours: z.object({
      enabled: z.boolean(),
      start: z.number().int().min(0).max(23),
      end: z.number().int().min(0).max(23),
      timezone: ReservationSchema.shape.timezone,
      criticalException: z.boolean(),
    }),
    criticalBeforeDeparture: z.boolean(),
  }),
});
export function defaultPreferences(): TripMonitoringPreference {
  return {
    autoActivate: true,
    activationHours: 24,
    preparation: true,
    location: "unknown",
    sharing: "ask",
    notifications: {
      push: false,
      tiers: { critical: true, important: true, helpful: false },
      categories: {
        flights: true,
        weather: true,
        transit: true,
        reservations: true,
        preparation: true,
        local: true,
      },
      quietHours: { enabled: false, start: 22, end: 7, timezone: "UTC", criticalException: false },
      criticalBeforeDeparture: false,
    },
  };
}
export function emptyDossier(): TravelDossier {
  return {
    schemaVersion: 1,
    trips: [],
    items: [],
    sources: [],
    versions: [],
    changes: [],
    reviews: [],
    processed: [],
    signals: [],
    live: [],
    dependencies: [],
    assessments: [],
    recommendations: [],
    notifications: [],
    audit: [],
    logs: [],
  };
}
