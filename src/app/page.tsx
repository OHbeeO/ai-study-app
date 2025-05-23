// src/app/page.tsx

import Link from 'next/link'; // 1. 이 줄을 파일 최상단에 추가하거나, 다른 import 문들 사이에 추가합니다.

// 메인 페이지 - React + Tailwind 기반
export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col items-center justify-center px-4 py-8"> {/* py-8 추가해서 상하 여백 확보 */}
      <header className="w-full max-w-4xl text-center mb-10">
        <h1 className="text-4xl font-bold mb-2">AI 기반 자기주도 학습 플랫폼</h1>
        <p className="text-lg text-gray-600">정보처리기사 버전 학습 자동화 도구</p>
      </header>

      {/* 2. 이 부분을 아래와 같이 수정합니다. */}
      <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10"> {/* 반응형으로 grid-cols-1 sm:grid-cols-2 */}
        {['데이터베이스', '프로그래밍 언어', '시스템 설계', '소프트웨어 공학', '정보시스템 관리'].map((area) => (
          <Link // Link 컴포넌트로 기존 div를 대체합니다.
            key={area}
            href={`/study?subject=${encodeURIComponent(area)}`} // /study 경로로, subject 쿼리 파라미터 추가
            className="border border-gray-200 rounded-2xl p-6 shadow hover:shadow-md transition cursor-pointer block" // Link에 직접 스타일 적용
          >
            {/* Link 안의 내용은 동일하게 유지합니다. */}
            <h2 className="text-xl font-semibold mb-2">{area}</h2>
            <p className="text-sm text-gray-500">이 영역의 학습 내용을 입력하고 AI 요약을 받아보세요.</p>
          </Link>
        ))}
      </div>
    </div>
  );
}