import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

// <SignIn /> reads the URL, so it renders behind a Suspense boundary (Cache Components).
export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <Suspense>
        <SignIn />
      </Suspense>
    </div>
  );
}
