/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return (
      registry[uri] ||
      new Promise((resolve) => {
        if ("document" in self) {
          const script = document.createElement("script");
          script.src = uri;
          script.onload = resolve;
          document.head.appendChild(script);
        } else {
          nextDefineUri = uri;
          importScripts(uri);
          resolve();
        }
      }).then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri =
      nextDefineUri ||
      ("document" in self ? document.currentScript.src : "") ||
      location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = (depUri) => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require,
    };
    registry[uri] = Promise.all(
      depsNames.map((depName) => specialDeps[depName] || require(depName))
    ).then((deps) => {
      factory(...deps);
      return exports;
    });
  };
}

define(["./workbox-e43f5367"], function (workbox) {
  "use strict";

  importScripts();
  self.skipWaiting();
  workbox.clientsClaim();
  workbox.registerRoute(
    "/",
    new workbox.NetworkFirst({
      cacheName: "start-url",
      plugins: [
        {
          cacheWillUpdate: async ({ request, response, event, state }) => {
            if (response && response.type === "opaqueredirect") {
              return new Response(response.body, {
                status: 200,
                statusText: "OK",
                headers: response.headers,
              });
            }
            return response;
          },
        },
      ],
    }),
    "GET"
  );
  workbox.registerRoute(
    /.*/i,
    new workbox.NetworkOnly({
      cacheName: "dev",
      plugins: [],
    }),
    "GET"
  );
});

// * NOTIFICATION STUFF

// Service Worker Installation and Activation (Basic)
self.addEventListener("install", (event) => {
  console.log("SW: Install event");
  // Perform install steps if needed (e.g., caching assets)
  // self.skipWaiting(); // Often used to activate immediately
});

self.addEventListener("activate", (event) => {
  console.log("SW: Activate event");
  // Perform activation steps (e.g., cleaning up old caches)
  // event.waitUntil(clients.claim()); // Take control of pages immediately
});

// --- Push Event Listener ---
self.addEventListener("push", (event) => {
  console.log("SW: Push Received.");

  let notificationData = {};
  try {
    // Attempt to parse the payload sent from the server
    if (event.data) {
      notificationData = event.data.json();
      console.log("SW: Push data parsed:", notificationData);
    } else {
      console.log("SW: Push event has no data.");
      // Provide default data if none sent
      notificationData = {
        title: "Reminder",
        body: "You have an upcoming task!",
        taskId: null, // Indicate no specific task link
      };
    }
  } catch (e) {
    console.error("SW: Error parsing push data:", e);
    // Provide default data on parse error
    notificationData = {
      title: "Notification Received",
      body: "Could not parse notification details.",
      taskId: null,
    };
  }

  const title = notificationData.title || "Task Reminder";
  const options = {
    body: notificationData.body || "Check your planner.",
    icon: "/icons/icon-192x192.png", // Path relative to origin
    badge: "/icons/badge-72x72.png", // Path relative to origin (for Android status bar)
    // Store data to use when notification is clicked
    data: {
      taskId: notificationData.taskId, // Pass task ID or URL
      url: notificationData.url || "/", // Default URL to open
    },
    // Optional: Add actions
    // actions: [
    //   { action: 'view', title: 'View Task' },
    //   { action: 'dismiss', title: 'Dismiss' },
    // ]
  };

  // Show the notification
  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .then(() => console.log("SW: Notification shown successfully."))
      .catch((err) => console.error("SW: Error showing notification:", err))
  );
});

// --- Notification Click Listener ---
self.addEventListener("notificationclick", (event) => {
  console.log("SW: Notification click Received.", event.notification);

  // Close the notification popup
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || "/"; // Default to home page

  // Optional: Handle specific actions if defined
  // if (event.action === 'view') {
  //   console.log('SW: View action clicked');
  //   // urlToOpen = `/tasks/${notificationData.taskId}`; // Example specific URL
  // } else if (event.action === 'dismiss') {
  //    console.log('SW: Dismiss action clicked');
  //    return; // Don't open window
  // }

  // Focus or open the app window/tab
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Check if an app window is already open
        for (const client of clientList) {
          // Attempt to focus an existing window if it's the correct URL
          // You might need more sophisticated URL matching
          if (client.url === self.origin + urlToOpen && "focus" in client) {
            console.log("SW: Focusing existing window:", client.url);
            return client.focus();
          }
        }
        // If no window is open or focused, open a new one
        console.log("SW: Opening new window to:", urlToOpen);
        return clients.openWindow(urlToOpen);
      })
      .catch((err) =>
        console.error("SW: Error handling notification click:", err)
      )
  );
});
