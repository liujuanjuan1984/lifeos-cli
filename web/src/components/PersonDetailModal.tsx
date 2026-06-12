/**
 * PersonDetailModal Component
 *
 * Reusable modal component for displaying person details.
 * This component is extracted from PersonManager to ensure consistency
 * across different pages (PersonsPage, NotesPage, etc.)
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";
import type { Person, Anniversary, PersonSummary } from "@/services/api";
import UnifiedTag from "./UnifiedTag";
import ActionButton from "./ActionButton";
import { ActionButtonGroup } from "./ActionButton";
import { TextInput } from "./forms";
import { usePersonAnniversaries } from "@/hooks/queries/usePersonAnniversaries";
import { useToast } from "@/contexts/ToastContext";

// Union type to support both PersonSummary and Person
type PersonDetail = PersonSummary | Person;

interface PersonDetailModalProps {
  person: PersonDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (person: PersonDetail) => void;
}

const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  person,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [annivName, setAnnivName] = useState("");
  const [annivDate, setAnnivDate] = useState("");
  const locationTags = useMemo(
    () => person?.tags?.filter((tag) => tag.category === "location") ?? [],
    [person],
  );
  const relationshipTags = useMemo(
    () => person?.tags?.filter((tag) => tag.category !== "location") ?? [],
    [person],
  );

  const personId = useMemo(() => (person ? person.id : null), [person]);
  const {
    anniversaries,
    isLoading: isAnnivLoading,
    createAnniversary,
    updateAnniversary,
    deleteAnniversary,
    creating,
    updatingId,
    deletingId,
  } = usePersonAnniversaries(personId);
  const [editingAnnivId, setEditingAnnivId] = useState<string | null>(null);

  if (!isOpen || !person) return null;

  const handleEditClick = () => {
    onClose();
    onEdit(person);
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="person-detail-modal-title"
      size="lg"
      title={person.display_name || person.name || `Person #${person.id}`}
      footer={
        <ActionButtonGroup splitOpposite gap="sm" align="end">
          <ActionButton
            label={t("common.close")}
            iconName="x-mark"
            color="neutral"
            variant="ghost"
            onClick={onClose}
          />
          <ActionButton
            label={t("common.edit")}
            iconName="edit"
            color="primary"
            onClick={handleEditClick}
          />
        </ActionButtonGroup>
      }
      loading={false}
      showLoadingOverlay={false}
      showCloseButton={true}
    >
      <div className="space-y-4">
        {person.name && (
          <div>
            <label className="block text-base font-medium text-base-content/70">
              {t("auth.name")}
            </label>
            <p className="text-base">{person.name}</p>
          </div>
        )}

        {/* Show nicknames for Person type or primary_nickname for PersonSummary */}
        {"nicknames" in person &&
          person.nicknames &&
          person.nicknames.length > 0 && (
            <div>
              <label className="block text-base font-medium text-base-content/70">
                {t("personDetail.nicknames")}
              </label>
              <div className="flex flex-wrap gap-1 mt-1">
                {person.nicknames.map((nickname: string, index: number) => (
                  <UnifiedTag key={index} type="nickname" size="md">
                    {nickname}
                  </UnifiedTag>
                ))}
              </div>
            </div>
          )}

        {/* Show primary nickname for PersonSummary type */}
        {"primary_nickname" in person && person.primary_nickname && (
          <div>
            <label className="block text-base font-medium text-base-content/70">
              {t("personDetail.primaryNickname")}
            </label>
            <div className="mt-1">
              <UnifiedTag type="nickname" size="md">
                {person.primary_nickname}
              </UnifiedTag>
            </div>
          </div>
        )}

        {person.birth_date && (
          <div>
            <label className="block text-base font-medium text-base-content/70">
              {t("personDetail.birthDate")}
            </label>
            <p className="text-base">{person.birth_date}</p>
          </div>
        )}

        {(locationTags.length > 0 || person.location) && (
          <div>
            <label className="block text-base font-medium text-base-content/70">
              {t("personDetail.location")}
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {locationTags.length > 0
                ? locationTags.map((tag) => (
                    <UnifiedTag key={tag.id} type="location" size="md">
                      {tag.name}
                    </UnifiedTag>
                  ))
                : person.location && (
                    <UnifiedTag type="location" size="md">
                      {person.location}
                    </UnifiedTag>
                  )}
            </div>
          </div>
        )}

        {relationshipTags.length > 0 && (
          <div>
            <label className="block text-base font-medium text-base-content/70">
              {t("personDetail.relationshipTags")}
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {relationshipTags.map((tag) => (
                <UnifiedTag key={tag.id} type="relationship" size="md">
                  {tag.name}
                </UnifiedTag>
              ))}
            </div>
          </div>
        )}

        {/* Show anniversaries only for Person type */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-base font-medium text-base-content/70">
              {t("personDetail.anniversaries")}
            </label>
            <ActionButton
              label={
                editingAnnivId
                  ? t("common.save")
                  : t("personDetail.addAnniversary")
              }
              iconName={editingAnnivId ? "check" : "plus"}
              size="sm"
              color="primary"
              disabled={creating || Boolean(updatingId)}
              onClick={() => {
                if (!annivName.trim() || !annivDate.trim()) {
                  toast.showError(t("personDetail.anniversaryValidation"));
                  return;
                }
                if (editingAnnivId) {
                  updateAnniversary(editingAnnivId as string, {
                    name: annivName.trim(),
                    date: annivDate.trim(),
                  });
                  setEditingAnnivId(null);
                } else {
                  createAnniversary({
                    name: annivName.trim(),
                    date: annivDate.trim(),
                  });
                }
                setAnnivName("");
                setAnnivDate("");
              }}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <TextInput
              name="anniversary-name"
              placeholder={t("personDetail.anniversaryNamePlaceholder")}
              value={annivName}
              onChange={(e) => setAnnivName(e.target.value)}
              disabled={creating}
            />
            <TextInput
              name="anniversary-date"
              type="date"
              placeholder="YYYY-MM-DD"
              value={annivDate}
              onChange={(e) => setAnnivDate(e.target.value)}
              disabled={creating}
            />
          </div>

          <div className="space-y-2 mt-1">
            {isAnnivLoading && (
              <p className="text-sm text-base-content/70">
                {t("common.loading")}
              </p>
            )}
            {!isAnnivLoading && anniversaries.length === 0 && (
              <p className="text-sm text-base-content/60">
                {t("personDetail.noAnniversary")}
              </p>
            )}
            {anniversaries.map((anniversary: Anniversary) => (
              <div
                key={anniversary.id}
                className="flex justify-between items-center p-2 bg-base-200 rounded-md"
              >
                <div>
                  <span className="font-medium">{anniversary.name}</span>
                  <span className="text-base ml-2">{anniversary.date}</span>
                </div>
                <ActionButton
                  label={t("common.edit")}
                  iconName="edit"
                  size="sm"
                  color="primary"
                  variant="ghost"
                  onClick={() => {
                    setAnnivName(anniversary.name);
                    setAnnivDate(anniversary.date);
                    setEditingAnnivId(anniversary.id);
                  }}
                />
                <ActionButton
                  label={t("common.delete")}
                  iconName="trash"
                  size="sm"
                  color="error"
                  variant="ghost"
                  disabled={deletingId === anniversary.id}
                  onClick={() => deleteAnniversary(anniversary.id)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalBase>
  );
};

export default PersonDetailModal;
