import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── 조회 ───────────────────────────────────────────────
// shareId로 여행 조회 (참가자용 — 전체 목록 노출 안 됨)
export const getByShareId = query({
  args: { shareId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trips")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first();
  },
});

// 전체 여행 목록 (관리자 전용 — 클라이언트에서 adminKey 검증 후 호출)
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("trips").order("desc").collect();
  },
});

// ID로 단일 여행 조회
export const getById = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tripId);
  },
});

// ─── 생성 ───────────────────────────────────────────────
export const create = mutation({
  args: {
    title: v.string(),
    destination: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    shareId: v.string(),
    currency: v.string(),
    coverEmoji: v.optional(v.string()),
    tripType: v.optional(v.string()),
    themeColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("trips", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ─── 수정 ───────────────────────────────────────────────
export const update = mutation({
  args: {
    tripId: v.id("trips"),
    title: v.optional(v.string()),
    destination: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    currency: v.optional(v.string()),
    coverEmoji: v.optional(v.string()),
    tripType: v.optional(v.string()),
    themeColor: v.optional(v.string()),   // 헤더 테마 컬러
  },
  handler: async (ctx, args) => {
    const { tripId, ...fields } = args;
    await ctx.db.patch(tripId, fields);
  },
});

// ─── 삭제 ───────────────────────────────────────────────
export const remove = mutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.tripId);
  },
});
