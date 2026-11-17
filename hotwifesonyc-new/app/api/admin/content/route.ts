import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, privateHeaders } from '../../../../lib/admin';
import { sameOrigin } from '../../../../lib/auth.mjs';
import { readContent, saveContent } from '../../../../lib/store.mjs';
export async function GET() { if(!await isAdmin()) return NextResponse.json({error:'Unauthorized'},{status:401,headers:privateHeaders}); return NextResponse.json(await readContent(),{headers:privateHeaders}); }
export async function PUT(request: NextRequest) {
  if(!await isAdmin()) return NextResponse.json({error:'Unauthorized'},{status:401,headers:privateHeaders});
  if(!sameOrigin(request)) return NextResponse.json({error:'Invalid origin'},{status:403,headers:privateHeaders});
  const body=await request.text(); if(body.length>2000000) return NextResponse.json({error:'Content too large'},{status:413,headers:privateHeaders});
  try { const data=JSON.parse(body); return NextResponse.json(await saveContent({site:data.site,catalog:data.catalog},data.revision),{headers:privateHeaders}); }
  catch(error) { const e=error as Error & {status?:number;code?:string}; if(e.code) return NextResponse.json({error:'Could not save. Your edits are preserved; check local storage permissions.'},{status:500,headers:privateHeaders}); return NextResponse.json({error:e.message},{status:e.status || 400,headers:privateHeaders}); }
}
