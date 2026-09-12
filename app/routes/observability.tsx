import { useT } from "@agent-native/core/client/i18n";
import { ObservabilityDashboard } from "@agent-native/core/client/observability";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";

import enUS from "@/i18n/en-US";

export function meta() {
  return [{ title: enUS.pages.observabilityPageTitle }];
}

export default function ObservabilityPage() {
  const t = useT();
  useSetPageTitle(t("pages.observabilityPageTitle"));
  return (
    <div className="p-4 lg:p-6">
      {/* Keep the framework tab strip reachable in narrow containers. */}
      <ObservabilityDashboard className="[&>div:first-child>div:first-child]:max-w-full [&>div:first-child>div:first-child]:flex-wrap" />
    </div>
  );
}
