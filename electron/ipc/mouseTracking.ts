import { uIOhook } from 'uiohook-napi'

let isMouseTrackingActive = false
let isHookStarted = false

export function startMouseTracking() {
  if (isMouseTrackingActive) {
    console.log('⚠️ Mouse tracking already active')
    return { success: false, message: 'Already tracking' }
  }

  console.log('🎯 Starting mouse tracking...')
  isMouseTrackingActive = true

  // Only start the hook once
  if (!isHookStarted) {
    setupMouseEventListeners()
    
    try {
      uIOhook.start()
      isHookStarted = true
      console.log('✅ Mouse tracking started successfully')
      console.log('💡 If you see "Accessibility API is disabled" error:')
      console.log('   Go to System Settings → Privacy & Security → Accessibility')
      console.log('   Enable permissions for Electron/Terminal/VS Code')
      return { success: true, message: 'Mouse tracking started' }
    } catch (error) {
      console.error('❌ Failed to start mouse tracking:', error)
      isMouseTrackingActive = false
      return { success: false, message: 'Failed to start hook', error }
    }
  } else {
    console.log('✅ Mouse tracking resumed')
    return { success: true, message: 'Mouse tracking resumed' }
  }
}

export function stopMouseTracking() {
  if (!isMouseTrackingActive) {
    console.log('⚠️ Mouse tracking not active')
    return { success: false, message: 'Not currently tracking' }
  }

  console.log('🛑 Stopping mouse tracking...')
  isMouseTrackingActive = false
  console.log('✅ Mouse tracking stopped (events will still be captured but not logged)')
  return { success: true, message: 'Mouse tracking stopped' }
}


function setupMouseEventListeners() {
  // Track mouse movement
  uIOhook.on('mousemove', (e) => {
    if (isMouseTrackingActive) {
      console.log(`[MOUSE MOVE] x: ${e.x}, y: ${e.y}`)
    }
  })

  // Track mouse button press
  uIOhook.on('mousedown', (e) => {
    if (isMouseTrackingActive) {
      console.log(`[MOUSE DOWN] x: ${e.x}, y: ${e.y}, button: ${e.button}, clicks: ${e.clicks}`)
    }
  })

  // Track mouse button release
  uIOhook.on('mouseup', (e) => {
    if (isMouseTrackingActive) {
      console.log(`[MOUSE UP] x: ${e.x}, y: ${e.y}, button: ${e.button}`)
    }
  })

  // Track complete click events
  uIOhook.on('click', (e) => {
    if (isMouseTrackingActive) {
      console.log(`[CLICK] x: ${e.x}, y: ${e.y}, button: ${e.button}, clicks: ${e.clicks}`)
    }
  })

  // Track mouse wheel scrolling
  uIOhook.on('wheel', (e) => {
    if (isMouseTrackingActive) {
      console.log(`[WHEEL] x: ${e.x}, y: ${e.y}, amount: ${e.amount}, direction: ${e.direction}, rotation: ${e.rotation}`)
    }
  })
}

export function cleanupMouseTracking() {
  if (isHookStarted) {
    try {
      uIOhook.stop()
      isHookStarted = false
      isMouseTrackingActive = false
      console.log('🧹 Mouse tracking cleaned up')
    } catch (error) {
      console.error('Error cleaning up mouse tracking:', error)
    }
  }
}
