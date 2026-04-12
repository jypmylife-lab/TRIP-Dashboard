import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db.query("flights").withIndex("by_tripId", (q) => q.eq("tripId", args.tripId)).order("asc").collect();
  },
});

export const add = mutation({
  args: {
    tripId: v.id("trips"),
    airline: v.string(),
    flightNumber: v.string(),
    departure: v.string(),
    arrival: v.string(),
    departureTime: v.string(),
    arrivalTime: v.string(),
    date: v.string(),
    type: v.string(),
    imageStorageId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("flights", { ...args, createdAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    flightId: v.id("flights"),
    airline: v.optional(v.string()),
    flightNumber: v.optional(v.string()),
    departure: v.optional(v.string()),
    arrival: v.optional(v.string()),
    departureTime: v.optional(v.string()),
    arrivalTime: v.optional(v.string()),
    date: v.optional(v.string()),
    type: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { flightId, ...fields } = args;
    await ctx.db.patch(flightId, fields);
  },
});

export const remove = mutation({
  args: { flightId: v.id("flights") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.flightId);
  },
});
