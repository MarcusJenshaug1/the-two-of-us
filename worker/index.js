// Custom worker additions for next-pwa
// This gets merged into the generated service worker

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
    }

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    )

    // Update badge count on app icon
    if (navigator.setAppBadge && data.badge) {
        navigator.setAppBadge(data.badge)
    }
})

// Notification click - open the app to the right page
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    // Clear badge
    if (navigator.clearAppBadge) {
        navigator.clearAppBadge()
    }

    const urlToOpen = event.notification.data?.url || '/app/questions'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes('/app') && 'focus' in client) {
                    client.navigate(urlToOpen)
                    return client.focus()
                }
            }
            return self.clients.openWindow(urlToOpen)
        })
    )
})
