"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import NicknameBadge from "@/components/NicknameBadge";

const CATEGORIES = [
  { id: "accommodation", label: "숙소", emoji: "🏨" },
  { id: "food", label: "음식", emoji: "🍜" },
  { id: "cafe", label: "카페", emoji: "☕" },
  { id: "dessert", label: "디저트", emoji: "🍰" },
  { id: "bar", label: "술집", emoji: "🍻" },
  { id: "massage", label: "마사지", emoji: "💆" },
  { id: "attraction", label: "관광", emoji: "🏛️" },
  { id: "shopping", label: "쇼핑", emoji: "🛍️" },
  { id: "transport", label: "교통", emoji: "🚌" },
  { id: "other", label: "기타", emoji: "📌" },
];

export default function MapTab({ trip, nickname, shareId }: { trip: any; nickname?: string; shareId?: string }) {
  const places = useQuery(api.places.listPlacesByTrip, { tripId: trip._id });
  const accommodations = useQuery(api.accommodations.listByTrip, { tripId: trip._id });
  const updateAccommodation = useMutation(api.accommodations.update);
  const addPlace = useMutation(api.places.addPlace);
  const updatePlace = useMutation(api.places.updatePlace);
  const removePlace = useMutation(api.places.removePlace);
  const itineraryDays = useQuery(api.itinerary.listDaysByTrip, { tripId: trip._id });
  const itineraryItems = useQuery(api.itinerary.listItemsByTrip, { tripId: trip._id });
  const addItineraryItem = useMutation(api.itinerary.addItem);
  const updateItineraryItem = useMutation(api.itinerary.updateItem);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", mapLink: "", category: "attraction", notes: "" });
  const [saving, setSaving] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [resolvingLink, setResolvingLink] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<any | null>(null);
  const [scheduleDayId, setScheduleDayId] = useState<string | null>(null);
  const [schedulePosition, setSchedulePosition] = useState(0);
  const [scheduling, setScheduling] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const formNameInputRef = useRef<HTMLInputElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const [tempLatLng, setTempLatLng] = useState<{lat: number, lng: number} | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const isMapExpandedRef = useRef(isMapExpanded);
  useEffect(() => { isMapExpandedRef.current = isMapExpanded; }, [isMapExpanded]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [sheetThumbCollapsed, setSheetThumbCollapsed] = useState(false);
  const sheetDragStartYRef = useRef<number | null>(null);

  // 새 핀을 선택할 때마다 하단 시트 썸네일을 기본값(펼침)으로 리셋
  useEffect(() => { if (focusedId) setSheetThumbCollapsed(false); }, [focusedId]);

  // 하단 시트 상단 손잡이를 아래로 살짝 끌면 썸네일만 접히고, 위로 끌면 다시 펼쳐짐
  function handleSheetHandlePointerDown(e: React.PointerEvent) {
    sheetDragStartYRef.current = e.clientY;
  }
  function handleSheetHandlePointerMove(e: React.PointerEvent) {
    if (sheetDragStartYRef.current === null) return;
    const delta = e.clientY - sheetDragStartYRef.current;
    if (delta > 24) { setSheetThumbCollapsed(true); sheetDragStartYRef.current = null; }
    else if (delta < -24) { setSheetThumbCollapsed(false); sheetDragStartYRef.current = null; }
  }
  function handleSheetHandlePointerUp() {
    sheetDragStartYRef.current = null;
  }

  // 모달 입력창 구글 자동완성 (매번 모달이 열릴 때마다 새롭게 바인딩하여 오류 방지)
  useEffect(() => {
    if (showForm && formNameInputRef.current && (window as any).google?.maps?.places) {
      const google = (window as any).google;
      const ac = new google.maps.places.Autocomplete(formNameInputRef.current, {
        fields: ["name", "formatted_address", "geometry", "url"]
      });
      
      // 지도가 있으면 검색 범위를 지도로 제한
      if (mapInstance) ac.bindTo("bounds", mapInstance);
      
      const listener = ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.geometry || !place.geometry.location) return;
        
        setForm(f => ({
          ...f,
          name: place.name || f.name,
          address: place.formatted_address || f.address,
          mapLink: place.url || f.mapLink,
        }));
        setTempLatLng({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
      });

      return () => {
        // cleanup: 리스너 제거
        google.maps.event.clearInstanceListeners(ac);
      };
    }
  }, [showForm, mapInstance]);

  // 필터링된 장소가 바뀌면 해당 카드로 스크롤 이동 (지도가 확대된 상태에서는 하단 시트로 보여주므로 스크롤하지 않음)
  useEffect(() => {
    if (!focusedId || isMapExpandedRef.current) return;
    const el = document.getElementById(`map-card-${focusedId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedId]);

  // 지도가 확대된 상태에서 빈 영역을 클릭하면 하단 시트를 닫음
  useEffect(() => {
    if (!mapInstance) return;
    const google = (window as any).google;
    const listener = google.maps.event.addListener(mapInstance, "click", () => setFocusedId(null));
    return () => google.maps.event.removeListener(listener);
  }, [mapInstance]);

  // 구글 맵스 API 로드 및 초기화
  useEffect(() => {
    const scriptId = "google-maps-api";
    
    function init() {
      if (mapRef.current && !mapInstance && (window as any).google?.maps) {
        const google = (window as any).google;
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
    }

    if ((window as any).google?.maps) {
      init();
    } else {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.addEventListener("load", init);
      } else {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.onload = init;
        document.head.appendChild(script);
      }
    }
  }, [apiKey, mapInstance]);

  // 장소/숙소 목록 바뀔 때마다 마커 새로 그리기
  useEffect(() => {
    if (!mapInstance || places === undefined || accommodations === undefined) return;
    const google = (window as any).google;
    
    // 기존 마커 초기화
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // 마커 클릭 리스너 헬퍼: 지도가 확대된 상태면 핀을 중앙으로 부드럽게 이동 + 하단 시트로 표시,
    // 아닌 상태면 기존처럼 아래 목록에서 해당 카드로 스크롤
    const addMarkerListener = (marker: any, id: string, pos: { lat: number; lng: number }) => {
      marker.addListener("click", () => {
        setFocusedId(id);
        if (isMapExpandedRef.current && mapInstance) {
          mapInstance.panTo(pos);
          if (mapInstance.getZoom() < 16) mapInstance.setZoom(16);
          // 하단 시트(최대 52% 높이)에 핀이 가려지지 않도록, 가려지지 않는 위쪽 영역의 중앙쯤에 오도록 살짝 위로 보정
          const containerHeight = mapRef.current?.clientHeight;
          if (containerHeight) {
            google.maps.event.addListenerOnce(mapInstance, "idle", () => {
              mapInstance.panBy(0, containerHeight * 0.24);
            });
          }
        }
      });
    };
    
    // 1. 숙소 (보라색 핀)
    accommodations.forEach(a => {
      if (selectedCat !== "all" && selectedCat !== "accommodation") return;

      if (a.lat && a.lng) {
        const pos = { lat: a.lat, lng: a.lng };
        const marker = new google.maps.Marker({
          position: pos, map: mapInstance, title: a.name,
          icon: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png"
        });
        addMarkerListener(marker, a._id, pos);
        markersRef.current.push(marker);
        bounds.extend(pos);
        hasPoints = true;
      } else if (!a.lat || !a.lng) {
        // ... (Geocoding API 생략 - 동일한 로직 유지)
        const query = encodeURIComponent(`${a.name} ${a.address || trip.destination}`);
        fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`)
          .then(res => res.json())
          .then(data => {
            if (data.results && data.results.length > 0) {
              const lat = data.results[0].geometry.location.lat;
              const lng = data.results[0].geometry.location.lng;
              updateAccommodation({ accommodationId: a._id, lat, lng });
            }
          })
          .catch(err => console.warn("Background accommodation geocode failed", err));
      }
    });

    // 2. 장소 필터링 후 렌더링
    places
      .filter(p => selectedCat === "all" || p.category === selectedCat)
      .forEach(p => {
        if (p.lat && p.lng) {
          const pos = { lat: p.lat, lng: p.lng };
          let color = "red-dot";
          if (p.category === "food") color = "orange-dot";
          else if (p.category === "shopping") color = "pink-dot";
          else if (p.category === "attraction") color = "blue-dot";
          else if (p.category === "dessert") color = "yellow-dot";
          else if (p.category === "bar") color = "green-dot";
          else if (p.category === "massage") color = "ltblue-dot";
          
          const marker = new google.maps.Marker({
            position: pos, map: mapInstance, title: p.name,
            icon: `https://maps.google.com/mapfiles/ms/icons/${color}.png`
          });
          addMarkerListener(marker, p._id, pos);
          markersRef.current.push(marker);
          bounds.extend(pos);
          hasPoints = true;
        }
      });

    if (hasPoints) {
      mapInstance.fitBounds(bounds);
      const listener = google.maps.event.addListener(mapInstance, "idle", function() {
        if (mapInstance.getZoom() > 15) mapInstance.setZoom(15);
        google.maps.event.removeListener(listener);
      });
    }
  }, [mapInstance, places, accommodations, selectedCat]);

  function focusPlace(lat?: number, lng?: number) {
    if (lat && lng && mapInstance) {
      mapInstance.panTo({ lat, lng });
      mapInstance.setZoom(16);
      window.scrollTo({ top: 0, behavior: "smooth" }); // 지도 쪽으로 스크롤 이동
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMapError(""); // 에러 초기화
    
    let lat: number | undefined;
    let lng: number | undefined;
    let resolvedName: string | undefined;
    let resolvedAddress: string | undefined;

    try {
      if (form.mapLink) {
        // 1. @lat,lng 패턴 (모바일/표준)
        let match = form.mapLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        
        // 2. !3dlat!4dlong 패턴 (데스크톱 검색 결과)
        if (!match) {
          const latMatch = form.mapLink.match(/!3d(-?\d+\.\d+)/);
          const lngMatch = form.mapLink.match(/!4d(-?\d+\.\d+)/);
          if (latMatch && lngMatch) match = [null, latMatch[1], lngMatch[1]] as any;
        }

        // 3. q=lat,lng 또는 ll=lat,lng 패턴
        if (!match) {
          const llMatch = form.mapLink.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (llMatch) match = llMatch;
        }

        if (match) {
          const pLat = parseFloat(match[1]);
          const pLng = parseFloat(match[2]);
          if (!isNaN(pLat) && !isNaN(pLng)) {
            lat = pLat;
            lng = pLng;
          }
        } else if (form.mapLink.startsWith("http")) {
          // 서버 사이드 리졸버 호출 (단축 링크 해결). onBlur 자동완성이 아직 안 끝났거나
          // 못 미더운 경우를 대비해, 저장 시점에도 이름/주소를 한 번 더 채워줌
          try {
            const res = await fetch(`/api/resolve-map-link?url=${encodeURIComponent(form.mapLink)}`);
            const data = await res.json();
            if (data.lat && data.lng) {
              lat = data.lat;
              lng = data.lng;
            }
            if (data.name) resolvedName = data.name;
            if (data.address) resolvedAddress = data.address;
          } catch (e) {
            console.warn("Link resolution API failed", e);
          }
        }
      }

      // 이름만 있고 좌표가 없다면 Geocoding API 찔러서 찾아주기
      if ((lat === undefined || lng === undefined) && tempLatLng) {
        lat = tempLatLng.lat;
        lng = tempLatLng.lng;
      } else if ((lat === undefined || lng === undefined) && form.name) {
        try {
          const query = encodeURIComponent(`${form.name} ${form.address || trip.destination}`);
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`);
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            lat = data.results[0].geometry.location.lat;
            lng = data.results[0].geometry.location.lng;
          }
        } catch (e) {
          console.warn("Geocode auto-fetch failed", e);
        }
      }

      const finalName = form.name || resolvedName || "";
      if (!finalName) {
        setMapError("장소 이름을 확인하지 못했습니다. 이름을 직접 입력해주세요.");
        setSaving(false);
        return;
      }

      const payload = {
        name: finalName,
        address: form.address || resolvedAddress || undefined,
        lat: (lat !== undefined && !isNaN(lat)) ? lat : undefined,
        lng: (lng !== undefined && !isNaN(lng)) ? lng : undefined,
        mapLink: form.mapLink || undefined,
        category: form.category,
        notes: form.notes || undefined
      };

      if (editingId) {
        await updatePlace({ placeId: editingId as any, ...payload });
      } else {
        await addPlace({ tripId: trip._id, ...payload });
      }
      
      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", address: "", mapLink: "", category: "attraction", notes: "" });
      setTempLatLng(null);
      if (lat !== undefined && lng !== undefined) focusPlace(lat, lng);
    } catch (err: any) {
      console.error("장소 저장 오류:", err);
      setMapError(`저장 중 오류가 발생했습니다: ${err.message || "알 수 없는 에러"}`);
    } finally {
      setSaving(false);
    }
  }

  // 구글 지도 링크 입력란에서 포커스를 벗어나면 이름/주소를 자동으로 채워줌
  // 링크가 바뀔 때마다 새로 조회한 값으로 항상 교체함 (다른 링크로 바꿔 넣으면 정보도 같이 새로 바뀌어야 하므로)
  async function handleMapLinkBlur() {
    if (!form.mapLink.startsWith("http")) return;
    setResolvingLink(true);
    try {
      const res = await fetch(`/api/resolve-map-link?url=${encodeURIComponent(form.mapLink)}`);
      const data = await res.json();
      if (data.lat && data.lng) setTempLatLng({ lat: data.lat, lng: data.lng });
      setForm(f => ({
        ...f,
        name: data.name || f.name,
        address: data.address || f.address,
      }));
    } catch (e) {
      console.warn("지도 링크 자동완성 실패", e);
    } finally {
      setResolvingLink(false);
    }
  }

  // 블러/붙여넣기 이벤트에 의존하지 않고, 입력이 잠시 멈추면(600ms) 자동으로 한 번 더 확인 (모바일 브라우저의 blur 타이밍 불안정 대비)
  useEffect(() => {
    if (!showForm || !form.mapLink.startsWith("http")) return;
    const handle = setTimeout(() => { handleMapLinkBlur(); }, 600);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.mapLink, showForm]);

  function handleEdit(p: any) {
    setForm({ name: p.name || "", address: p.address || "", mapLink: p.mapLink || "", category: p.category || "attraction", notes: p.notes || "" });
    setEditingId(p._id);
    setTempLatLng(null);
    setShowForm(true);
  }

  // 일정에 포함할 DAY의 현재 항목 목록 (정렬됨)
  function itemsForDay(dayId: string) {
    return (itineraryItems || [])
      .filter((it: any) => it.dayId === dayId)
      .sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  }

  function openScheduleModal(p: any) {
    setScheduleTarget(p);
    const firstDay = itineraryDays && itineraryDays.length > 0 ? itineraryDays[0]._id : null;
    setScheduleDayId(firstDay);
    setSchedulePosition(firstDay ? itemsForDay(firstDay).length : 0);
  }

  async function handleConfirmSchedule() {
    if (!scheduleTarget || !scheduleDayId) return;
    setScheduling(true);
    try {
      const existing = itemsForDay(scheduleDayId);
      // 선택한 위치 이후 항목들은 순서를 한 칸씩 뒤로 밀어줌
      for (let i = schedulePosition; i < existing.length; i++) {
        await updateItineraryItem({ itemId: existing[i]._id, orderIndex: i + 1 });
      }
      await addItineraryItem({
        dayId: scheduleDayId as any, tripId: trip._id, orderIndex: schedulePosition,
        type: "place", placeName: scheduleTarget.name, placeCategory: scheduleTarget.category,
        placeAddress: scheduleTarget.address || undefined, placeLat: scheduleTarget.lat, placeLng: scheduleTarget.lng,
        placeMapLink: scheduleTarget.mapLink || undefined,
      });
      setScheduleTarget(null);
    } finally {
      setScheduling(false);
    }
  }

  function findMyLocation() {
    if (navigator.geolocation && mapInstance && (window as any).google) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          mapInstance.setCenter({ lat, lng });
          mapInstance.setZoom(15);
          
          new (window as any).google.maps.Marker({
            position: { lat, lng },
            map: mapInstance,
            title: "내 위치",
            icon: {
               path: (window as any).google.maps.SymbolPath.CIRCLE,
               scale: 8,
               fillColor: "#4285F4",
               fillOpacity: 1,
               strokeColor: "white",
               strokeWeight: 2,
            }
          });
        },
        (err) => console.warn("GPS failed", err),
        { enableHighAccuracy: true }
      );
    }
  }

  const sheetAccommodation = focusedId ? accommodations?.find(a => a._id === focusedId) : null;
  const sheetPlace = focusedId ? places?.find(p => p._id === focusedId) : null;
  const sheetCat = sheetPlace ? CATEGORIES.find(c => c.id === sheetPlace.category) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.02em" }}>📍 지도</h2>
          {nickname && shareId && <NicknameBadge trip={trip} nickname={nickname} shareId={shareId} />}
        </div>
        <button className="btn-primary" onClick={() => { setEditingId(null); setForm({ name: "", address: "", mapLink: "", category: "attraction", notes: "" }); setTempLatLng(null); setShowForm(true); }} style={{ padding: "7px 14px", fontSize: "0.78rem", minHeight: "auto" }}>+ 장소 추가</button>
      </div>

      {/* 지도 표시 (네이버 지도처럼 좌우 여백 없이 꽉 채움) */}
      <div style={{ position: "relative", margin: "0 -10px" }}>
        <div className="glass" style={{ borderRadius: 0, overflow: "hidden", height: isMapExpanded ? "70vh" : 200, transition: "height 0.4s cubic-bezier(0.4, 0, 0.2, 1)", position: "relative", borderTop: "2px solid rgba(0,0,0,0.08)", borderBottom: "2px solid rgba(0,0,0,0.08)", borderLeft: "none", borderRight: "none" }}>
          {apiKey ? (
            <>
              <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
              
              {/* 검색창 제거됨 */}

              <button
                onClick={findMyLocation}
                style={{
                  position: "absolute", bottom: 12, right: 12,
                  width: 44, height: 44, borderRadius: "50%",
                  background: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.1)",
                  boxShadow: "0 2px 12px rgba(66,133,244,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", zIndex: 10, color: "#4285F4",
                  transition: "all 0.2s"
                }}
                title="현재 위치로 이동"
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

              {/* 확대된 지도에서 핀 클릭 시 올라오는 하단 시트 (네이버 지도 스타일) */}
              {isMapExpanded && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: "absolute", left: 0, right: 0, bottom: 0,
                  maxHeight: "52%",
                  background: "#ffffff",
                  borderTopLeftRadius: 22, borderTopRightRadius: 22,
                  boxShadow: "0 -8px 28px rgba(0,0,0,0.18)",
                  transform: (sheetPlace || sheetAccommodation) ? "translateY(0)" : "translateY(100%)",
                  transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
                  zIndex: 120, // 모바일 하단 고정 탭바(.tab-nav-wrapper, z-index:100)보다 위에 오도록

                  display: "flex", flexDirection: "column",
                  pointerEvents: (sheetPlace || sheetAccommodation) ? "auto" : "none",
                }}>
                  <div
                    onPointerDown={handleSheetHandlePointerDown}
                    onPointerMove={handleSheetHandlePointerMove}
                    onPointerUp={handleSheetHandlePointerUp}
                    onPointerCancel={handleSheetHandlePointerUp}
                    style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px", flexShrink: 0, cursor: "grab", touchAction: "none" }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)" }} />
                  </div>
                  <div style={{ overflowY: "auto", padding: "6px 18px 18px" }}>
                    {sheetAccommodation && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-secondary)" }}>🏨 숙소</span>
                          <button onClick={() => setFocusedId(null)} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 4, color: "#1a1a1a" }}>{sheetAccommodation.name}</div>
                        {sheetAccommodation.address && <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 8 }}>📍 {sheetAccommodation.address}</p>}
                        {apiKey && (
                          <div style={{ maxHeight: sheetThumbCollapsed ? 0 : 150, overflow: "hidden", transition: "max-height 0.3s ease", marginBottom: sheetThumbCollapsed ? 0 : 8 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/place-thumbnail?name=${encodeURIComponent(sheetAccommodation.name)}${sheetAccommodation.lat && sheetAccommodation.lng ? `&lat=${sheetAccommodation.lat}&lng=${sheetAccommodation.lng}` : ""}`}
                              alt="" loading="lazy" style={{ width: "100%", height: 150, objectFit: "cover", display: "block", borderRadius: 10, cursor: "zoom-in" }}
                              onClick={e => setLightboxUrl(e.currentTarget.src)}
                              onError={e => { e.currentTarget.style.display = "none"; }} />
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button className="btn-ghost" style={{ fontSize: "0.78rem", fontWeight: 700 }}
                            onClick={() => openScheduleModal({ ...sheetAccommodation, category: "accommodation" })}>📅 일정 포함</button>
                          {(sheetAccommodation.lat && sheetAccommodation.lng) || sheetAccommodation.address ? (
                            <a href={`https://maps.google.com/?q=${sheetAccommodation.lat ? sheetAccommodation.lat + ',' + sheetAccommodation.lng : encodeURIComponent(sheetAccommodation.address || sheetAccommodation.name)}`} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center" }}>
                              🔗 구글 지도에서 보기
                            </a>
                          ) : null}
                        </div>
                      </>
                    )}
                    {sheetPlace && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-secondary)" }}>{sheetCat?.emoji} {sheetCat?.label}</span>
                          <button onClick={() => setFocusedId(null)} style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 4, color: "#1a1a1a" }}>{sheetPlace.name}</div>
                        {sheetPlace.address && <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 8 }}>📍 {sheetPlace.address}</p>}
                        {apiKey && (
                          <div style={{ maxHeight: sheetThumbCollapsed ? 0 : 150, overflow: "hidden", transition: "max-height 0.3s ease", marginBottom: sheetThumbCollapsed ? 0 : 8 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/place-thumbnail?name=${encodeURIComponent(sheetPlace.name)}${sheetPlace.lat && sheetPlace.lng ? `&lat=${sheetPlace.lat}&lng=${sheetPlace.lng}` : ""}`}
                              alt="" loading="lazy" style={{ width: "100%", height: 150, objectFit: "cover", display: "block", borderRadius: 10, cursor: "zoom-in" }}
                              onClick={e => setLightboxUrl(e.currentTarget.src)}
                              onError={e => { e.currentTarget.style.display = "none"; }} />
                          </div>
                        )}
                        {sheetPlace.notes && <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: 8, padding: "8px", background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>{sheetPlace.notes}</p>}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <button className="btn-ghost" style={{ fontSize: "0.78rem", fontWeight: 700 }}
                            onClick={() => openScheduleModal(sheetPlace)}>📅 일정 포함</button>
                          <button className="btn-ghost" style={{ fontSize: "0.78rem", fontWeight: 700 }}
                            onClick={() => handleEdit(sheetPlace)}>수정</button>
                          {(sheetPlace.mapLink || (sheetPlace.lat && sheetPlace.lng)) ? (
                            <a href={sheetPlace.mapLink || `https://maps.google.com/?q=${sheetPlace.lat},${sheetPlace.lng}`} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center" }}>
                              🔗 구글 지도에서 보기
                            </a>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: 12 }}>
              <div style={{ fontSize: 48 }}>🗺️</div>
              <p style={{ fontSize: "0.9rem" }}>Google Maps API 키가 필요합니다</p>
              <p style={{ fontSize: "0.78rem" }}>.env.local에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 설정해주세요</p>
            </div>
          )}
        </div>
        
        {/* 지도 크기 토글 화살표 */}
        <button onClick={() => setIsMapExpanded(!isMapExpanded)}
          style={{ position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "#fff", border: "2px solid rgba(0,0,0,0.08)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", fontSize: "0.6rem", color: "var(--text-secondary)" }}>
          {isMapExpanded ? "▲" : "▼"}
        </button>
      </div>

      {/* 카테고리 필터 UI - 기본은 "모두"+햄버거만 노출, 햄버거를 누르면 세부 항목이 펼쳐짐 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4, marginTop: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => { setSelectedCat("all"); setFocusedId(null); }}
            style={{
              padding: "6px 14px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", border: "1px solid", transition: "all 0.15s",
              background: selectedCat === "all" ? "var(--lavender)" : "#ffffff",
              color: selectedCat === "all" ? "#1a1a1a" : "var(--text-secondary)",
              borderColor: selectedCat === "all" ? "var(--lavender)" : "rgba(0,0,0,0.08)",
              boxShadow: selectedCat === "all" ? "none" : "0 1px 2px rgba(0,0,0,0.05)"
            }}>
            모두
          </button>
          {selectedCat !== "all" && !showFilters && (
            <button onClick={() => setShowFilters(true)}
              style={{
                padding: "6px 14px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", border: "1px solid",
                background: "var(--lavender)", color: "#1a1a1a", borderColor: "var(--lavender)",
                display: "flex", alignItems: "center", gap: 4
              }}>
              {CATEGORIES.find(c => c.id === selectedCat)?.emoji} {CATEGORIES.find(c => c.id === selectedCat)?.label}
            </button>
          )}
          <button onClick={() => setShowFilters(v => !v)} title="필터"
            style={{
              width: 32, height: 32, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "1px solid",
              background: showFilters ? "var(--lavender)" : "#ffffff",
              borderColor: showFilters ? "var(--lavender)" : "rgba(0,0,0,0.08)",
              boxShadow: showFilters ? "none" : "0 1px 2px rgba(0,0,0,0.05)"
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.3" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
        {showFilters && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => { setSelectedCat(c.id); setFocusedId(null); }}
                style={{
                  padding: "6px 14px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", border: "1px solid", transition: "all 0.15s",
                  background: selectedCat === c.id ? "var(--lavender)" : "#ffffff",
                  color: selectedCat === c.id ? "#1a1a1a" : "var(--text-secondary)",
                  borderColor: selectedCat === c.id ? "var(--lavender)" : "rgba(0,0,0,0.08)",
                  boxShadow: selectedCat === c.id ? "none" : "0 1px 2px rgba(0,0,0,0.05)",
                  display: "flex", alignItems: "center", gap: 4
                }}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 장소 목록 */}
      {places === undefined || accommodations === undefined ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" style={{ margin: "0 auto" }} /></div>
        : (places.length === 0 && accommodations.length === 0) ? (
          <div className="glass" style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
            <p>아직 등록된 숙소나 장소가 없습니다. + 장소 추가로 시작해보세요!</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {/* 숙소 목록 */}
            {((selectedCat === "all" || selectedCat === "accommodation") ? accommodations : []).map(a => (
              <div key={a._id} id={`map-card-${a._id}`} className="glass glass-hover" style={{
                cursor: "pointer",
                background: "#ffffff",
                border: "2px solid rgba(0,0,0,0.08)",
                borderRadius: 20,
                overflow: "hidden",
                display: "flex", flexDirection: "column"
              }}
              onClick={() => focusPlace(a.lat, a.lng)}>
                <div style={{ background: "var(--mint)", padding: "6px 16px", borderBottom: "2px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#1a1a1a", fontSize: "0.8rem", fontWeight: 800, letterSpacing: 1 }}>🏨 숙소</span>
                  <button className="btn-ghost" style={{ padding: "2px 6px", fontSize: "0.72rem", color: "rgba(0,0,0,0.6)", background: "transparent", border: "none", fontWeight: 700 }}
                    onClick={(e) => { e.stopPropagation(); openScheduleModal({ ...a, category: "accommodation" }); }}>📅 일정 포함</button>
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 6, color: "#1a1a1a" }}>{a.name}</div>
                  {a.address && <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: 4 }}>📍 {a.address}</p>}

                  {apiKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/place-thumbnail?name=${encodeURIComponent(a.name)}${a.lat && a.lng ? `&lat=${a.lat}&lng=${a.lng}` : ""}`}
                      alt="" loading="lazy" style={{ width: "100%", height: 190, objectFit: "cover", display: "block", borderRadius: 10, cursor: "zoom-in", marginTop: 4, marginBottom: 4 }}
                      onClick={e => { e.stopPropagation(); setLightboxUrl(e.currentTarget.src); }}
                      onError={e => { e.currentTarget.style.display = "none"; }} />
                  )}

                  {(a.lat && a.lng) || a.address ? (
                    <div style={{ marginTop: "auto", paddingTop: 10 }}>
                      <a href={`https://maps.google.com/?q=${a.lat ? a.lat + ',' + a.lng : encodeURIComponent(a.address || a.name)}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()} style={{ display: "inline-block", color: "var(--accent)", fontSize: "0.78rem", textDecoration: "none", fontWeight: 700 }}>
                        🔗 구글 지도에서 보기
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {/* 장소 목록 */}
            {places.filter(p => selectedCat === "all" || p.category === selectedCat).map(p => {
              const cat = CATEGORIES.find(c => c.id === p.category);
              return (
                <div key={p._id} id={`map-card-${p._id}`} className="glass glass-hover" style={{ cursor: "pointer", background: "#ffffff", border: "2px solid rgba(0,0,0,0.08)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}
                  onClick={() => focusPlace(p.lat, p.lng)}>
                  <div style={{ background: "var(--mint)", padding: "6px 16px", borderBottom: "2px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#1a1a1a", fontSize: "0.8rem", fontWeight: 800, letterSpacing: 1 }}>{cat?.emoji} {cat?.label}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-ghost" style={{ padding: "2px 6px", fontSize: "0.72rem", color: "rgba(0,0,0,0.6)", background: "transparent", border: "none", fontWeight: 700 }}
                        onClick={(e) => { e.stopPropagation(); openScheduleModal(p); }}>📅 일정 포함</button>
                      <button className="btn-ghost" style={{ padding: "2px 6px", fontSize: "0.72rem", color: "rgba(0,0,0,0.6)", background: "transparent", border: "none", fontWeight: 700 }}
                        onClick={(e) => { e.stopPropagation(); handleEdit(p); }}>수정</button>
                      <button className="btn-ghost" style={{ padding: "2px 6px", fontSize: "0.72rem", color: "rgba(0,0,0,0.6)", background: "transparent", border: "none", fontWeight: 700 }}
                        onClick={(e) => { e.stopPropagation(); removePlace({ placeId: p._id }); }}>삭제</button>
                    </div>
                  </div>
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 6, color: "#1a1a1a" }}>{p.name}</div>
                    {p.address && <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: 4 }}>📍 {p.address}</p>}

                    {apiKey && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/place-thumbnail?name=${encodeURIComponent(p.name)}${p.lat && p.lng ? `&lat=${p.lat}&lng=${p.lng}` : ""}`}
                        alt="" loading="lazy" style={{ width: "100%", height: 190, objectFit: "cover", display: "block", borderRadius: 10, cursor: "zoom-in", marginBottom: 4 }}
                        onClick={e => { e.stopPropagation(); setLightboxUrl(e.currentTarget.src); }}
                        onError={e => { e.currentTarget.style.display = "none"; }} />
                    )}

                    {p.notes && <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginBottom: 4, padding: "8px", background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>{p.notes}</p>}

                    <div style={{ marginTop: "auto", paddingTop: 10 }}>
                      {p.mapLink || (p.lat && p.lng) ? (
                        <a href={p.mapLink || `https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()} style={{ display: "inline-block", color: "var(--accent)", fontSize: "0.78rem", textDecoration: "none", fontWeight: 700 }}>
                          🔗 구글 지도에서 보기
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: "", address: "", mapLink: "", category: "attraction", notes: "" }); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 20 }}>{editingId ? "✏️ 장소 수정" : "📌 장소 추가"}</h3>
            <div className="glass" style={{ padding: 14, marginBottom: 16, borderRadius: 10, background: "rgba(0,0,0,0.02)" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>💡 지도 링크를 넣으면 위도/경도를 자동으로 추출합니다.<br/>링크가 없어도 장소 이름만으로 구글 지도에서 자동 검색됩니다.</p>
            </div>
            {mapError && <p style={{ color: "var(--danger)", fontSize: "0.82rem", marginBottom: 12 }}>{mapError}</p>}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label>장소 이름 {!form.mapLink && "*"}</label><input ref={formNameInputRef} className="input" placeholder="예: 도톤보리 (검색 시 자동완성, 지도 링크만 입력해도 됨)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required={!form.mapLink} /></div>
              <div>
                <label>구글 지도 링크 (선택)</label>
                <input className="input" placeholder="https://maps.app.goo.gl/..." value={form.mapLink}
                  onChange={e => setForm(f => ({ ...f, mapLink: e.target.value }))}
                  onBlur={handleMapLinkBlur}
                  onPaste={() => setTimeout(handleMapLinkBlur, 0)} />
                {resolvingLink && <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>🔎 이름/주소 자동완성 중...</p>}
              </div>
              <div><label>주소 (선택)</label><input className="input" placeholder="주소 직접 입력 가능" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>

              <div>
                <label>카테고리</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {CATEGORIES.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => setForm(f => ({ ...f, category: c.id }))}
                      style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${form.category === c.id ? "var(--accent)" : "var(--glass-border)"}`, background: form.category === c.id ? "var(--accent-dim)" : "transparent", color: form.category === c.id ? "var(--accent)" : "var(--text-secondary)", fontSize: "0.82rem", cursor: "pointer", transition: "all 0.15s" }}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div><label>메모</label><input className="input" placeholder="메모 (선택)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: "", address: "", mapLink: "", category: "attraction", notes: "" }); setTempLatLng(null); }}>취소</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving}>
                  {saving ? <span className="spinner" /> : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scheduleTarget && (
        <div className="modal-overlay" onClick={() => setScheduleTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 16 }}>📅 일정에 포함 — {scheduleTarget.name}</h3>
            {!itineraryDays || itineraryDays.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>아직 일정에 DAY가 없습니다. 먼저 일정 탭에서 DAY를 추가해주세요.</p>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label>어느 DAY에 추가할까요?</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {itineraryDays.map((d: any) => (
                      <button key={d._id} type="button"
                        onClick={() => { setScheduleDayId(d._id); setSchedulePosition(itemsForDay(d._id).length); }}
                        style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${scheduleDayId === d._id ? "var(--accent)" : "var(--glass-border)"}`, background: scheduleDayId === d._id ? "var(--accent-dim)" : "transparent", color: scheduleDayId === d._id ? "var(--accent)" : "var(--text-secondary)", fontSize: "0.82rem", cursor: "pointer" }}>
                        DAY {d.dayNumber} ({d.date})
                      </button>
                    ))}
                  </div>
                </div>

                {scheduleDayId && (
                  <div style={{ marginBottom: 20 }}>
                    <label>순서</label>
                    {itemsForDay(scheduleDayId).length === 0 ? (
                      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>이 DAY의 첫 일정으로 추가됩니다.</p>
                    ) : (
                      <select className="input" value={schedulePosition} onChange={e => setSchedulePosition(Number(e.target.value))}>
                        {itemsForDay(scheduleDayId).map((it: any, idx: number) => (
                          <option key={it._id} value={idx}>{idx + 1}번째 — “{it.placeName}” 앞에</option>
                        ))}
                        <option value={itemsForDay(scheduleDayId).length}>맨 마지막에 추가</option>
                      </select>
                    )}
                  </div>
                )}
              </>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setScheduleTarget(null)}>취소</button>
              {itineraryDays && itineraryDays.length > 0 && (
                <button type="button" className="btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={!scheduleDayId || scheduling} onClick={handleConfirmSchedule}>
                  {scheduling ? <span className="spinner" /> : "추가"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <button onClick={() => setLightboxUrl(null)}
            style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }}
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
