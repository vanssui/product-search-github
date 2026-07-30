import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLocalCatalog } from '../src/store/catalogStore.js';

const tasks = [
  {
    taskToken: 'a',
    zone: 'B5',
    floor: '2',
    itemName: 'Тормозные колодки',
    wbSticker: '111',
    hasPhoto: true,
    employeeId: 'E1'
  },
  {
    taskToken: 'b',
    zone: 'B5',
    floor: '3',
    itemName: 'Бумага',
    wbSticker: '222',
    hasPhoto: false,
    employeeId: ''
  },
  {
    taskToken: 'c',
    zone: 'B4',
    floor: '3',
    itemName: 'Бумага',
    wbSticker: '333',
    hasPhoto: true,
    employeeId: 'E2'
  }
];

function state(patch = {}) {
  return {
    catalogComplete: true,
    allTasks: tasks,
    zone: '',
    floor: '',
    query: '',
    photoOnly: false,
    myOnly: false,
    employeeId: '',
    visibleLimit: 60,
    ...patch
  };
}

test('catalog facets are derived from API tasks without table knowledge', () => {
  const result = deriveLocalCatalog(state());
  assert.equal(result.filteredCount, 3);
  assert.deepEqual(result.blocks, [
    { id: 'B4', label: 'B4', count: 1 },
    { id: 'B5', label: 'B5', count: 2 }
  ]);
  assert.deepEqual(result.floors, [
    { id: '2', label: '2', count: 1 },
    { id: '3', label: '3', count: 2 }
  ]);
});

test('photo, employee, zone and floor filters compose locally', () => {
  const result = deriveLocalCatalog(state({
    zone: 'B5',
    floor: '2',
    photoOnly: true,
    myOnly: true,
    employeeId: 'e1'
  }));
  assert.equal(result.filteredCount, 1);
  assert.equal(result.tasks[0].taskToken, 'a');
});
