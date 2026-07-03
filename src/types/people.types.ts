export type JsonObject = Record<string, unknown>;

export interface NormalizedPeoplePayload {
  device_id: string;
  timestamp: Date;
  entradas: number;
  salidas: number;
  total: number;
  raw_payload: JsonObject;
  warnings: string[];
}

export interface PeopleCountRecord {
  id: number;
  device_id: string;
  entradas: number;
  salidas: number;
  total: number;
  fecha: Date;
  raw_payload: JsonObject;
  payload_hash: string;
  created_at: Date;
}

export interface PeopleCountPublicRecord {
  id: number;
  device_id: string;
  timestamp: string;
  entradas: number;
  salidas: number;
  total: number;
  created_at?: string;
}

export interface CreatePeopleCountInput {
  device_id: string;
  timestamp: Date;
  entradas: number;
  salidas: number;
  total: number;
  raw_payload: JsonObject;
  payload_hash: string;
}

export interface CreatePeopleCountResult {
  record: PeopleCountRecord | null;
  duplicate: boolean;
}

export interface ListPeopleFilters {
  page: number;
  limit: number;
  device_id?: string;
  from?: Date;
  to?: Date;
}

export interface ListPeopleResult {
  data: PeopleCountRecord[];
  totalItems: number;
}

export interface PeopleRepository {
  create(input: CreatePeopleCountInput): Promise<CreatePeopleCountResult>;
  list(filters: ListPeopleFilters): Promise<ListPeopleResult>;
  findById(id: number): Promise<PeopleCountRecord | null>;
  healthCheck(): Promise<void>;
  close(): Promise<void>;
}
