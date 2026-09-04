import type { Permission } from "@shri-anandam/shared-types";

export type SubjectType = "CUSTOMER" | "STAFF";

interface BaseAuthenticatedUser {
  id: string;
  subjectType: SubjectType;
}

export interface AuthenticatedCustomer extends BaseAuthenticatedUser {
  subjectType: "CUSTOMER";
  mobileNumber: string;
}

export interface AuthenticatedStaff extends BaseAuthenticatedUser {
  subjectType: "STAFF";
  email: string;
  permissions: Permission[];
}

export type AuthenticatedUser = AuthenticatedCustomer | AuthenticatedStaff;

/** Shape encoded into the JWT access token payload. */
export interface JwtPayload {
  sub: string;
  subjectType: SubjectType;
  /** Present for STAFF tokens only — customers carry no RBAC permissions. */
  permissions?: Permission[];
  mobileNumber?: string;
  email?: string;
}
