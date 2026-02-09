"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PermissionsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/roles");
  }, [router]);
  return (
    <div className="p-6">
      <p className="text-zinc-500">Redirecting to Roles & Permissions...</p>
    </div>
  );
}
