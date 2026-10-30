import { TogetherlyBrand } from "./ui/togetherly-brand";

export default function Loading() {
  return (
    <main
      className="route-loading"
      aria-busy="true"
      aria-label="Opening your family space"
    >
      <div className="account-brand">
        <TogetherlyBrand tagline={false} />
      </div>
      <p role="status">Opening your family space</p>
      <div className="loading-layout" aria-hidden="true">
        <div className="skeleton loading-title" />
        <div className="loading-moments">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
        <div className="skeleton loading-photo" />
      </div>
    </main>
  );
}
