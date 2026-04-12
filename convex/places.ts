import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── 장소 ───────────────────────────────────────────────
export const listPlacesByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db.query("places").withIndex("by_tripId", (q) => q.eq("tripId", args.tripId)).collect();
  },
});

export const addPlace = mutation({
  args: {
    tripId: v.id("trips"),
    name: v.string(),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    mapLink: v.optional(v.string()),
    category: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("places", { ...args, createdAt: Date.now() });
  },
});

export const updatePlace = mutation({
  args: {
    placeId: v.id("places"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    mapLink: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { placeId, ...fields } = args;
    await ctx.db.patch(placeId, fields);
  },
});

export const removePlace = mutation({
  args: { placeId: v.id("places") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.placeId);
  },
});

// ─── 체크리스트 ───────────────────────────────────────────
export const listChecklistsByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db.query("checklists").withIndex("by_tripId", (q) => q.eq("tripId", args.tripId)).collect();
  },
});

export const addChecklist = mutation({
  args: {
    tripId: v.id("trips"),
    text: v.string(),
    link: v.optional(v.string()),
    assignee: v.optional(v.string()),
    assignees: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("checklists", { ...args, completed: false, createdAt: Date.now() });
  },
});

export const updateChecklist = mutation({
  args: {
    checklistId: v.id("checklists"),
    text: v.optional(v.string()),
    link: v.optional(v.string()),
    assignee: v.optional(v.string()),
    assignees: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { checklistId, ...fields } = args;
    await ctx.db.patch(checklistId, fields);
  },
});

export const toggleChecklist = mutation({
  args: { checklistId: v.id("checklists"), completed: v.boolean() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.checklistId);
    if (!item) return;
    
    // 전체 체크를 하면 모든 담당자를 completedBy에 일괄 넣거나 뺌
    const newCompletedBy = args.completed ? (item.assignees || []) : [];
    await ctx.db.patch(args.checklistId, { 
      completed: args.completed,
      completedBy: newCompletedBy
    });
  },
});

export const toggleAssignee = mutation({
  args: { checklistId: v.id("checklists"), nickname: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.checklistId);
    if (!item) return;

    let completedBy = item.completedBy || [];
    if (completedBy.includes(args.nickname)) {
      completedBy = completedBy.filter(n => n !== args.nickname);
    } else {
      completedBy = [...completedBy, args.nickname];
    }

    const assignees = item.assignees || [];
    // 모든 담당자가 완료하면 전체 상태도 완료 처리
    const isAllCompleted = assignees.length > 0 && assignees.every(a => completedBy.includes(a));

    await ctx.db.patch(args.checklistId, { 
      completedBy, 
      completed: isAllCompleted 
    });
  },
});

export const removeChecklist = mutation({
  args: { checklistId: v.id("checklists") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.checklistId);
  },
});
