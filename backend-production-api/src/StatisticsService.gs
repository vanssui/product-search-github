function getStatisticsApi_(payload) {
  var snapshot = getTaskSnapshot_();
  var filters = normalizeCatalogFilters_(payload || {});
  var tasks = filterTasks_(snapshot.tasks, filters, true);
  var statuses = {};
  var employees = {};

  tasks.forEach(function(task) {
    var status = stringify_(task.statusSearch) || 'Без статуса';
    statuses[status] = (statuses[status] || 0) + 1;
    var employee = stringify_(task.employeeId).toUpperCase();
    if (employee) employees[employee] = (employees[employee] || 0) + 1;
  });

  return {
    generatedAt: snapshot.generatedAt,
    totalActive: snapshot.tasks.length,
    filteredCount: tasks.length,
    photoCount: tasks.filter(function(task) { return task.hasPhoto; }).length,
    assignedCount: tasks.filter(function(task) {
      return Boolean(stringify_(task.employeeId));
    }).length,
    distinctEmployeeCount: Object.keys(employees).length,
    blocks: buildBlockFacets_(snapshot.tasks, filters),
    floors: buildFloorFacets_(snapshot.tasks, filters),
    statuses: mapCounts_(statuses),
    employees: mapCounts_(employees)
  };
}

function mapCounts_(counts) {
  return Object.keys(counts).sort(compareNatural_).map(function(id) {
    return { id: id, count: counts[id] };
  });
}
