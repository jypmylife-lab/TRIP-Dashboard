"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const CATEGORIES = [
  { id: "accommodation", label: "숙소", emoji: "🏨" },
  { id: "food", label: "음식", emoji: "🍜" },
  { id: "cafe", label: "카페", emoji: "☕" },
  { id: "attraction", label: "관광", emoji: "🏛️" },
  { id: "shopping", label: "쇼핑", emoji: "🛍️" },
  { id: "transport", label: "교통", emoji: "🚌" },
  { id: "other", label: "기타", emoji: "📌" },
];

export default function MapTab({ trip }: { trip: any }) {
  const places = useQuery(api.places.listPlacesByTrip, { tripId: trip._id });
  const accommodations = useQuery(api.accommodations.listByTrip, { tripId: trip._id });
  const updateAccommodation = useMutation(api.accommodations.update);
  const addPlace = useMutation(api.places.addPlace);
  const updatePlace = useMutation(api.places.updatePlace);
  const removePlace = useMutation(api.places.removePlace);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", mapLink: "", category: "attraction", notes: "" });
  const [saving, setSaving] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  // 구글 맵스 API 로드 및 초기화
  useEffect(() => {
    if (!apiKey) return;
    const existingScript = document.getElementById("google-maps-script");
    
    function init() {
      if (mapRef.current && !mapInstance && (window as any).google?.maps) {
        const google = (window as any).google;
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 37.5, lng: 127 },
          zoom: 12,
          gestureHandling: "greedy",   // 손가락 1개로 이동 가능
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
        });
        setMapInstance(map);
        infoWindowRef.current = new google.maps.InfoWindow();
      }
    }

    if (existingScript) {
      init();
    } else {
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onload = init;
      document.head.appendChild(script);
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

    // 마커 클릭 리스너 헬퍼
    const addMarkerListener = (marker: any, content: string) => {
      marker.addListener("click", () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(`
            <div style="padding: 14px 18px; min-width: 140px; background: #ffffff; cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('closeInfoWindow'))">
              <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 2px;">
                ${content}
              </div>
              <div style="font-size: 0.72rem; color: #64748b; font-weight: 500;">
                지도를 보려면 닫기
              </div>
            </div>
          `);
          infoWindowRef.current.open(mapInstance, marker);
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
          icon: "http://maps.google.com/mapfiles/ms/icons/purple-dot.png"
        });
        addMarkerListener(marker, `🏨 ${a.name}`);
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
          let emoji = "📌";
          if (p.category === "food") { color = "orange-dot"; emoji = "🍜"; }
          else if (p.category === "shopping") { color = "pink-dot"; emoji = "🛍️"; }
          else if (p.category === "attraction") { color = "blue-dot"; emoji = "🏛️"; }
          
          const marker = new google.maps.Marker({
            position: pos, map: mapInstance, title: p.name,
            icon: `http://maps.google.com/mapfiles/ms/icons/${color}.png`
          });
          addMarkerListener(marker, `${emoji} ${p.name}`);
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
          // 서버 사이드 리졸버 호출 (단축 링크 해결)
          try {
            const res = await fetch(`/api/resolve-map-link?url=${encodeURIComponent(form.mapLink)}`);
            const data = await res.json();
            if (data.lat && data.lng) {
              lat = data.lat;
              lng = data.lng;
            }
          } catch (e) {
            console.warn("Link resolution API failed", e);
          }
        }
      }

      // 이름만 있고 좌표가 없다면 Geocoding API 찔러서 찾아주기
      if ((lat === undefined || lng === undefined) && form.name) {
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

      const payload = {
        name: form.name,
        address: form.address || undefined,
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
      if (lat !== undefined && lng !== undefined) focusPlace(lat, lng);
    } catch (err: any) {
      console.error("장소 저장 오류:", err);
      setMapError(`저장 중 오류가 발생했습니다: ${err.message || "알 수 없는 에러"}`);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(p: any) {
    setForm({ name: p.name || "", address: p.address || "", mapLink: p.mapLink || "", category: p.category || "attraction", notes: p.notes || "" });
    setEditingId(p._id);
    setShowForm(true);
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
              strokeColor: "#ffffff",
              strokeWeight: 2,
            }
          });
        },
        (err) => console.warn("GPS failed", err),
        { enableHighAccuracy: true }
      );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.1rem" }}>🗺️ 지도</h2>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ 장소 추가</button>
      </div>

      {/* 지도 표시 */}
      <div className="glass" style={{ borderRadius: 16, overflow: "hidden", height: 380, position: "relative" }}>
        {apiKey ? (
          <>
            <style>{`
              .gm-style-iw-c { padding: 16px !important; border-radius: 16px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important; }
              .gm-style-iw-d { overflow: hidden !important; }
              .gm-ui-hover-effect { display: none !important; }
            `}</style>
            <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
            <button
              onClick={findMyLocation}
              style={{
                position: "absolute", bottom: 80, right: 12,
                width: 44, height: 44, borderRadius: "50%",
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.1)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", zIndex: 10,
                fontSize: 20, color: "#4285F4"
              }}
              title="내 위치 찾기"
            >
              📍
            </button>
          </>
        ) : (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: 12 }}>
            <div style={{ fontSize: 48 }}>🗺️</div>
            <p style={{ fontSize: "0.9rem" }}>Google Maps API 키가 필요합니다</p>
            <p style={{ fontSize: "0.78rem" }}>.env.local에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 설정해주세요</p>
          </div>
        )}
      </div>

      {/* 카테고리 필터 UI - 항상 표시 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        <button className={`badge ${selectedCat === "all" ? "badge-purple" : ""}`} onClick={() => setSelectedCat("all")} 
          style={{ cursor: "pointer", background: selectedCat !== "all" ? "rgba(0,0,0,0.05)" : undefined, color: selectedCat !== "all" ? "var(--text-secondary)" : undefined }}>
          모두
        </button>
        {CATEGORIES.map(c => (
          <button key={c.id} className={`badge ${selectedCat === c.id ? "badge-purple" : ""}`} onClick={() => setSelectedCat(c.id)} 
            style={{ cursor: "pointer", background: selectedCat !== c.id ? "rgba(0,0,0,0.05)" : undefined, color: selectedCat !== c.id ? "var(--text-secondary)" : undefined, display: "flex", alignItems: "center", gap: 3 }}>
            {c.emoji} {c.label}
          </button>
        ))}
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
            {selectedCat === "all" || selectedCat === "accommodation" ? accommodations.map(a => (
              <div key={a._id} className="glass glass-hover" style={{ 
                padding: 16, cursor: "pointer", 
                background: "#fffbeb",
                border: "1px solid rgba(0,0,0,0.06)",
                borderLeft: "3px solid #d4b248",
                boxShadow: "0 2px 4px -2px rgba(0,0,0,0.03)"
              }}
              onClick={() => focusPlace(a.lat, a.lng)}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 18 }}>🏨</span>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{a.name}</span>
                    </div>
                    <span className="badge badge-yellow" style={{ marginBottom: 6 }}>숙소</span>
                    {a.address && <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 4 }}>📍 {a.address}</p>}
                  </div>
                </div>
                {(a.lat && a.lng) || a.address ? (
                  <a href={`https://maps.google.com/?q=${a.lat ? a.lat + ',' + a.lng : encodeURIComponent(a.address || a.name)}`} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()} style={{ display: "inline-block", marginTop: 10, color: "var(--accent)", fontSize: "0.78rem", textDecoration: "none" }}>
                    🔗 구글 지도에서 보기
                  </a>
                ) : null}
              </div>
            )) : null}
            
            {/* 장소 목록 */}
            {places.filter(p => selectedCat === "all" || p.category === selectedCat).map(p => {
              const cat = CATEGORIES.find(c => c.id === p.category);
              return (
                <div key={p._id} className="glass glass-hover" style={{ padding: 16, cursor: "pointer", background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 4px -2px rgba(0,0,0,0.03)" }}
                  onClick={() => focusPlace(p.lat, p.lng)}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 20 }}>{cat?.emoji || "📌"}</span>
                        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{p.name}</span>
                      </div>
                      <span className="badge badge-purple" style={{ marginBottom: 6 }}>{cat?.label}</span>
                      {p.address && <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 4 }}>📍 {p.address}</p>}
                      {p.notes && <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginTop: 4 }}>{p.notes}</p>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: "0.72rem", color: "var(--danger)", background: "transparent", border: "none", textAlign: "right" }}
                        onMouseEnter={e => e.currentTarget.style.background="rgba(239, 68, 68, 0.1)"}
                        onMouseLeave={e => e.currentTarget.style.background="transparent"}
                        onClick={(e) => { e.stopPropagation(); removePlace({ placeId: p._id }); }}>삭제</button>
                      <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: "0.72rem", color: "var(--accent)", background: "transparent", border: "none", textAlign: "right" }}
                        onMouseEnter={e => e.currentTarget.style.background="rgba(99, 102, 241, 0.1)"}
                        onMouseLeave={e => e.currentTarget.style.background="transparent"}
                        onClick={(e) => { e.stopPropagation(); handleEdit(p); }}>수정</button>
                    </div>
                  </div>
                  {p.mapLink || (p.lat && p.lng) ? (
                    <a href={p.mapLink || `https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()} style={{ display: "inline-block", marginTop: 10, color: "var(--accent)", fontSize: "0.78rem", textDecoration: "none" }}>
                      🔗 구글 지도에서 보기
                    </a>
                  ) : null}
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
              <div><label>장소 이름 *</label><input className="input" placeholder="예: 도톤보리" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div><label>구글 지도 링크 (선택)</label><input className="input" placeholder="https://maps.app.goo.gl/..." value={form.mapLink} onChange={e => setForm(f => ({ ...f, mapLink: e.target.value }))} /></div>
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
                <button type="button" className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowForm(false)}>취소</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving}>
                  {saving ? <span className="spinner" /> : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
