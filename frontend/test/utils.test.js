import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeRouteSegments, formatRoute, matchesTask, splitWbStickers } from '../src/utils.js';

test('dedupeRouteSegments removes adjacent duplicate route parts', () => {
  assert.deepEqual(dedupeRouteSegments(['8', '8', '49', '', '49']), ['8', '49']);
});

test('formatRoute builds a readable long route', () => {
  assert.equal(
    formatRoute({ floor: '8', row: '49', place: '183', shelf: '2', cell: '1' }),
    'Этаж 8 · Ряд 49 · Место 183 · Полка 2 · Ячейка 1'
  );
});

test('matchesTask follows the v51 WB/product/MX/BOX search fields', () => {
  const task = { itemId: '48101014476', wbSticker: '48884313938', itemName: 'Комплект белья' };
  assert.equal(matchesTask(task, '481010'), false);
  assert.equal(matchesTask(task, '48884313938'), true);
  assert.equal(matchesTask(task, 'белья'), true);
  assert.equal(matchesTask(task, 'нет'), false);
});

test('splitWbStickers supports multiple stickers and removes duplicates', () => {
  assert.deepEqual(splitWbStickers('123, 456\n123 / 789'), ['123', '456', '789']);
});
