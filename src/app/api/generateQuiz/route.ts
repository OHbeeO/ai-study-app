// src/app/api/generateQuiz/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const MODEL_NAME = "gemini-1.5-flash-latest"; // 또는 "gemini-pro" 등 사용 가능한 모델

export async function POST(request: Request) {
  // 1. API 키가 있는지 확인
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Server configuration error: API key not found.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { learnedContent, subject } = body;

    if (!learnedContent || !subject) {
      return NextResponse.json({ message: '학습 내용(learnedContent)과 주제(subject)를 모두 보내주세요.' }, { status: 400 });
    }

    // 2. Gemini AI 클라이언트 초기화
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      // 안전 설정을 조정할 수 있습니다. 모든 유해 카테고리에 대해 차단 안 함으로 설정
      // 필요에 따라 더 엄격하게 설정할 수 있습니다.
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    // 3. AI에게 전달할 프롬프트 구성
    // AI가 JSON 형식으로 응답하도록 명확하게 지시하는 것이 매우 중요합니다.
    const prompt = `
      당신은 학습 내용을 바탕으로 요약과 다양한 유형의 문제(객관식, 단답형)를 한국어로 생성하는 AI 도우미입니다.
      주제: "${subject}"
      학습 내용: "${learnedContent}"

      위 학습 내용을 바탕으로 다음 작업을 수행해주세요:
      1. 학습 내용을 간결하게 한국어로 요약해주세요. (1-2문장)
      2. 학습 내용과 관련된 문제 2개를 한국어로 만들어주세요.
         - 문제 유형은 "multipleChoice" (객관식) 또는 "shortAnswer" (단답형) 중에서 선택해주세요.
         - 객관식 문제는 4개의 선택지를 포함해야 합니다.

      아래 JSON 형식을 반드시 따라서 응답해주세요. 다른 설명 없이 JSON 객체만 응답해야 합니다:
      {
        "summary": "여기에 요약 내용을 넣어주세요.",
        "questions": [
          {
            "type": "multipleChoice",
            "question": "여기에 객관식 문제 내용을 넣어주세요.",
            "options": ["선택지1", "선택지2", "선택지3", "정답 선택지"],
            "answer": "정답 선택지"
          },
          {
            "type": "shortAnswer",
            "question": "여기에 단답형 문제 내용을 넣어주세요.",
            "answer": "단답형 문제의 정답"
          }
        ]
      }
    `;

    // 4. Gemini API 호출
    const result = await model.generateContent(prompt);
    const response = result.response;
    const aiResponseText = response.text();

    // 5. AI 응답 파싱 (JSON 형태를 기대)
    let aiData;
    try {
      // AI 응답 텍스트에서 JSON 부분만 추출 (가끔 AI가 JSON 앞뒤로 ```json ... ``` 등을 붙일 수 있음)
      const jsonMatch = aiResponseText.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
      if (!jsonMatch || (!jsonMatch[1] && !jsonMatch[2])) {
        console.error("AI 응답에서 JSON을 찾을 수 없습니다:", aiResponseText);
        throw new Error("AI 응답 형식이 올바르지 않습니다. JSON을 찾을 수 없습니다.");
      }
      const extractedJson = jsonMatch[1] || jsonMatch[2];
      aiData = JSON.parse(extractedJson);

      // 생성된 데이터 구조 검증 (선택 사항이지만, 안정성을 위해 추가 가능)
      if (!aiData.summary || !Array.isArray(aiData.questions)) {
        console.error("AI 응답 JSON 구조가 예상과 다릅니다:", aiData);
        throw new Error("AI 응답 JSON 구조가 올바르지 않습니다.");
      }

    } catch (parseError: any) {
      console.error('AI 응답 파싱 에러:', parseError);
      console.error('원본 AI 응답 텍스트:', aiResponseText); // 디버깅을 위해 원본 응답을 로그로 남깁니다.
      return NextResponse.json({ message: 'AI 응답을 처리하는 중 에러가 발생했습니다. (Parsing Error)', rawResponse: aiResponseText }, { status: 500 });
    }

    // 6. 클라이언트에게 AI가 생성한 데이터 응답
    return NextResponse.json({
      summary: aiData.summary,
      questions: aiData.questions,
    });

  } catch (error: any) {
    console.error('Gemini API 호출 또는 기타 에러:', error);
    // AxiosError인 경우 더 자세한 정보 로깅 (Gemini SDK는 자체 에러 타입을 가질 수 있음)
    if (error.response) {
      console.error('Error data:', error.response.data);
      console.error('Error status:', error.response.status);
    }
    return NextResponse.json({ message: error.message || 'Gemini API 요청 중 에러가 발생했습니다.' }, { status: 500 });
  }
}