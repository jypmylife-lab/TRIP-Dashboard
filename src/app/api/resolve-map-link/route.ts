import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    // 1. 단축 링크 해결 (리다이렉트 따라가기)
    let finalUrl = url;
    const res = await fetch(url, { 
      method: 'GET',
      redirect: 'follow', 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    finalUrl = res.url;

    // 2. 최종 URL에서 좌표 추출 로직 적용
    let lat: number | undefined;
    let lng: number | undefined;

    // 패턴 1: @lat,lng
    let match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    
    // 패턴 2: !3d lat !4d long (데스크톱/긴 주소)
    if (!match) {
      const latMatch = finalUrl.match(/!3d(-?\d+\.\d+)/);
      const lngMatch = finalUrl.match(/!4d(-?\d+\.\d+)/);
      if (latMatch && lngMatch) match = [null, latMatch[1], lngMatch[1]] as any;
    }

    // 패턴 3: q=lat,lng 또는 query=lat,lng 패턴
    if (!match) {
      const llMatch = finalUrl.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (llMatch) match = llMatch;
    }

    // 패턴 4: 데이터 문자열 안의 좌표 직접 파싱 (data=...!3d...!4d...)
    if (!lat && finalUrl.includes('!3d')) {
       try {
         const parts = finalUrl.split('!3d');
         if (parts.length > 1) {
           const latVal = parts[1].split('!')[0];
           const lngPart = finalUrl.split('!4d');
           if (lngPart.length > 1) {
             const lngVal = lngPart[1].split('!')[0].split('?')[0];
             const pLat = parseFloat(latVal);
             const pLng = parseFloat(lngVal);
             if (!isNaN(pLat) && !isNaN(pLng)) {
               lat = pLat;
               lng = pLng;
             }
           }
         }
       } catch (e) {
         console.warn("Manual data coordinate extraction failed");
       }
    }

    if (!lat && match) {
      const pLat = parseFloat(match[1]);
      const pLng = parseFloat(match[2]);
      if (!isNaN(pLat) && !isNaN(pLng)) {
        lat = pLat;
        lng = pLng;
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
