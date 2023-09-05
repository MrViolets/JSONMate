'use strict'

/* global chrome */

const allThemes = [
  { name: 'Clear', fileName: 'clear.css', id: 'clear' },
  { name: 'Abyssal', fileName: 'abyssal.css', id: 'abyssal' },
  { name: 'Gruvbox', fileName: 'gruvbox.css', id: 'gruvbox' },
  { name: 'Tokyo Night', fileName: 'tokyo-night.css', id: 'tokyoNight' },
  { name: 'Vanilla', fileName: 'vanilla.css', id: 'vanilla' }
]

async function start () {
  const validJSON = isJSON()

  if (validJSON) { // isJSON either returns a boolean or the JSON object
    // This is to avoid extra needless parsing if JSON was determined through eventual parsing
    const preElements = document.querySelectorAll('pre')
    const targetElement = preElements[0]
    const unformattedStr = targetElement.textContent
    const jsonData = typeof validJSON === 'object' ? validJSON : unformattedStr
    await initJsonViewer(jsonData, targetElement)
  }
}

function isJSON () {
  const MAX_CHARACTERS = 3000000
  const MAX_DEPTH = 20

  const preElements = document.querySelectorAll('pre')

  if (preElements.length !== 1) {
    return false
  }

  const targetElement = preElements[0]
  const str = targetElement.textContent

  if (str.length === 0 || str.length > MAX_CHARACTERS) {
    return false
  }

  const estimatedDepth = getApproximateJsonDepth(str)

  if (estimatedDepth > MAX_DEPTH) return false

  const contentType = document.contentType
  const url = window.location.href.toLowerCase()

  if (!str) return false
  if (contentType && contentType.includes('application/json')) return true
  if (url.endsWith('.json')) return true
  if (!((str.trim().startsWith('{') && str.trim().endsWith('}')) || (str.trim().startsWith('[') && str.trim().endsWith(']')))) return false
  if (/<\w+.*?>.*?<\/\w+.*?>/.test(str)) return false
  if (document.querySelector('title, link[rel="stylesheet"]')) return false

  try {
    const parsed = JSON.parse(str)
    if (typeof parsed === 'object') {
      return true
    } else {
      return false
    }
  } catch (error) {
    return false
  }
}

async function initJsonViewer (jsonData, targetElement) {
  // Include css asap to minimize unstyled flashing
  await includeCSS()

  const app = document.createElement('div')
  app.classList.add('app')

  const views = document.createElement('div')
  views.classList.add('views')

  const pre = document.createElement('pre')
  pre.classList.add('formatted')

  targetElement.classList.add('raw', 'hidden')

  // Detach pre element
  targetElement.remove()

  // Clean up the body element to get rid of prettyprint
  document.body.innerHTML = ''

  views.appendChild(targetElement)
  views.appendChild(pre)
  app.appendChild(views)
  document.body.appendChild(app)

  const treeHtml = await getTreeHtml(jsonData)

  pre.innerHTML = treeHtml

  await includeControlBar(app)
  updateFavicon()
  registerListeners()

  // Clear temp storage items
  try {
    await Promise.all([
      clear('temp-json-data'),
      clear('HTML')
    ])
  } catch (error) {
    console.error(error)
  }
}

function updateFavicon () {
  const link = document.createElement('link')
  link.rel = 'icon'
  link.href = chrome.runtime.getURL('content/images/favicon.svg')

  document.querySelector('head').appendChild(link)
}

async function includeControlBar (parent) {
  const controlBar = document.createElement('div')
  controlBar.classList.add('control-bar')

  const pathAndRadioParent = document.createElement('div')
  pathAndRadioParent.classList.add('action-container')

  const jsonPath = document.createElement('div')
  jsonPath.classList.add('json-path')

  const radioGroup = document.createElement('div')
  radioGroup.classList.add('radio-group')

  const themePickerParent = document.createElement('div')
  const themePickerSelect = document.createElement('select')
  themePickerSelect.id = 'themeSelect'
  themePickerParent.classList.add('theme-picker', 'action-container')
  themePickerParent.appendChild(themePickerSelect)

  const tabs = ['raw', 'formatted']

  for (const [index, tab] of tabs.entries()) {
    const toggle = getToggleEl(tab)

    if (index === 1) {
      toggle.input.checked = true
    }

    radioGroup.appendChild(toggle.input)
    radioGroup.appendChild(toggle.label)
  }

  pathAndRadioParent.appendChild(radioGroup)
  pathAndRadioParent.appendChild(jsonPath)
  controlBar.appendChild(pathAndRadioParent)
  controlBar.appendChild(themePickerParent)

  parent.insertBefore(controlBar, parent.firstChild)

  await includeThemesInDropdown(themePickerSelect)
}

async function includeThemesInDropdown(el) {
  for (const theme of allThemes) {
    const optionElement = document.createElement('option')
    optionElement.value = theme.id
    optionElement.innerText = theme.name
    el.appendChild(optionElement)
  }

  const theme = await load('theme', { id: 'clear' }).catch(error => {
    console.error(error)
    return { fileName: 'clear.css' }
  })

  el.value = theme.id
}

function getToggleEl (name) {
  const input = document.createElement('input')
  input.type = 'radio'
  input.name = 'jsonViewToggle'
  input.id = `${name}Toggle`
  input.classList.add('radio')

  const label = document.createElement('label')
  label.htmlFor = input.id
  label.classList.add('tab')
  label.innerText = chrome.i18n.getMessage(`TAB_${name.toUpperCase()}`)

  return { input, label }
}

async function includeCSS () {
  const cssFileURL = chrome.runtime.getURL('content/css/json.css')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = cssFileURL

  document.head.appendChild(link)

  const theme = await load('theme', { fileName: 'clear.css' }).catch(error => {
    console.error(error)
    return { fileName: 'clear.css' }
  })

  includeTheme(theme)
}

function includeTheme (theme) {
  const cssFileURL = theme
    ? chrome.runtime.getURL(`content/css/themes/${theme.fileName}`)
    : chrome.runtime.getURL('content/css/themes/clear.css')

  const existingThemeStylesheet = document.querySelector('link#theme')

  if (existingThemeStylesheet) {
    existingThemeStylesheet.href = cssFileURL
  } else {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = cssFileURL
    link.id = 'theme'

    document.head.appendChild(link)
  }
}

async function getTreeHtml (jsonData) {
  try {
    await save('temp-json-data', jsonData)
  } catch (error) {
    console.error(error)
    return
  }

  const backgroundResponse = await sendMessage({ msg: 'process-data' }).catch((error) => {
    console.error(error)
    return null
  })

  if (!backgroundResponse || backgroundResponse.msg !== 'html-ready') {
    return
  }

  const html = await load('HTML', '').catch((error) => {
    console.error(error)
    window.alert("Couldn't load HTML")
    return null
  })

  return html
}

function getApproximateJsonDepth (jsonString) {
  let depth = 0
  let maxDepth = 0
  let inString = false

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i]

    if (char === '"' && jsonString[i - 1] !== '\\') {
      inString = !inString
    }

    if (inString) {
      continue
    }

    if (char === '{' || char === '[') {
      depth++
      if (depth > maxDepth) {
        maxDepth = depth
      }
    } else if (char === '}' || char === ']') {
      depth--
    }
  }

  return maxDepth
}

function save (key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      {
        [key]: value
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

function load (key, defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      {
        [key]: defaults
      },
      function (value) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }
        resolve(value[key])
      }
    )
  })
}

function clear (key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, function () {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message)
      }
      resolve()
    })
  })
}

function sendMessage (message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message)
      }
      resolve(response)
    })
  })
}

function registerListeners () {
  document.addEventListener('click', onDocumentClicked, false)
  document.addEventListener('mousedown', onDocumentMousedown, false)

  const formattedEl = document.querySelector('.formatted')
  formattedEl.addEventListener('mouseover', onFormattedMouseOver, false)
  formattedEl.addEventListener('mouseout', onFormattedMouseOut, false)

  const radioButtons = document.querySelectorAll('input[type="radio"]')
  for (const r of radioButtons) {
    r.addEventListener('change', onRadioButtonChanged, false)
  }

  const themeDropdown = document.getElementById('themeSelect')
  console.log(themeDropdown)
  themeDropdown.addEventListener('change', onThemeDropdownChanged, false)
}

async function onThemeDropdownChanged(e) {
  console.log(e)
  const newTheme = allThemes.find(theme => theme.id === e.target.value)

    // Store the new theme obj
    try {
      await save('theme', newTheme)
    } catch (error) {
      console.error(error)
    }

    includeTheme(newTheme)
}

function onRadioButtonChanged (e) {
  const formattedEl = document.querySelector('.formatted')
  const rawEl = document.querySelector('.raw')

  const targetId = e.target.id

  let toHide
  let toShow

  if (targetId === 'formattedToggle') {
    toHide = [rawEl]
    toShow = [formattedEl]
  } else if (targetId === 'rawToggle') {
    toHide = [formattedEl]
    toShow = [rawEl]
  }

  for (const el of toHide) {
    hideElement(el)
  }

  for (const el of toShow) {
    showElement(el)
  }
}

function showElement (el) {
  el.classList.remove('hidden')
}

function hideElement (el) {
  el.classList.add('hidden')
}

function onFormattedMouseOver (e) {
  const liElement = getClosestLiWithDataPath(e.target)
  if (liElement) {
    const jsonPathEl = document.querySelector('.json-path')
    const jsonpath = liElement.getAttribute('data-path')
    jsonPathEl.innerHTML = `<span class="path">${jsonpath}</span>`

    liElement.classList.add('in-focus')
  }
}

function onFormattedMouseOut (e) {
  const liElement = getClosestLiWithDataPath(e.target)
  if (liElement) {
    const jsonPathEl = document.querySelector('.json-path')
    jsonPathEl.innerHTML = ''

    liElement.classList.remove('in-focus')
  }
}

function getClosestLiWithDataPath (element) {
  while (element && element !== document) {
    if (element.tagName.toLowerCase() === 'li' && element.hasAttribute('data-path')) {
      return element
    }
    element = element.parentNode
  }
  return null
}

function onDocumentClicked (e) {
  if (e.target.matches('.toggle') || e.target.matches('.item-count')) {
    const listItem = getClosestLiWithDataPath(e.target)
    const isShiftPressed = e.shiftKey

    if (isShiftPressed) {
      const toCollapse = !listItem.classList.contains('collapsed')
      toggleCollapse(listItem, toCollapse)

      const lis = listItem.querySelectorAll('li')
      for (const item of lis) {
        toggleCollapse(item, toCollapse)
      }
    } else {
      toggleCollapse(listItem)
    }

    e.preventDefault()
  }
}

function onDocumentMousedown (e) {
  if (e.target.matches('.toggle')) {
    e.preventDefault()
  }
}

function toggleCollapse (element, forceCollapse) {
  if (forceCollapse === undefined) {
    if (element.classList.contains('collapsed')) {
      element.classList.remove('collapsed')
    } else {
      element.classList.add('collapsed')
    }
  } else if (forceCollapse) {
    element.classList.add('collapsed')
  } else {
    element.classList.remove('collapsed')
  }
}

start()
