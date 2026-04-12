import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db.query("expenses").withIndex("by_tripId", (q) => q.eq("tripId", args.tripId)).order("desc").collect();
  },
});

export const add = mutation({
  args: {
    tripId: v.id("trips"),
    title: v.string(),
    amount: v.number(),
    currency: v.string(),
    exchangeRate: v.number(),
    amountKRW: v.number(),
    date: v.string(),
    paidBy: v.string(),
    splitWith: v.array(v.string()),
    splitAmounts: v.optional(v.array(v.object({ nickname: v.string(), amount: v.number() }))),
    imageStorageId: v.optional(v.string()),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("expenses", { ...args, createdAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    expenseId: v.id("expenses"),
    title: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    exchangeRate: v.optional(v.number()),
    amountKRW: v.optional(v.number()),
    date: v.optional(v.string()),
    paidBy: v.optional(v.string()),
    splitWith: v.optional(v.array(v.string())),
    splitAmounts: v.optional(v.array(v.object({ nickname: v.string(), amount: v.number() }))),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { expenseId, ...fields } = args;
    await ctx.db.patch(expenseId, fields);
  },
});

export const remove = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.expenseId);
  },
});
