export type OutputMode = 'json' | 'text';

type SchemaVersion = '1';

export type EnvelopeError = {
  code: string;
  details?: unknown;
  message: string;
  retryable: boolean;
};

export type ErrorEnvelope = {
  command: string;
  error: EnvelopeError;
  ok: false;
  requestedAt: string;
  schemaVersion: SchemaVersion;
};

export type SuccessEnvelope<TData> = {
  command: string;
  data: TData;
  ok: true;
  requestedAt: string;
  schemaVersion: SchemaVersion;
};

export type OutputOptions = {
  color?: boolean | undefined;
  json?: boolean | undefined;
  text?: boolean | undefined;
};

export type StationCandidate = {
  crs: string;
  name: string;
};

export type ResolvedStation = {
  crs: string;
  name: string;
};

export type RailServiceStatus = 'cancelled' | 'delayed' | 'expected' | 'on-time' | 'unknown';

export type RailBoardService = {
  callingPoints?: string[] | undefined;
  counterpartName: string;
  expectedTime?: string | undefined;
  operatorName: string;
  platform?: string | undefined;
  scheduledTime: string;
  status: RailServiceStatus;
  statusLabel: string;
};

export type RailBoardFilter = {
  crs: string;
  name: string;
  type: 'from' | 'to';
};

export type RailBoardData = {
  filter?: RailBoardFilter | undefined;
  requestedFilter?: string | undefined;
  requestedStation: string;
  services: RailBoardService[];
  station: ResolvedStation;
};

export type SearchData = {
  candidates: StationCandidate[];
  query: string;
};
