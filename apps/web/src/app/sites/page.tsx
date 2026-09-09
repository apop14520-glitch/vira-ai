import { ModulePage } from "@/components/module-page";
import { productModules } from "@/lib/modules";

export default function SitesPage() {
  return <ModulePage module={productModules.find((module) => module.slug === "sites")!} />;
}

