import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, SESSION_SECONDS, getCredentials, checkPassword, createSession, sameOrigin, loginAllowed, failedLogin, successfulLogin, secureCookie } from '../../../../lib/auth.mjs';
import { privateHeaders } from '../../../../lib/admin';
export async function POST(request: NextRequest) {
  if(!sameOrigin(request)) return NextResponse.json({error:'Invalid origin'},{status:403,headers:privateHeaders});
  if(!loginAllowed()) return NextResponse.json({error:'Too many attempts. Try again in 15 minutes.'},{status:429,headers:privateHeaders});
  const credential=await getCredentials();
  if(!credential) return NextResponse.json({error:'Administrator not configured. Run npm run admin:setup locally.'},{status:503,headers:privateHeaders});
  const body=await request.text(); if(body.length>2000) return NextResponse.json({error:'Invalid request'},{status:413,headers:privateHeaders});
  let password; try { password=JSON.parse(body).password; } catch { return NextResponse.json({error:'Invalid request'},{status:400,headers:privateHeaders}); }
  if(!checkPassword(password,credential)) { failedLogin(); return NextResponse.json({error:'Invalid password'},{status:401,headers:privateHeaders}); }
  successfulLogin(); const response=NextResponse.json({ok:true},{headers:privateHeaders});
  response.cookies.set(COOKIE,createSession(credential),{httpOnly:true,sameSite:'strict',secure:secureCookie(request),path:'/',maxAge:SESSION_SECONDS}); return response;
}
