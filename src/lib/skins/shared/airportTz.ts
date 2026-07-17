/**
 * Minimal IATA → IANA timezone lookup for the ~140 highest-traffic
 * international airports. Used to render flight times with an accurate
 * local timezone abbreviation (DST-aware via Intl) and to compute
 * flight duration across zones. Unknown codes fall back gracefully —
 * the caller renders the plain time with no zone suffix.
 */
export const IATA_TO_IANA: Record<string, string> = {
  // North America
  ATL: "America/New_York", JFK: "America/New_York", LGA: "America/New_York",
  EWR: "America/New_York", BOS: "America/New_York", DCA: "America/New_York",
  IAD: "America/New_York", PHL: "America/New_York", MIA: "America/New_York",
  FLL: "America/New_York", MCO: "America/New_York", TPA: "America/New_York",
  CLT: "America/New_York", RDU: "America/New_York", PIT: "America/New_York",
  DTW: "America/Detroit", CLE: "America/New_York", CVG: "America/New_York",
  IND: "America/Indiana/Indianapolis",
  ORD: "America/Chicago", MDW: "America/Chicago", DFW: "America/Chicago",
  DAL: "America/Chicago", IAH: "America/Chicago", HOU: "America/Chicago",
  AUS: "America/Chicago", SAT: "America/Chicago", MSY: "America/Chicago",
  MSP: "America/Chicago", MCI: "America/Chicago", STL: "America/Chicago",
  MEM: "America/Chicago", BNA: "America/Chicago", MKE: "America/Chicago",
  DEN: "America/Denver", SLC: "America/Denver", ABQ: "America/Denver",
  PHX: "America/Phoenix", LAS: "America/Los_Angeles",
  LAX: "America/Los_Angeles", SFO: "America/Los_Angeles",
  SJC: "America/Los_Angeles", OAK: "America/Los_Angeles",
  SAN: "America/Los_Angeles", SNA: "America/Los_Angeles",
  BUR: "America/Los_Angeles", ONT: "America/Los_Angeles",
  SMF: "America/Los_Angeles", PDX: "America/Los_Angeles",
  SEA: "America/Los_Angeles", ANC: "America/Anchorage",
  HNL: "Pacific/Honolulu", OGG: "Pacific/Honolulu",
  YYZ: "America/Toronto", YUL: "America/Toronto", YOW: "America/Toronto",
  YHZ: "America/Halifax", YWG: "America/Winnipeg",
  YYC: "America/Edmonton", YEG: "America/Edmonton",
  YVR: "America/Vancouver",
  MEX: "America/Mexico_City", CUN: "America/Cancun", GDL: "America/Mexico_City",
  MTY: "America/Monterrey", SJD: "America/Mazatlan", PVR: "America/Bahia_Banderas",

  // Central & South America
  PTY: "America/Panama", SJO: "America/Costa_Rica",
  BOG: "America/Bogota", UIO: "America/Guayaquil",
  LIM: "America/Lima", SCL: "America/Santiago",
  EZE: "America/Argentina/Buenos_Aires", AEP: "America/Argentina/Buenos_Aires",
  GRU: "America/Sao_Paulo", GIG: "America/Sao_Paulo",
  BSB: "America/Sao_Paulo", CWB: "America/Sao_Paulo",
  MVD: "America/Montevideo",

  // Europe
  LHR: "Europe/London", LGW: "Europe/London", STN: "Europe/London",
  LTN: "Europe/London", LCY: "Europe/London", MAN: "Europe/London",
  EDI: "Europe/London", DUB: "Europe/Dublin",
  CDG: "Europe/Paris", ORY: "Europe/Paris", NCE: "Europe/Paris",
  LYS: "Europe/Paris", MRS: "Europe/Paris",
  AMS: "Europe/Amsterdam", BRU: "Europe/Brussels",
  FRA: "Europe/Berlin", MUC: "Europe/Berlin", BER: "Europe/Berlin",
  HAM: "Europe/Berlin", DUS: "Europe/Berlin", STR: "Europe/Berlin",
  CGN: "Europe/Berlin", TXL: "Europe/Berlin",
  ZRH: "Europe/Zurich", GVA: "Europe/Zurich",
  VIE: "Europe/Vienna", PRG: "Europe/Prague", WAW: "Europe/Warsaw",
  BUD: "Europe/Budapest", OTP: "Europe/Bucharest",
  MAD: "Europe/Madrid", BCN: "Europe/Madrid", PMI: "Europe/Madrid",
  AGP: "Europe/Madrid", VLC: "Europe/Madrid",
  LIS: "Europe/Lisbon", OPO: "Europe/Lisbon",
  FCO: "Europe/Rome", MXP: "Europe/Rome", LIN: "Europe/Rome",
  VCE: "Europe/Rome", NAP: "Europe/Rome", BLQ: "Europe/Rome",
  ATH: "Europe/Athens", SKG: "Europe/Athens",
  IST: "Europe/Istanbul", SAW: "Europe/Istanbul",
  ARN: "Europe/Stockholm", CPH: "Europe/Copenhagen",
  OSL: "Europe/Oslo", HEL: "Europe/Helsinki",
  KEF: "Atlantic/Reykjavik",
  SVO: "Europe/Moscow", DME: "Europe/Moscow", LED: "Europe/Moscow",

  // Middle East & Africa
  DXB: "Asia/Dubai", AUH: "Asia/Dubai", DOH: "Asia/Qatar",
  RUH: "Asia/Riyadh", JED: "Asia/Riyadh",
  KWI: "Asia/Kuwait", BAH: "Asia/Bahrain",
  TLV: "Asia/Jerusalem", AMM: "Asia/Amman", BEY: "Asia/Beirut",
  CAI: "Africa/Cairo", HRG: "Africa/Cairo", SSH: "Africa/Cairo",
  CMN: "Africa/Casablanca", RAK: "Africa/Casablanca",
  ADD: "Africa/Addis_Ababa", NBO: "Africa/Nairobi",
  JNB: "Africa/Johannesburg", CPT: "Africa/Johannesburg",
  DUR: "Africa/Johannesburg", LOS: "Africa/Lagos",

  // Asia
  DEL: "Asia/Kolkata", BOM: "Asia/Kolkata", BLR: "Asia/Kolkata",
  MAA: "Asia/Kolkata", HYD: "Asia/Kolkata", CCU: "Asia/Kolkata",
  CMB: "Asia/Colombo", KTM: "Asia/Kathmandu",
  BKK: "Asia/Bangkok", DMK: "Asia/Bangkok", HKT: "Asia/Bangkok",
  KUL: "Asia/Kuala_Lumpur", SIN: "Asia/Singapore",
  CGK: "Asia/Jakarta", DPS: "Asia/Makassar",
  MNL: "Asia/Manila", CEB: "Asia/Manila",
  SGN: "Asia/Ho_Chi_Minh", HAN: "Asia/Ho_Chi_Minh",
  HKG: "Asia/Hong_Kong", MFM: "Asia/Macau", TPE: "Asia/Taipei",
  ICN: "Asia/Seoul", GMP: "Asia/Seoul", PUS: "Asia/Seoul",
  NRT: "Asia/Tokyo", HND: "Asia/Tokyo", KIX: "Asia/Tokyo",
  NGO: "Asia/Tokyo", FUK: "Asia/Tokyo", CTS: "Asia/Tokyo", OKA: "Asia/Tokyo",
  PEK: "Asia/Shanghai", PKX: "Asia/Shanghai", PVG: "Asia/Shanghai",
  SHA: "Asia/Shanghai", CAN: "Asia/Shanghai", SZX: "Asia/Shanghai",
  CTU: "Asia/Shanghai", CKG: "Asia/Shanghai", XIY: "Asia/Shanghai",
  KMG: "Asia/Shanghai", HGH: "Asia/Shanghai",

  // Oceania
  SYD: "Australia/Sydney", MEL: "Australia/Melbourne", BNE: "Australia/Brisbane",
  PER: "Australia/Perth", ADL: "Australia/Adelaide", CBR: "Australia/Sydney",
  OOL: "Australia/Brisbane", CNS: "Australia/Brisbane", HBA: "Australia/Hobart",
  AKL: "Pacific/Auckland", WLG: "Pacific/Auckland", CHC: "Pacific/Auckland",
  NAN: "Pacific/Fiji", PPT: "Pacific/Tahiti",
};

/** Resolve an airport code (case-insensitive) to its IANA timezone. */
export function airportZone(iata?: string): string | undefined {
  if (!iata) return undefined;
  return IATA_TO_IANA[iata.trim().toUpperCase()];
}

/** Short timezone label (e.g. "EST", "GMT+1") for an airport on a given
 *  date. DST-aware — the tz abbreviation reflects the observed offset on
 *  the flight's date, not today's offset. */
export function airportTzLabel(iata?: string, dateISO?: string): string | undefined {
  const zone = airportZone(iata);
  if (!zone) return undefined;
  const d = parseFlightDate(dateISO) ?? new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "short",
      hour: "numeric",
    }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value;
  } catch {
    return undefined;
  }
}

/** Parse the loosely-typed flight `date` field. Accepts ISO (YYYY-MM-DD),
 *  full ISO datetimes, and common display formats like "Jun 12, 2026". */
export function parseFlightDate(input?: string): Date | undefined {
  if (!input) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Date.UTC(+y, +m - 1, +d, 12, 0, 0));
  }
  const t = Date.parse(input);
  return Number.isFinite(t) ? new Date(t) : undefined;
}

/** Interpret a wall-clock (Y/M/D H:M) in a given IANA zone and return the
 *  UTC milliseconds. Uses the classic "guess → measure offset → correct"
 *  trick so we don't need a tz library. */
function zonedWallClockToUtc(
  y: number, m: number, d: number, hh: number, mm: number, zone: string,
): number | undefined {
  try {
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(guess));
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    const asLocal = Date.UTC(
      +map.year, +map.month - 1, +map.day,
      +map.hour % 24, +map.minute, +map.second,
    );
    return guess - (asLocal - guess);
  } catch {
    return undefined;
  }
}

function parseHHMM(t?: string): [number, number] | undefined {
  if (!t) return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return undefined;
  const hh = +m[1], mm = +m[2];
  if (hh > 23 || mm > 59) return undefined;
  return [hh, mm];
}

/** Duration between two zoned wall-clock times. Falls back to same-zone
 *  math when only one airport is known. Returns "7h 55m" style. */
export function flightDuration(
  dateISO: string | undefined,
  departTime: string | undefined,
  arriveTime: string | undefined,
  fromIata: string | undefined,
  toIata: string | undefined,
  arriveDateISO?: string,
): string | undefined {
  const dep = parseHHMM(departTime);
  const arr = parseHHMM(arriveTime);
  if (!dep || !arr) return undefined;
  const depBase = parseFlightDate(dateISO);
  if (!depBase) return undefined;
  const arrBase = parseFlightDate(arriveDateISO) ?? depBase;
  const fromZone = airportZone(fromIata) ?? airportZone(toIata);
  const toZone = airportZone(toIata) ?? fromZone;
  if (!fromZone || !toZone) return undefined;
  const depUtc = zonedWallClockToUtc(
    depBase.getUTCFullYear(), depBase.getUTCMonth() + 1, depBase.getUTCDate(),
    dep[0], dep[1], fromZone,
  );
  let arrUtc = zonedWallClockToUtc(
    arrBase.getUTCFullYear(), arrBase.getUTCMonth() + 1, arrBase.getUTCDate(),
    arr[0], arr[1], toZone,
  );
  if (depUtc == null || arrUtc == null) return undefined;
  // If no arrival date was given and the arrival wall-clock lands before
  // departure UTC, assume it rolls over to the next day.
  if (!arriveDateISO && arrUtc < depUtc) arrUtc += 24 * 60 * 60 * 1000;
  const diffMin = Math.round((arrUtc - depUtc) / 60000);
  if (diffMin <= 0 || diffMin > 60 * 30) return undefined;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}