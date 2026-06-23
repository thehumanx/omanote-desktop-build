// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup(userId: string) {
  const t = convexTest(schema, modules);
  return t.withIdentity({ tokenIdentifier: userId });
}

describe("todo folders", () => {
  it("creates uncategorized todos in the default Others folder", async () => {
    const asUser = setup("todo-default-folder-user");

    const todoId = await asUser.mutation(api.todos.createTodo, {
      title: "Buy milk",
      createdDateKey: "2026-06-23",
    });

    const [todo, folders] = await Promise.all([
      asUser.query(api.todos.getTodoById, { todoId }),
      asUser.query(api.todos.listTodoFolders, {}),
    ]);

    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatchObject({ name: "Others" });
    expect(todo).toMatchObject({
      folderId: folders[0]._id,
      folderName: "Others",
    });
  });

  it("creates a folder from a todo folder name", async () => {
    const asUser = setup("todo-create-folder-by-name-user");

    const todoId = await asUser.mutation(api.todos.createTodo, {
      title: "Get lentils",
      createdDateKey: "2026-06-23",
      folderName: "Shopping",
    });

    const [todo, folders] = await Promise.all([
      asUser.query(api.todos.getTodoById, { todoId }),
      asUser.query(api.todos.listTodoFolders, {}),
    ]);

    const shopping = folders.find((folder) => folder.name === "Shopping");
    expect(shopping).toBeTruthy();
    expect(todo).toMatchObject({
      folderId: shopping!._id,
      folderName: "Shopping",
    });
  });

  it("moves a todo to another folder on update", async () => {
    const asUser = setup("todo-move-folder-user");
    const booksFolderId = await asUser.mutation(api.todos.createTodoFolder, { name: "Books" });
    const todoId = await asUser.mutation(api.todos.createTodo, {
      title: "Read Dune",
      createdDateKey: "2026-06-23",
      folderName: "Shopping",
    });

    await asUser.mutation(api.todos.updateTodo, {
      todoId,
      title: "Read Dune",
      folderId: booksFolderId,
    });

    await expect(asUser.query(api.todos.getTodoById, { todoId })).resolves.toMatchObject({
      folderId: booksFolderId,
      folderName: "Books",
    });
  });

  it("renames a folder and updates todos using its denormalized folder name", async () => {
    const asUser = setup("todo-rename-folder-user");
    const folderId = await asUser.mutation(api.todos.createTodoFolder, { name: "Errands" });
    const todoId = await asUser.mutation(api.todos.createTodo, {
      title: "Pick up package",
      createdDateKey: "2026-06-23",
      folderId,
    });

    await asUser.mutation(api.todos.updateTodoFolder, {
      folderId,
      name: "Shopping",
    });

    await expect(asUser.query(api.todos.getTodoById, { todoId })).resolves.toMatchObject({
      folderId,
      folderName: "Shopping",
    });
  });

  it("moves todos to Others when deleting a folder", async () => {
    const asUser = setup("todo-delete-folder-user");
    const folderId = await asUser.mutation(api.todos.createTodoFolder, { name: "Books" });
    const todoId = await asUser.mutation(api.todos.createTodo, {
      title: "Read Hyperion",
      createdDateKey: "2026-06-23",
      folderId,
    });

    await asUser.mutation(api.todos.deleteTodoFolder, { folderId });

    const [todo, folders] = await Promise.all([
      asUser.query(api.todos.getTodoById, { todoId }),
      asUser.query(api.todos.listTodoFolders, {}),
    ]);
    const others = folders.find((folder) => folder.name === "Others");

    expect(others).toBeTruthy();
    expect(todo).toMatchObject({
      folderId: others!._id,
      folderName: "Others",
    });
  });

  it("soft-deletes todos when deleting a folder with todos", async () => {
    const asUser = setup("todo-delete-folder-with-todos-user");
    const folderId = await asUser.mutation(api.todos.createTodoFolder, { name: "Books" });
    const todoId = await asUser.mutation(api.todos.createTodo, {
      title: "Read Foundation",
      createdDateKey: "2026-06-23",
      folderId,
    });

    await asUser.mutation(api.todos.deleteTodoFolderWithTodos, { folderId });

    const todo = await asUser.query(api.todos.getTodoById, { todoId });
    expect(todo?.deletedAt).toEqual(expect.any(Number));
  });
});
