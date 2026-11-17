import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin, COOKIE, secureCookie } from '../../../../lib/auth.mjs';
import { privateHeaders } from '../../../../lib/admin';
export async function POST(request: NextRequest) {
  if(!sameOrigin(request)) return NextResponse.json({error:'Invalid origin'},{status:403,headers:privateHeaders});
  const response=NextResponse.json({ok:true},{headers:privateHeaders}); response.cookies.set(COOKIE,'',{httpOnly:true,sameSite:'strict',secure:secureCookie(request),path:'/',maxAge:0});return response;
}
