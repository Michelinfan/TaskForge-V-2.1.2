const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taskforge", {
  showNotification: ({ title, body }) => ipcRenderer.send("show-notification", { title, body }),
  syncTasks: (tasks) => ipcRenderer.send("sync-tasks", tasks),
  getStoredTasks: () => ipcRenderer.invoke("get-stored-tasks")
});
