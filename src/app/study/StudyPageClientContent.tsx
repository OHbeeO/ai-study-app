// src/app/study/StudyPageClientContent.tsx
'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

interface Question { // Question 인터페이스를 좀 더 구체적으로 정의
  id: number;
  type: 'multipleChoice' | 'shortAnswer'; // 문제 유형 명시
  question: string;
  options?: string[];
  answer: string;
  explanation?: string; // 해설 필드 (AI가 제공한다면)
}

interface QuizResponse {
  summary: string;
  questions: Question[];
}

type GenerationMode = 'userInput' | 'topicOnly';
type QuestionType = 'any' | 'multipleChoice' | 'shortAnswer'; // 문제 유형 선택 옵션

export default function StudyPageClientContent() {
  const searchParams = useSearchParams();
  const [subject, setSubject] = useState('');
  const [learnedContent, setLearnedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<QuizResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>('userInput');

  // --- 새로운 상태 변수들 ---
  const [numQuestions, setNumQuestions] = useState<number>(2); // 문제 개수 (기본값 2)
  const [questionType, setQuestionType] = useState<QuestionType>('any'); // 문제 유형 (기본값 'any')
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({}); // 사용자가 입력한 답 {문제id: 답}
  const [submitted, setSubmitted] = useState(false); // 퀴즈 제출 여부
  // -------------------------

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
    setUserAnswers({}); // 새 문제 생성 시 이전 답안 초기화
    setSubmitted(false);  // 새 문제 생성 시 제출 상태 초기화

    let requestBody: any = {
      subject,
      numQuestions, // 추가
      questionType, // 추가
    };

    if (mode === 'userInput') {
      if (!learnedContent.trim()) {
        setError('학습 내용을 입력해주세요.');
        setIsLoading(false);
        return;
      }
      requestBody.learnedContent = learnedContent;
      requestBody.mode = 'userInput';
    } else {
      requestBody.learnedContent = '';
      requestBody.mode = 'topicOnly';
      if (subject === "정보처리기사 시스템 설계") {
         requestBody.specificTopic = "정보처리기사 시스템 설계 복원문제 스타일";
      }
    }

    try {
      const response = await fetch('/api/generateQuiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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

  // 사용자의 답을 업데이트하는 함수
  const handleAnswerChange = (questionId: number, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  // 퀴즈 제출 처리 함수
  const handleQuizSubmit = () => {
    setSubmitted(true);
    // 여기에 채점 로직을 넣을 수도 있지만, 우선은 제출 상태만 변경
  };


  return (
    <>
      <header className="mb-8 text-center">
        {/* ... 제목, 주제 표시는 동일 ... */}
      </header>

      {/* 모드 선택 UI - 기존과 동일 */}
      <div className="mb-6 flex justify-center space-x-4">
        {/* ... 버튼들 ... */}
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md">
        {/* --- 문제 생성 옵션 UI 추가 --- */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="numQuestions" className="block text-sm font-medium text-gray-800 mb-1">
              문제 개수
            </label>
            <select
              id="numQuestions"
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-black"
              disabled={isLoading}
            >
              <option value={1}>1문제</option>
              <option value={2}>2문제</option>
              <option value={3}>3문제</option>
              <option value={5}>5문제</option>
            </select>
          </div>
          <div>
            <label htmlFor="questionType" className="block text-sm font-medium text-gray-800 mb-1">
              문제 유형
            </label>
            <select
              id="questionType"
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as QuestionType)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-black"
              disabled={isLoading}
            >
              <option value="any">모두</option>
              <option value="multipleChoice">객관식</option>
              <option value="shortAnswer">주관식(단답형)</option>
            </select>
          </div>
        </div>
        {/* ----------------------------- */}

        {mode === 'userInput' && (
          <div className="mb-6">
            {/* ... 학습 내용 입력칸 ... */}
          </div>
        )}

        <button
          type="submit" // AI 문제 생성 요청 버튼
          className="w-full bg-green-500 text-white py-3 px-6 rounded-xl text-lg font-semibold hover:bg-green-600 transition disabled:opacity-50"
          disabled={isLoading || (mode === 'userInput' && !learnedContent.trim())}
        >
          {isLoading ? '생성 중...' : 'AI 요약 및 문제 생성 요청'}
        </button>
        {/* ... 안내 문구 ... */}
      </form>

      {/* ... 로딩, 에러 표시는 기존과 동일 ... */}

      {/* API 응답 결과 표시 - 퀴즈 풀이 UI로 변경 */}
      {apiResponse && !isLoading && (
        <div className="mt-8 w-full max-w-2xl bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">AI 생성 결과 ✨</h2>
          {apiResponse.summary && ( /* 요약은 그대로 표시 */
            <div className="mb-6">
              {/* ... 요약 표시 ... */}
            </div>
          )}

          <div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">생성된 문제</h3>
            {apiResponse.questions.map((q, index) => (
              <div key={q.id || index} className="mb-6 p-4 border border-gray-200 rounded-md">
                <p className="font-medium text-gray-800 mb-2">{index + 1}. {q.question}</p>
                {q.type === 'multipleChoice' && q.options && (
                  <div className="space-y-2">
                    {q.options.map((option, optIndex) => (
                      <label key={optIndex} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 cursor-pointer">
                        <input
                          type="radio"
                          name={`question-${q.id || index}`}
                          value={option}
                          onChange={() => handleAnswerChange(q.id || index, option)}
                          checked={userAnswers[q.id || index] === option}
                          disabled={submitted} // 제출 후 비활성화
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="text-gray-800">{option}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'shortAnswer' && (
                  <input
                    type="text"
                    onChange={(e) => handleAnswerChange(q.id || index, e.target.value)}
                    value={userAnswers[q.id || index] || ''}
                    disabled={submitted} // 제출 후 비활성화
                    className="mt-2 w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="답을 입력하세요"
                  />
                )}
                {/* 정답 및 해설은 제출 후에만 표시 */}
                {submitted && (
                  <div className={`mt-3 p-3 rounded-md ${userAnswers[q.id || index] === q.answer ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
                    <p className="text-sm font-semibold">정답: {q.answer}</p>
                    {q.explanation && <p className="text-xs text-gray-800 mt-1">해설: {q.explanation}</p>}
                    {userAnswers[q.id || index] !== q.answer && userAnswers[q.id || index] && (
                        <p className="text-sm text-red-700">당신의 답: {userAnswers[q.id || index]}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!submitted && apiResponse.questions.length > 0 && (
              <button
                onClick={handleQuizSubmit}
                className="w-full mt-4 bg-blue-600 text-white py-3 px-6 rounded-xl text-lg font-semibold hover:bg-blue-700 transition"
              >
                제출하고 정답 확인
              </button>
            )}
            {submitted && (
                 <button
                 onClick={() => { // 다시 풀기 또는 새 문제 생성 준비
                     setSubmitted(false);
                     setUserAnswers({});
                     // apiResponse를 null로 만들어 문제 생성 버튼을 다시 누르도록 유도하거나,
                     // 같은 문제로 다시 풀게 할 수도 있습니다. 여기서는 초기화만.
                 }}
                 className="w-full mt-4 bg-gray-500 text-white py-3 px-6 rounded-xl text-lg font-semibold hover:bg-gray-600 transition"
               >
                 다시 풀기 (같은 문제) / 새 문제 받기
               </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}