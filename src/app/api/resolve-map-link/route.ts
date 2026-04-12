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
      redirect: 'follow', // 리다이렉트를 자동으로 따라감
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
    
    // 패턴 2: !3dlat!4dlong
    if (!match) {
      const latMatch = finalUrl.match(/!3d(-?\d+\.\d+)/);
      const lngMatch = finalUrl.match(/!4d(-?\d+\.\d+)/);
      if (latMatch && lngMatch) match = [null, latMatch[1], lngMatch[1]] as any;
    }

    // 패턴 3: q=lat,lng 또는 ll=lat,lng
    if (!match) {
      const llMatch = finalUrl.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (llMatch) match = llMatch;
    }

    if (match) {
      lat = parseFloat(match[1]);
      lng = parseFloat(match[2]);
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
