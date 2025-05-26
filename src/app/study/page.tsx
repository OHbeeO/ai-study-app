// src/app/study/page.tsx
import React, { Suspense } from 'react';
import StudyPageClientContent from './StudyPageClientContent';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 py-8">
      <p className="text-xl">페이지를 불러오는 중입니다...</p>
    </div>
  );
}

export default function StudyPageContainer() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 py-8">
      <Suspense fallback={<LoadingFallback />}>
        <StudyPageClientContent />
      </Suspense>
    </div>
  );
}