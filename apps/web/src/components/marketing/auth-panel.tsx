import Logo from "./logo";
import { AUTH_BACKGROUND_IMAGE } from "./auth-image";

export default function AuthPanel() {
  return (
    <div className="relative hidden min-h-full overflow-hidden lg:block lg:w-[45%] xl:w-1/2">
      <img
        src={AUTH_BACKGROUND_IMAGE}
        alt=""
        className="absolute inset-0 size-full object-cover"
        loading="eager"
        decoding="async"
      />
      <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
        <Logo variant="light" />
      </div>
    </div>
  );
}
