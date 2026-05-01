import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════
// 일정 DAY CRUD
// ═══════════════════════════════════════════════════════════

// 여행의 모든 DAY 조회 (dayNumber 순)
export const listDaysByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    const days = await ctx.db
      .query("itineraryDays")
      .withIndex("by_tripId", (q) => q.eq("tripId", args.tripId))
      .collect();
    return days.sort((a, b) => a.dayNumber - b.dayNumber);
  },
});

// DAY 추가
export const addDay = mutation({
  args: {
    tripId: v.id("trips"),
    dayNumber: v.number(),
    date: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("itineraryDays", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// DAY 제목 수정
export const updateDay = mutation({
  args: {
    dayId: v.id("itineraryDays"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { dayId, ...fields } = args;
    await ctx.db.patch(dayId, fields);
  },
});

// DAY 삭제 (하위 항목 + 댓글 일괄 삭제)
export const removeDay = mutation({
  args: { dayId: v.id("itineraryDays") },
  handler: async (ctx, args) => {
    // 하위 항목들 조회
    const items = await ctx.db
      .query("itineraryItems")
      .withIndex("by_dayId", (q) => q.eq("dayId", args.dayId))
      .collect();

    // 각 항목의 댓글 삭제 + 사진 스토리지 삭제
    for (const item of items) {
      const comments = await ctx.db
        .query("itineraryComments")
        .withIndex("by_itemId", (q) => q.eq("itemId", item._id))
        .collect();
      for (const comment of comments) {
        await ctx.db.delete(comment._id);
      }
      // 사진 스토리지 파일 삭제
      if (item.photos) {
        for (const storageId of item.photos) {
          try {
            await ctx.storage.delete(storageId as any);
          } catch (e) {
            // 이미 삭제된 파일은 무시
          }
        }
      }
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.dayId);
  },
});

// ═══════════════════════════════════════════════════════════
// 일정 항목 CRUD
// ═══════════════════════════════════════════════════════════

// 특정 DAY의 항목들 조회 (orderIndex 순)
export const listItemsByDay = query({
  args: { dayId: v.id("itineraryDays") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("itineraryItems")
      .withIndex("by_dayId", (q) => q.eq("dayId", args.dayId))
      .collect();
    return items.sort((a, b) => a.orderIndex - b.orderIndex);
  },
});

// 여행의 전체 항목 조회
export const listItemsByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("itineraryItems")
      .withIndex("by_tripId", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

// 항목 추가 (장소 또는 메모)
export const addItem = mutation({
  args: {
    dayId: v.id("itineraryDays"),
    tripId: v.id("trips"),
    orderIndex: v.number(),
    type: v.string(),
    placeName: v.optional(v.string()),
    placeCategory: v.optional(v.string()),
    placeAddress: v.optional(v.string()),
    placeLat: v.optional(v.number()),
    placeLng: v.optional(v.number()),
    placeMapLink: v.optional(v.string()),
    memo: v.optional(v.string()),
    time: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("itineraryItems", {
      ...args,
      photos: [],
      createdAt: Date.now(),
    });
  },
});

// 항목 수정
export const updateItem = mutation({
  args: {
    itemId: v.id("itineraryItems"),
    placeName: v.optional(v.string()),
    placeCategory: v.optional(v.string()),
    placeAddress: v.optional(v.string()),
    placeLat: v.optional(v.number()),
    placeLng: v.optional(v.number()),
    placeMapLink: v.optional(v.string()),
    memo: v.optional(v.string()),
    time: v.optional(v.string()),
    photos: v.optional(v.array(v.string())),
    orderIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { itemId, ...fields } = args;
    // undefined 값 제거
    const clean: Record<string, any> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(itemId, clean);
  },
});

// 두 항목의 순서 교체 (Atomic Swap)
export const swapItems = mutation({
  args: {
    itemAId: v.id("itineraryItems"),
    itemBId: v.id("itineraryItems"),
  },
  handler: async (ctx, args) => {
    const itemA = await ctx.db.get(args.itemAId);
    const itemB = await ctx.db.get(args.itemBId);
    if (!itemA || !itemB) return;
    
    const tempIndex = itemA.orderIndex;
    await ctx.db.patch(args.itemAId, { orderIndex: itemB.orderIndex });
    await ctx.db.patch(args.itemBId, { orderIndex: tempIndex });
  },
});

// 사진 하나 삭제 (사진에 달린 댓글도 함께 삭제)
export const removePhoto = mutation({
  args: { 
    itemId: v.id("itineraryItems"),
    storageId: v.string() 
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) return;

    // item.photos 배열에서 해당 storageId 제거
    const newPhotos = (item.photos || []).filter((id: string) => id !== args.storageId);
    await ctx.db.patch(args.itemId, { photos: newPhotos });

    // 해당 사진의 댓글 삭제
    const comments = await ctx.db
      .query("itineraryComments")
      .withIndex("by_photoId", (q) => q.eq("photoId", args.storageId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // 스토리지 파일 삭제
    try {
      await ctx.storage.delete(args.storageId as any);
    } catch (e) {
      // 이미 삭제되었을 수 있음
    }
  },
});

// 항목 삭제 (하위 댓글 + 사진 삭제)
export const removeItem = mutation({
  args: { itemId: v.id("itineraryItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);

    // 댓글 삭제
    const comments = await ctx.db
      .query("itineraryComments")
      .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // 사진 스토리지 삭제
    if (item?.photos) {
      for (const storageId of item.photos) {
        try {
          await ctx.storage.delete(storageId as any);
        } catch (e) {
          // 이미 삭제된 파일은 무시
        }
      }
    }

    await ctx.db.delete(args.itemId);
  },
});

// ═══════════════════════════════════════════════════════════
// 파일 업로드 (Convex Storage)
// ═══════════════════════════════════════════════════════════

// 업로드 URL 생성
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Storage ID → URL 변환
export const getPhotoUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId as any);
  },
});

// 여러 사진 URL 일괄 조회
export const getPhotoUrls = query({
  args: { storageIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const urls: Record<string, string | null> = {};
    for (const id of args.storageIds) {
      urls[id] = await ctx.storage.getUrl(id as any);
    }
    return urls;
  },
});

// ═══════════════════════════════════════════════════════════
// 댓글 CRUD (사진별)
// ═══════════════════════════════════════════════════════════

// 특정 사진의 댓글 조회
export const listCommentsByPhoto = query({
  args: { photoId: v.string() },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("itineraryComments")
      .withIndex("by_photoId", (q) => q.eq("photoId", args.photoId))
      .collect();
    return comments.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// 특정 아이템의 모든 댓글 조회 (사진 썸네일에 뱃지 표시용)
export const listCommentsByItem = query({
  args: { itemId: v.id("itineraryItems") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("itineraryComments")
      .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
      .collect();
    return comments;
  },
});

// 댓글 추가
export const addComment = mutation({
  args: {
    itemId: v.id("itineraryItems"),
    photoId: v.string(),
    tripId: v.id("trips"),
    nickname: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("itineraryComments", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// 댓글 삭제
export const removeComment = mutation({
  args: { commentId: v.id("itineraryComments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.commentId);
  },
});
