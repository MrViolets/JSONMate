'use strict'

/* global chrome */

export function create (arr) {
  return new Promise((resolve, reject) => {
    for (const i of arr) {
      chrome.contextMenus.create(i, function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }
      })
    }
    resolve()
  })
}

export function update (id, obj) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.update(
      id,
      obj,
      function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }
        resolve()
      }
    )
  })
}
