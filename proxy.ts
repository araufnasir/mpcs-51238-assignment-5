import { clerkMiddleware } from "@clerk/nextjs/server";

// Makes the Clerk session available to server code. Access control is not
// done here: every page, route handler and server action that touches data
// calls auth.protect() itself (Clerk's recommended resource-based checks).
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
