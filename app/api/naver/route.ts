// app/api/naver/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { token } = await req.json();

  const response = await fetch('https://openapi.naver.com/v1/nid/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  return NextResponse.json(data);
}