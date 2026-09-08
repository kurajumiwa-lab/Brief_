import React, { lazy, Suspense } from "react";
const Workspace = lazy(() =>
  import("./QuoteWorkspace").then((m) => ({ default: m.QuoteWorkspace })),
);
export function QuoteWorkspace(props: {
  requestId?: string;
  onRequestChanged?: () => void;
}) {
  return (
    <Suspense fallback={<p role="status">Loading commercial workspace…</p>}>
      <Workspace {...props} />
    </Suspense>
  );
}
