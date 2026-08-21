import { ProfilePanel } from "../components/ProfilePanel";

export default function ProfilePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-headline-lg text-on-surface">Profile</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Your details, keys, and connections — everything lives here.
        </p>
      </header>
      <ProfilePanel />
    </div>
  );
}
