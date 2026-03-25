import { PrismaClient } from "@prisma/client";
import { getOrgId } from "./auth-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

function createPrismaClient() {
  const client = new PrismaClient();

  // Multi-tenant row-level isolation using $extends.
  // All queries on org-scoped models automatically inject organization_id.
  // User model queries are NOT scoped (users belong to one org but admins
  // may need to query across orgs for invite/lookup flows — handled explicitly).
  //
  // Models with organizationId: ImportJob, MappingDictionary, RuleVersion,
  // Rule, QuoteVersion, Quote, Surcharge, BillingRule, Restriction, AuditLog.
  //
  // Models without organizationId but still need careful handling:
  //   - ImportBlock / ParseIssue — scoped via importJob -> organizationId
  //   - Organization — top-level, always queried by id explicitly

  const orgExtend = {
    importJob: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {
          // No org context (e.g., in a worker) — skip injection
        }
        return next(args);
      },
      findFirst: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findUnique: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      count: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      update: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      delete: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
    mappingDictionary: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findFirst: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findUnique: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      count: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      create: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.data = { ...args.data, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      update: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      delete: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
    ruleVersion: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findFirst: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findUnique: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      count: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      create: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.data = { ...args.data, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      update: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      delete: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
    rule: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findFirst: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findUnique: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      count: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      create: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.data = { ...args.data, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      update: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      delete: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
    quoteVersion: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findFirst: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findUnique: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      count: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      create: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.data = { ...args.data, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      update: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      delete: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
    quote: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findFirst: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findUnique: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      count: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      create: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.data = { ...args.data, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      update: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      delete: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
    surcharge: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findFirst: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findUnique: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      create: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.data = { ...args.data, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      update: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      delete: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
    billingRule: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findFirst: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findUnique: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      create: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.data = { ...args.data, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      update: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      delete: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
    restriction: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findFirst: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      findUnique: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      create: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.data = { ...args.data, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      update: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      delete: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
    auditLog: {
      findMany: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      count: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.where = { ...args.where, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
      create: async ({ args, next }: { args: any; next: any }) => {
        try {
          args.data = { ...args.data, organization_id: getOrgId() };
        } catch {}
        return next(args);
      },
    },
  };

  return client.$extends(orgExtend as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
