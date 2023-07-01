// // ==UserScript==
// // @name         Habitica Task Organizer
// // @namespace    http://tampermonkey.net/
// // @version      0.1
// // @description  try to take over the world!
// // @author       You
// // @match        https://habitica.com/
// // @icon         https://www.google.com/s2/favicons?sz=64&domain=habitica.com
// // @require      https://cdn.jsdelivr.net/npm/short-unique-id@latest/dist/short-unique-id.min.js
// // @require      https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// // @grant        none
// // ==/UserScript==

// console.log("LZString", LZString);
// const idGenerator = new ShortUniqueId();
// console.log("ShortUniqueId", idGenerator);
// const idLength = 32;

// (function () {
//   "use strict";

//   // Your code here...
//   console.log("test");

//   const re = /(.*) \[data:([^[]*)\]$/g;
//   function GetMetadata(str) {
//     if (typeof str !== "string") {
//       return undefined;
//     }
//     const array = [...str.matchAll(re)];
//     // console.log("GetMetadata", str, array);
//     if (array.length === 0) {
//       return undefined;
//     }
//     const mappedData = array.map((m) => m[2]);
//     if (mappedData.length === 0) {
//       return undefined;
//     }
//     return mappedData[0];
//   }
//   function GetTitle(str) {
//     if (typeof str !== "string") {
//       return undefined;
//     }
//     const array = [...str.matchAll(re)];
//     // console.log("GetTitle", str, array);
//     if (array.length === 0) {
//       return undefined;
//     }
//     const mappedData = array.map((m) => m[1]);
//     if (mappedData.length === 0) {
//       return undefined;
//     }
//     return mappedData[0];
//   }
//   // Json format for data
//   // {
//   //    // The id of this task.
//   //    id: string
//   //    // Id of the group.
//   //    groupId?: string
//   //    // Date the task is due. milliseconds from unix epoch.
//   //    due?: number;
//   //    // Note entry fields.
//   //    notes?: string[];
//   //    // Dependency task id.
//   //    dep?: string[]
//   //}

//   const TASK_SORT_PREFIX = "SORT:";
//   const API_KEY = "ed78381e-daeb-465f-b511-d7015f4e4255";
//   const API_USER = "7052dde5-a2d9-4185-82fb-bf5be2122270";

//   function CreateBasicMetadata() {
// const metadata = {
//   id: idGenerator.stamp(idLength),
// };

//     return metadata;
//   }

//   const sortChecklistItems = (a, b) => {
//     if (a.completed && !b.completed) {
//       return 1;
//     }
//     if (!a.completed && b.completed) {
//       return -1;
//     }
//     if (!a.completed && !b.completed) {
//       if (a.text > b.text) {
//         return 1;
//       }
//       if (a.text < b.text) {
//         return -1;
//       }
//       return 0;
//     }

//     return 0;
//   };

//   // Sort all tasks checklist items.
//   const sortAllMarkedChecklist = async () => {
//     // Fetch the tasks groups.
//     const resp = await fetch("https://habitica.com/api/v3/tasks/user", {
//       headers: {
//         "x-api-key": API_KEY,
//         "x-api-user": API_USER,
//       },
//     });
//     const data = await resp.json();

//     // For each task group check if it matches the prefix, if so sort the checklist items.
//     for (let task of data.data) {
//       console.log(task);
//       if (!task.text.startsWith(TASK_SORT_PREFIX)) {
//         continue;
//       }
//       // console.log(task);

//       task.checklist = task.checklist.sort(sortChecklistItems);
//       task.updatedAt = new Date().toISOString();

//       // Update the habitica api.
//       const updateResp = await fetch("https://habitica.com/api/v4/tasks/" + task.id, {
//         method: "PUT",
//         headers: {
//           "x-api-key": API_KEY,
//           "x-api-user": API_USER,
//           "content-type": "application/json",
//         },
//         body: JSON.stringify(task),
//       });
//       const updateData = await updateResp.json();
//       console.log(updateData);
//     }

//     //location.reload()
//   };

//   const markAllChecklistItemsAsComplete = async (tasks) => {
//     for (let task of tasks) {
//       console.log(task);
//       if (!task.text.startsWith(TASK_SORT_PREFIX)) {
//         continue;
//       }

//       console.log(task);

//       task.updatedAt = new Date().toISOString();
//       task.checklist.forEach((checklistItem) => {
//         if (checklistItem.completed) {
//           return;
//         }

//         checklistItem.completed = true;
//       });

//       console.log(task);
//       // return;
//       const updateResp = await fetch("https://habitica.com/api/v4/tasks/" + task.id, {
//         method: "PUT",
//         headers: {
//           "x-api-key": API_KEY,
//           "x-api-user": API_USER,
//           "content-type": "application/json",
//         },
//         body: JSON.stringify(task),
//       });
//       const updateData = await updateResp.json();
//       console.log(updateData);
//     }

//     location.reload();
//   };

//   const combineTasks = async () => {
//     const resp = await fetch("https://habitica.com/api/v3/tasks/user", {
//       headers: {
//         "x-api-key": API_KEY,
//         "x-api-user": API_USER,
//       },
//     });
//     const data = await resp.json();markAllChecklistItemsAsComplete
//     console.log(data);

//     const uncompletedItems = [];
//     data.data.forEach((task) => {
//       if (!task.text.startsWith(TASK_SORT_PREFIX)) {
//         return;
//       }

//       console.log(task);

//       task.checklist.forEach((checklistItem) => {
//         if (checklistItem.completed) {
//           return;
//         }

//         uncompletedItems.push({
//           text: checklistItem.text,
//           completed: checklistItem.completed,
//         });
//       });
//     }, []);

//     await markAllChecklistItemsAsComplete(data.data);

//     console.log(uncompletedItems);

//     const payload = [
//       {
//         type: "todo",
//         text: `${TASK_SORT_PREFIX} \`TODO\` @ ${new Date().toDateString()}`,
//         value: 0,
//         priority: 1,
//         completed: false,
//         collapseChecklist: false,
//         checklist: uncompletedItems.sort(sortChecklistItems),
//       },
//     ];

//     console.log(payload);

//     const postResp = await fetch("https://habitica.com/api/v4/tasks/user", {
//       method: "POST",
//       headers: {
//         "x-api-key": API_KEY,
//         "x-api-user": API_USER,
//         "content-type": "application/json",
//       },
//       body: JSON.stringify(payload),
//     });
//     const postData = await postResp.json();
//     console.log(postData);

//     location.reload();
//   };

//   const setupSortingButton = () => {
//     console.log("setting up sort button");

//     const sortButton = document.createElement("button");
//     sortButton.innerText = "Sort";
//     sortButton.addEventListener("click", () => {
//       console.log("click");
//       sortAllMarkedChecklist();
//     });

//     const combineButton = document.createElement("button");
//     combineButton.innerText = "Combine";
//     combineButton.addEventListener("click", () => {
//       console.log("combine!");
//       combineTasks();
//     });

//     const fixButton = document.createElement("button");
//     fixButton.innerText = "Fix Cols";
//     fixButton.addEventListener("click", () => {
//       const parent = document.querySelector(".tasks-columns");
//       if (parent.childNodes.length === 4) {
//         parent.removeChild(parent.childNodes[0]);
//         parent.removeChild(parent.childNodes[0]);
//         parent.childNodes[0].className = "tasks-column col-lg-9 col-md-12 todo";
//       }
//     });

//     const parentNode = document.querySelector(".search-button").parentNode;
//     parentNode.appendChild(sortButton);
//     parentNode.appendChild(combineButton);
//     parentNode.appendChild(fixButton);
//   };

//   const setupColorCoding = () => {
//     const tasks = document.querySelectorAll(".task-content");

//     tasks.forEach((task) => {
//       // console.log(task);
//       const title = task.querySelector(".task-title p").innerHTML.trim();
//       // console.log(title);
//       if (!title.startsWith(TASK_SORT_PREFIX)) {
//         // Exist because task does not need to be sorted.
//         return;
//       }
//       // console.log(title);
//       // console.log(task);

//       const completedTasks = task.querySelectorAll(
//         ".custom-control.custom-checkbox.checklist-item.checklist-item-done"
//       );

//       completedTasks.forEach((completedTask) => {
//         completedTask.style.opacity = 0.3;
//         // console.log(completedTask.style);
//       });

//       const uncompletedTasks = task.querySelectorAll(
//         ".custom-control.custom-checkbox.checklist-item:not(.checklist-item-done)"
//       );

//       uncompletedTasks.forEach((uncompletedTask) => {
//         // console.log(uncompletedTask);
//         const text = uncompletedTask.querySelector("label>p").innerHTML;
//         const data = GetTitle(text);
//         if (data !== undefined) {
//           uncompletedTask.querySelector("label>p").innerHTML = data;
//         }
//         // console.log(text);
//         // completedTask.style.opacity = 0.3;
//         // console.log(completedTask.style);
//         if (text.startsWith("0")) {
//           uncompletedTask.style.backgroundColor = "#FFC0CB";
//         } else if (text.startsWith("1")) {
//           uncompletedTask.style.backgroundColor = "#FFFACD";
//         } else if (text.startsWith("2")) {
//           uncompletedTask.style.backgroundColor = "#98FB98";
//         } else {
//           uncompletedTask.style.backgroundColor = "#00FFFF";
//         }
//       });
//     });
//   };

//   // Handles some task bookkeeping tasks such as:
//   // - Making sure there is a current day task group.
//   // - Making sure all tasks have metadata.
//   async function HandleTasks() {
//     // Fetch the tasks and parse them as json.
//     const resp = await fetch("https://habitica.com/api/v3/tasks/user", {
//       headers: {
//         "x-api-key": API_KEY,
//         "x-api-user": API_USER,
//       },
//     });
//     const data = await resp.json();

//     // Attempt to find the current day's task group.
//     const currentTaskName = `${TASK_SORT_PREFIX} \`TODO\` @ ${new Date().toDateString()}`;
//     let hasCurrentTask = false;
//     let currentTask;
//     data.data.forEach((task) => {
//       console.log(task);
//       if (task.text !== currentTaskName) {
//         return;
//       }

//       hasCurrentTask = true;
//       currentTask = task;
//     });

//     // If it doesn't exist run the combine tasks function.
//     if (!hasCurrentTask) {
//       await combineTasks();
//     }

//     // Make sure all tasks have correct metadata.
//     let updatedChecklistItem = false;
//     currentTask.checklist.forEach((checklistItem) => {
//       // If there is metadata tag.
//       const hasMetaData = checklistItem.text.indexOf("[data:") !== -1;
//       // Get the title and data using regex.
//       const title = GetTitle(checklistItem.text);
//       const data = GetMetadata(checklistItem.text);
//       console.log("data: ", data, title, hasMetaData);

//       // Title and data fail if there are muiltiple [data:...] tags. If found remove them all.
//       if (title === undefined && data === undefined && hasMetaData) {
//         checklistItem.text = checklistItem.text
//           .substring(0, checklistItem.text.indexOf("[data:"))
//           .trim();
//         updatedChecklistItem = true;
//       } else if (!data) {
//         updatedChecklistItem = true;
//         const meta = CreateBasicMetadata();
// checklistItem.text = `${checklistItem.text} [data:${LZString.compressToBase64(
//   JSON.stringify(meta)
// )}]`;
//       }
//     });

//     if (updatedChecklistItem) {
//       console.log("updating tasks", currentTask);
//       const updateResp = await fetch("https://habitica.com/api/v4/tasks/" + currentTask.id, {
//         method: "PUT",
//         headers: {
//           "x-api-key": API_KEY,
//           "x-api-user": API_USER,
//           "content-type": "application/json",
//         },
//         body: JSON.stringify(currentTask),
//       });
//       const updateData = await updateResp.json();
//       console.log(updateData);
//       location.reload();
//     }
//   }

//   async function UpdateTasks(tasks) {
//     const resp = await fetch("https://habitica.com/api/v3/tasks/user", {
//       headers: {
//         "x-api-key": API_KEY,
//         "x-api-user": API_USER,
//       },
//     });
//     const data = await resp.json();
//     console.log(data);

//     const uncompletedItems = [];
//     data.data.forEach((task) => {
//       if (!task.text.startsWith(TASK_SORT_PREFIX)) {
//         return;
//       }

//       console.log(task);

//       task.checklist.forEach((checklistItem) => {
//         if (checklistItem.completed) {
//           return;
//         }

//         uncompletedItems.push({
//           text: checklistItem.text,
//           completed: checklistItem.completed,
//         });
//       });
//     });
//   }

//   // Creates an abortable timeout using an abortcontroller signal.
//   const createAbortableTimeout = (callback, delayInMilliseconds, signal) => {
//     let interalTimerRef;

//     // Handler for the abort signal "abort" event.
//     const abortHandler = () => {
//       console.warn("Canceling timer (%s) via signal abort.", interalTimerRef);
//       clearTimeout(interalTimerRef);
//     };

//     // Handler for the callback of the setTimeout.
//     const internalCallabck = () => {
//       signal?.removeEventListener("abort", abortHandler);
//       callback();
//     };

//     // Setup our internal timer that we can clear-on-abort.
//     interalTimerRef = setTimeout(internalCallabck, delayInMilliseconds);

//     signal?.addEventListener("abort", abortHandler);
//   };

//   // Abort controller to kill the timeout.
//   let abortController = null;

//   // Select the node that will be observed for mutations
//   const targetNode = document.getElementsByTagName("body")[0];

//   // Options for the observer (which mutations to observe)
//   const config = { attributes: true, childList: true, subtree: true };

//   // Callback function to execute when mutations are observed, if no mutation
//   // is observed for 750ms the callback is called. This is expected to happen
//   // once all the primary loading is done.
//   const callback = (mutationList, observer) => {
//     console.log(mutationList);
//     const createNewAbortTimeout = (func) => {
//       abortController?.abort();
//       abortController = new AbortController();

//       createAbortableTimeout(func, 750, abortController.signal);
//     };

//     const timeoutFunction = () => {
//       if (document.querySelector(".search-button") === null) {
//         createNewAbortTimeout(timeoutFunction);
//         return;
//       }

//       // Stop Observing for changes.
//       observer.disconnect();
//       // Run other necessary functions.
//       setupSortingButton();
//       setupColorCoding();
//     };

//     createNewAbortTimeout(timeoutFunction);
//   };

//   // Create an observer instance linked to the callback function
//   const observer = new MutationObserver(callback);

//   // Start observing the target node for configured mutations
//   observer.observe(targetNode, config);

//   // Clean up tasks that autorun.
//   HandleTasks();
// })();
