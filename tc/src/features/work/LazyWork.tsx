import React, { lazy, Suspense } from "react";
const Workspace = lazy(() =>
  import("./WorkWorkspace").then((m) => ({ default: m.WorkWorkspace })),
);
export function WorkWorkspace(props: {
  requestId?: string;
  onRequestChanged?: () => void;
}) {
  return (
    <Suspense fallback={<p role="status">Loading work…</p>}>
      <Workspace {...props} />
    </Suspense>
  );
}
