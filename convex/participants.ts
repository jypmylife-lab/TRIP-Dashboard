import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db.query("participants").withIndex("by_tripId", (q) => q.eq("tripId", args.tripId)).collect();
  },
});

export const add = mutation({
  args: { tripId: v.id("trips"), nickname: v.string() },
  handler: async (ctx, args) => {
    // 중복 닉네임 방지
    const existing = await ctx.db.query("participants").withIndex("by_tripId", (q) => q.eq("tripId", args.tripId)).filter((q) => q.eq(q.field("nickname"), args.nickname)).first();
    if (existing) return existing._id;
    return await ctx.db.insert("participants", { ...args, joinedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { participantId: v.id("participants") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.participantId);
  },
});
