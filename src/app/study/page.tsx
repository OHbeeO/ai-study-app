// src/app/study/page.tsx
export const dynamic = 'force-dynamic';
'use client';

import React, { useEffect, useState, FormEvent } from 'react'; // FormEvent 추가
import { useSearchParams } from 'next/navigation';

// API 응답 타입을 미리 정의해두면 자동완성 등의 이점이 있습니다.
interface QuizResponse {
  summary: string;
  questions: Array<{
    id: number;
    type: string;
    question: string;
    options?: string[]; // 객관식 문제에만 있을 수 있음
    answer: string;
  }>;
}

export default function StudyPage() {
  const searchParams = useSearchParams();
  const [subject, setSubject] = useState('');
  const [learnedContent, setLearnedContent] = useState(''); // 학습 내용 입력을 위한 상태
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태
  const [apiResponse, setApiResponse] = useState<QuizResponse | null>(null); // API 응답 저장
  const [error, setError] = useState<string | null>(null); // 에러 메시지 저장

  useEffect(() => {
    const subjectFromQuery = searchParams.get('subject');
    if (subjectFromQuery) {
      setSubject(decodeURIComponent(subjectFromQuery));
    }
  }, [searchParams]);

  // API 호출 함수
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // 폼 제출 시 페이지 새로고침 방지
    setIsLoading(true);
    setApiResponse(null);
    setError(null);

    try {
      const response = await fetch('/api/generateQuiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ learnedContent, subject }), // 입력된 내용과 주제를 전송
      });

      if (!response.ok) {
        // 서버에서 2xx 상태 코드가 아닌 응답을 보냈을 때
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data: QuizResponse = await response.json();
      setApiResponse(data);
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는 중 에러가 발생했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 py-8"> {/* py-8 추가 */}
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800">학습 내용 입력하기</h1>
        {subject && (
          <p className="text-xl text-blue-600 mt-2">
            선택한 학습 주제: <span className="font-semibold">{subject}</span>
          </p>
        )}
      </header>

      {/* 폼(form) 요소로 감싸서 제출 이벤트를 관리합니다. */}
      <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md">
        <div className="mb-6">
          <label htmlFor="learnedContent" className="block text-lg font-medium text-gray-700 mb-2">
            학습한 내용을 입력하세요:
          </label>
          <textarea
            id="learnedContent"
            name="learnedContent"
            rows={10}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="여기에 학습 내용을 자세히 적어주세요..."
            value={learnedContent} // 상태와 연결
            onChange={(e) => setLearnedContent(e.target.value)} // 입력 값 변경 시 상태 업데이트
            disabled={isLoading} // 로딩 중일 때 입력 비활성화
          />
        </div>

        <button
          type="submit" // 폼 제출 버튼으로 변경
          className="w-full bg-green-500 text-white py-3 px-6 rounded-xl text-lg font-semibold hover:bg-green-600 transition disabled:opacity-50"
          disabled={isLoading || !learnedContent.trim()} // 로딩 중이거나 입력 내용이 없을 때 비활성화
        >
          {isLoading ? '생성 중...' : 'AI 요약 및 문제 생성 요청'}
        </button>
      </form>

      {/* 로딩 중 메시지 */}
      {isLoading && <p className="mt-6 text-lg">AI가 열심히 생성 중입니다... 잠시만 기다려주세요! 🧠</p>}

      {/* 에러 메시지 표시 */}
      {error && <p className="mt-6 text-red-500 text-lg">에러: {error}</p>}

      {/* API 응답 결과 표시 */}
      {apiResponse && !isLoading && (
        <div className="mt-8 w-full max-w-2xl bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">AI 생성 결과 ✨</h2>

          {/* 요약 표시 */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-700">요약</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{apiResponse.summary}</p>
          </div>

          {/* 문제 표시 */}
          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-700">생성된 문제</h3>
            {apiResponse.questions.map((q) => (
              <div key={q.id} className="mb-4 p-4 border border-gray-200 rounded-md">
                <p className="font-medium text-gray-800">{q.id}. {q.question}</p>
                {q.type === 'multipleChoice' && q.options && (
                  <ul className="list-disc list-inside mt-2 ml-4">
                    {q.options.map((option, index) => (
                      <li key={index} className="text-gray-600">{option}</li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-green-600 mt-1">(정답: {q.answer})</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}