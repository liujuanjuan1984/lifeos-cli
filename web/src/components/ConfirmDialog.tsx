import React from "react";
import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";
import { FormActions } from "./ActionButton";
import { Icon } from "./icons";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Friendly confirmation dialog component
 * Replaces the native confirm() dialog with a more user-friendly modal
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const confirmTextValue = confirmText || t("common.confirm");
  const isDestructive =
    /删|删除|移除|清除|清空/.test(confirmTextValue) ||
    /delete|remove|clear/i.test(confirmTextValue);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onCancel}
      header={title}
      role="alertdialog"
      overlayClosable={false}
      loading={false}
      showLoadingOverlay={false}
      showCloseButton={true}
      size="sm"
      footer={
        <FormActions
          submitText={confirmTextValue}
          cancelText={cancelText || t("common.cancel")}
          onCancel={onCancel}
          onSubmit={onConfirm}
          loading={loading}
          submitColor={isDestructive ? "error" : "primary"}
          submitIcon={
            isDestructive ? <Icon name="trash" size={18} /> : undefined
          }
        />
      }
    >
      <div className="flex items-start space-x-3 py-3">
        <div className="flex-shrink-0 pt-0.5">
          <div className="w-8 h-8 bg-warning/20 rounded-full flex items-center justify-center">
            <Icon
              name="warning"
              size={18}
              className="text-warning"
              aria-hidden
            />
          </div>
        </div>
        <div className="flex-grow min-w-0">
          <p className="text-sm leading-relaxed text-base-content/80">
            {message}
          </p>
        </div>
      </div>
    </ModalBase>
  );
};

export default ConfirmDialog;
