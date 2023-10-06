import { Guards } from "./assert";
import { Combine } from "./combine";
import { LZString } from "./lz-string";
import { Option, Some } from "./option";
import { Ok, Result } from "./result";
import { ShortUniqueId } from "./short-unique-id";
import { Utils } from "./utils";

interface TasksUserFetch {
  success: boolean;
  data: Task[];
}

export namespace Habitica {

  /**
   * Gets the days todo name.
   * @returns an option wrapping the possible output
   */
  function GetTodayTodoName(): Option<string> {
    const userProperties = PropertiesService.getUserProperties();
    const taskSortPrefix = userProperties.getProperty("TASK_SORT_PREFIX");
    if (taskSortPrefix === null) {
      return Option.None;
    }
    const currentTaskName = `${taskSortPrefix} \`TODO\` @ ${new Date().toDateString()}`;
    return Option.Some(currentTaskName);
  }

  /**
   * Get all habitica todo tasks.
   * @returns result of operation to fetch habitica tasks
   */
  export function GetHabiticaTasks(): Result<
    Task[],
    "InvalidScriptProperty" | "FailedFetchNetworkRequest" | "FailedTasksSuccess"
  > {
    const userProperties = PropertiesService.getUserProperties();
    const apiKey = userProperties.getProperty("API_KEY");
    const apiUser = userProperties.getProperty("API_USER");

    if (apiKey === null || apiUser === null) {
      return Result.Err("InvalidScriptProperty");
    }

    // Fetch the tasks and parse them as json.
    const resp = UrlFetchApp.fetch(
      "https://habitica.com/api/v3/tasks/user?type=todos",
      {
        headers: {
          "x-api-key": apiKey,
          "x-api-user": apiUser,
        },
      }
    );
    const success = resp.getResponseCode() === 200;
    if (!success) {
      return Result.Err("FailedFetchNetworkRequest");
    }

    // Check the tasks were successfully fetched.
    const data: TasksUserFetch = JSON.parse(resp.getContentText());
    if (!data.success) {
      return Result.Err("FailedTasksSuccess");
    }

    return Result.Ok(data.data);
  }

  /**
   * Gets today's todo item.
   * @returns Result of today's todo entry, if it exists
   */
  function GetTodayTodo(): Result<
    Task,
    | "InvalidScriptProperty"
    | "FailedFetchNetworkRequest"
    | "FailedTasksSuccess"
    | "MissingToday"
  > {
    const data = GetHabiticaTasks();
    if (data.err) {
      return data;
    }
    Guards.assert<Ok<Task[]>>(data);

    // Get the name for today's todo.
    const todayNameOption = GetTodayTodoName();
    if (todayNameOption.none) {
      return Result.Err("InvalidScriptProperty");
    }

    // Unwrap the option value.
    const todayName = todayNameOption.unwrap();

    // Finally attempt to find the task that relates to today.
    for (const task of data.unwrap()) {
      if (task.text === todayName) {
        return Result.Ok(task);
      }
    }

    return Result.Err("MissingToday");
  }

  /**
   * Attempt to create or get today's task.
   * @returns today's task item
   */
  function CreateOrGetTodayTodoItem(): Result<Task, "InvalidScriptProperty"> {
    const todo = GetTodayTodo();

    if (todo.ok) {
      return todo;
    }

    if (todo.err && todo.val === "InvalidScriptProperty") {
      return Result.Err("InvalidScriptProperty");
    }

    const combine = Combine.CombineIntoTodo();
    if (combine.ok) {
      return CreateOrGetTodayTodoItem();
    }

    if (combine.err && combine.val === "InvalidScriptProperty") {
      return Result.Err("InvalidScriptProperty");
    }

    return CreateOrGetTodayTodoItem();
  }

  /**
   * Gets the current day's task graph.
   * @returns the graph of tasks
   */
  export function GetTaskGraph(): Result<
    TaskGraph,
    "InvalidScriptProperty" | "UnderlyingIssue"
  > {
    if (currentTaskGraph === undefined) {
      const todo = CreateOrGetTodayTodoItem();

      if (todo.err) {
        return Result.Err("InvalidScriptProperty");
      }
      Guards.assert<Ok<Task>>(todo);

      // Raw habitica api task.
      const task = todo.val;
      currentTaskGraph = new TaskGraph(task.id, task.text, task.checklist);
    }

    return Result.Ok(currentTaskGraph);
  }
}

let currentTaskGraph: Habitica.TaskGraph | undefined = undefined;
