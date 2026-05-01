import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // [강제 리프레시용 주석] 유료 플랜 전환 후 동기화를 위해 추가됨
  // 여행 목록
  trips: defineTable({
    title: v.string(),
    destination: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    shareId: v.string(),
    currency: v.string(),
    coverEmoji: v.optional(v.string()),
    tripType: v.optional(v.string()), // 여행 테마 (Friends Trip 등)
    themeColor: v.optional(v.string()), // 헤더 테마 컬러 (hex 코드)
    createdAt: v.number(),
  }).index("by_shareId", ["shareId"]),

  // 참가자 닉네임
  participants: defineTable({
    tripId: v.id("trips"),
    nickname: v.string(),
    joinedAt: v.number(),
  }).index("by_tripId", ["tripId"]),

  // 항공편
  flights: defineTable({
    tripId: v.id("trips"),
    airline: v.string(),
    flightNumber: v.string(),
    departure: v.string(),        // 출발지
    arrival: v.string(),          // 도착지
    departureTime: v.string(),    // 출발 시간
    arrivalTime: v.string(),      // 도착 시간
    date: v.string(),
    type: v.string(),             // "outbound" | "return"
    imageStorageId: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_tripId", ["tripId"]),

  // 숙소
  accommodations: defineTable({
    tripId: v.id("trips"),
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),       // 호텔 전화번호
    checkIn: v.string(),
    checkOut: v.string(),
    confirmationNumber: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    notes: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_tripId", ["tripId"]),

  // 지도 장소
  places: defineTable({
    tripId: v.id("trips"),
    name: v.string(),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    mapLink: v.optional(v.string()),  // 지도 URL
    category: v.string(),             
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_tripId", ["tripId"]),

  // 체크리스트
  checklists: defineTable({
    tripId: v.id("trips"),
    text: v.string(),
    link: v.optional(v.string()),
    completed: v.boolean(),
    assignee: v.optional(v.string()),            // 단일 담당자 (하위호환)
    assignees: v.optional(v.array(v.string())),  // 다중 담당자 닉네임 목록
    completedBy: v.optional(v.array(v.string())), // 개별 담당자 완료 여부 추적
    createdAt: v.number(),
  }).index("by_tripId", ["tripId"]),

  // 지출 내역
  expenses: defineTable({
    tripId: v.id("trips"),
    title: v.string(),            // 항목 이름 (예: 스시 저녁)
    amount: v.number(),           // 원래 금액
    currency: v.string(),         // 통화 코드 (JPY, USD 등)
    exchangeRate: v.number(),     // KRW 환율 (수동 or 자동)
    amountKRW: v.number(),        // 한화 환산 금액
    date: v.string(),
    paidBy: v.string(),           // 결제한 참가자 닉네임
    splitWith: v.array(v.string()), // 나눌 참가자 닉네임 목록
    splitAmounts: v.optional(v.array(v.object({ nickname: v.string(), amount: v.number() }))), // 개별 금액
    imageStorageId: v.optional(v.string()),
    category: v.string(),         // "food" | "transport" | "accommodation" | "activity" | "other"
    createdAt: v.number(),
  }).index("by_tripId", ["tripId"]),

  // ─── 일정 DAY (DAY 1, DAY 2 ...) ─────────────────────────
  itineraryDays: defineTable({
    tripId: v.id("trips"),
    dayNumber: v.number(),          // 1, 2, 3 ...
    date: v.string(),               // "2026-06-13"
    title: v.optional(v.string()),  // "오사카 도착일" 등 선택적 제목
    createdAt: v.number(),
  }).index("by_tripId", ["tripId"]),

  // ─── 일정 내 개별 항목 (장소/메모) ────────────────────────
  itineraryItems: defineTable({
    dayId: v.id("itineraryDays"),
    tripId: v.id("trips"),
    orderIndex: v.number(),           // 정렬 순서
    type: v.string(),                 // "place" | "memo"
    // 장소 관련
    placeName: v.optional(v.string()),
    placeCategory: v.optional(v.string()),
    placeAddress: v.optional(v.string()),
    placeLat: v.optional(v.number()),
    placeLng: v.optional(v.number()),
    placeMapLink: v.optional(v.string()),
    // 메모 관련
    memo: v.optional(v.string()),
    // 공통
    time: v.optional(v.string()),                 // "10:00"
    photos: v.optional(v.array(v.string())),      // Convex Storage ID 배열 (최대 5개)
    createdAt: v.number(),
  }).index("by_dayId", ["dayId"]).index("by_tripId", ["tripId"]),

  // ─── 사진/항목별 댓글 ─────────────────────────────────────
  itineraryComments: defineTable({
    itemId: v.id("itineraryItems"),
    photoId: v.string(),            // 어떤 사진에 달린 댓글인지 식별 (Storage ID)
    tripId: v.id("trips"),
    nickname: v.string(),           // 작성자 닉네임
    text: v.string(),               // 댓글 내용
    createdAt: v.number(),
  }).index("by_itemId", ["itemId"]).index("by_photoId", ["photoId"]).index("by_tripId", ["tripId"]),
});
