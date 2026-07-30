import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogRequestParams } from '../src/api/catalogRequest.js';

const baseState = {
  zone: '',
  floor: '',
  query: '',
  photoOnly: false,
  myOnly: false,
  employeeId: ''
};

test('unfiltered first load requests the largest safe snapshot', () => {
  assert.deepEqual(buildCatalogRequestParams(baseState, {
    append: false,
    page: 1,
    pageSize: 60,
    snapshotPageSize: 100,
    fresh: true
  }), {
    page: 1,
    pageSize: 100,
    fresh: true
  });
});

test('filters are sent to the API when the catalog exceeds one snapshot page', () => {
  assert.deepEqual(buildCatalogRequestParams({
    ...baseState,
    zone: 'B4',
    query: '48727820282',
    photoOnly: true
  }, {
    append: false,
    page: 1,
    pageSize: 60,
    snapshotPageSize: 100,
    fresh: false
  }), {
    zone: 'B4',
    floor: '',
    query: '48727820282',
    photoOnly: true,
    myOnly: false,
    employeeId: '',
    page: 1,
    pageSize: 60
  });
});
