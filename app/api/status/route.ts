import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandler } from "@/lib/error";
import { getRequestAuth } from "@/lib/request-auth";

export const GET = withErrorHandler(async () => {
  const [
    orgCount,
    userCount,
    ruleVersionCount,
    publishedRuleVersions,
    quoteVersionCount,
    publishedQuoteVersions,
    quoteCount,
    ruleCount,
    surchargeCount,
    billingRuleCount,
    restrictionCount,
    upstreamList,
    recentImportJobs,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.ruleVersion.count(),
    prisma.ruleVersion.findMany({
      where: { status: "published" },
      select: { id: true, upstream: true, version: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 10,
    }),
    prisma.quoteVersion.count(),
    prisma.quoteVersion.findMany({
      where: { status: "published" },
      select: { id: true, upstream: true, version: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 10,
    }),
    prisma.quote.count(),
    prisma.rule.count(),
    prisma.surcharge.count(),
    prisma.billingRule.count(),
    prisma.restriction.count(),
    // Distinct upstreams across rule versions and quote versions
    prisma.ruleVersion.findMany({
      select: { upstream: true },
      distinct: ["upstream"],
    }),
    // Recent import jobs
    prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        upstream: true,
        filename: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    }),
  ]);

  const upstreams = upstreamList.map((u) => u.upstream);

  const stats = {
    organizations: orgCount,
    users: userCount,
    ruleVersions: ruleVersionCount,
    publishedRuleVersions: publishedRuleVersions.length,
    quoteVersions: quoteVersionCount,
    publishedQuoteVersions: publishedQuoteVersions.length,
    quotes: quoteCount,
    rules: ruleCount,
    surcharges: surchargeCount,
    billingRules: billingRuleCount,
    restrictions: restrictionCount,
  };

  return NextResponse.json({
    stats,
    upstreams,
    publishedRuleVersions: publishedRuleVersions.map((v) => ({
      id: v.id,
      upstream: v.upstream,
      version: v.version,
      publishedAt: v.publishedAt?.toISOString() ?? null,
    })),
    publishedQuoteVersions: publishedQuoteVersions.map((v) => ({
      id: v.id,
      upstream: v.upstream,
      version: v.version,
      publishedAt: v.publishedAt?.toISOString() ?? null,
    })),
    recentImportJobs: recentImportJobs.map((j) => ({
      id: j.id,
      upstream: j.upstream,
      filename: j.filename,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
    })),
  });
});
