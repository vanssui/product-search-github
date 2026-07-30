import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIdStats,
  buildReportStats,
  buildReportText,
  extractIdsForStats,
  parseReportRows,
  pluralTimes
} from '../src/utils/report.js';

function row(employeeId, status) {
  const cells = Array(13).fill('');
  cells[10] = employeeId;
  cells[12] = status;
  return cells.join('\t');
}

test('report parser and text match the version 51 TSV workflow', () => {
  const rows = parseReportRows([
    row('12345', 'Найдено'),
    row('12345', 'Найдено'),
    row('67890', 'Найдено'),
    row('77777', 'Не найдено'),
    row('', 'Поиск')
  ].join('\n'));
  const stats = buildReportStats(rows);

  assert.deepEqual(stats, {
    total: 5,
    found: 3,
    notFound: 1,
    inSearch: 1,
    responsibleCounts: { 12345: 2, 67890: 1 }
  });
  assert.equal(buildReportText(stats), [
    'На поиске было: 5 ШК',
    'Найдено: 3',
    'Не найдено: 1',
    'Ещё в поиске: 1',
    '',
    'Топ сотрудников, оставивших товар на МХ:',
    '12345 — 2',
    '',
    'Оставили по 1 разу:',
    '67890'
  ].join('\n'));
});

test('ID statistics preserve version 51 modes, ranking and plurals', () => {
  const text = [
    row('12345', 'Найдено'),
    row('12345', 'Не найдено'),
    row('67890', 'Найдено')
  ].join('\n');

  assert.deepEqual(extractIdsForStats(text, 'found'), ['12345', '67890']);
  assert.deepEqual(extractIdsForStats(text, 'missing'), ['12345']);
  assert.deepEqual(buildIdStats(['12345', '67890', '12345']), {
    unique: 2,
    rows: [
      { id: '12345', count: 2 },
      { id: '67890', count: 1 }
    ],
    text: '12345 — 2 раза\n67890 — 1 раз'
  });
  assert.equal(pluralTimes(5), 'раз');
  assert.equal(pluralTimes(22), 'раза');
});
