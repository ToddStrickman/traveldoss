import type {
  CanonicalItineraryItem,
  EmailSyncState,
  ImportedEmailMessage,
  LiveSignal,
  Trip,
} from "./types";
export interface EmailProviderAdapter {
  profile(): Promise<{ email: string; historyId: string }>;
  scan(state: EmailSyncState): Promise<{ ids: string[]; next: EmailSyncState }>;
  message(id: string, accountId: string): Promise<ImportedEmailMessage>;
  revoke(): Promise<void>;
}
export interface LiveProviderAdapter {
  id: string;
  label: string;
  supported: boolean;
  poll(items: CanonicalItineraryItem[], trip: Trip, now: string): Promise<LiveSignal[]>;
}
export interface FlightStatusProviderAdapter extends LiveProviderAdapter {
  category: "flights";
}
export interface WeatherProviderAdapter extends LiveProviderAdapter {
  category: "weather";
}
export interface TrafficTransitProviderAdapter extends LiveProviderAdapter {
  category: "transit";
}
export interface DestinationDisruptionProviderAdapter extends LiveProviderAdapter {
  category: "local";
}
export interface NotificationDeliveryAdapter {
  send(
    eventId: string,
    subscription: unknown,
    payload: { title: string; body: string; url: string; tag: string },
  ): Promise<"sent" | "expired">;
}
