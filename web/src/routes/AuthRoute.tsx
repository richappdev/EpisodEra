import {Navigate, useLocation, useNavigate} from "react-router-dom";
import {useAppContext} from "../AppContext";
import {AuthPage} from "../pages/AuthPage";
import {paths} from "./paths";
import {useLocale} from "./LocaleContext";

interface AuthRouteProps {
  mode: "signin" | "signup";
}

export const AuthRoute = ({mode}: AuthRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {urlLocale} = useLocale();
  const {setProfile} = useAppContext();
  const redirectTarget =
    typeof location.state === "object" && location.state && "from" in location.state
      ? String((location.state as {from?: string}).from ?? paths.home(urlLocale))
      : paths.home(urlLocale);

  return (
    <AuthPage
      initialMode={mode}
      onDone={() => navigate(redirectTarget, {replace: true})}
      onProfileLoaded={setProfile}
    />
  );
};

export const ContinueWatchingRoute = () => {
  const {urlLocale} = useLocale();
  return <Navigate replace to={`${paths.watchlist(urlLocale)}#continue-watching`} />;
};
