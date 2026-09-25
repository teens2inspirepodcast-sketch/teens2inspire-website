import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (path.startsWith("/api/") && path !== "/api/stripe/webhook" && isMutation) {
    const origin = request.headers.get("origin");
    let originMatches = false;
    try { originMatches = Boolean(origin && new URL(origin).origin === request.nextUrl.origin); } catch {}
    if (!originMatches) return NextResponse.json({ error: "Please reload the page and try again." }, { status: 403 });
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return NextResponse.next({request});
  let response=NextResponse.next({request});
  const supabase=createServerClient(url,key,{
    cookieOptions:{path:"/",sameSite:"lax",secure:process.env.NODE_ENV==="production"},
    cookies:{
      getAll(){return request.cookies.getAll();},
      setAll(cookiesToSet){
        cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request});
        cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
