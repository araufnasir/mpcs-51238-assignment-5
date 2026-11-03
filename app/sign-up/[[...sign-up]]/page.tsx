import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

// <SignUp /> reads the URL, so it renders behind a Suspense boundary (Cache Components).
export default function SignUpPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <Suspense>
        <SignUp />
      </Suspense>
    </div>
  );
}
