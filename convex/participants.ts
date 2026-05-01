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

export const updateNickname = mutation({
  args: { tripId: v.id("trips"), oldNickname: v.string(), newNickname: v.string() },
  handler: async (ctx, args) => {
    // 1. 참여자 레코드 갱신
    const p = await ctx.db.query("participants")
      .withIndex("by_tripId", q => q.eq("tripId", args.tripId))
      .filter(q => q.eq(q.field("nickname"), args.oldNickname)).first();
    
    if (p) {
      await ctx.db.patch(p._id, { nickname: args.newNickname });
    } else {
      await ctx.db.insert("participants", { tripId: args.tripId, nickname: args.newNickname, joinedAt: Date.now() });
    }

    // 2. 체크리스트 연동 업데이트
    try {
      const checklists = await ctx.db.query("checklists").withIndex("by_tripId", q => q.eq("tripId", args.tripId)).collect();
      for (const c of checklists) {
        let changed = false;
        const updates: any = {};
        if (c.assignee === args.oldNickname) { updates.assignee = args.newNickname; changed = true; }
        if (Array.isArray(c.assignees) && c.assignees.includes(args.oldNickname)) {
          updates.assignees = c.assignees.map((a: any) => a === args.oldNickname ? args.newNickname : a);
          changed = true;
        }
        if (Array.isArray(c.completedBy) && c.completedBy.includes(args.oldNickname)) {
          updates.completedBy = c.completedBy.map((a: any) => a === args.oldNickname ? args.newNickname : a);
          changed = true;
        }
        if (changed) await ctx.db.patch(c._id, updates);
      }
    } catch (e) { console.error("Checklist sync failed", e); }

    // 3. 지출 내역 연동 업데이트
    try {
      const expenses = await ctx.db.query("expenses").withIndex("by_tripId", q => q.eq("tripId", args.tripId)).collect();
      for (const e of expenses) {
        let changed = false;
        const updates: any = {};
        if (e.paidBy === args.oldNickname) { updates.paidBy = args.newNickname; changed = true; }
        if (Array.isArray(e.splitWith) && e.splitWith.includes(args.oldNickname)) {
          updates.splitWith = e.splitWith.map((a: any) => a === args.oldNickname ? args.newNickname : a);
          changed = true;
        }
        if (Array.isArray(e.splitAmounts)) {
          updates.splitAmounts = e.splitAmounts.map((sa: any) => 
            (sa && sa.nickname === args.oldNickname) ? { ...sa, nickname: args.newNickname } : sa
          );
          changed = true;
        }
        if (changed) await ctx.db.patch(e._id, updates);
      }
    } catch (e) { console.error("Expense sync failed", e); }

    // 4. 일정 댓글 연동 업데이트
    try {
      const comments = await ctx.db.query("itineraryComments")
        .withIndex("by_tripId", q => q.eq("tripId", args.tripId))
        .collect();
      for (const c of comments) {
        if (c.nickname === args.oldNickname) {
          await ctx.db.patch(c._id, { nickname: args.newNickname });
        }
      }
    } catch (e) { console.error("Comment sync failed", e); }
  }
});
