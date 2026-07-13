import {Navigate, useLocation, useNavigate} from "react-router-dom";
import {useAppContext} from "../AppContext";
import {AuthPage} from "../pages/AuthPage";
import {paths} from "./paths";

interface AuthRouteProps {
  mode: "signin" | "signup";
}

export const AuthRoute = ({mode}: AuthRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {setProfile} = useAppContext();
  const redirectTarget =
    typeof location.state === "object" && location.state && "from" in location.state
      ? String((location.state as {from?: string}).from ?? paths.home)
      : paths.home;

  return (
    <AuthPage
      initialMode={mode}
      onDone={() => navigate(redirectTarget, {replace: true})}
      onProfileLoaded={setProfile}
    />
  );
};

export const ContinueWatchingRoute = () => <Navigate replace to={`${paths.watchlist}#continue-watching`} />;
