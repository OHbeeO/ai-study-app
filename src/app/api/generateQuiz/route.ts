// src/app/api/generateQuiz/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const MODEL_NAME = "gemini-1.5-flash-latest";

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Server configuration error: API key not found.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    // 프론트엔드에서 전달받는 값들 확장
    const {
      learnedContent,
      subject,
      mode, // 'userInput' 또는 'topicOnly'
      numQuestions, // 요청된 문제 개수
      questionType, // 'any', 'multipleChoice', 'shortAnswer'
      specificTopic // 'topicOnly' 모드에서 특정 주제 스타일 (예: "정보처리기사 시스템 설계 복원문제 스타일")
    } = body;

    // 필수 값 확인 (subject, mode, numQuestions, questionType)
    if (!subject || !mode || !numQuestions || !questionType) {
      return NextResponse.json({ message: '필수 파라미터가 누락되었습니다 (subject, mode, numQuestions, questionType).' }, { status: 400 });
    }
    // userInput 모드일 때 learnedContent 확인
    if (mode === 'userInput' && (!learnedContent || learnedContent.trim() === '')) {
      return NextResponse.json({ message: '학습 내용을 입력해주세요.' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
      // generationConfig 추가: JSON 모드 사용 시도 (Gemini 모델에 따라 지원 여부 확인 필요)
      // generationConfig: {
      //   responseMimeType: "application/json", // Gemini가 직접 JSON을 출력하도록 요청
      // },
    });

    // --- AI에게 전달할 프롬프트 동적 구성 ---
    let instructionForAI = ""; // AI에게 전달할 주요 지시사항
    let summaryInstruction = `1. 내용을 간결하게 한국어로 요약해주세요. (1-2문장)`; // userInput 모드에서만 사용될 수 있음

    const questionTypeDescription =
      questionType === 'multipleChoice' ? '객관식 문제 (4개의 선택지 포함)' :
      questionType === 'shortAnswer' ? '단답형 주관식 문제' :
      '객관식 또는 단답형 주관식 문제 중 자유롭게';

    const commonQuestionInstruction = `
      2. 아래 조건에 맞춰 총 ${numQuestions}개의 문제를 한국어로 만들어주세요.
         - 문제 유형: ${questionTypeDescription}.
         - 각 문제에는 명확한 정답과 함께, 왜 그것이 정답인지 또는 오답인지에 대한 간략한 해설을 반드시 포함해주세요.
         - 문제는 서로 다른 내용을 다루도록 해주세요.`;

    if (mode === 'userInput') {
      instructionForAI = `
        당신은 학습 내용을 바탕으로 요약과 다양한 유형의 문제(객관식, 단답형) 및 해설을 한국어로 생성하는 AI 도우미입니다.
        주제: "${subject}"
        학습 내용: "${learnedContent}"

        위 학습 내용을 바탕으로 다음 작업을 수행해주세요:
        ${summaryInstruction}
        ${commonQuestionInstruction}
      `;
    } else { // mode === 'topicOnly'
      // specificTopic이 있으면 해당 내용을 프롬프트에 더 구체적으로 반영
      const topicDetail = specificTopic ? `(${specificTopic} 스타일로)` : '';
      instructionForAI = `
        당신은 주어진 주제에 대해 다양한 유형의 문제(객관식, 단답형)와 해설을 한국어로 생성하는 AI 도우미입니다.
        주제: "${subject}" ${topicDetail}

        위 주제에 대해 다음 작업을 수행해주세요:
        (요약은 생성하지 않습니다.)
        ${commonQuestionInstruction.replace("2.", "1.")}
      `;
      // topicOnly 모드에서는 summary를 요청하지 않으므로, JSON 구조에서 summary를 빼거나 빈 값으로 처리할 것을 명시
      summaryInstruction = `(요약은 생성하지 않습니다. 만약 JSON 구조에 summary 필드가 필요하다면 빈 문자열 ""로 응답해주세요.)`;
    }

    const jsonOutputFormat = `
      최종 응답은 반드시 아래의 JSON 형식을 따라야 하며, 다른 어떤 텍스트도 포함하지 마세요:
      {
        "summary": "여기에 요약 내용을 넣어주세요. ${mode === 'topicOnly' ? '요약이 필요 없는 경우 이 필드는 비워두거나 생략해도 됩니다.' : ''}",
        "questions": [
          {
            "id": 1, // 문제 번호 (1부터 시작)
            "type": "multipleChoice", // 또는 "shortAnswer"
            "question": "여기에 문제 내용을 넣어주세요.",
            "options": ["선택지1", "선택지2", "선택지3", "정답 선택지"], // multipleChoice 유형일 때만 포함
            "answer": "정답 내용",
            "explanation": "여기에 정답에 대한 간략한 해설을 넣어주세요."
          }
          // ... 요청된 문제 개수만큼 반복 ...
        ]
      }
    `;

    const prompt = `${instructionForAI}\n${jsonOutputFormat}`;
    // --- 프롬프트 구성 완료 ---

    console.log("Sending prompt to Gemini:", prompt); // 디버깅용 로그

    const result = await model.generateContent(prompt);
    const response = result.response;
    const aiResponseText = response.text();

    console.log("Received from Gemini:", aiResponseText); // 디버깅용 로그

    let aiData;
    try {
      const jsonMatch = aiResponseText.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
      if (!jsonMatch || (!jsonMatch[1] && !jsonMatch[2])) {
        console.error("AI 응답에서 JSON을 찾을 수 없습니다:", aiResponseText);
        throw new Error("AI 응답 형식이 올바르지 않습니다. JSON을 찾을 수 없습니다.");
      }
      const extractedJson = jsonMatch[1] || jsonMatch[2];
      aiData = JSON.parse(extractedJson);

      // topicOnly 모드이고 summary가 없다면 빈 문자열로 채워주기 (프론트엔드 호환성)
      if (mode === 'topicOnly' && !aiData.summary) {
        aiData.summary = "";
      }
      // questions 배열의 각 question 객체에 id가 없다면 순서대로 부여 (AI가 id를 안 넣어줄 경우 대비)
      if (aiData.questions && Array.isArray(aiData.questions)) {
        aiData.questions.forEach((q: any, index: number) => {
          if (q.id === undefined) {
            q.id = index + 1;
          }
        });
      } else {
        // questions가 없거나 배열이 아니면 빈 배열로 초기화
         aiData.questions = [];
         console.warn("AI response did not contain a valid questions array. Setting to empty array.");
      }


    } catch (parseError: any) {
      console.error('AI 응답 파싱 에러:', parseError);
      console.error('원본 AI 응답 텍스트:', aiResponseText);
      return NextResponse.json({ message: 'AI 응답을 처리하는 중 에러가 발생했습니다. (Parsing Error)', rawResponse: aiResponseText }, { status: 500 });
    }

    return NextResponse.json({
      summary: aiData.summary,
      questions: aiData.questions,
    });

  } catch (error: any) {
    console.error('Gemini API 호출 또는 기타 에러:', error);
    if (error.response) {
      console.error('Error data:', error.response.data);
      console.error('Error status:', error.response.status);
    }
    return NextResponse.json({ message: error.message || 'Gemini API 요청 중 에러가 발생했습니다.' }, { status: 500 });
  }
}