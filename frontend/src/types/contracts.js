export const API_VERSION = 'v1';

/**
 * @typedef {Object} Task
 * @property {string} taskToken
 * @property {string} zone
 * @property {string} itemId
 * @property {string} wbSticker
 * @property {string[]} wbStickers
 * @property {string} itemName
 * @property {string} mx
 * @property {string} box
 * @property {string} floor
 * @property {string} row
 * @property {string} place
 * @property {string} shelf
 * @property {string} cell
 * @property {string} pickerId
 * @property {string} itemStatus
 * @property {string} action
 * @property {string} statusSearch
 * @property {string} comment
 * @property {string} employeeId
 * @property {string} createdAt
 * @property {string} timeFilled
 * @property {number} photoCount
 * @property {boolean} hasPhoto
 */

/**
 * @typedef {Object} ApiEnvelope
 * @property {boolean} ok
 * @property {*} data
 * @property {{code:string,message:string}|null} error
 * @property {string} requestId
 * @property {string} timestamp
 * @property {{apiVersion?:string,serverDurationMs:number,readOnly?:boolean}} meta
 */

/**
 * @typedef {Object} WriteIdentity
 * @property {string} employeeId
 * @property {string} sessionId
 * @property {string} idempotencyKey
 */
