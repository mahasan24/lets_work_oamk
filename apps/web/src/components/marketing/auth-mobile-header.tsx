import Logo from "./logo";
import { AUTH_BACKGROUND_IMAGE } from "./auth-image";

export default function AuthMobileHeader() {
  return (
    <div className="relative h-36 overflow-hidden bg-background lg:hidden">
      <img
        src={AUTH_BACKGROUND_IMAGE}
        alt=""
        className="absolute inset-0 size-full object-cover object-[center_35%]"
      />
      <div className="relative p-6">
        <Logo variant="light" />
      </div>
    </div>
  );
}
