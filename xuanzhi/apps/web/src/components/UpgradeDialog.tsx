import { Link } from "react-router-dom";
import { Modal } from "./ui";
import { useT } from "@/i18n";

export function UpgradeDialog({ open, onClose, requiredPlan, reason }: { open: boolean; onClose: () => void; requiredPlan: string | null; reason?: string }) {
  const { t } = useT();
  const plan = requiredPlan ? t(`common.${requiredPlan}` as never) : t("common.pro");
  return (
    <Modal open={open} onClose={onClose} title={t("upgrade.title", { plan })} size="sm" footer={<><button className="btn btn-ghost btn-sm" onClick={onClose}>{t("upgrade.later")}</button><Link to="/pricing" className="btn btn-primary btn-sm" onClick={onClose}>{t("upgrade.cta")}</Link></>}>
      <div className="text-center py-2"><span className="xz-seal lg mb-3">玄</span><p className="mb-1 fw-medium">{reason ?? t("upgrade.body")}</p></div>
    </Modal>
  );
}
