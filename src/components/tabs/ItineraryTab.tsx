"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import ItineraryPhotos from "./ItineraryPhotos";
import ItineraryComments from "./ItineraryComments";

const CATEGORIES = [
  { id: "food", label: "음식", emoji: "🍜" },
  { id: "cafe", label: "카페", emoji: "☕" },
  { id: "dessert", label: "디저트", emoji: "🍰" },
  { id: "bar", label: "술집", emoji: "🍻" },
  { id: "massage", label: "마사지", emoji: "💆" },
  { id: "attraction", label: "관광", emoji: "🏛️" },
  { id: "shopping", label: "쇼핑", emoji: "🛍️" },
  { id: "transport", label: "교통", emoji: "🚌" },
  { id: "accommodation", label: "숙소", emoji: "🏨" },
  { id: "other", label: "기타", emoji: "📌" },
];

// 구글 인코딩 폴리라인 디코딩 (표준 알고리즘, 외부 라이브러리 불필요)
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// 두 지점 사이의 거리(m) - 작은 규모(도보 경로)에서 충분히 정확한 haversine 공식
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 현재 위치에서 각 구간(step)까지의 수직 거리 - 가장 가까운 구간을 "현재 구간"으로 판단하는 데 사용
// (작은 규모의 도보 경로이므로 위도 기준 평면 근사로 충분)
function distanceToSegmentMeters(p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const cosLat = Math.cos(a.lat * Math.PI / 180);
  const toXY = (pt: { lat: number; lng: number }) => ({ x: (pt.lng - a.lng) * cosLat, y: pt.lat - a.lat });
  const A = toXY(a), B = toXY(b), P = toXY(p);
  const dx = B.x - A.x, dy = B.y - A.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closest = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
  return haversineMeters(p, closest);
}

// 내비게이션 안내 유형(maneuver) -> 한국어 라벨 + 화살표 회전각
const MANEUVER_INFO: Record<string, { label: string; rotation: number }> = {
  DEPART: { label: "출발", rotation: 0 },
  STRAIGHT: { label: "직진", rotation: 0 },
  TURN_SLIGHT_LEFT: { label: "완만한 좌회전", rotation: -30 },
  TURN_LEFT: { label: "왼쪽 방향", rotation: -90 },
  TURN_SHARP_LEFT: { label: "급좌회전", rotation: -120 },
  TURN_SLIGHT_RIGHT: { label: "완만한 우회전", rotation: 30 },
  TURN_RIGHT: { label: "오른쪽 방향", rotation: 90 },
  TURN_SHARP_RIGHT: { label: "급우회전", rotation: 120 },
  U_TURN_LEFT: { label: "유턴", rotation: 180 },
  U_TURN_RIGHT: { label: "유턴", rotation: 180 },
  FORK_LEFT: { label: "왼쪽 갈림길", rotation: -45 },
  FORK_RIGHT: { label: "오른쪽 갈림길", rotation: 45 },
  MERGE: { label: "합류", rotation: 0 },
  ROUNDABOUT_LEFT: { label: "회전교차로 (좌측)", rotation: -45 },
  ROUNDABOUT_RIGHT: { label: "회전교차로 (우측)", rotation: 45 },
  ARRIVE: { label: "목적지 도착", rotation: 0 },
  ARRIVE_LEFT: { label: "목적지 도착 (좌측)", rotation: 0 },
  ARRIVE_RIGHT: { label: "목적지 도착 (우측)", rotation: 0 },
  UNKNOWN_MANEUVER: { label: "직진", rotation: 0 },
};

// 10점 만점 별점 위젯 (별 10개, 0.5점 단위). 탭 한 번으로 바로 선택되고,
// 별 위를 눌러서 드래그하면 손가락을 뗄 때까지 미리보기가 따라오는, 리뷰 앱에서 흔히 쓰는 "드래그로 선택" 방식.
function StarRating({ score, onChange, size = 16, readOnly = false }: { score: number; onChange?: (score: number) => void; size?: number; readOnly?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragScore, setDragScore] = useState<number | null>(null);
  const displayScore = dragScore !== null ? dragScore : score;

  function scoreFromClientX(clientX: number): number | null {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    const raw = ((clientX - rect.left) / rect.width) * 10;
    const stepped = Math.round(raw * 2) / 2; // 0.5점 단위로 반올림
    return Math.max(0.5, Math.min(10, stepped));
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (readOnly || !onChange) return;
    const s = scoreFromClientX(e.clientX);
    if (s !== null) setDragScore(s);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (readOnly || !onChange || dragScore === null) return;
    const s = scoreFromClientX(e.clientX);
    if (s !== null) setDragScore(s);
  }
  function handlePointerUp() {
    if (readOnly || !onChange || dragScore === null) return;
    onChange(dragScore);
    setDragScore(null);
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragScore(null)}
      style={{ display: "inline-flex", gap: 1, touchAction: readOnly ? undefined : "none", cursor: readOnly ? "default" : "pointer" }}>
      {Array.from({ length: 10 }, (_, idx) => idx + 1).map((i) => {
        const fillPct = Math.max(0, Math.min(1, displayScore - (i - 1))) * 100; // 0% / 50% / 100%
        return (
          <div key={i} style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="rgba(0,0,0,0.12)" />
            </svg>
            <div style={{ position: "absolute", top: 0, left: 0, width: `${fillPct}%`, height: size, overflow: "hidden", pointerEvents: "none" }}>
              <svg width={size} height={size} viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="var(--warning)" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 일정 항목의 별점 영역: 평소엔 숫자 평점만 보여주다가, 탭하면 큰 별 10개가 펼쳐져서 쉽게 매길 수 있음
function ItemRating({ item, nickname, onRate }: { item: any; nickname: string; onRate: (item: any, score: number) => void }) {
  const [editing, setEditing] = useState(false);
  const myScore = item.ratings?.find((r: any) => r.nickname === nickname)?.score ?? 0;
  const others = (item.ratings || []).filter((r: any) => r.nickname !== nickname);

  function handleChange(score: number) {
    onRate(item, score);
    setEditing(false);
  }

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      {editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StarRating score={myScore} onChange={handleChange} size={26} />
          <button onClick={() => setEditing(false)} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.7rem", flexShrink: 0 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, background: myScore > 0 ? "rgba(245,158,11,0.1)" : "rgba(0,0,0,0.04)", border: "none", borderRadius: 999, padding: "4px 10px", cursor: "pointer", fontSize: "0.76rem", fontWeight: 700, color: myScore > 0 ? "var(--warning)" : "var(--text-muted)" }}>
          {myScore > 0 ? `⭐ ${myScore.toFixed(1)}` : "별점 매기기"}
        </button>
      )}
      {others.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 2 }}>
          {others.map((r: any) => (
            <span key={r.nickname} style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>{r.nickname} ⭐{r.score.toFixed(1)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function getDaysBetween(start: string, end: string) {
  const days: { dayNumber: number; date: string; weekday: string }[] = [];
  const s = new Date(start);
  const e = new Date(end);
  let n = 1;
  while (s <= e) {
    const dateStr = s.toISOString().split("T")[0];
    const weekday = s.toLocaleDateString("ko-KR", { weekday: "short" });
    days.push({ dayNumber: n, date: dateStr, weekday });
    s.setDate(s.getDate() + 1);
    n++;
  }
  return days;
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isPM = value ? parseInt(value.split(":")[0]) >= 12 : false;
  const ampm = value ? (isPM ? "PM" : "AM") : "PM";
  let h = value ? parseInt(value.split(":")[0]) : 12;
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  const m = value ? value.split(":")[1] : "00";

  const handleChange = (newAmpm: string, newH: number, newM: string) => {
    let hour = newH;
    if (newAmpm === "PM" && hour < 12) hour += 12;
    if (newAmpm === "AM" && hour === 12) hour = 0;
    onChange(`${hour.toString().padStart(2, "0")}:${newM}`);
  };

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <select className="input" style={{ width: "auto", padding: "3px 6px", fontSize: "0.78rem" }} value={ampm} onChange={e => handleChange(e.target.value, h, m)}>
        <option value="AM">오전</option>
        <option value="PM">오후</option>
      </select>
      <select className="input" style={{ width: "auto", padding: "3px 6px", fontSize: "0.78rem" }} value={h} onChange={e => handleChange(ampm, parseInt(e.target.value), m)}>
        {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => <option key={num} value={num}>{num}</option>)}
      </select>
      <span>:</span>
      <select className="input" style={{ width: "auto", padding: "3px 6px", fontSize: "0.78rem" }} value={m} onChange={e => handleChange(ampm, h, e.target.value)}>
        {["00","10","20","30","40","50"].map(num => <option key={num} value={num}>{num}</option>)}
      </select>
    </div>
  );
}

export default function ItineraryTab({ trip, nickname }: { trip: any; nickname: string }) {
  const days = useQuery(api.itinerary.listDaysByTrip, { tripId: trip._id });
  const allItems = useQuery(api.itinerary.listItemsByTrip, { tripId: trip._id });
  const savedPlaces = useQuery(api.places.listPlacesByTrip, { tripId: trip._id });
  const accommodations = useQuery(api.accommodations.listByTrip, { tripId: trip._id });
  const addDay = useMutation(api.itinerary.addDay);
  const removeDay = useMutation(api.itinerary.removeDay);
  const updateDay = useMutation(api.itinerary.updateDay);
  const addItem = useMutation(api.itinerary.addItem);
  const updateItem = useMutation(api.itinerary.updateItem);
  const removeItem = useMutation(api.itinerary.removeItem);
  const rateItem = useMutation(api.itinerary.rateItem);
  const addPlace = useMutation(api.places.addPlace);

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [focusedDayId, setFocusedDayId] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<any>(null);
  const [dragOverItem, setDragOverItem] = useState<any>(null);
  const [reorderItem, setReorderItem] = useState<string | null>(null);
  const [showPlaceModal, setShowPlaceModal] = useState<string | null>(null);
  const [placeForm, setPlaceForm] = useState({ name: "", category: "attraction", address: "", time: "", lat: undefined as number|undefined, lng: undefined as number|undefined });
  const [placeTab, setPlaceTab] = useState<"saved" | "search">("saved");
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [editTimeVal, setEditTimeVal] = useState("");
  const [editPlaceModal, setEditPlaceModal] = useState<any | null>(null);
  const [editingPlace, setEditingPlace] = useState<string | null>(null);
  const [editPlaceForm, setEditPlaceForm] = useState({ name: "", category: "attraction" });
  const [saving, setSaving] = useState(false);
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRefs = useRef<any[]>([]);
  const myLocationMarkerRef = useRef<any>(null);
  const lastPosRef = useRef<{lat: number, lng: number} | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [navLoadingDayId, setNavLoadingDayId] = useState<string | null>(null);
  const [navError, setNavError] = useState("");
  const [navData, setNavData] = useState<{
    day: any; dayLabel: string; places: any[]; path: { lat: number; lng: number }[];
    distanceMeters?: number; durationSeconds?: number;
    steps: { maneuver: string; instruction: string; distanceMeters: number; durationSeconds: number; start: { lat: number; lng: number }; end: { lat: number; lng: number } }[];
  } | null>(null);
  const navMapRef = useRef<HTMLDivElement>(null);
  const navMapInstanceRef = useRef<any>(null);
  const navWatchIdRef = useRef<number | null>(null);
  const navMeMarkerRef = useRef<any>(null);
  const [elevationPoints, setElevationPoints] = useState<{ elevation: number; lat: number; lng: number }[]>([]);
  const [navProgress, setNavProgress] = useState<{ stepIdx: number; remainingDistanceM: number; remainingDurationS: number } | null>(null);
  const [navAutoFollow, setNavAutoFollow] = useState(true);
  const navAutoFollowRef = useRef(true);
  useEffect(() => { navAutoFollowRef.current = navAutoFollow; }, [navAutoFollow]);
  const [navMapType, setNavMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [navHeadingMode, setNavHeadingMode] = useState(false);
  const [navHeading, setNavHeading] = useState(0);
  const navHeadingListenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const tripDays = useMemo(() => getDaysBetween(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const existingDayNumbers = useMemo(() => new Set(days?.map(d => d.dayNumber) || []), [days]);

  const combinedSavedPlaces = useMemo(() => {
    const list: any[] = [];
    if (accommodations) {
      accommodations.forEach(a => list.push({
        _id: a._id,
        name: a.name,
        address: a.address,
        lat: a.lat,
        lng: a.lng,
        category: "accommodation" // 숙소용 카테고리로 매핑
      }));
    }
    if (savedPlaces) {
      savedPlaces.forEach(p => list.push(p));
    }
    return list;
  }, [savedPlaces, accommodations]);

  // DAY 자동 생성
  useEffect(() => {
    if (days !== undefined && days.length === 0 && tripDays.length > 0 && !saving && !hasAutoGenerated) {
      setHasAutoGenerated(true);
      handleGenerateAllDays();
    }
  }, [days, tripDays.length, saving, hasAutoGenerated]);

  // 첫 번째 DAY 자동 확장
  useEffect(() => {
    if (days && days.length > 0 && expandedDays.size === 0 && !focusedDayId) {
      setExpandedDays(new Set([days[0]._id]));
    }
  }, [days]);

  // 구글 맵 초기화 및 장소 검색 자동완성
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    const scriptId = "google-maps-api";

    function initMapAndAutocomplete() {
      const google = (window as any).google;
      if (!google?.maps) return;

      // 1. 일정 상단 지도 초기화
      if (mapRef.current && !mapInstance) {
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 37.5, lng: 127 },
          zoom: 12,
          gestureHandling: "greedy",
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
        });
        setMapInstance(map);
      }

      // 2. 모달 내 장소 검색 자동완성
      if ((showPlaceModal && placeTab === "search" || editPlaceModal) && searchInputRef.current) {
        if (google.maps.places) {
          const ac = new google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ["name", "formatted_address", "geometry"]
          });
          ac.addListener("place_changed", () => {
            const place = ac.getPlace();
            if (!place.geometry || !place.geometry.location) return;
            setPlaceForm(f => ({
              ...f,
              name: place.name || f.name,
              address: place.formatted_address || f.address,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            }));
          });
        }
      }
    }

    if ((window as any).google?.maps) {
      initMapAndAutocomplete();
    } else {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.addEventListener("load", initMapAndAutocomplete);
      } else {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.onload = initMapAndAutocomplete;
        document.head.appendChild(script);
      }
    }
  }, [showPlaceModal, placeTab, editPlaceModal, mapInstance, days]);

  // 내 위치 실시간 추적 (일정 탭 지도용)
  useEffect(() => {
    if (!mapInstance || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      lastPosRef.current = { lat, lng };
      const google = (window as any).google;
      if (!google?.maps) return;

      if (!myLocationMarkerRef.current) {
        myLocationMarkerRef.current = new google.maps.Marker({
          position: { lat, lng },
          map: mapInstance,
          title: "내 위치",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#4285F4",
            fillOpacity: 1,
            scale: 8,
            strokeColor: "white",
            strokeWeight: 2,
          },
          zIndex: 999
        });
      } else {
        myLocationMarkerRef.current.setPosition({ lat, lng });
      }
    }, (err) => console.warn("GPS watch failed", err), { enableHighAccuracy: true });

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (myLocationMarkerRef.current) {
        myLocationMarkerRef.current.setMap(null);
        myLocationMarkerRef.current = null;
      }
    };
  }, [mapInstance]);

  // 지도 마커 및 경로 렌더링
  useEffect(() => {
    if (!mapInstance || allItems === undefined || days === undefined) return;
    const google = (window as any).google;

    // 기존 마커 및 선 지우기
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    polylineRefs.current.forEach(p => p.setMap(null));
    polylineRefs.current = [];

    if (days.length === 0) return;

    // 확장된 모든 DAY + 현재 포커스된 DAY의 장소를 지도에 표시 (모두 닫혀있다면 1일차 표시)
    let targetDayIdsArray = Array.from(expandedDays);
    if (focusedDayId && !targetDayIdsArray.includes(focusedDayId)) {
      targetDayIdsArray.push(focusedDayId);
    }
    const targetDayIds = targetDayIdsArray.length > 0 ? targetDayIdsArray : (days.length > 0 ? [days[0]._id] : []);

    const bounds = new google.maps.LatLngBounds();
    const focusBounds = new google.maps.LatLngBounds();
    const path: any[] = [];
    let placeCount = 0;
    let focusPlaceCount = 0;

    // 날짜 순서대로 정렬해서 경로 그리기
    const sortedTargetDays = targetDayIds.sort((a: any, b: any) => {
      const dayA = days.find(d => d._id === a)?.dayNumber || 0;
      const dayB = days.find(d => d._id === b)?.dayNumber || 0;
      return dayA - dayB;
    });

    sortedTargetDays.forEach((dayId) => {
      const dayItems = (allItems || []).filter((it: any) => it.dayId === dayId).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
      const places = dayItems.filter((it: any) => it.type === "place" && it.placeLat && it.placeLng);
      const dayPath: any[] = [];
      
      places.forEach((p: any, idx: number) => {
        placeCount++;
        const pos = { lat: p.placeLat, lng: p.placeLng };
        dayPath.push(pos);
        bounds.extend(pos);
        if (dayId === focusedDayId) {
          focusBounds.extend(pos);
          focusPlaceCount++;
        }

        const marker = new google.maps.Marker({
          position: pos,
          map: mapInstance,
          label: { text: (idx + 1).toString(), color: "white", fontWeight: "bold", fontSize: "12px" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#6366f1",
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: 2,
            scale: 12
          }
        });
        markersRef.current.push(marker);
      });

      // 날짜별 개별 경로 그리기 (날짜 간 연결되지 않도록)
      if (dayPath.length > 1) {
        const poly = new google.maps.Polyline({
          path: dayPath,
          geodesic: true,
          strokeColor: "#6366f1",
          strokeOpacity: 0.8,
          strokeWeight: 3,
          icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW }, offset: "50%" }],
          map: mapInstance
        });
        polylineRefs.current.push(poly);
      }
    });

    if (placeCount === 0) return;

    if (focusPlaceCount > 0) {
      if (focusPlaceCount === 1) {
        mapInstance.setCenter({ lat: focusBounds.getNorthEast().lat(), lng: focusBounds.getNorthEast().lng() });
        mapInstance.setZoom(15);
      } else {
        mapInstance.fitBounds(focusBounds);
        const listener = google.maps.event.addListener(mapInstance, "idle", () => {
          if (mapInstance.getZoom() > 15) mapInstance.setZoom(15);
          google.maps.event.removeListener(listener);
        });
      }
    } else {
      mapInstance.fitBounds(bounds);
      const listener = google.maps.event.addListener(mapInstance, "idle", () => {
        if (mapInstance.getZoom() > 15) mapInstance.setZoom(15);
        google.maps.event.removeListener(listener);
      });
    }
  }, [mapInstance, allItems, expandedDays, days, focusedDayId]);

  // 내비게이션 모드 시작: 경로(Routes API)를 가져와서 전체화면 내비게이션 뷰를 띄움
  async function handleStartNavigation(day: any) {
    const dayPlaces = (allItems || [])
      .filter((it: any) => it.dayId === day._id && it.type === "place" && it.placeLat && it.placeLng)
      .sort((a: any, b: any) => a.orderIndex - b.orderIndex);

    if (dayPlaces.length < 2) return;

    setNavLoadingDayId(day._id);
    setNavError("");
    try {
      const res = await fetch("/api/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: dayPlaces[0].placeLat, lng: dayPlaces[0].placeLng },
          destination: { lat: dayPlaces[dayPlaces.length - 1].placeLat, lng: dayPlaces[dayPlaces.length - 1].placeLng },
          waypoints: dayPlaces.slice(1, -1).map((p: any) => ({ lat: p.placeLat, lng: p.placeLng })),
        }),
      });
      const data = await res.json();
      if (!data.ok || !data.encodedPolyline) {
        setNavError(data.error || "경로를 불러오지 못했습니다.");
        return;
      }
      setNavAutoFollow(true);
      setNavProgress(data.steps?.length ? { stepIdx: 0, remainingDistanceM: data.distanceMeters || 0, remainingDurationS: data.durationSeconds || 0 } : null);
      setNavData({
        day,
        dayLabel: `DAY ${day.dayNumber}`,
        places: dayPlaces,
        path: decodePolyline(data.encodedPolyline),
        distanceMeters: data.distanceMeters,
        durationSeconds: data.durationSeconds,
        steps: data.steps || [],
      });

      // 고도 그래프용 데이터는 별도로 비동기 조회 (실패해도 내비게이션 자체에는 영향 없음)
      setElevationPoints([]);
      fetch(`/api/elevation?polyline=${encodeURIComponent(data.encodedPolyline)}&samples=40`)
        .then(r => r.json())
        .then(elev => { if (elev.ok) setElevationPoints(elev.points); })
        .catch(() => {});
    } catch (e) {
      console.warn("도보 경로 요청 실패:", e);
      setNavError("경로를 불러오지 못했습니다.");
    } finally {
      setNavLoadingDayId(null);
    }
  }

  function handleCloseNavigation() {
    if (navWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(navWatchIdRef.current);
      navWatchIdRef.current = null;
    }
    if (navHeadingListenerRef.current) {
      window.removeEventListener("deviceorientation", navHeadingListenerRef.current);
      navHeadingListenerRef.current = null;
    }
    navMapInstanceRef.current = null;
    navMeMarkerRef.current = null;
    setNavData(null);
    setElevationPoints([]);
    setNavProgress(null);
    setNavHeadingMode(false);
    setNavHeading(0);
  }

  // 재조준 버튼: 평소엔 "나를 중심으로" 추적을 다시 켜고, 이미 추적 중일 때 한 번 더 누르면
  // 나침반 방향에 맞춰 지도 자체가 회전하는 "진행방향 모드"를 켬 (일반 내비게이션 앱과 동일한 동작)
  async function handleRecenterNavigation() {
    if (navAutoFollow && !navHeadingMode) {
      const DOE: any = (window as any).DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        try {
          const permission = await DOE.requestPermission();
          if (permission !== "granted") return;
        } catch {
          return;
        }
      }
      const handler = (e: any) => {
        const heading = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.alpha != null ? (360 - e.alpha) % 360 : null);
        if (heading != null && !isNaN(heading)) setNavHeading(heading);
      };
      navHeadingListenerRef.current = handler;
      window.addEventListener("deviceorientation", handler);
      setNavHeadingMode(true);
    } else {
      if (navHeadingListenerRef.current) {
        window.removeEventListener("deviceorientation", navHeadingListenerRef.current);
        navHeadingListenerRef.current = null;
      }
      setNavHeadingMode(false);
      setNavHeading(0);
      setNavAutoFollow(true);
      if (navMeMarkerRef.current && navMapInstanceRef.current) {
        navMapInstanceRef.current.panTo(navMeMarkerRef.current.getPosition());
      }
    }
  }

  function handleToggleNavMapType() {
    setNavMapType(prev => {
      const next = prev === "roadmap" ? "satellite" : "roadmap";
      navMapInstanceRef.current?.setMapTypeId(next);
      return next;
    });
  }

  // 내비게이션 전체화면 지도 초기화: 경로 + 장소 마커를 그리고, 내 실시간 위치를 계속 따라가며 중심을 맞춤
  useEffect(() => {
    if (!navData || !navMapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const map = new google.maps.Map(navMapRef.current, {
      center: navData.path[0] || { lat: navData.places[0].placeLat, lng: navData.places[0].placeLng },
      zoom: 17,
      gestureHandling: "greedy",
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      zoomControl: false,
      disableDefaultUI: true,
    });
    navMapInstanceRef.current = map;

    new google.maps.Polyline({
      path: navData.path, geodesic: true, strokeColor: "#f43f5e", strokeWeight: 6, strokeOpacity: 0.9, map,
    });

    navData.places.forEach((p: any, idx: number) => {
      new google.maps.Marker({
        position: { lat: p.placeLat, lng: p.placeLng },
        map,
        label: { text: (idx + 1).toString(), color: "#fff", fontWeight: "bold", fontSize: "12px" },
        icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: "#6366f1", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 13 },
        title: p.placeName,
      });
    });

    // 전체 경로가 다 보이도록 축소하지 않고, 실제 내비게이션처럼 내 위치 기준으로 가깝게 확대된 상태를 유지함 (zoom: 17)

    // 사용자가 직접 지도를 움직이면 "내가 중심" 자동 추적을 잠시 멈춤 (재조준 버튼으로 다시 켤 수 있음)
    const dragListener = google.maps.event.addListener(map, "dragstart", () => setNavAutoFollow(false));

    // 실시간 내 위치 추적: 움직일 때마다 파란 점을 갱신하고, 현재 구간(안내 배너)·남은 거리/시간을 갱신
    if (navigator.geolocation) {
      navWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!navMeMarkerRef.current) {
            navMeMarkerRef.current = new google.maps.Marker({
              position: me, map,
              icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: "#4285F4", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3, scale: 9 },
              zIndex: 999,
            });
          } else {
            navMeMarkerRef.current.setPosition(me);
          }
          if (navAutoFollowRef.current) map.panTo(me);

          // 현재 위치와 가장 가까운 구간을 "현재 안내 구간"으로 판단
          if (navData.steps.length > 0) {
            let bestIdx = 0, bestDist = Infinity;
            navData.steps.forEach((s, i) => {
              const d = distanceToSegmentMeters(me, s.start, s.end);
              if (d < bestDist) { bestDist = d; bestIdx = i; }
            });
            const current = navData.steps[bestIdx];
            const distToStepEnd = haversineMeters(me, current.end);
            const fracRemaining = current.distanceMeters > 0 ? Math.min(1, distToStepEnd / current.distanceMeters) : 0;
            let remainingDistanceM = distToStepEnd;
            let remainingDurationS = current.durationSeconds * fracRemaining;
            for (let i = bestIdx + 1; i < navData.steps.length; i++) {
              remainingDistanceM += navData.steps[i].distanceMeters;
              remainingDurationS += navData.steps[i].durationSeconds;
            }
            setNavProgress({ stepIdx: bestIdx, remainingDistanceM, remainingDurationS });
          }
        },
        (err) => console.warn("내비게이션 GPS 추적 실패", err),
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (navWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(navWatchIdRef.current);
        navWatchIdRef.current = null;
      }
      google.maps.event.removeListener(dragListener);
      navMeMarkerRef.current = null;
    };
  }, [navData]);

  function toggleDay(dayId: string) {
    setExpandedDays(prev => {
      const n = new Set(prev);
      if (n.has(dayId)) {
        n.delete(dayId);
      } else {
        n.add(dayId);
        setFocusedDayId(dayId);
      }
      return n;
    });
  }

  async function handleGenerateAllDays() {
    setSaving(true);
    for (const td of tripDays) {
      if (!existingDayNumbers.has(td.dayNumber)) {
        await addDay({ tripId: trip._id, dayNumber: td.dayNumber, date: td.date });
      }
    }
    setSaving(false);
  }

  function getItemsForDay(dayId: string) {
    return (allItems || []).filter((it: any) => it.dayId === dayId).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  }

  async function handleAddPlace(dayId: string) {
    if (!placeForm.name.trim()) return;
    setSaving(true);
    const items = getItemsForDay(dayId);
    let lat = placeForm.lat;
    let lng = placeForm.lng;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (apiKey && placeForm.name && (lat === undefined || lng === undefined)) {
      try {
        const q = encodeURIComponent(`${placeForm.name} ${placeForm.address || trip.destination}`);
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${apiKey}`);
        const data = await res.json();
        if (data.results?.[0]) {
          lat = data.results[0].geometry.location.lat;
          lng = data.results[0].geometry.location.lng;
        }
      } catch (e) { /* ignore */ }
    }
    
    await addItem({
      dayId: dayId as any, tripId: trip._id, orderIndex: items.length,
      type: "place", placeName: placeForm.name.trim(), placeCategory: placeForm.category,
      placeAddress: placeForm.address || undefined, placeLat: lat, placeLng: lng,
      time: placeForm.time || undefined,
    });

    // 일정에서 직접 입력한 신규 장소는 지도 탭에서도 보이도록 places 테이블에도 저장
    await addPlace({
      tripId: trip._id, name: placeForm.name.trim(), category: placeForm.category,
      address: placeForm.address || undefined, lat, lng,
    });

    setPlaceForm({ name: "", category: "attraction", address: "", time: "", lat: undefined, lng: undefined });
    setShowPlaceModal(null);
    setSaving(false);
  }

  async function handleAddSavedPlace(dayId: string, place: any) {
    const items = getItemsForDay(dayId);
    await addItem({
      dayId: dayId as any, tripId: trip._id, orderIndex: items.length,
      type: "place", placeName: place.name, placeCategory: place.category,
      placeAddress: place.address, placeLat: place.lat, placeLng: place.lng,
      placeMapLink: place.mapLink,
    });
    setShowPlaceModal(null);
  }

  async function handleSaveTime(itemId: string) {
    await updateItem({ itemId: itemId as any, time: editTimeVal || undefined });
    setEditingTime(null);
  }

  async function handleRate(item: any, score: number) {
    const current = item.ratings?.find((r: any) => r.nickname === nickname)?.score ?? 0;
    // 이미 선택된 값을 다시 누르면 평점 취소 (0점으로)
    await rateItem({ itemId: item._id, nickname, score: current === score ? 0 : score });
  }

  async function handleMoveItem(item: any, direction: "up" | "down", dayItems: any[]) {
    const idx = dayItems.findIndex((i: any) => i._id === item._id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= dayItems.length) return;
    const other = dayItems[swapIdx];
    await updateItem({ itemId: item._id, orderIndex: other.orderIndex });
    await updateItem({ itemId: other._id, orderIndex: item.orderIndex });
  }

  // 드래그 앤 드롭으로 순서 변경
  async function handleDragDrop(dayItems: any[]) {
    if (!dragItem || !dragOverItem || dragItem._id === dragOverItem._id) return;
    const dragIdx = dayItems.findIndex((i: any) => i._id === dragItem._id);
    const dropIdx = dayItems.findIndex((i: any) => i._id === dragOverItem._id);
    if (dragIdx < 0 || dropIdx < 0) return;
    await updateItem({ itemId: dragItem._id, orderIndex: dayItems[dropIdx].orderIndex });
    await updateItem({ itemId: dayItems[dropIdx]._id, orderIndex: dayItems[dragIdx].orderIndex });
    setDragItem(null);
    setDragOverItem(null);
  }

  async function moveItemUp(itemId: string, dayId: string) {
    const dayItems = (allItems || []).filter((it: any) => String(it.dayId) === String(dayId)).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
    const idx = dayItems.findIndex((i: any) => String(i._id) === String(itemId));
    if (idx > 0) {
      const current = dayItems[idx];
      const prev = dayItems[idx - 1];
      const targetOrder = prev.orderIndex - 0.001;
      await updateItem({ itemId: current._id, orderIndex: targetOrder });
    }
  }

  async function moveItemDown(itemId: string, dayId: string) {
    const dayItems = (allItems || []).filter((it: any) => String(it.dayId) === String(dayId)).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
    const idx = dayItems.findIndex((i: any) => String(i._id) === String(itemId));
    if (idx < dayItems.length - 1) {
      const current = dayItems[idx];
      const next = dayItems[idx + 1];
      const targetOrder = next.orderIndex + 0.001;
      await updateItem({ itemId: current._id, orderIndex: targetOrder });
    }
  }

  if (days === undefined || allItems === undefined) {
    return <div style={{ textAlign: "center", padding: 60 }}><span className="spinner" style={{ margin: "0 auto", width: 32, height: 32 }} /></div>;
  }

  // 내비게이션 전체화면용 파생 값: 현재 안내 구간, 남은 거리/시간, 도착 예정 시각, 고도 그래프 진행률
  const navCurrentStep = navData && navProgress ? navData.steps[navProgress.stepIdx] : null;
  const navManeuver = navCurrentStep ? (MANEUVER_INFO[navCurrentStep.maneuver] || MANEUVER_INFO.UNKNOWN_MANEUVER) : null;
  const navDistToTurn = navCurrentStep && navProgress
    ? (navProgress.stepIdx === navData!.steps.length - 1 ? navProgress.remainingDistanceM : navProgress.remainingDistanceM - navData!.steps.slice(navProgress.stepIdx + 1).reduce((s, st) => s + st.distanceMeters, 0))
    : 0;
  const navRemainingDistanceM = navProgress ? navProgress.remainingDistanceM : navData?.distanceMeters || 0;
  const navRemainingDurationS = navProgress ? navProgress.remainingDurationS : navData?.durationSeconds || 0;
  const navEtaLabel = (() => {
    const eta = new Date(Date.now() + navRemainingDurationS * 1000);
    return eta.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  })();
  const navProgressFraction = navData?.distanceMeters ? Math.max(0, Math.min(1, 1 - navRemainingDistanceM / navData.distanceMeters)) : 0;

  // 고도 그래프 좌표 계산 (SVG viewBox 320x70 기준)
  const ELEV_W = 320, ELEV_H = 70, ELEV_PAD = 6;
  let elevLinePoints: { x: number; y: number }[] = [];
  let elevMin = 0, elevMax = 0;
  if (elevationPoints.length > 1) {
    elevMin = Math.min(...elevationPoints.map(p => p.elevation));
    elevMax = Math.max(...elevationPoints.map(p => p.elevation));
    const range = Math.max(1, elevMax - elevMin);
    elevLinePoints = elevationPoints.map((p, i) => ({
      x: (i / (elevationPoints.length - 1)) * ELEV_W,
      y: ELEV_PAD + (1 - (p.elevation - elevMin) / range) * (ELEV_H - ELEV_PAD * 2),
    }));
  }
  const elevPathD = elevLinePoints.length ? "M" + elevLinePoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L") : "";
  const elevProgressX = navProgressFraction * ELEV_W;
  const elevProgressIdx = elevLinePoints.length ? Math.round(navProgressFraction * (elevLinePoints.length - 1)) : 0;
  const elevProgressY = elevLinePoints[elevProgressIdx]?.y ?? ELEV_H / 2;
  const elevTraveledPathD = elevLinePoints.length ? "M" + elevLinePoints.slice(0, elevProgressIdx + 1).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L") : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 텍스트와 지도를 포함하는 Sticky 컨테이너 */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", flexDirection: "column", gap: 12, background: "rgba(255,255,255,0.75)", backdropFilter: "blur(12px)", paddingTop: 16, paddingBottom: 16, margin: "0 -20px", paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.02em" }}>🗓️ 일정</h2>
        </div>

        {navError && (
          <div style={{ padding: "8px 14px", fontSize: "0.78rem", color: "var(--danger)", background: "rgba(248,113,113,0.1)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span>⚠️ {navError}</span>
            <button onClick={() => setNavError("")} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontWeight: 800 }}>✕</button>
          </div>
        )}

        {/* 상단 지도 영역 (경로 표시) */}
        <div style={{ position: "relative" }}>
        <div className="glass" style={{ borderRadius: 20, overflow: "hidden", height: isMapExpanded ? "70vh" : 200, transition: "height 0.4s cubic-bezier(0.4, 0, 0.2, 1)", flexShrink: 0, border: "2px solid rgba(0,0,0,0.08)", position: "relative" }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
          {!mapInstance && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              지도를 불러오는 중이거나 일정이 없습니다
            </div>
          )}
          {/* 내 위치 버튼 추가 */}
          {mapInstance && (
            <button
              onClick={() => {
                if (lastPosRef.current) {
                  mapInstance.setCenter(lastPosRef.current);
                  mapInstance.setZoom(15);
                } else if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    lastPosRef.current = p;
                    mapInstance.setCenter(p);
                    mapInstance.setZoom(15);
                  });
                }
              }}
              style={{
                position: "absolute", bottom: 12, right: 12,
                width: 36, height: 36, borderRadius: "50%",
                background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)",
                boxShadow: "0 2px 10px rgba(66,133,244,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", zIndex: 10, color: "#4285F4"
              }}
              title="내 위치로 이동"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" strokeOpacity="0.4" />
                <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            </button>
          )}
        </div>
        {/* 지도 크기 토글 화살표 */}
        <button onClick={() => setIsMapExpanded(v => !v)}
          style={{ position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "#fff", border: "2px solid rgba(0,0,0,0.08)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", fontSize: "0.6rem", color: "var(--text-secondary)" }}>
          {isMapExpanded ? "▲" : "▼"}
        </button>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="glass" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <p>아직 일정이 없습니다</p>
          <p style={{ fontSize: "0.8rem", marginTop: 6 }}>여행 기간에 맞춰 일정이 생성되는 중입니다...</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {days.map((day) => {
            const isExpanded = expandedDays.has(day._id);
            const dayItems = getItemsForDay(day._id);
            const td = tripDays.find(t => t.dayNumber === day.dayNumber);
            return (
              <div key={day._id} className="glass" style={{ overflow: "hidden", border: "2px solid rgba(0,0,0,0.08)", borderRadius: 20 }}>
                {/* DAY 헤더 */}
                <div onClick={() => { 
                  if (!expandedDays.has(day._id)) toggleDay(day._id); 
                  setFocusedDayId(null); // 강제 리트리거를 위해 잠시 해제
                  setTimeout(() => setFocusedDayId(day._id), 0);
                }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: isExpanded ? "var(--sky)" : "transparent", transition: "background 0.2s", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 900, fontSize: "1.05rem", color: isExpanded ? "#1a1a1a" : "var(--text-primary)" }}>day {day.dayNumber}</span>
                    <span style={{ fontSize: "0.82rem", color: isExpanded ? "rgba(0,0,0,0.6)" : "var(--text-muted)", fontWeight: 600 }}>
                      {formatShortDate(day.date)}/{td?.weekday || ""}
                    </span>
                    {day.title && <span style={{ fontSize: "0.8rem", color: isExpanded ? "rgba(0,0,0,0.7)" : "var(--text-secondary)", fontWeight: 700 }}>· {day.title}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {dayItems.filter((it: any) => it.placeLat && it.placeLng).length >= 2 && (
                      <button onClick={(e) => {
                        e.stopPropagation();
                        handleStartNavigation(day);
                      }} disabled={navLoadingDayId === day._id} style={{
                        padding: "3px 8px", borderRadius: 999, fontSize: "0.68rem", fontWeight: 800, border: "none", cursor: "pointer",
                        background: "rgba(0,0,0,0.06)", color: "var(--text-secondary)",
                      }}>
                        {navLoadingDayId === day._id ? "로딩중..." : "🧭 경로 보기"}
                      </button>
                    )}
                    <div onClick={(e) => { e.stopPropagation(); toggleDay(day._id); }} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <span className="badge badge-sky" style={{ fontSize: "0.65rem", background: "var(--sky)", color: "#1a1a1a", border: isExpanded ? "1px solid rgba(0,0,0,0.1)" : "none" }}>{dayItems.length}개</span>
                      <span style={{ fontSize: 14, color: isExpanded ? "#1a1a1a" : "var(--text-muted)", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                    </div>
                  </div>
                </div>


                {/* DAY 내용 */}
                {isExpanded && (
                  <div style={{ padding: "0 18px 16px" }}>
                    {/* 항목 타임라인 */}
                    {dayItems.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 12 }}>
                        {dayItems.map((item: any, idx: number) => {
                          const cat = CATEGORIES.find(c => c.id === item.placeCategory);
                          return (
                            <div key={item._id} style={{ display: "flex", gap: 12, position: "relative" }}>
                              {/* 타임라인 라인 */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0, paddingTop: 28 }}>
                                <div onClick={() => { if(item.placeLat && item.placeLng && mapInstance) { mapInstance.setCenter({lat: item.placeLat, lng: item.placeLng}); mapInstance.setZoom(17); } }} style={{ width: 24, height: 24, borderRadius: "50%", background: item.type === "place" ? "var(--accent)" : "var(--warning)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, zIndex: 1, cursor: item.placeLat ? "pointer" : "default" }}>
                                  {idx + 1}
                                </div>
                                {idx < dayItems.length - 1 && (
                                  <div style={{ width: 2, flex: 1, background: "rgba(0,0,0,0.08)", minHeight: 20 }} />
                                )}
                              </div>

                              {/* 항목 카드 */}
                              <div style={{ flex: 1, paddingBottom: 14 }}>
                                <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div style={{ flex: 1 }}>
                                      {/* 시간 */}
                                      {editingTime === item._id ? (
                                        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                                          <TimePicker value={editTimeVal} onChange={setEditTimeVal} />
                                          <button onClick={() => handleSaveTime(item._id)}
                                            style={{ padding: "3px 8px", fontSize: "0.72rem", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>저장</button>
                                          <button onClick={() => setEditingTime(null)}
                                            style={{ padding: "3px 8px", fontSize: "0.72rem", background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>취소</button>
                                        </div>
                                      ) : (
                                        <button onClick={() => { setEditingTime(item._id); setEditTimeVal(item.time || ""); }}
                                          style={{ background: item.time ? "rgba(99,102,241,0.08)" : "rgba(0,0,0,0.03)", border: "none", padding: "2px 8px", borderRadius: 6, fontSize: "0.72rem", color: item.time ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", marginBottom: 6, fontWeight: 600, display: "inline-block" }}>
                                          🕐 {item.time || "시간 추가"}
                                        </button>
                                      )}

                                      {item.type === "place" ? (
                                        <>
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: item.placeLat ? "pointer" : "default" }} onClick={() => { if(item.placeLat && item.placeLng && mapInstance) { mapInstance.setCenter({lat: item.placeLat, lng: item.placeLng}); mapInstance.setZoom(17); } }}>
                                            <span style={{ fontSize: 16 }}>{cat?.emoji || "📌"}</span>
                                            <span style={{ fontWeight: 700, fontSize: "0.92rem", textDecoration: item.placeLat ? "underline" : "none", textDecorationColor: "rgba(0,0,0,0.15)", textUnderlineOffset: 3 }}>{item.placeName}</span>
                                          </div>
                                          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                                            <span className="badge badge-purple" style={{ fontSize: "0.62rem" }}>{cat?.label || "기타"}</span>
                                            {item.placeAddress && <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>· {item.placeAddress}</span>}
                                          </div>
                                          
                                          {/* 별점 영역 */}
                                          <ItemRating item={item} nickname={nickname} onRate={handleRate} />
                                        </>
                                      ) : null}
                                    </div>

                                      {/* 순서 변경 버튼 (상시 노출) */}
                                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: 8, alignItems: "center" }}>
                                        <button 
                                          type="button" 
                                          onClick={(e) => { e.stopPropagation(); moveItemUp(item._id, day._id); }} 
                                          disabled={idx === 0} 
                                          style={{ 
                                            width: 32, height: 32, border: "1px solid rgba(0,0,0,0.1)", 
                                            background: "white", borderRadius: 8, display: "flex", 
                                            alignItems: "center", justifyContent: "center", fontSize: 18, 
                                            cursor: idx === 0 ? "default" : "pointer", 
                                            opacity: idx === 0 ? 0.2 : 0.8, 
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                            color: "var(--accent)"
                                          }}
                                          title="위로 이동"
                                        >↑</button>
                                        <button 
                                          type="button" 
                                          onClick={(e) => { e.stopPropagation(); moveItemDown(item._id, day._id); }} 
                                          disabled={idx === dayItems.length - 1} 
                                          style={{ 
                                            width: 32, height: 32, border: "1px solid rgba(0,0,0,0.1)", 
                                            background: "white", borderRadius: 8, display: "flex", 
                                            alignItems: "center", justifyContent: "center", fontSize: 18, 
                                            cursor: idx === dayItems.length - 1 ? "default" : "pointer", 
                                            opacity: idx === dayItems.length - 1 ? 0.2 : 0.8, 
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                            color: "var(--accent)"
                                          }}
                                          title="아래로 이동"
                                        >↓</button>
                                        
                                        {/* 편집 버튼 */}
                                        {item.type === "place" && (
                                          <button onClick={() => {
                                            setEditPlaceModal(item);
                                            setPlaceForm({
                                              name: item.placeName || "", category: item.placeCategory || "attraction",
                                              address: item.placeAddress || "", time: item.time || "",
                                              lat: item.placeLat, lng: item.placeLng
                                            });
                                          }} style={{ width: 36, display: "flex", justifyContent: "center", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 6, cursor: "pointer", fontSize: 11, color: "var(--accent)", padding: "5px 0", lineHeight: 1, transition: "all 0.15s", whiteSpace: "nowrap", fontWeight: 700, marginTop: 4 }}>편집</button>
                                        )}
                                        {/* 삭제 버튼 */}
                                        <button onClick={() => removeItem({ itemId: item._id })}
                                          style={{ width: 36, display: "flex", justifyContent: "center", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 6, cursor: "pointer", fontSize: 14, color: "var(--danger)", padding: "4px 0", lineHeight: 1, transition: "all 0.15s", marginTop: 4 }}>✕</button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 사진 */}
                                  <ItineraryPhotos item={item} nickname={nickname} />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* 추가 버튼 */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setShowPlaceModal(day._id); setPlaceTab("saved"); }}
                        style={{ flex: 1, padding: "10px", border: "1px dashed rgba(0,0,0,0.15)", borderRadius: 10, background: "#fafafa", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", transition: "all 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)"}>
                        + 장소 추가
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 장소 추가 모달 */}
      {showPlaceModal && (
        <div className="modal-overlay" onClick={() => setShowPlaceModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 16 }}>📍 장소 추가</h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <button onClick={() => setPlaceTab("saved")}
                className={`badge ${placeTab === "saved" ? "badge-purple" : ""}`}
                style={{ cursor: "pointer", padding: "6px 14px", fontSize: "0.82rem", background: placeTab !== "saved" ? "rgba(0,0,0,0.04)" : undefined }}>
                📌 저장된 장소
              </button>
              <button onClick={() => setPlaceTab("search")}
                className={`badge ${placeTab === "search" ? "badge-purple" : ""}`}
                style={{ cursor: "pointer", padding: "6px 14px", fontSize: "0.82rem", background: placeTab !== "search" ? "rgba(0,0,0,0.04)" : undefined }}>
                🔍 직접 입력
              </button>
            </div>

            {placeTab === "saved" ? (
              <div style={{ maxHeight: 350, overflowY: "auto" }}>
                {combinedSavedPlaces.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    <p>저장된 장소나 숙소가 없습니다.</p>
                    <p style={{ marginTop: 4, fontSize: "0.78rem" }}>예약 또는 지도 탭에서 정보를 먼저 추가하거나, 직접 입력을 이용하세요.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {combinedSavedPlaces.map((p: any) => {
                      // 숙소는 전용 카테고리 기호로 처리
                      const cat = p.category === "accommodation" 
                        ? { emoji: "🏨", label: "숙소" } 
                        : CATEGORIES.find(c => c.id === p.category);
                      return (
                        <div key={p._id} onClick={() => handleAddSavedPlace(showPlaceModal, p)}
                          className="glass-hover" style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, background: "#fff" }}>
                          <span style={{ fontSize: 20 }}>{cat?.emoji || "📌"}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.name}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{cat?.label} {p.address ? `· ${p.address}` : ""}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div><label>장소 이름 검색 (구글맵 자동완성) *</label><input ref={searchInputRef} className="input" placeholder="예: 도톤보리" value={placeForm.name} onChange={e => setPlaceForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label>주소 (선택)</label><input className="input" placeholder="주소 입력" value={placeForm.address} onChange={e => setPlaceForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div><label>시간 (선택)</label><TimePicker value={placeForm.time} onChange={time => setPlaceForm(f => ({ ...f, time }))} /></div>
                <div>
                  <label>카테고리</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {CATEGORIES.map(c => (
                      <button key={c.id} type="button" onClick={() => setPlaceForm(f => ({ ...f, category: c.id }))}
                        style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${placeForm.category === c.id ? "var(--accent)" : "rgba(0,0,0,0.08)"}`, background: placeForm.category === c.id ? "var(--accent-dim)" : "transparent", color: placeForm.category === c.id ? "var(--accent)" : "var(--text-secondary)", fontSize: "0.78rem", cursor: "pointer" }}>
                        {c.emoji} {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowPlaceModal(null)}>취소</button>
                  <button className="btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => handleAddPlace(showPlaceModal)} disabled={saving || !placeForm.name.trim()}>
                    {saving ? <span className="spinner" /> : "추가"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 장소 수정 모달 */}
      {editPlaceModal && (
        <div className="modal-overlay" onClick={() => setEditPlaceModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 16 }}>📍 장소 수정</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label>장소 이름 검색 (구글맵 자동완성) *</label><input ref={searchInputRef} className="input" placeholder="예: 도톤보리" value={placeForm.name} onChange={e => setPlaceForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label>주소 (선택)</label><input className="input" placeholder="주소 입력" value={placeForm.address} onChange={e => setPlaceForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><label>시간 (선택)</label><TimePicker value={placeForm.time} onChange={time => setPlaceForm(f => ({ ...f, time }))} /></div>
              <div>
                <label>카테고리</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {CATEGORIES.map(c => (
                    <button key={c.id} type="button" onClick={() => setPlaceForm(f => ({ ...f, category: c.id }))}
                      style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${placeForm.category === c.id ? "var(--accent)" : "rgba(0,0,0,0.08)"}`, background: placeForm.category === c.id ? "var(--accent-dim)" : "transparent", color: placeForm.category === c.id ? "var(--accent)" : "var(--text-secondary)", fontSize: "0.78rem", cursor: "pointer" }}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setEditPlaceModal(null)}>취소</button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={async () => {
                   if (!placeForm.name.trim()) return;
                   setSaving(true);
                   let lat = placeForm.lat;
                   let lng = placeForm.lng;
                   const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
                   if (apiKey && placeForm.name && (lat === undefined || lng === undefined)) {
                     try {
                       const q = encodeURIComponent(`${placeForm.name} ${placeForm.address || trip.destination}`);
                       const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${apiKey}`);
                       const data = await res.json();
                       if (data.results?.[0]) {
                         lat = data.results[0].geometry.location.lat;
                         lng = data.results[0].geometry.location.lng;
                       }
                     } catch (e) { /* ignore */ }
                   }
                   await updateItem({ itemId: editPlaceModal._id, placeName: placeForm.name, placeCategory: placeForm.category, placeAddress: placeForm.address || undefined, placeLat: lat, placeLng: lng, time: placeForm.time || undefined });
                   setEditPlaceModal(null);
                   setSaving(false);
                }} disabled={saving || !placeForm.name.trim()}>
                  {saving ? <span className="spinner" /> : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {navData && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#0f172a", display: "flex", flexDirection: "column" }}>
          {/* 상단 턴바이턴 안내 배너 */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "14px 14px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 800, opacity: 0.85 }}>🧭 {navData.dayLabel} 경로</span>
              <button onClick={handleCloseNavigation}
                style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: "1.1rem", cursor: "pointer", flexShrink: 0 }}>✕</button>
            </div>
            {navManeuver && (
              <div style={{ background: "#2563eb", borderRadius: 18, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 8px 20px rgba(0,0,0,0.3)" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: `rotate(${navManeuver.rotation}deg)` }}>
                    <path d="M12 19V5" /><path d="M6 11l6-6 6 6" />
                  </svg>
                </div>
                <div style={{ color: "#fff" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 900 }}>{navManeuver.label}</div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, opacity: 0.9, marginTop: 2 }}>
                    {navDistToTurn < 1000 ? `${Math.round(navDistToTurn)}m` : `${(navDistToTurn / 1000).toFixed(1)}km`}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
            <div style={{
              width: "100%", height: "100%",
              transform: navHeadingMode ? `rotate(${-navHeading}deg) scale(1.6)` : "none",
              transformOrigin: "center center",
              transition: "transform 0.2s linear",
            }}>
              <div ref={navMapRef} style={{ width: "100%", height: "100%" }} />
            </div>
          </div>

          {/* 우측 플로팅 버튼: 지도 유형 전환 / 재조준(+나침반) / 경로 새로고침 */}
          <div style={{ position: "absolute", right: 14, top: navManeuver ? 164 : 70, zIndex: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={handleToggleNavMapType} title="지도 유형"
              style={{ width: 44, height: 44, borderRadius: "50%", background: "#fff", border: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
              {navMapType === "satellite" ? "🛰️" : "🗺️"}
            </button>
            <button onClick={handleRecenterNavigation} title={navHeadingMode ? "나침반 모드 끄기" : navAutoFollow ? "나침반 모드 켜기" : "내 위치로"}
              style={{ width: 44, height: 44, borderRadius: "50%", background: navHeadingMode ? "#f59e0b" : navAutoFollow ? "#2563eb" : "#fff", border: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {navHeadingMode ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3 7-3 13-3-13z" fill="#fff" stroke="none" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={navAutoFollow ? "#fff" : "#4285F4"} strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="7" strokeOpacity="0.4" /><circle cx="12" cy="12" r="2" fill={navAutoFollow ? "#fff" : "#4285F4"} stroke="none" />
                </svg>
              )}
            </button>
            <button onClick={() => navData && handleStartNavigation(navData.day)} title="경로 새로고침"
              style={{ width: 44, height: 44, borderRadius: "50%", background: "#fff", border: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
              🔄
            </button>
          </div>

          {/* 하단 시트: 남은 거리/시간/도착예정 + 고도 그래프 */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, background: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "10px 18px 18px", boxShadow: "0 -8px 24px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: "1.3rem", fontWeight: 900, color: "#2563eb" }}>{Math.max(1, Math.round(navRemainingDurationS / 60))}분</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800 }}>{navRemainingDistanceM < 1000 ? `${Math.round(navRemainingDistanceM)}m` : `${(navRemainingDistanceM / 1000).toFixed(1)}km`}</span>
              <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 600 }}>{navEtaLabel} 도착</span>
            </div>
            {elevLinePoints.length > 1 && (
              <>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  고도 그래프 (m)
                </div>
                <svg viewBox={`0 0 ${ELEV_W} ${ELEV_H}`} width="100%" height={ELEV_H} preserveAspectRatio="none">
                  <path d={elevPathD} fill="none" stroke="#93c5fd" strokeWidth="2.5" />
                  {elevTraveledPathD && <path d={elevTraveledPathD} fill="none" stroke="#34d399" strokeWidth="2.5" />}
                  <circle cx={elevLinePoints[0].x} cy={elevLinePoints[0].y} r="4" fill="#fff" stroke="#34d399" strokeWidth="2.5" />
                  <circle cx={elevLinePoints[elevLinePoints.length - 1].x} cy={elevLinePoints[elevLinePoints.length - 1].y} r="4" fill="#f43f5e" />
                  <circle cx={elevProgressX} cy={elevProgressY} r="4.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                </svg>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
