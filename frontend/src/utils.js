export function normalizeText(value) {
  return String(value ?? '').trim().toLocaleLowerCase('ru-RU');
}

export function splitWbStickers(value) {
  return [...new Set(String(value ?? '')
    .split(/[\s,;|/]+/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

export function dedupeRouteSegments(values) {
  const result = [];
  values.forEach((value) => {
    const text = String(value ?? '').trim();
    if (text && result[result.length - 1] !== text) result.push(text);
  });
  return result;
}

export function formatRoute(task) {
  const detailed = dedupeRouteSegments([
    task.floor && `Этаж ${task.floor}`,
    task.row && `Ряд ${task.row}`,
    task.place && `Место ${task.place}`,
    task.shelf && `Полка ${task.shelf}`,
    task.cell && `Ячейка ${task.cell}`
  ]);
  return detailed.length ? detailed.join(' · ') : String(task.mx || 'Маршрут не указан');
}

export function matchesTask(task, query) {
  const normalized = normalizeText(query);
  if (!normalized) return true;
  const haystack = [
    task.itemId,
    task.wbSticker,
    ...(task.wbStickers || []),
    task.itemName,
    task.mx,
    task.box,
    task.floor,
    task.row,
    task.place,
    task.shelf,
    task.cell,
    task.action,
    task.comment,
    task.sourceLabel
  ].map(normalizeText).join(' ');
  return haystack.includes(normalized);
}

export function formatTime(value) {
  if (!value) return 'ещё не обновлялось';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'время неизвестно';
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}
