function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeHeader(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeEmployeeId(value) {
  const match = normalizeText(value).match(/\b\d{5,8}\b/);
  if (!match || match[0] === '1') return '';
  return match[0];
}

function compareIds(left, right) {
  const leftNumber = Number(String(left).replace(/\D/g, ''));
  const rightNumber = Number(String(right).replace(/\D/g, ''));
  if (!Number.isNaN(leftNumber) &&
      !Number.isNaN(rightNumber) &&
      leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right), 'ru');
}

function findReportStatusInRow(cells) {
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const status = normalizeStatus(cells[index]);
    if (status === 'найдено' || status === 'не найдено' || status === 'поиск') {
      return normalizeText(cells[index]);
    }
  }
  return '';
}

function buildReportHeaderMap(headerRow) {
  const map = { employeeId: 10, status: 12 };
  let actionIndex = -1;
  headerRow.forEach((cell, index) => {
    const header = normalizeHeader(cell);
    if (header === 'действия с товаром' || header === 'действиястоваром') {
      actionIndex = index;
    }
    if (header.includes('id сотруд') ||
        header.includes('ид сотруд') ||
        header.includes('кто оставил')) {
      map.employeeId = index;
    }
    if (header === 'статус поиска' || header === 'статуспоиска') {
      map.status = index;
    }
  });
  if (actionIndex > 0 && map.employeeId === 10) map.employeeId = actionIndex - 1;
  return map;
}

export function parseReportRows(text) {
  const lines = String(text || '').split(/\r?\n/).filter(normalizeText);
  if (!lines.length) return [];

  const parsed = lines.map((line) => line.split('\t'));
  const first = parsed[0].map(normalizeHeader);
  const hasHeader = first.some((cell) =>
    cell === 'ответственный' ||
    cell === 'статус поиска' ||
    cell === 'статуспоиска'
  );
  const map = hasHeader
    ? buildReportHeaderMap(parsed[0])
    : { employeeId: 10, status: 12 };
  const rows = [];

  for (let index = hasHeader ? 1 : 0; index < parsed.length; index += 1) {
    const cells = parsed[index];
    const employeeId = normalizeEmployeeId(cells[map.employeeId]);
    let status = normalizeText(cells[map.status]);
    if (!hasHeader && !status) status = normalizeText(cells[11]);
    if (!hasHeader && !status) status = findReportStatusInRow(cells);
    if (!cells.some(normalizeText)) continue;
    rows.push({ employeeId, status });
  }
  return rows;
}

export function buildReportStats(rows) {
  const stats = {
    total: rows.length,
    found: 0,
    notFound: 0,
    inSearch: 0,
    responsibleCounts: {}
  };

  rows.forEach((row) => {
    const status = normalizeStatus(row.status);
    if (status === 'найдено') {
      stats.found += 1;
      if (row.employeeId) {
        stats.responsibleCounts[row.employeeId] =
          (stats.responsibleCounts[row.employeeId] || 0) + 1;
      }
    } else if (status === 'не найдено') {
      stats.notFound += 1;
    } else {
      stats.inSearch += 1;
    }
  });
  return stats;
}

export function buildReportText(stats) {
  const top = [];
  const single = [];
  Object.keys(stats.responsibleCounts).forEach((id) => {
    const count = stats.responsibleCounts[id];
    if (count >= 2) top.push({ id, count });
    else single.push(id);
  });
  top.sort((left, right) => right.count - left.count || compareIds(left.id, right.id));
  single.sort(compareIds);

  const lines = [
    `На поиске было: ${stats.total} ШК`,
    `Найдено: ${stats.found}`,
    `Не найдено: ${stats.notFound}`
  ];
  if (stats.inSearch > 0) lines.push(`Ещё в поиске: ${stats.inSearch}`);
  lines.push('', 'Топ сотрудников, оставивших товар на МХ:');
  if (top.length) top.forEach((item) => lines.push(`${item.id} — ${item.count}`));
  else lines.push('Нет сотрудников с повторами.');
  lines.push('', 'Оставили по 1 разу:');
  lines.push(single.length ? single.join(', ') : 'Нет.');
  return lines.join('\n');
}

function extractIdsFromText(text) {
  return (String(text || '').match(/\b\d{5,8}\b/g) || [])
    .filter((id) => id !== '1');
}

function rowLooksLikeHeader(cells) {
  return cells.some((cell) => {
    const header = normalizeHeader(cell);
    return header === 'статус поиска' ||
      header === 'действия с товаром' ||
      header.includes('ид сотруд') ||
      header.includes('id сотруд');
  });
}

export function extractIdsForStats(text, mode = 'all') {
  const lines = String(text || '').split(/\r?\n/).filter(normalizeText);
  if (!lines.length) return [];
  const tabRows = lines.map((line) => line.split('\t'));
  const looksLikeRange = tabRows.some((cells) => cells.length >= 13);
  if (!looksLikeRange) return mode === 'all' ? extractIdsFromText(text) : [];

  const ids = [];
  tabRows.forEach((cells, index) => {
    if (index === 0 && rowLooksLikeHeader(cells)) return;
    const status = normalizeStatus(cells[12]);
    if (mode === 'found' && status !== 'найдено') return;
    if (mode === 'missing' && status !== 'не найдено') return;
    const id = normalizeEmployeeId(cells[10]);
    if (id) ids.push(id);
  });
  return ids;
}

export function pluralTimes(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'раз';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'раза';
  return 'раз';
}

export function buildIdStats(ids) {
  const counts = {};
  ids.forEach((id) => {
    counts[id] = (counts[id] || 0) + 1;
  });
  const rows = Object.keys(counts).map((id) => ({ id, count: counts[id] }));
  rows.sort((left, right) => right.count - left.count || compareIds(left.id, right.id));
  return {
    unique: rows.length,
    rows,
    text: rows.map((row) =>
      `${row.id} — ${row.count} ${pluralTimes(row.count)}`
    ).join('\n')
  };
}
