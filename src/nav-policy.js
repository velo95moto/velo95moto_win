export function canShowAssemblyOrderCreate(bootstrap = {}) {
  const user = bootstrap.user || {};
  const roles = bootstrap.roles || {};
  const nav = Array.isArray(bootstrap.nav) ? bootstrap.nav : [];
  if (user.is_superuser) return true;
  if (roles.is_operator_role) return false;
  return Boolean(roles.is_view_only_role || nav.some((item) => item.id === "assembly_order"));
}

export function canShowAssemblyOrdersList(bootstrap = {}) {
  const user = bootstrap.user || {};
  const roles = bootstrap.roles || {};
  const nav = Array.isArray(bootstrap.nav) ? bootstrap.nav : [];
  if (user.is_superuser) return true;
  if (roles.is_view_only_role) return false;
  return Boolean(roles.is_operator_role || nav.some((item) => item.id === "assembly_orders"));
}
