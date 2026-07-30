export function hasActiveCatalogFilters(state) {
  return Boolean(
    state.zone ||
    state.floor ||
    state.query ||
    state.photoOnly ||
    state.myOnly
  );
}

export function buildCatalogRequestParams(
  state,
  { append, page, pageSize, snapshotPageSize, fresh }
) {
  if (!append && !hasActiveCatalogFilters(state)) {
    return { page: 1, pageSize: snapshotPageSize, fresh };
  }

  return {
    zone: state.zone,
    floor: state.floor,
    query: state.query,
    photoOnly: state.photoOnly,
    myOnly: state.myOnly,
    employeeId: state.employeeId,
    page,
    pageSize
  };
}
