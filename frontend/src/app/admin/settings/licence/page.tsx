import { redirect } from "next/navigation";

export default function AdminLicenceSettingsRedirectPage() {
  redirect("/dashboard/settings?tab=licence");
}
