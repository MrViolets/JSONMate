'use strict'

/* global chrome */

export function create (url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(
      {
        url
      },
      function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }
        resolve()
      }
    )
  })
}

export function getCurrentTab () {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message)
      }
      resolve(tabs[0])
    })
  })
}
