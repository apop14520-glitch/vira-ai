import { ModulePage } from "@/components/module-page";
import { productModules } from "@/lib/modules";

export default function StudioPage() {
  return <ModulePage module={productModules.find((module) => module.slug === "studio")!} />;
}

