import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    // 1. 단축 링크 해결 (리다이렉트 따라가기)
    const res = await fetch(url, { 
      method: 'GET',
      redirect: 'follow', 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const finalUrl = res.url;
    let lat: number | undefined;
    let lng: number | undefined;
    let rating: number | null = null;
    let ratingsTotal: number | null = null;

    // --- 추출 로직 시작 ---

    // 패턴 1: @lat,lng
    const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    }

    // 패턴 2: !3d lat !4d long (데스크톱/긴 주소)
    if (!lat) {
      const latMatch = finalUrl.match(/!3d(-?\d+\.\d+)/);
      const lngMatch = finalUrl.match(/!4d(-?\d+\.\d+)/);
      if (latMatch && lngMatch) {
        lat = parseFloat(latMatch[1]);
        lng = parseFloat(lngMatch[1]);
      }
    }

    // 패턴 3: q=lat,lng 또는 query=lat,lng
    if (!lat) {
      const llMatch = finalUrl.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (llMatch) {
        lat = parseFloat(llMatch[1]);
        lng = parseFloat(llMatch[2]);
      }
    }

    // 패턴 4: Place ID 추출 (!1s 패턴) - 가장 정확함. Place Details API로 좌표와 평점을 한 번에 가져옴
    if (!lat || isNaN(lat)) {
      const placeIdMatch = finalUrl.match(/!1s(0x[0-9a-f]+:[0-9a-f]+)/i) || finalUrl.match(/place_id=([^&]+)/);
      if (placeIdMatch && API_KEY) {
        const placeId = placeIdMatch[1];
        try {
          const detailsRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,rating,user_ratings_total&key=${API_KEY}`);
          const detailsData = await detailsRes.json();
          const loc = detailsData.result?.geometry?.location;
          if (loc) {
            lat = loc.lat;
            lng = loc.lng;
          }
          if (typeof detailsData.result?.rating === "number") {
            rating = detailsData.result.rating;
            ratingsTotal = detailsData.result.user_ratings_total ?? null;
          }
        } catch (e) {
          console.warn('Place Details lookup failed:', e);
        }
      }
    }

    // 패턴 5: data= 안의 좌표 (최후의 수단 파싱)
    if (!lat && finalUrl.includes('!3d')) {
       const parts = finalUrl.split('!3d');
       const latPart = parts[1]?.split('!')[0];
       const longParts = finalUrl.split('!4d');
       const lngPart = longParts[1]?.split('!')[0]?.split('?')[0];
       if (latPart && lngPart) {
         lat = parseFloat(latPart);
         lng = parseFloat(lngPart);
       }
    }

    // 패턴 6: 모바일 "공유 → 링크 복사"로 만든 링크는 보통 /maps?q=업체명+주소&ftid=... 형태로 끝남
    // (위 패턴들이 전혀 못 잡는 형태) - q= 안의 텍스트를 Places API로 바로 검색해서 정확한 이름/주소/좌표를 한 번에 찾음
    let placesTextResult: { name?: string; address?: string; lat?: number; lng?: number } | null = null;
    if ((lat === undefined || isNaN(lat)) && API_KEY) {
      const qMatch = finalUrl.match(/[?&]q=([^&]+)/);
      const qText = qMatch ? decodeURIComponent(qMatch[1].replace(/\+/g, " ")) : null;
      // 순수 "위도,경도" 숫자 쌍은 패턴 3에서 이미 처리되므로, 텍스트인 경우만 검색
      if (qText && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(qText)) {
        try {
          const fpRes = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(qText)}&inputtype=textquery&fields=name,formatted_address,geometry,rating,user_ratings_total&key=${API_KEY}`);
          const fpData = await fpRes.json();
          const candidate = fpData.candidates?.[0];
          if (candidate?.geometry?.location) {
            placesTextResult = {
              name: candidate.name,
              address: candidate.formatted_address,
              lat: candidate.geometry.location.lat,
              lng: candidate.geometry.location.lng,
            };
            lat = placesTextResult.lat;
            lng = placesTextResult.lng;
          }
          if (typeof candidate?.rating === "number") {
            rating = candidate.rating;
            ratingsTotal = candidate.user_ratings_total ?? null;
          }
        } catch (e) {
          console.warn('findplacefromtext fallback failed:', e);
        }
      }
    }

    // 장소 이름: 리다이렉트된 URL 경로(/maps/place/이름/...)에서 바로 추출, 없으면 패턴 6 결과 사용
    let name: string | null = null;
    const nameMatch = finalUrl.match(/\/maps\/place\/([^/]+)\//);
    if (nameMatch) {
      name = decodeURIComponent(nameMatch[1].replace(/\+/g, " "));
    } else if (placesTextResult?.name) {
      name = placesTextResult.name;
    }

    // 주소: 패턴 6에서 이미 찾았다면 그대로 쓰고, 아니면 좌표 기반 역지오코딩으로 채움
    let address: string | null = placesTextResult?.address || null;
    if (!address && lat !== undefined && !isNaN(lat) && lng !== undefined && !isNaN(lng) && API_KEY) {
      try {
        const revRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`);
        const revData = await revRes.json();
        if (revData.results?.length > 0) {
          address = revData.results[0].formatted_address;
        }
      } catch (e) {
        console.warn("Reverse geocoding failed:", e);
      }
    }

    // 평점: 위에서 아직 못 찾았다면(=좌표가 URL에 바로 박혀있던 가장 흔한 케이스), 이름으로 한 번 더 검색해서 채움
    if (rating === null && name && API_KEY) {
      try {
        const ratingQuery = address ? `${name} ${address}` : name;
        const ratingRes = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(ratingQuery)}&inputtype=textquery&fields=rating,user_ratings_total&key=${API_KEY}`);
        const ratingData = await ratingRes.json();
        const candidate = ratingData.candidates?.[0];
        if (typeof candidate?.rating === "number") {
          rating = candidate.rating;
          ratingsTotal = candidate.user_ratings_total ?? null;
        }
      } catch (e) {
        console.warn('Rating lookup failed:', e);
      }
    }

    return NextResponse.json({
      finalUrl,
      lat: (lat !== undefined && !isNaN(lat)) ? lat : null,
      lng: (lng !== undefined && !isNaN(lng)) ? lng : null,
      name,
      address,
      rating,
      ratingsTotal,
    });
  } catch (err: any) {
    console.error('Link resolution failed:', err);
    return NextResponse.json({ error: 'Failed to resolve link', details: err.message }, { status: 500 });
  }
}
