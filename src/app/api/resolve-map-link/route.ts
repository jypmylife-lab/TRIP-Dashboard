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
        lng = parseFloat(lngMatch[2]);
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

    // 패턴 4: Place ID 추출 (!1s 패턴) - 가장 정확함
    if (!lat || isNaN(lat)) {
      const placeIdMatch = finalUrl.match(/!1s(0x[0-9a-f]+:[0-9a-f]+)/i) || finalUrl.match(/place_id=([^&]+)/);
      if (placeIdMatch && API_KEY) {
        const placeId = placeIdMatch[1];
        try {
          const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${API_KEY}`);
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results.length > 0) {
            lat = geoData.results[0].geometry.location.lat;
            lng = geoData.results[0].geometry.location.lng;
          }
        } catch (e) {
          console.warn('Place ID Geocoding failed:', e);
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

    return NextResponse.json({ 
      finalUrl, 
      lat: (lat !== undefined && !isNaN(lat)) ? lat : null,
      lng: (lng !== undefined && !isNaN(lng)) ? lng : null
    });
  } catch (err: any) {
    console.error('Link resolution failed:', err);
    return NextResponse.json({ error: 'Failed to resolve link', details: err.message }, { status: 500 });
  }
}
