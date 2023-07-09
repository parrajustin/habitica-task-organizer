import { Habitica, Task, GoogleChartRow, ChartTaskId } from "./habitica";

let filteredTasks: Habitica.TaskGraph[] = [];

export namespace GanttHtml {
  export function GetAllDataAsRows(): string {
    const rowByDay: GoogleChartRow[][] = [];
    for (const task of filteredTasks) {
      rowByDay.push(task.convertToGoogleChartEntries());
    }

    const tasksById: Record<ChartTaskId, GoogleChartRow> = {};
    for (const dayRows of rowByDay) {
      for (const row of dayRows) {
        if (tasksById[row[0]] === undefined) {
          tasksById[row[0]] = row;
        } else {
          const saved = tasksById[row[0]];

          // Get the new unique set of task dependencies.
          const deps: Record<string, boolean> = {};
          (saved[7] ?? "").split(",").forEach((i) => {
            deps[i] = true;
          });
          (row[7] ?? "").split(",").forEach((i) => {
            deps[i] = true;
          });
          const newDeps: string[] = Object.keys(deps);
          saved[7] = newDeps.join(",");

          if (saved[4] < row[4]) {
            // The saved row is earlier than the row.
            saved[4] = row[4];
            saved[2] = row[2];
          } else {
            // The current row is later than the row.
            saved[3] = row[3];
          }

          tasksById[row[0]] = saved;
        }
      }
    }

    const finalTasks = Object.keys(tasksById).map((k) => tasksById[k]);
    return Utilities.base64Encode(JSON.stringify(finalTasks));
  }
  /**
   * Gets the gantt html content.
   * @param e do get request
   * @returns html output
   */
  export function GetHtmlPage(
    e: GoogleAppsScript.Events.AppsScriptHttpRequestEvent
  ): GoogleAppsScript.HTML.HtmlOutput {
    const now = new Date();
    const past = new Date(new Date().setDate(now.getDate() - 30));
    const allTasks = Habitica.GetHabiticaTasks();
    if (allTasks.ok) {
      const tasks = allTasks.unwrap();
      for (let i = 0; i < tasks.length; i++) {
        const createdDate = new Date(tasks[i].createdAt);
        if (past > createdDate) {
          break;
        }
        filteredTasks.push(new Habitica.TaskGraph(tasks[i].id, tasks[i].text, tasks[i].checklist));
      }
      console.log("gantt", filteredTasks);
    }
    // const graph = Habitica.GetTaskGraph();
    // if (graph.ok && e.parameter["selectedGroup"] !== undefined) {
    //   const node = graph.safeUnwrap().findGroupNodeFromRaw(e.parameter["selectedGroup"]);
    //   if (node.some) {
    //     selectedGroup = node.safeUnwrap();
    //   }
    // }
    return HtmlService.createTemplateFromFile("gantt").evaluate();
  }
}
