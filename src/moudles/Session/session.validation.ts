import z from "zod"
import { SESSION_STATUSES, SESSION_TYPES } from "../../DB/model/session.model"

export const createSessionSchema = {
    body: z.object({
        legalCase:  z.string().length(24),
        type:       z.enum([...SESSION_TYPES]    as [string, ...string[]]).optional(),
        startAt:    z.string(),
        endAt:      z.string().optional(),
        status:     z.enum([...SESSION_STATUSES] as [string, ...string[]]).optional(),
        courtName:  z.string().max(200).optional(),
        city:       z.string().max(100).optional(),
        circuit:    z.string().max(200).optional(),
        notes:      z.string().max(4000).optional(),
        assignedTo: z.string().length(24),
        team:       z.array(z.string().length(24)).optional(),
    }),
}

export const updateSessionSchema = {
    params: z.object({ sessionId: z.string().length(24) }),
    body:   z.object({
        type:          z.enum([...SESSION_TYPES]    as [string, ...string[]]).optional(),
        startAt:       z.string().optional(),
        endAt:         z.string().optional(),
        courtName:     z.string().max(200).optional(),
        city:          z.string().max(100).optional(),
        circuit:       z.string().max(200).optional(),
        notes:         z.string().max(4000).optional(),
        assignedTo:    z.string().length(24).optional(),
        team:          z.array(z.string().length(24)).optional(),
    }),
}

export const updateStatusSchema = {
    params: z.object({ sessionId: z.string().length(24) }),
    body:   z.object({
        status:        z.enum([...SESSION_STATUSES] as [string, ...string[]]),
        result:        z.string().max(4000).optional(),
        nextSessionAt: z.string().optional(),
    }),
}

export const sessionParamsSchema = {
    params: z.object({ sessionId: z.string().length(24) }),
}

export const caseSessionsSchema = {
    params: z.object({ legalCaseId: z.string().length(24) }),
    query:  z.object({
        status: z.enum([...SESSION_STATUSES] as [string, ...string[]]).optional(),
        page:   z.string().optional(),
        limit:  z.string().optional(),
    }),
}