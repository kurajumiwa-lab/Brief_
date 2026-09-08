export function openWork(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("work", id);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new CustomEvent("brief:work-open", { detail: id }));
}
