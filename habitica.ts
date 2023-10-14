import { Guards } from "./assert";
import { Combine } from "./combine";
import { LZString } from "./lz-string";
import { Option, Some } from "./option";
import { Ok, Result } from "./result";
import { ShortUniqueId } from "./short-unique-id";
import { Utils } from "./utils";
import { Preferences } from "./preferences";
import { Graph } from "./taskGraph";

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

export namespace Habitica {
  /** Habitica API for checklist items within the Todo entry. */
  export interface ChecklistItem {
    completed: boolean;
    text: string;
    id: string;
  }

  /** Minimial interface of Todo entry from Habitica API. */
  export interface TaskShort {
    id: string;
    notes: string;
    completed: boolean;
  }

  /** Full interface of Todo entry from Habitica API. */
  export interface Task extends TaskShort {
    attribute: string;
    byHabitica: boolean;
    challenge: any;
    checklist: ChecklistItem[];
    collapseChecklist: boolean;
    createdAt: string;
    group: any;
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

  /** Json Response from habitica api */
  interface HabiticaFetchTasks<T> {
    success: boolean;
    data: T;
  }

  /** Gets the task prefix for the names on habitica todo's. */
  function GetTaskPrefix(): string {
    if (TODO_ENTRY_PREFIX !== undefined) {
      return TODO_ENTRY_PREFIX;
    }
    const userProperties = PropertiesService.getUserProperties();
    const taskSortPrefix = userProperties.getProperty("TASK_SORT_PREFIX");
    if (taskSortPrefix === null) {
      const newPref = {};
      const entryDefault = "Entry:";
      TODO_ENTRY_PREFIX = entryDefault;
      newPref[Preferences.todoPrefix] = entryDefault;
      userProperties.setProperties(newPref);
      return entryDefault;
    }
    TODO_ENTRY_PREFIX = taskSortPrefix;
    return taskSortPrefix;
  }

  /** Gets the api props for the habitica api data. */
  function GetApiProps(): Result<
    { key: string; user: string },
    "InvalidScriptProperty"
  > {
    const userProperties = PropertiesService.getUserProperties();
    const apiKey = userProperties.getProperty(Preferences.ApiKey);
    const apiUser = userProperties.getProperty(Preferences.ApiUser);

    if (apiKey === null || apiUser === null) {
      return Result.Err("InvalidScriptProperty");
    }
    return Result.Ok({ key: apiKey, user: apiUser });
  }

  /**
   * Get all habitica todo tasks.
   * @returns result of operation to fetch habitica tasks
   */
  export function GetHabiticaTasks(): Result<
    Task[],
    "InvalidScriptProperty" | "FailedFetchNetworkRequest" | "ApiError"
  > {
    return GetApiProps()
      .andThen<string, "FailedFetchNetworkRequest">((props) => {
        const resp = UrlFetchApp.fetch(
          "https://habitica.com/api/v3/tasks/user?type=todos",
          {
            headers: {
              "x-api-key": props.key,
              "x-api-user": props.user,
            },
          }
        );
        const success = resp.getResponseCode() === 200;
        if (!success) {
          return Result.Err("FailedFetchNetworkRequest");
        }
        return Result.Ok(resp.getContentText());
      })
      .andThen<Task[], "ApiError">((content) => {
        // Check the tasks were successfully fetched.
        const data: HabiticaFetchTasks<Task[]> = JSON.parse(content);
        if (!data.success) {
          return Result.Err("ApiError");
        }
        return Result.Ok(data.data);
      });
  }

  /**
   * Create a default habitica task.
   * @returns default task or error
   */
  function CreateDefaultHabiticaTask(): Result<
    Task,
    "ApiError" | "FailedFetchNetworkRequest" | "InvalidScriptProperty"
  > {
    return GetApiProps()
      .andThen<string, "FailedFetchNetworkRequest">((apiProps) => {
        const todoPrefix = GetTaskPrefix();
        const payload: CreateTaskBody[] = [
          {
            type: "todo",
            text: `${todoPrefix} \`Root Entry\` @ ${new Date().toDateString()}`,
            value: 0,
            priority: 1,
            collapseChecklist: false,
            checklist: [],
          },
        ];
        const postResp = UrlFetchApp.fetch(
          "https://habitica.com/api/v3/tasks/user",
          {
            method: "post",
            headers: {
              "x-api-key": apiProps.key,
              "x-api-user": apiProps.user,
              "content-type": "application/json",
            },
            payload: JSON.stringify(payload),
          }
        );
        const success = postResp.getResponseCode() === 200;
        if (!success) {
          return Result.Err("FailedFetchNetworkRequest");
        }
        return Result.Ok(postResp.getContentText());
      })
      .andThen<Task, "ApiError">((content) => {
        // Check the tasks were successfully fetched.
        const data: HabiticaFetchTasks<Task> = JSON.parse(content);
        if (!data.success) {
          return Result.Err("ApiError");
        }
        return Result.Ok(data.data);
      });
  }

  /**
   * Attempt to create or get today's task.
   * @returns today's task item
   */
  function CreateOrGetHabiticaTasks(): Result<
    Task[],
    "InvalidScriptProperty" | "FailedFetchNetworkRequest" | "ApiError"
  > {
    return GetHabiticaTasks()
      .andThen<Task[], "InvalidData">((task) => {
        const todoPrefix = GetTaskPrefix();
        const prefixLen = todoPrefix.length;

        const keptTodos = task.filter(
          (t) => t.notes.slice(0, prefixLen) === todoPrefix
        );
        if (keptTodos.length === 0) {
          return Result.Err("InvalidData");
        }
        return Result.Ok(keptTodos);
      })
      .transformError<
        Task[],
        "ApiError" | "FailedFetchNetworkRequest" | "InvalidScriptProperty"
      >((err) => {
        // If we got `InvalidData` attempt to create a default task.
        if (err !== "InvalidData") {
          return Result.Err(err);
        }
        return CreateDefaultHabiticaTask().andThen<Task[]>((defaultTask) => {
          return Result.Ok([defaultTask]);
        });
      });
  }

  /**
   * Gets the current day's task graph.
   * @returns the graph of tasks
   */
  export function GetTaskGraph(): Result<
    Graph.TaskGraph,
    "InvalidScriptProperty" | "FailedFetchNetworkRequest" | "ApiError"
  > {
    if (currentTaskGraph === undefined) {
      return CreateOrGetHabiticaTasks().andThen<Graph.TaskGraph>((tasks) => {
        const checkListItems: Habitica.ChecklistItem[] = [];
        const todoItems: Habitica.TaskShort[] = [];

        for (const task of tasks) {
          todoItems.push({
            id: task.id,
            notes: task.notes,
            completed: task.completed,
          });
          checkListItems.push(...task.checklist);
        }

        currentTaskGraph = new Graph.TaskGraph(checkListItems, todoItems);
        return Result.Ok(currentTaskGraph);
      });
    }

    return Result.Ok(currentTaskGraph);
  }
}

let currentTaskGraph: Graph.TaskGraph | undefined = undefined;

/** App script saved todo entry prefix. */
let TODO_ENTRY_PREFIX: string | undefined = undefined;
