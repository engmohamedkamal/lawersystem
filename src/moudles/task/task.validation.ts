import z from "zod"
import { TASK_PRIORITIES, TASK_STATUSES } from "../../DB/model/tasks.model"

export const createTaskSchema = {
    body: z.object({
        title:       z.string().min(2).max(300),
        description: z.string().max(2000).optional(),
        assignedTo:  z.string().length(24).optional(),
        client:      z.string().length(24).optional(),
        legalCase:   z.string().length(24).optional(),
        priority:    z.enum([...TASK_PRIORITIES] as [string, ...string[]]).optional(),
        dueDate:     z.string().optional(),
    }),
}

export const updateTaskSchema = {
    params: z.object({
        taskId: z.string().length(24),
    }),
    body: z.object({
        title:       z.string().min(2).max(300).optional(),
        description: z.string().max(2000).optional(),
        assignedTo:  z.string().length(24),
        client:      z.string().length(24).optional(),
        legalCase:   z.string().length(24).optional(),
        priority:    z.enum([...TASK_PRIORITIES] as [string, ...string[]]).optional(),
        status:      z.enum([...TASK_STATUSES]   as [string, ...string[]]).optional(),
        dueDate:     z.string().optional(),
    }),
}

export const updateTaskStatusSchema = {
    params: z.object({
        taskId: z.string().length(24),
    }),
    body: z.object({
        status: z.enum([...TASK_STATUSES] as [string, ...string[]]),
    }),
}

export const getTasksSchema = {
    query: z.object({
        status:     z.enum([...TASK_STATUSES]   as [string, ...string[]]).optional(),
        priority:   z.enum([...TASK_PRIORITIES] as [string, ...string[]]).optional(),
        assignedTo: z.string().length(24).optional(),
        client:     z.string().length(24).optional(),
        legalCase:  z.string().length(24).optional(),
        page:       z.string().optional(),
        limit:      z.string().optional(),
    }),
}

export const addTaskCommentSchema = {
    params: z.object({
        taskId: z.string().length(24),
    }),
    body: z.object({
        content: z.string().min(1),
        parentCommentId: z.string().length(24).optional(),
    }),
}

export const addSubtaskSchema = {
    params: z.object({
        taskId: z.string().length(24),
    }),
    body: z.object({
        title: z.string().min(1),
    }),
}

export const updateSubtaskSchema = {
    params: z.object({
        taskId: z.string().length(24),
        subtaskId: z.string().length(24),
    }),
    body: z.object({
        title: z.string().min(1).optional(),
        isCompleted: z.boolean().optional(),
    }),
}


export type CreateTaskType       = z.infer<typeof createTaskSchema.body>
export type UpdateTaskType       = z.infer<typeof updateTaskSchema.body>
export type UpdateTaskStatusType = z.infer<typeof updateTaskStatusSchema.body>