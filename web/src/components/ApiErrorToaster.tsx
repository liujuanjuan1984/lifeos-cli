import { useEffect } from "react";
import { useToast } from "@/contexts/ToastContext";
import { subscribeApiError } from "@/services/api/errorBus";

export default function ApiErrorToaster() {
  const toast = useToast();

  useEffect(() => {
    const unsubscribe = subscribeApiError((detail) => {
      const title = detail?.title || "网络或服务错误";
      const message = detail?.message || "请求失败";
      toast.showError(title, message);
    });
    return unsubscribe;
  }, [toast]);

  return null;
}
