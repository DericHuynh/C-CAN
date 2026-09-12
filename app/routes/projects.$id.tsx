import { Navigate, useLocation, useParams } from "react-router";
import { legacyProjectLocation } from "@shared/project-routes";

/** Existing bookmarks keep their tab, selected entities and anchor. */
export default function LegacyProjectRoute() {
  const { id } = useParams();
  const { search, hash } = useLocation();
  return <Navigate replace to={legacyProjectLocation(id!, search, hash)} />;
}
