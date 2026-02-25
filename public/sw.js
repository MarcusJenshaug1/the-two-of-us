// Service Worker for The Two of Us - Push Notifications

const CACHE_NAME = 'two-of-us-v1'

// Install — do NOT skipWaiting automatically so AppUpdateNotifier can control activation
self.addEventListener('install', (event) => {
    // New SW is installed but waits until told to activate
    console.log('[SW] installed')
})

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
    console.log('[SW] activated')
})

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting()
    }

    // Close notifications matching specific tags when user opens the relevant page
    if (event.data && event.data.type === 'CLEAR_NOTIFICATIONS') {
        const tags = event.data.tags || []
        self.registration.getNotifications().then((notifications) => {
            notifications.forEach((n) => {
                // Match exact tag or tag prefix (e.g. 'event' matches 'event-abc')
                const shouldClose =
                    tags.length === 0 ||
                    tags.some((t) => n.tag === t || (n.tag && n.tag.startsWith(t + '-')))
                if (shouldClose) n.close()
            })
        })
        // Also clear badge
        if (navigator.clearAppBadge) {
            navigator.clearAppBadge()
        }
    }
})

// Push notification received
self.addEventListener('push', (event) => {
    let data = { title: 'The Two of Us', body: 'You have a new update!' }

    if (event.data) {
        try {
            data = event.data.json()
        } catch (e) {
            data.body = event.data.text()
        }
    }

    const options = {
        body: data.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [100, 50, 100],
        tag: data.tag || 'default',
        renotify: true,
        data: {
            url: data.url || '/app/questions'
        },
        actions: data.actions || []
    }

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    )

    // Update badge count
    if (navigator.setAppBadge && data.badge) {
        navigator.setAppBadge(data.badge)
    }
})

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    // Clear badge
    if (navigator.clearAppBadge) {
        navigator.clearAppBadge()
    }

    const urlToOpen = event.notification.data?.url || '/app/questions'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            // Focus existing window if open
            for (const client of clients) {
                if (client.url.includes('/app') && 'focus' in client) {
                    client.navigate(urlToOpen)
                    return client.focus()
                }
            }
            // Open new window
            return self.clients.openWindow(urlToOpen)
        })
    )
})
