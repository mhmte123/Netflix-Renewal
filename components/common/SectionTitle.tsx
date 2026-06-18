"use client";

import Link from "next/link";
import "./sectionTitle.scss";
import { useSubscriptionGuard } from "@/lib/subscription";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";
import { useSectionText, useT } from "@/lib/i18n";

type SectionTitleProps = {
    title: string;
    subTitle?: string;
    showMore?: boolean;
    onMoreClick?: () => void;
    href?: string;
};

export default function SectionTitle({
    title,
    subTitle,
    showMore = true,
    onMoreClick,
    href,
}: SectionTitleProps) {
    const { isUnsubscribed } = useSubscriptionGuard();
    const openModal = useSubscribeModalStore((state) => state.openModal);
    const translateSectionText = useSectionText();
    const t = useT();

    const handleClick = (e: React.MouseEvent) => {
        if (isUnsubscribed) {
            e.preventDefault();
            openModal();
        }
    };

    return (
        <div className="section-header">
            <div className="section-title-wrap">
                <h2 className="section-title">
                    {translateSectionText(title)}
                </h2>

                {subTitle && (
                    <p className="section-sub">
                        {translateSectionText(subTitle)}
                    </p>
                )}
            </div>

            {showMore && (
                href
                    ? <Link href={href} className="see-all" onClick={handleClick}>{t("common.viewAll")} ›</Link>
                    : <button className="see-all" onClick={isUnsubscribed ? openModal : onMoreClick}>{t("common.viewAll")} ›</button>
            )}
        </div>
    );
}
