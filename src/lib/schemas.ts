import { z } from 'zod';

export const StationSearchResultSchema = z
  .object({
    crsCode: z.string(),
    stationName: z.string(),
  })
  .passthrough();

export const StationSearchResponseSchema = z.array(StationSearchResultSchema);

export const ServiceLocationSchema = z
  .object({
    assocIsCancelled: z.boolean().optional(),
    crs: z.string().optional().nullable(),
    futureChangeTo: z.string().optional().nullable(),
    locationName: z.string(),
    via: z.string().optional().nullable(),
  })
  .passthrough();

export const CallingPointSchema = z
  .object({
    at: z.string().optional().nullable(),
    crs: z.string().optional().nullable(),
    et: z.string().optional().nullable(),
    isCancelled: z.boolean().optional(),
    locationName: z.string(),
    st: z.string().optional().nullable(),
  })
  .passthrough();

export const CallingPointListSchema = z
  .object({
    callingPoint: z.array(CallingPointSchema).optional().nullable().default([]),
  })
  .passthrough();

export const BoardServiceSchema = z
  .object({
    ata: z.string().optional().nullable(),
    atd: z.string().optional().nullable(),
    cancelReason: z.string().optional().nullable(),
    currentDestinations: z.array(ServiceLocationSchema).optional().nullable().default([]),
    currentOrigins: z.array(ServiceLocationSchema).optional().nullable().default([]),
    delayReason: z.string().optional().nullable(),
    destination: z.array(ServiceLocationSchema).optional().nullable().default([]),
    eta: z.string().optional().nullable(),
    etd: z.string().optional().nullable(),
    filterLocationCancelled: z.boolean().optional(),
    isCancelled: z.boolean().optional(),
    operator: z.string().optional().nullable(),
    operatorCode: z.string().optional().nullable(),
    origin: z.array(ServiceLocationSchema).optional().nullable().default([]),
    platform: z.string().optional().nullable(),
    previousCallingPoints: z.array(CallingPointListSchema).optional().nullable().default([]),
    rsid: z.string().optional().nullable(),
    serviceID: z.string().optional().nullable(),
    sta: z.string().optional().nullable(),
    std: z.string().optional().nullable(),
    subsequentCallingPoints: z.array(CallingPointListSchema).optional().nullable().default([]),
  })
  .passthrough();

export const StationBoardResponseSchema = z
  .object({
    areServicesAvailable: z.boolean().optional(),
    crs: z.string(),
    filterLocationName: z.string().optional().nullable(),
    filterType: z.union([z.enum(['from', 'to']), z.number()]).optional().nullable(),
    filtercrs: z.string().optional().nullable(),
    generatedAt: z.string(),
    locationName: z.string(),
    nrccMessages: z.array(z.unknown()).optional().nullable().default([]),
    platformAvailable: z.boolean().optional(),
    trainServices: z.array(BoardServiceSchema).optional().nullable().default([]),
  })
  .passthrough();

export type HuxleyBoardService = z.infer<typeof BoardServiceSchema>;
export type HuxleyStationBoardResponse = z.infer<typeof StationBoardResponseSchema>;
export type HuxleyStationSearchResult = z.infer<typeof StationSearchResultSchema>;
