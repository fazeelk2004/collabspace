/**
 * Pure role logic, safe to import in client components (no Prisma).
 * The server-side module (lib/permissions) re-exports these so there is a
 * single definition of the role hierarchy.
 *
 * Client-side checks are for UX only (hiding buttons) — the server always
 * re-validates against the database.
 */
export type RoleName = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

const ROLE_LEVEL: Record<RoleName, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(role: RoleName, required: RoleName): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[required];
}

export const can = {
  view: (role: RoleName) => roleAtLeast(role, "VIEWER"),
  /** create/edit tasks, comment, chat */
  contribute: (role: RoleName) => roleAtLeast(role, "MEMBER"),
  /** manage boards, columns, members, labels */
  manage: (role: RoleName) => roleAtLeast(role, "ADMIN"),
  /** delete workspace, transfer ownership */
  own: (role: RoleName) => roleAtLeast(role, "OWNER"),
};
