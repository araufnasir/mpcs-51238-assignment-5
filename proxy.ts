import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Makes the Clerk session available to server code. Access control is not
// done here: every page, route handler and server action that touches data
// calls auth.protect() itself (Clerk's recommended resource-based checks).
// The one thing done here: signed-in users landing on / go straight to /live.
export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname === "/" && (await auth()).userId) {
    return NextResponse.redirect(new URL("/live", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
