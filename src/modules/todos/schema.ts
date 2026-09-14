import { z } from "zod";
import { ErrorResponseSchema } from "../../lib/errors.ts";
import { PaginationQuerySchema, paginatedSchema } from "../../lib/pagination.ts";

export const TodoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Todo = z.infer<typeof TodoSchema>;

const TitleSchema = z.string().trim().min(1, "Title is required").max(200);

export const CreateTodoBodySchema = z.object({
  title: TitleSchema,
  completed: z.boolean().default(false),
});

export type CreateTodoInput = z.infer<typeof CreateTodoBodySchema>;

export const UpdateTodoBodySchema = z
  .object({
    title: TitleSchema.optional(),
    completed: z.boolean().optional(),
  })
  .refine((body) => body.title !== undefined || body.completed !== undefined, {
    message: "Provide at least one field to update",
  });

export type UpdateTodoInput = z.infer<typeof UpdateTodoBodySchema>;

export const TodoParamsSchema = z.object({ id: z.uuid() });

export const ListTodosQuerySchema = PaginationQuerySchema.extend({
  completed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type ListTodosQuery = z.infer<typeof ListTodosQuerySchema>;

const authErrors = { 401: ErrorResponseSchema };

export const ListTodosSchema = {
  querystring: ListTodosQuerySchema,
  response: { 200: paginatedSchema(TodoSchema), 400: ErrorResponseSchema, ...authErrors },
};

export const GetTodoSchema = {
  params: TodoParamsSchema,
  response: { 200: TodoSchema, 404: ErrorResponseSchema, ...authErrors },
};

export const CreateTodoSchema = {
  body: CreateTodoBodySchema,
  response: { 201: TodoSchema, 400: ErrorResponseSchema, ...authErrors },
};

export const UpdateTodoSchema = {
  params: TodoParamsSchema,
  body: UpdateTodoBodySchema,
  response: { 200: TodoSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, ...authErrors },
};

export const DeleteTodoSchema = {
  params: TodoParamsSchema,
  response: { 204: z.null(), 404: ErrorResponseSchema, ...authErrors },
};
