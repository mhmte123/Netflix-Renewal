"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import FooterMenuNav from "@/components/common/FooterMenuNav";
import { getFooterDoc } from "@/data/footerDocs";
import "../../scss/info.scss";

interface InfoPageProps {
  params: Promise<{ slug: string }>;
}

export default function InfoPage({ params }: InfoPageProps) {
  const { slug } = use(params);
  const doc = getFooterDoc(slug);

  if (!doc) {
    notFound();
  }

  return (
    <div className="info-page">
      <div className="footer-menu-page">
        <Suspense fallback={null}>
          <FooterMenuNav />
        </Suspense>
        <main className="footer-menu-content inner">
          <div className="info-head">
            <h2>{doc.title}</h2>
            <p className="info-intro">{doc.intro}</p>
            <p className="info-updated">최종 개정일 · {doc.updated}</p>
          </div>

          <div className="info-body">
            {doc.sections.map((section, si) => (
              <div className="info-section" key={si}>
                <h3>{section.heading}</h3>
                {section.body.map((block, bi) =>
                  Array.isArray(block) ? (
                    <ul className="info-list" key={bi}>
                      {block.map((line, li) => (
                        <li key={li}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={bi}>{block}</p>
                  ),
                )}
              </div>
            ))}
          </div>

          <div className="info-foot">
            <p>
              원하는 내용을 찾지 못했나요?{" "}
              <Link href="/faq" className="info-link">
                자주 묻는 질문
              </Link>{" "}
              또는{" "}
              <Link href="/contact?tab=inquiry" className="info-link">
                문의하기
              </Link>
              에서 도움을 받을 수 있어요.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
