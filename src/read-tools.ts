import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  queryTodos,
  queryTodoById,
  queryProjects,
  queryProjectById,
  queryAreas,
  queryTags,
} from "./db.js";
import type { TodoList } from "./db.js";

export function registerReadTools(server: McpServer): void {
  registerGetTodos(server);
  registerGetTodo(server);
  registerGetProjects(server);
  registerGetProject(server);
  registerGetAreas(server);
  registerGetTags(server);
}

// --- get-todos ---

function registerGetTodos(server: McpServer): void {
  server.registerTool(
    "get-todos",
    {
      description:
        "Get to-dos from Things 3 by reading the database directly. " +
        "Returns data inline — no need to open the app. " +
        "Filter by list (inbox, today, anytime, someday, upcoming, logbook, trash), project, area, tag, or search text.",
      inputSchema: {
        list: z
          .enum(["inbox", "today", "anytime", "someday", "upcoming", "logbook", "trash"])
          .optional()
          .describe("Filter by built-in list view"),
        projectId: z.string().optional().describe("Filter by project UUID"),
        areaId: z.string().optional().describe("Filter by area UUID"),
        tag: z.string().optional().describe("Filter by tag name"),
        status: z
          .enum(["open", "completed", "canceled"])
          .optional()
          .describe("Filter by status (default: depends on list)"),
        search: z.string().optional().describe("Search in title and notes"),
        limit: z.number().optional().describe("Max results to return (default 50)"),
      },
    },
    async (params) => {
      try {
        const todos = queryTodos({
          list: params.list as TodoList | undefined,
          projectId: params.projectId,
          areaId: params.areaId,
          tag: params.tag,
          search: params.search,
          status: params.status as "open" | "completed" | "canceled" | undefined,
          limit: params.limit,
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(todos, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to query todos: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

// --- get-todo ---

function registerGetTodo(server: McpServer): void {
  server.registerTool(
    "get-todo",
    {
      description:
        "Get a single to-do from Things 3 by UUID. " +
        "Returns full details including notes, checklist items, tags, project, and area.",
      inputSchema: {
        id: z.string().describe("UUID of the to-do"),
      },
    },
    async (params) => {
      try {
        const todo = queryTodoById(params.id);
        if (!todo) {
          return {
            content: [{ type: "text" as const, text: `No to-do found with ID: ${params.id}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(todo, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to query todo: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

// --- get-projects ---

function registerGetProjects(server: McpServer): void {
  server.registerTool(
    "get-projects",
    {
      description:
        "Get projects from Things 3. " +
        "Returns project list with open/total to-do counts. " +
        "Filter by status, area, or search text.",
      inputSchema: {
        status: z
          .enum(["open", "completed", "canceled"])
          .optional()
          .describe("Filter by project status"),
        areaId: z.string().optional().describe("Filter by area UUID"),
        search: z.string().optional().describe("Search in title and notes"),
        limit: z.number().optional().describe("Max results to return (default 50)"),
      },
    },
    async (params) => {
      try {
        const projects = queryProjects({
          status: params.status as "open" | "completed" | "canceled" | undefined,
          areaId: params.areaId,
          search: params.search,
          limit: params.limit,
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to query projects: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

// --- get-project ---

function registerGetProject(server: McpServer): void {
  server.registerTool(
    "get-project",
    {
      description:
        "Get a single project from Things 3 by UUID. " +
        "Returns full details including headings and to-dos organized by heading.",
      inputSchema: {
        id: z.string().describe("UUID of the project"),
      },
    },
    async (params) => {
      try {
        const project = queryProjectById(params.id);
        if (!project) {
          return {
            content: [{ type: "text" as const, text: `No project found with ID: ${params.id}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to query project: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

// --- get-areas ---

function registerGetAreas(server: McpServer): void {
  server.registerTool(
    "get-areas",
    {
      description: "Get all areas from Things 3.",
      inputSchema: {},
    },
    async () => {
      try {
        const areas = queryAreas();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(areas, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to query areas: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

// --- get-tags ---

function registerGetTags(server: McpServer): void {
  server.registerTool(
    "get-tags",
    {
      description: "Get all tags from Things 3.",
      inputSchema: {},
    },
    async () => {
      try {
        const tags = queryTags();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(tags, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to query tags: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
