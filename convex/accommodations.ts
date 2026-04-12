import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db.query("accommodations").withIndex("by_tripId", (q) => q.eq("tripId", args.tripId)).collect();
  },
});

export const add = mutation({
  args: {
    tripId: v.id("trips"),
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    checkIn: v.string(),
    checkOut: v.string(),
    confirmationNumber: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    notes: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("accommodations", { ...args, createdAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    accommodationId: v.id("accommodations"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    checkIn: v.optional(v.string()),
    checkOut: v.optional(v.string()),
    confirmationNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { accommodationId, ...fields } = args;
    await ctx.db.patch(accommodationId, fields);
  },
});

export const remove = mutation({
  args: { accommodationId: v.id("accommodations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.accommodationId);
  },
});
