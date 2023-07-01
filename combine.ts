import { Result, Ok, Err } from "./result";

interface ChecklistItem {
  completed: boolean;
  text: string;
  id: string;
}

interface Task {
  attribute: "str" | "int" | "per" | "con";
  byHabitica: boolean;
  challenge: any;
  checklist: ChecklistItem[];
  collapseChecklist: boolean;
  completed: boolean;
  createdAt: string;
  group: any;
  id: string;
  notes: string;
  priority: number;
  reminders: any[];
  tags: string[];
  text: string;
  type: "todos";
  updatedAt: string;
  userId: string;
  value: number;
  _id: string;
}

interface TasksUserFetch {
  success: boolean;
  data: Task[];
}

interface CreateTaskBody {
  // The text to be displayed for the task.
  text: string;
  // Task type, options are: "habit", "daily", "todo", "reward".
  type: "habit" | "daily" | "todo" | "reward";
  // Array of UUIDs of tags.
  tags?: string[];
  // Alias to assign to task.
  alias?: string;
  // User's attribute to use, options are: "str", "int", "per", "con".
  attribute?: "str" | "int" | "per" | "con";
  // An array of checklist items. For example, [{"text":"buy tools", "completed":true}, {"text":"build shed", "completed":false}].
  checklist?: { text: string; completed: boolean }[];
  // Determines if a checklist will be displayed.
  collapseChecklist?: boolean;
  notes?: string;
  date?: Date;
  priority?: number;
  reminders?: string;
  frequency?: string;
  repeat?: string;
  everyX?: number;
  streak?: number;
  daysOfMonth?: number;
  weeksOfMonth?: number;
  startDate?: Date;
  up?: boolean;
  down?: boolean;
  value?: number;
}

export namespace Combine {
  /**
   * Mark all checklist items as complete for all tasks.
   * @param tasks habitica tasks
   * @param taskPrefix habitica task prefix
   * @param apiKey the habitica api key
   * @param apiUser the habitica api user id
   * @returns Resutl if successful
   */
  export function MarkAllChecklistItemsAsComplete(
    tasks: Task[],
    taskPrefix: string,
    apiKey: string,
    apiUser: string
  ): Result<undefined, "FailedFetchNetworkRequest" | "FailedCompleteSuccess"> {
    for (let task of tasks) {
      if (!task.text.startsWith(taskPrefix)) {
        continue;
      }

      task.updatedAt = new Date().toISOString();
      task.checklist.forEach((checklistItem) => {
        checklistItem.completed = true;
      });

      const updateResp = UrlFetchApp.fetch(`https://habitica.com/api/v4/tasks/${task.id}`, {
        method: "put",
        headers: {
          "x-api-key": apiKey,
          "x-api-user": apiUser,
          "content-type": "application/json",
        },
        payload: JSON.stringify(task),
      });
      const postRespSuccess = updateResp.getResponseCode() === 200;
      if (!postRespSuccess) {
        return Result.Err("FailedFetchNetworkRequest");
      }

      // Check the tasks were successfully fetched.
      const postRespData: TasksUserFetch = JSON.parse(updateResp.getContentText());
      if (!postRespData.success) {
        return Result.Err("FailedCompleteSuccess");
      }
    }

    return Result.Ok(undefined);
  }

  /**
   *
   * @returns Promise result if successfully combined items into todo.
   */
  export function CombineIntoTodo(): Result<
    undefined,
    | "InvalidScriptProperty"
    | "FailedFetchNetworkRequest"
    | "FailedTasksSuccess"
    | "FailedPostSuccess"
    | "FailedCompleteSuccess"
  > {
    const userProperties = PropertiesService.getUserProperties();
    const taskSortPrefix = userProperties.getProperty("TASK_SORT_PREFIX");
    const apiKey = userProperties.getProperty("API_KEY");
    const apiUser = userProperties.getProperty("API_USER");

    if (taskSortPrefix === null || apiKey === null || apiUser === null) {
      return Result.Err("InvalidScriptProperty");
    }

    // Fetch the tasks and parse them as json.
    const resp = UrlFetchApp.fetch("https://habitica.com/api/v3/tasks/user?type=todos", {
      headers: {
        "x-api-key": apiKey,
        "x-api-user": apiUser,
      },
    });
    const success = resp.getResponseCode() === 200;
    if (!success) {
      return Result.Err("FailedFetchNetworkRequest");
    }

    // Check the tasks were successfully fetched.
    const data: TasksUserFetch = JSON.parse(resp.getContentText());
    if (!data.success) {
      return Result.Err("FailedTasksSuccess");
    }

    // Get all the uncompleted items.
    const uncompletedItems: { text: string; completed: boolean }[] = [];
    data.data.forEach((task) => {
      if (!task.text.startsWith(taskSortPrefix)) {
        return;
      }

      task.checklist.forEach((checklistItem) => {
        if (checklistItem.completed) {
          return;
        }

        uncompletedItems.push({
          text: checklistItem.text,
          completed: checklistItem.completed,
        });
      });
    });

    const completedResp = MarkAllChecklistItemsAsComplete(
      data.data,
      taskSortPrefix,
      apiKey,
      apiUser
    );
    if (completedResp.err) {
      return completedResp;
    }

    // Create a new todo task for today.
    const payload: CreateTaskBody[] = [
      {
        type: "todo",
        text: `${taskSortPrefix} \`TODO\` @ ${new Date().toDateString()}`,
        value: 0,
        priority: 1,
        collapseChecklist: false,
        checklist: uncompletedItems,
      },
    ];
    const postResp = UrlFetchApp.fetch("https://habitica.com/api/v4/tasks/user", {
      method: "post",
      headers: {
        "x-api-key": apiKey,
        "x-api-user": apiUser,
        "content-type": "application/json",
      },
      payload: JSON.stringify(payload),
    });
    const postRespSuccess = postResp.getResponseCode() === 200;
    if (!postRespSuccess) {
      return Result.Err("FailedFetchNetworkRequest");
    }

    // Check the tasks were successfully fetched.
    const postRespData: TasksUserFetch = JSON.parse(postResp.getContentText());
    if (!postRespData.success) {
      return Result.Err("FailedPostSuccess");
    }

    return Result.Ok(undefined);
  }
}
