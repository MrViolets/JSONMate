'use strict'

/* global chrome */

import * as menu from './modules/menu.js'
import * as storage from './modules/storage.js'
import * as tabs from './modules/tabs.js'
import * as themes from './modules/themes.js'

chrome.runtime.onInstalled.addListener(onInstalled)
chrome.runtime.onStartup.addListener(init)
chrome.contextMenus.onClicked.addListener(onMenuClicked)
chrome.runtime.onMessage.addListener(onMessageReceived)

async function onInstalled () {
  await init()
}

async function init () {
  await setupContextMenu()
  await restoreSelectedThemeMenuItem()
}

async function setupContextMenu () {
  const themesMenuItems = getThemesMenuItems()

  const menuItems = [
    ...themesMenuItems,
    {
      contexts: ['action'],
      id: 'separator_2',
      type: 'separator'
    },
    {
      title: chrome.i18n.getMessage('MENU_RATE'),
      contexts: ['action'],
      id: 'rate_extension',
      type: 'normal'
    },
    {
      title: chrome.i18n.getMessage('MENU_DONATE'),
      contexts: ['action'],
      id: 'donate',
      type: 'normal'
    }
  ]

  try {
    await menu.create(menuItems)
  } catch (error) {
    console.error(error)
  }
}

function getThemesMenuItems () {
  const parentMenuItem = [
    {
      title: 'Theme',
      contexts: ['action'],
      id: 'themes',
      type: 'normal'
    }
  ]

  const allThemes = themes.themes

  for (const theme of allThemes) {
    const menuItem = getThemeMenuItem(theme)
    parentMenuItem.push(menuItem)
  }

  return parentMenuItem
}

function getThemeMenuItem (theme) {
  return {
    title: theme.name,
    contexts: ['action'],
    id: theme.id,
    type: 'radio',
    parentId: 'themes'
  }
}

async function restoreSelectedThemeMenuItem () {
  const defaultTheme = themes.themes.find(theme => theme.id === 'clear')
  const selectedTheme = await storage.load('theme', defaultTheme).catch(error => {
    console.error(error)
    return defaultTheme
  })

  try {
    await menu.update(selectedTheme.id, { checked: true })
  } catch (error) {
    console.error(error)
  }
}

async function onMenuClicked (info) {
  if (info.parentMenuItemId && info.parentMenuItemId === 'themes') {
    const clickedTheme = themes.themes.find(theme => theme.id === info.menuItemId)

    // Store the new theme obj
    try {
      await storage.save('theme', clickedTheme)
    } catch (error) {
      console.error(error)
    }
  } else if (info.menuItemId === 'rate_extension' || info.menuItemId === 'donate') {
    await openTab(info.menuItemId)
  }
}

async function openTab (type) {
  const urls = {
    rate_extension: `https://chrome.google.com/webstore/detail/${chrome.runtime.id}`,
    donate: 'https://www.buymeacoffee.com/mrviolets'
  }

  const url = urls[type]
  if (url) {
    try {
      await tabs.create(url)
    } catch (error) {
      console.error(error)
    }
  }
}

function onMessageReceived (message, sender, sendResponse) {
  if (message.msg === 'process-data') {
    storage
      .load('temp-json-data', '')
      .then((jsonData) => {
        if (!jsonData) {
          sendResponse('error')
          return
        }

        if (typeof jsonData === 'string') {
          try {
            jsonData = JSON.parse(jsonData)
          } catch (error) {
            console.error('Error parsing JSON:', error)
            sendResponse('error')
            return
          }
        }

        const innerHtml = syntaxHighlight(jsonData)
        const completeHtml = getTreeHTML(innerHtml)

        return storage.save('HTML', completeHtml)
      })
      .then(() => {
        sendResponse({ msg: 'html-ready' })
      })
      .catch((error) => {
        console.error(error)
        sendResponse('error')
      })

    return true // Keep the message channel open
  }
}

function syntaxHighlight (jsonObj, depth = 0, currentPath = '$') {
  if (jsonObj === null) {
    return '<span class="null">null</span>'
  }

  const type = typeof jsonObj
  switch (type) {
    case 'string':
      return isUrl(jsonObj) ? `<span class="string">"<a href="${jsonObj}" target="_blank">${escapeHtmlCharacters(jsonObj)}</a>"</span>` : `<span class="string">"${escapeHtmlCharacters(jsonObj)}"</span>`
    case 'number':
      return `<span class="number">${jsonObj}</span>`
    case 'boolean':
      return `<span class="boolean">${jsonObj}</span>`
  }

  const keys = Object.keys(jsonObj)
  const items = []
  const isArray = Array.isArray(jsonObj)

  for (let i = 0, len = keys.length; i < len; i++) {
    const keyOrIndex = isArray ? i : keys[i]
    const value = jsonObj[keyOrIndex]
    const newPath = isArray ? `${currentPath}[${i}]` : `${currentPath}.${keyOrIndex}`
    const formattedValue = syntaxHighlight(value, depth + 1, newPath)

    const valueType = typeof value
    const isObjectOrArray = valueType === 'object' && value !== null

    const clickableElement = isObjectOrArray ? '<span class="toggle"></span>' : ''
    const comma = i < len - 1 ? ',' : ''

    if (isArray) {
      items.push(`<li data-path="${newPath}">${clickableElement}${formattedValue}${comma}</li>`)
    } else {
      items.push(`<li data-path="${newPath}">${clickableElement}<span class="key">"${escapeHtmlCharacters(keyOrIndex)}"</span>: ${formattedValue}${comma}</li>`)
    }
  }

  const itemCount = getItemsCountString(keys.length)
  return `${isArray ? '[' : '{'}${itemCount}<ul class="nested-list">${items.join('')}</ul>${isArray ? ']' : '}'}`
}

function getItemsCountString (count) {
  if (count === 0) return ''
  return count === 1 ? '<span class="item-count">... 1 item</span>' : `<span class="item-count">... ${count} items</span>`
}

function getTreeHTML (treeHTML) {
  return `<ul class="nested-list"><li data-path="$"><span class="toggle"></span>${treeHTML}</li></ul>`
}

function isUrl (str) {
  let url

  try {
    url = new URL(str)
  } catch (e) {
    return false
  }

  const allowedProtocols = ['http:', 'https:', 'ftp:', 'file:']

  return allowedProtocols.includes(url.protocol)
}

function escapeHtmlCharacters (str) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  }

  return String(str).replace(/[&<>"'`=/]/g, function (s) {
    return entityMap[s]
  })
}
