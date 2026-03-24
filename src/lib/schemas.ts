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
    crs: z.string().optional(),
    futureChangeTo: z.string().optional().nullable(),
    locationName: z.string(),
    via: z.string().optional().nullable(),
  })
  .passthrough();

export const CallingPointSchema = z
  .object({
    at: z.string().optional(),
    crs: z.string().optional(),
    et: z.string().optional(),
    isCancelled: z.boolean().optional(),
    locationName: z.string(),
    st: z.string().optional(),
  })
  .passthrough();

export const CallingPointListSchema = z
  .object({
    callingPoint: z.array(CallingPointSchema).optional().default([]),
  })
  .passthrough();

export const BoardServiceSchema = z
  .object({
    ata: z.string().optional(),
    atd: z.string().optional(),
    cancelReason: z.string().optional(),
    currentDestinations: z.array(ServiceLocationSchema).optional().default([]),
    currentOrigins: z.array(ServiceLocationSchema).optional().default([]),
    delayReason: z.string().optional(),
    destination: z.array(ServiceLocationSchema).optional().default([]),
    eta: z.string().optional(),
    etd: z.string().optional(),
    filterLocationCancelled: z.boolean().optional(),
    isCancelled: z.boolean().optional(),
    operator: z.string().optional(),
    operatorCode: z.string().optional(),
    origin: z.array(ServiceLocationSchema).optional().default([]),
    platform: z.string().optional(),
    previousCallingPoints: z.array(CallingPointListSchema).optional().default([]),
    rsid: z.string().optional(),
    serviceID: z.string().optional(),
    sta: z.string().optional(),
    std: z.string().optional(),
    subsequentCallingPoints: z.array(CallingPointListSchema).optional().default([]),
  })
  .passthrough();

export const StationBoardResponseSchema = z
  .object({
    areServicesAvailable: z.boolean().optional(),
    crs: z.string(),
    filterLocationName: z.string().optional(),
    filterType: z.enum(['from', 'to']).optional(),
    filtercrs: z.string().optional(),
    generatedAt: z.string(),
    locationName: z.string(),
    nrccMessages: z.array(z.unknown()).optional().default([]),
    platformAvailable: z.boolean().optional(),
    trainServices: z.array(BoardServiceSchema).optional().default([]),
  })
  .passthrough();

export type HuxleyBoardService = z.infer<typeof BoardServiceSchema>;
export type HuxleyStationBoardResponse = z.infer<typeof StationBoardResponseSchema>;
export type HuxleyStationSearchResult = z.infer<typeof StationSearchResultSchema>;
