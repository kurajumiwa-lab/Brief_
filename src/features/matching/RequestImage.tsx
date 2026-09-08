import React, { useEffect, useState } from "react";
import * as api from "../../api/briefApi";
import { SessionSignIn } from "../../components/SessionSignIn";
export function RequestImage({ id, name }: { id: string; name: string }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <div className="request-private-image">
      <button
        type="button"
        onClick={async () => {
          const r = await api.readPrivateEvidence(id);
          if (r.ok) {
            setUrl(URL.createObjectURL(r.data));
            setError("");
          } else setError(r.error);
        }}
      >
        Open {name} (private)
      </button>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => setAuth(true)}>Sign in again</button>
        </>
      )}
      {auth && (
        <SessionSignIn
          title="Sign in to view your Request image"
          onSignedIn={() => {
            setAuth(false);
            setError("Signed in. Open the image again.");
          }}
        />
      )}
      {url && (
        <div role="dialog" aria-label="Private Request image">
          <img src={url} alt={name} />
          <button onClick={() => setUrl("")}>Close image</button>
        </div>
      )}
    </div>
  );
}
