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

export function canShowAdminHelper(bootstrap = {}) {
  const user = bootstrap.user || {};
  if (typeof user.can_use_admin_helper === "boolean") return user.can_use_admin_helper;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return Boolean(user.is_superuser || permissions.includes("auth.change_user"));
}

export function canShowFileExchange(bootstrap = {}) {
  const user = bootstrap.user || {};
  if (typeof user.can_use_file_exchange === "boolean") return user.can_use_file_exchange;
  return Boolean(user.username || user.display_name || bootstrap.access_token);
}
