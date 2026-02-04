import { useMemo } from "react";
import { useUserContext } from "../context/userContext";

export function usePermission() {
  const { user } = useUserContext();

  const permissions = useMemo(() => {
    return Array.isArray(user?.permissions) ? user.permissions : [];
  }, [user]);

  const hasPermission = (permissionKey) => permissions.includes(permissionKey);

  return {
    user,
    permissions,
    hasPermission,
  };
}

export function Can({ permission, children, fallback = null }) {
  const { hasPermission } = usePermission();
  if (!permission) return children;
  return hasPermission(permission) ? children : fallback;
}
