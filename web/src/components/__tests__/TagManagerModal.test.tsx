import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import TagManagerModal from "@/components/TagManagerModal";
import { ModalProvider } from "@/contexts/ModalProvider";
import { renderWithProviders, setupTranslationMock } from "@test/utils";

const tagsApiMock = vi.hoisted(() => ({
  getEntityTypes: vi.fn(),
  getCategories: vi.fn(),
  getAll: vi.fn(),
  getStatsBatch: vi.fn(),
  getUsage: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  bulkUpdateCategories: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/services/api/tags", () => ({
  tagsApi: tagsApiMock,
}));

const ModalWrapper = ({ children }: { children: ReactNode }) => (
  <ModalProvider>{children}</ModalProvider>
);

beforeEach(() => {
  setupTranslationMock({
    translator: (key) =>
      ({
        "tagManager.categoryManager.title": "Categories",
        "tagManager.categoryManager.description":
          "Create and switch between tag categories.",
        "tagManager.categoryManager.addButton": "New category",
        "tagManager.categoryManager.newLabel": "Category name",
        "tagManager.categoryManager.placeholder": "e.g., Work",
        "tagManager.categoryManager.createButton": "Add",
        "tagManager.categoryManager.addTagButton": "Add tag",
        "tagManager.categoryManager.batchEditButton": "Batch Edit",
        "tagManager.categoryManager.bulkSelectAll": "Select all",
        "tagManager.categoryManager.bulkInvertSelection": "Invert",
        "tagManager.categoryManager.cancelBulkEdit": "Cancel",
        "tagManager.categoryManager.bulkSelectionCount":
          "{{selected}} / {{total}} selected",
        "tagManager.categoryManager.bulkTargetCategoryPlaceholder":
          "Target category",
        "tagManager.categoryManager.bulkMoveButton": "Move to category",
        "tagManager.categoryManager.bulkUpdateConfirmTitle": "Move tags",
        "tagManager.categoryManager.bulkUpdateConfirmMessage":
          "Move {{count}} selected tags to {{target}}?",
        "tagManager.categoryManager.bulkUpdateSuccessTitle": "Tags moved",
        "tagManager.categoryManager.bulkUpdateSuccessMessage":
          "{{count}} tags moved to {{target}}",
        "tagManager.categoryManager.bulkUpdatePartialErrorTitle":
          "Some tags failed",
        "tagManager.categoryManager.bulkUpdatePartialErrorMessage":
          "Success: {{success}}, Failed: {{failed}}",
        "tagManager.categoryManager.successTitle": "Category created",
        "tagManager.categoryManager.successMessage": "Category created",
        "tagManager.categoryManager.errorTitle": "Create category failed",
        "tagManager.categoryManager.emptyError": "Category name required",
        "tagManager.categoryManager.renameButton": "Rename category",
        "tagManager.createNewTag": "Create New Tag",
        "tagManager.fields.name": "Name",
        "tagManager.fields.namePlaceholder": "Tag Name",
        "tagManager.title": "Tag Management",
        "tagManager.createButton": "Create Tag",
        "tagManager.noTags": "No tags",
        "tagManager.empty.createFirstTagHint": "Create your first tag",
        "tagManager.ui.tagCount": "tags",
        "tagManager.ui.tagNamePlaceholder": "Tag name",
        "common.save": "Save",
        "common.cancel": "Cancel",
        "common.submit": "Submit",
        "common.operationFailed": "Operation failed",
        "common.edit": "Edit",
        "common.confirm": "Confirm",
      })[key] ?? key,
  });

  tagsApiMock.getEntityTypes.mockReset();
  tagsApiMock.getCategories.mockReset();
  tagsApiMock.getAll.mockReset();
  tagsApiMock.getStatsBatch.mockReset();
  tagsApiMock.getUsage.mockReset();
  tagsApiMock.createCategory.mockReset();
  tagsApiMock.renameCategory.mockReset();
  tagsApiMock.bulkUpdateCategories.mockReset();
  tagsApiMock.create.mockReset();
  tagsApiMock.update.mockReset();
  tagsApiMock.delete.mockReset();

  tagsApiMock.getEntityTypes.mockResolvedValue(["note", "person"]);
});

describe("TagManagerModal category buttons", () => {
  it("shows tags for the selected category and switches on click", async () => {
    tagsApiMock.getCategories.mockResolvedValue([
      { value: "topic", label: "Theme" },
      { value: "work_stuff", label: "Work Stuff" },
    ]);

    tagsApiMock.getAll.mockResolvedValue({
      items: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          name: "topic tag",
          entity_type: "note",
          category: "topic",
          description: null,
          color: null,
          created_at: "2026-02-09T00:00:00Z",
          updated_at: "2026-02-09T00:00:00Z",
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          name: "work tag",
          entity_type: "note",
          category: "work_stuff",
          description: null,
          color: null,
          created_at: "2026-02-09T00:00:00Z",
          updated_at: "2026-02-09T00:00:00Z",
        },
      ],
    });

    tagsApiMock.getStatsBatch.mockResolvedValue({
      entity_type: "note",
      tag_stats: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          name: "topic tag",
          usage_count: 1,
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          name: "work tag",
          usage_count: 2,
        },
      ],
      total_tags: 2,
    });

    renderWithProviders(
      <TagManagerModal
        isOpen={true}
        onClose={() => undefined}
        entityTypeScope="note"
      />,
      { wrapper: ModalWrapper },
    );

    await screen.findByText("topic tag");
    expect(screen.queryByText("work tag")).not.toBeInTheDocument();

    const workButton = screen.getByRole("button", { name: /Work Stuff/i });
    await userEvent.click(workButton);

    await screen.findByText("work tag");
    expect(screen.queryByText("topic tag")).not.toBeInTheDocument();
  });

  it("creates a new category from within the modal and selects it", async () => {
    let categories = [
      { value: "topic", label: "Theme" },
      { value: "work_stuff", label: "Work Stuff" },
    ];

    tagsApiMock.getCategories.mockImplementation(async () => categories);
    tagsApiMock.getAll.mockResolvedValue({ items: [] });
    tagsApiMock.getStatsBatch.mockResolvedValue({
      entity_type: "note",
      tag_stats: [],
      total_tags: 0,
    });

    tagsApiMock.createCategory.mockImplementation(
      async ({ label }: { label: string }) => {
        const created = { value: "hobbies", label };
        categories = [...categories, created];
        return created;
      },
    );

    renderWithProviders(
      <TagManagerModal
        isOpen={true}
        onClose={() => undefined}
        entityTypeScope="note"
      />,
      { wrapper: ModalWrapper },
    );

    const addButton = await screen.findByRole("button", {
      name: /New category/i,
    });
    await userEvent.click(addButton);

    const input = screen.getByLabelText("Category name");
    await userEvent.type(input, "Hobbies");

    const createButton = screen.getByRole("button", { name: /^Add$/i });
    await userEvent.click(createButton);

    await waitFor(() =>
      expect(tagsApiMock.createCategory).toHaveBeenCalledWith(
        { label: "Hobbies" },
        "note",
      ),
    );

    await screen.findByRole("button", { name: /Hobbies/i });
    expect(screen.getByText("Hobbies")).toBeInTheDocument();
  });

  it("renames a custom category and updates the button label", async () => {
    let categories = [
      { value: "topic", label: "Theme" },
      { value: "work_stuff", label: "Work Stuff" },
    ];
    tagsApiMock.getCategories.mockImplementation(async () => categories);
    tagsApiMock.getAll.mockResolvedValue({ items: [] });
    tagsApiMock.getStatsBatch.mockResolvedValue({
      entity_type: "note",
      tag_stats: [],
      total_tags: 0,
    });

    tagsApiMock.renameCategory.mockImplementation(
      async (value: string, payload: { label: string }) => {
        const updated = { value, label: payload.label };
        categories = categories.map((item) =>
          item.value === value ? updated : item,
        );
        return updated;
      },
    );

    renderWithProviders(
      <TagManagerModal
        isOpen={true}
        onClose={() => undefined}
        entityTypeScope="note"
      />,
      { wrapper: ModalWrapper },
    );

    await screen.findByText("Work Stuff");

    const renameButton = screen.getByRole("button", {
      name: /Rename category/i,
    });
    await userEvent.click(renameButton);

    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Work Items");

    const saveButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveButton);

    await waitFor(() =>
      expect(tagsApiMock.renameCategory).toHaveBeenCalledWith(
        "work_stuff",
        { label: "Work Items" },
        "note",
      ),
    );

    await screen.findByText("Work Items");
  });

  it("quick add tag from category with scoped entity type and prefilled category", async () => {
    tagsApiMock.getCategories.mockResolvedValue([
      { value: "topic", label: "Theme" },
      { value: "work_stuff", label: "Work Stuff" },
    ]);

    tagsApiMock.getAll.mockResolvedValue({
      items: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          name: "topic tag",
          entity_type: "note",
          category: "topic",
          description: null,
          color: null,
          created_at: "2026-02-09T00:00:00Z",
          updated_at: "2026-02-09T00:00:00Z",
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          name: "work tag",
          entity_type: "note",
          category: "work_stuff",
          description: null,
          color: null,
          created_at: "2026-02-09T00:00:00Z",
          updated_at: "2026-02-09T00:00:00Z",
        },
      ],
    });

    tagsApiMock.getStatsBatch.mockResolvedValue({
      entity_type: "note",
      tag_stats: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          name: "topic tag",
          usage_count: 1,
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          name: "work tag",
          usage_count: 2,
        },
      ],
      total_tags: 2,
    });

    tagsApiMock.create.mockImplementation(
      async (payload: {
        entity_type?: string;
        name: string;
        category?: string;
      }) => {
        return {
          id: "00000000-0000-0000-0000-000000000100",
          name: payload.name,
          entity_type: payload.entity_type ?? "note",
          category: payload.category ?? "topic",
          description: null,
          color: null,
          created_at: "2026-02-22T00:00:00Z",
          updated_at: "2026-02-22T00:00:00Z",
        };
      },
    );

    renderWithProviders(
      <TagManagerModal
        isOpen={true}
        onClose={() => undefined}
        entityTypeScope="note"
      />,
      { wrapper: ModalWrapper },
    );

    const addTagButton = await screen.findByRole("button", {
      name: /tagManager.categoryManager.addTagButton|add tag/i,
    });
    await userEvent.click(addTagButton);

    const nameInput = await screen.findByRole("textbox", {
      name: /tagManager\.fields\.name|Name/i,
    });
    await userEvent.type(nameInput, "quarterly");

    const submitButton = screen.getByRole("button", {
      name: /common\.submit|submit/i,
    });
    await userEvent.click(submitButton);

    await waitFor(() =>
      expect(tagsApiMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "quarterly",
          entity_type: "note",
          category: "topic",
        }),
      ),
    );
  });

  it("only updates tag name when editing a single tag", async () => {
    tagsApiMock.getCategories.mockResolvedValue([
      { value: "topic", label: "Theme" },
      { value: "work_stuff", label: "Work Stuff" },
    ]);

    tagsApiMock.getAll.mockResolvedValue({
      items: [
        {
          id: "00000000-0000-0000-0000-000000000101",
          name: "initial tag",
          entity_type: "note",
          category: "topic",
          description: null,
          color: null,
          created_at: "2026-02-09T00:00:00Z",
          updated_at: "2026-02-09T00:00:00Z",
        },
      ],
    });

    tagsApiMock.getStatsBatch.mockResolvedValue({
      entity_type: "note",
      tag_stats: [
        {
          id: "00000000-0000-0000-0000-000000000101",
          name: "initial tag",
          usage_count: 1,
        },
      ],
      total_tags: 1,
    });

    tagsApiMock.update.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000101",
      name: "renamed tag",
      entity_type: "note",
      category: "topic",
      description: null,
      color: null,
      created_at: "2026-02-09T00:00:00Z",
      updated_at: "2026-02-09T00:00:00Z",
    });

    renderWithProviders(
      <TagManagerModal
        isOpen={true}
        onClose={() => undefined}
        entityTypeScope="note"
      />,
      { wrapper: ModalWrapper },
    );

    const tagText = await screen.findByText("initial tag");
    await userEvent.click(tagText);

    const nameInput = await screen.findByDisplayValue("initial tag");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "renamed tag");

    const saveButton = screen.getByRole("button", {
      name: /save|common\.save/i,
    });
    await userEvent.click(saveButton);

    await waitFor(() => expect(tagsApiMock.update).toHaveBeenCalledTimes(1));

    expect(tagsApiMock.update).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000101",
      { name: "renamed tag" },
    );
  });

  it("supports bulk editing with select all, invert selection and confirm move", async () => {
    tagsApiMock.getCategories.mockResolvedValue([
      { value: "location", label: "Location" },
      { value: "work_stuff", label: "Work Stuff" },
      { value: "finance", label: "Finance" },
    ]);

    tagsApiMock.getAll.mockResolvedValue({
      items: [
        {
          id: "00000000-0000-0000-0000-000000000201",
          name: "person tag a",
          entity_type: "person",
          category: "location",
          description: null,
          color: null,
          created_at: "2026-02-09T00:00:00Z",
          updated_at: "2026-02-09T00:00:00Z",
        },
        {
          id: "00000000-0000-0000-0000-000000000202",
          name: "person tag b",
          entity_type: "person",
          category: "location",
          description: null,
          color: null,
          created_at: "2026-02-09T00:00:00Z",
          updated_at: "2026-02-09T00:00:00Z",
        },
      ],
    });

    tagsApiMock.getStatsBatch.mockResolvedValue({
      entity_type: "person",
      tag_stats: [
        {
          id: "00000000-0000-0000-0000-000000000201",
          name: "person tag a",
          usage_count: 1,
        },
        {
          id: "00000000-0000-0000-0000-000000000202",
          name: "person tag b",
          usage_count: 2,
        },
      ],
      total_tags: 2,
    });

    tagsApiMock.bulkUpdateCategories.mockResolvedValue({
      updated_count: 1,
      failed_ids: [],
      errors: [],
      updated_tags: [
        {
          id: "00000000-0000-0000-0000-000000000202",
          name: "person tag b",
          entity_type: "person",
          category: "work_stuff",
          description: null,
          color: null,
          created_at: "2026-02-09T00:00:00Z",
          updated_at: "2026-02-09T00:00:00Z",
        },
      ],
    });

    renderWithProviders(
      <TagManagerModal
        isOpen={true}
        onClose={() => undefined}
        entityTypeScope="person"
      />,
      { wrapper: ModalWrapper },
    );

    const [batchEditButton] = await screen.findAllByRole("button", {
      name: /Batch Edit/i,
    });
    await userEvent.click(batchEditButton);

    const selectAllButton = await screen.findByRole("button", {
      name: /Select all/i,
    });
    await userEvent.click(selectAllButton);

    const invertButton = screen.getByRole("button", {
      name: /Invert/i,
    });
    await userEvent.click(invertButton);

    const tagAText = screen.getByText("person tag a");
    const tagALabel = tagAText.closest("label");
    await userEvent.click(
      within(tagALabel as HTMLElement).getByRole("checkbox"),
    );

    const targetCategorySelect = screen.getByPlaceholderText("Target category");
    await userEvent.click(targetCategorySelect);

    const targetOption = await screen.findByRole("button", {
      name: "Work Stuff",
    });
    await userEvent.click(targetOption);

    const moveButton = screen.getByRole("button", {
      name: /Move to category/i,
    });
    await userEvent.click(moveButton);

    const confirmDialog = await screen.findByRole("alertdialog");
    const confirmButton = within(confirmDialog).getByRole("button", {
      name: /Move to category/i,
    });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(tagsApiMock.bulkUpdateCategories).toHaveBeenCalledWith({
        ids: ["00000000-0000-0000-0000-000000000201"],
        category: "work_stuff",
      });
    });

    expect(tagsApiMock.bulkUpdateCategories).toHaveBeenCalledTimes(1);
  });
});
