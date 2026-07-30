import { createStore } from './createStore.js';
import { loadPersistentState } from './persistence.js';
import { matchesTask } from '../utils/tasks.js';

export function createCatalogStore() {
  return createStore({
    tasks: [],
    allTasks: [],
    catalogComplete: false,
    blocks: [],
    floors: [],
    zone: '',
    floor: '',
    photoOnly: false,
    myOnly: false,
    filteredCount: 0,
    totalActive: 0,
    photoCount: 0,
    page: 1,
    pageCount: 1,
    hasMore: false,
    visibleLimit: 60,
    generatedAt: '',
    loading: false,
    saving: false,
    offline: !navigator.onLine,
    selectedTask: null,
    selectedPhotos: [],
    photosLoading: false,
    photoBusy: false,
    claim: null,
    message: null,
    ...loadPersistentState()
  });
}

export function deriveLocalCatalog(current, { pageSize = 60, resetLimit = true } = {}) {
  if (!current.catalogComplete) return null;

  const employeeId = String(current.employeeId || '').trim().toUpperCase();
  const baseTasks = current.allTasks.filter((task) => {
    if (current.photoOnly && !task.hasPhoto) return false;
    if (current.myOnly &&
        String(task.employeeId || '').trim().toUpperCase() !== employeeId) return false;
    return matchesTask(task, current.query);
  });

  const blockCounts = new Map();
  baseTasks.forEach((task) => {
    const zone = String(task.zone || '').trim();
    if (zone) blockCounts.set(zone, (blockCounts.get(zone) || 0) + 1);
  });
  const blocks = [...blockCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ru', { numeric: true }))
    .map(([id, count]) => ({ id, label: id, count }));

  const zoneTasks = current.zone
    ? baseTasks.filter((task) => task.zone === current.zone)
    : baseTasks;
  const floorCounts = new Map();
  zoneTasks.forEach((task) => {
    const floor = String(task.floor || '').trim() || 'Без этажа';
    floorCounts.set(floor, (floorCounts.get(floor) || 0) + 1);
  });
  const floors = [...floorCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ru', { numeric: true }))
    .map(([id, count]) => ({ id, label: id, count }));

  const matching = current.floor
    ? zoneTasks.filter((task) =>
      (String(task.floor || '').trim() || 'Без этажа') === current.floor)
    : zoneTasks;
  const visibleLimit = resetLimit ? pageSize : (current.visibleLimit || pageSize);
  const tasks = matching.slice(0, visibleLimit);

  return {
    tasks,
    blocks,
    floors,
    filteredCount: matching.length,
    totalActive: current.allTasks.length,
    photoCount: matching.filter((task) => task.hasPhoto).length,
    page: Math.max(1, Math.ceil(tasks.length / pageSize)),
    pageCount: Math.max(1, Math.ceil(matching.length / pageSize)),
    hasMore: tasks.length < matching.length,
    visibleLimit,
    loading: false
  };
}
