/**
 * Role & Permission CRUD validation (zod).
 * Pagination/search for scale (thousands of permissions, large role sets).
 */

import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional().nullable(),
  permissionIds: z.array(z.string().cuid()).optional().default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  permissionIds: z.array(z.string().cuid()).optional(),
});

export const roleIdParamSchema = z.object({ id: z.string().cuid() });

export const createPermissionSchema = z.object({
  code: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, "Code: lowercase, numbers, underscores"),
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional().nullable(),
});

export const updatePermissionSchema = z.object({
  code: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const permissionIdParamSchema = z.object({ id: z.string().cuid() });

export const listQuerySchema = z.object({
  page: z.string().optional().default("1").transform(Number),
  limit: z.string().optional().default("20").transform((v) => Math.min(100, Math.max(1, Number(v)))),
  search: z.string().optional().default(""),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
