import { ApiClient } from './ApiClient.js';

export function createProductSearchApi(baseUrl, options = {}) {
  const client = new ApiClient(baseUrl, options);
  return Object.freeze({
    health: () => client.get('health'),
    getCapabilities: () => client.get('getCapabilities'),
    getCatalog: (filters = {}) => client.get('getCatalog', filters),
    getTask: (taskToken) => client.get('getTask', { taskToken }),
    getStatistics: (filters = {}) => client.get('getStatistics', filters),
    getTaskPhotos: (taskToken) => client.get('getTaskPhotos', { taskToken }),
    getTaskPhoto: (taskToken, photoToken) =>
      client.get('getTaskPhoto', { taskToken, photoToken }),
    getOperationStatus: (writeAction, idempotencyKey) =>
      client.get('getOperationStatus', { writeAction, idempotencyKey }),
    updateTask: (payload, requestOptions) =>
      client.post('updateTask', payload, requestOptions),
    uploadTaskPhoto: (payload, requestOptions) =>
      client.post('uploadTaskPhoto', payload, requestOptions)
  });
}
