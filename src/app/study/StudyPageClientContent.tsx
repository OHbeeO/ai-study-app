// src/app/study/StudyPageClientContent.tsx
'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

interface QuizResponse {
  summary: string;
  questions: Array<{
    id: number;
    type: string;
    question: string;
    options?: string[];
    answer: string;
  }>;
}

export default function StudyPageClientContent() {
  const searchParams = useSearchParams();
  const [subject, setSubject] = useState('');
  const [learnedContent, setLearnedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<QuizResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subjectFromQuery = searchParams.get('subject');
    if (subjectFromQuery) {
      setSubject(decodeURIComponent(subjectFromQuery));
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setApiResponse(null);
    setError(null);

    try {
      const response = await fetch('/api/generateQuiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ learnedContent, subject }),
      });

      if (!response.ok) {
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
    <>
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800">학습 내용 입력하기</h1>
        {subject && (
          <p className="text-xl text-blue-600 mt-2">
            선택한 학습 주제: <span className="font-semibold">{subject}</span>
          </p>
        )}
      </header>

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
            value={learnedContent}
            onChange={(e) => setLearnedContent(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-green-500 text-white py-3 px-6 rounded-xl text-lg font-semibold hover:bg-green-600 transition disabled:opacity-50"
          disabled={isLoading || !learnedContent.trim()}
        >
          {isLoading ? '생성 중...' : 'AI 요약 및 문제 생성 요청'}
        </button>
      </form>

      {isLoading && <p className="mt-6 text-lg">AI가 열심히 생성 중입니다... 잠시만 기다려주세요! 🧠</p>}
      {error && <p className="mt-6 text-red-500 text-lg">에러: {error}</p>}

      {apiResponse && !isLoading && (
        <div className="mt-8 w-full max-w-2xl bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">AI 생성 결과 ✨</h2>
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-700">요약</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{apiResponse.summary}</p>
          </div>
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
    </>
  );
}