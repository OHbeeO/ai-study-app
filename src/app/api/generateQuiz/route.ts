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
    const {
      learnedContent,
      subject,
      mode,
      numQuestions, // 사용자가 요청한 문제 개수
      questionType,
      specificTopic
    } = body;

    if (!subject || !mode || numQuestions === undefined || !questionType) { // numQuestions가 0일 수도 있으니 undefined 체크
      return NextResponse.json({ message: '필수 파라미터가 누락되었습니다 (subject, mode, numQuestions, questionType).' }, { status: 400 });
    }
    if (mode === 'userInput' && (!learnedContent || learnedContent.trim() === '')) {
      return NextResponse.json({ message: '학습 내용을 입력해주세요.' }, { status: 400 });
    }

    // --- AI에게 실제 요청할 문제 개수 결정 ---
    const userRequestedNumQuestions = Number(numQuestions); // 사용자가 요청한 실제 개수
    let numQuestionsToRequestFromAI = userRequestedNumQuestions;

    // 'topicOnly' 모드이고 사용자가 1문제를 요청한 경우, AI에게는 3문제를 요청하여 다양성 확보
    if (mode === 'topicOnly' && userRequestedNumQuestions === 1) {
      numQuestionsToRequestFromAI = 3;
    }
    // (나중에 이 부분을 확장해서, 사용자가 2문제 요청 시 AI에게 4문제 요청 등으로 설정할 수도 있습니다)
    // --- ----------------------------- ---

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: [ /* ... 기존 안전 설정 ... */ ],
      generationConfig: {
        temperature: 0.8, // 이전 단계에서 추가한 temperature
      }
    });

    let instructionForAI = "";
    const questionTypeDescription = /* ... 기존과 동일 ... */;
    // commonQuestionInstruction에서 요청 문제 개수를 numQuestionsToRequestFromAI로 변경
    const commonQuestionInstruction = `
      아래 조건에 맞춰 총 ${numQuestionsToRequestFromAI}개의 문제를 한국어로 만들어주세요.
      - 문제 유형: ${questionTypeDescription}.
      - 각 문제에는 명확한 정답과 함께, 왜 그것이 정답인지 또는 오답인지에 대한 간략한 해설을 반드시 포함해주세요.
      - 문제는 서로 다른 내용을 다루도록 해주세요.`;

    if (mode === 'userInput') {
      // ... (userInput 모드 프롬프트 구성, numQuestionsToRequestFromAI 사용하도록 수정 필요시 반영)
      // userInput 모드에서는 사용자가 요청한 만큼만 생성해도 괜찮을 수 있으므로,
      // commonQuestionInstruction을 여기서 재정의하거나, 처음부터 userRequestedNumQuestions를 사용할지 결정
      // 여기서는 일관성을 위해 numQuestionsToRequestFromAI를 그대로 사용하겠습니다.
       const summaryInstruction = `1. 내용을 간결하게 한국어로 요약해주세요. (1-2문장)`;
       instructionForAI = `
        당신은 학습 내용을 바탕으로 요약과 다양한 유형의 문제(객관식, 단답형) 및 해설을 한국어로 생성하는 AI 도우미입니다.
        주제: "${subject}"
        학습 내용: "${learnedContent}"

        위 학습 내용을 바탕으로 다음 작업을 수행해주세요:
        ${summaryInstruction}
        ${commonQuestionInstruction}
      `;
    } else { // mode === 'topicOnly'
      // ... (topicOnly 모드 프롬프트 구성은 기존 로직 유지, commonQuestionInstruction은 위에서 변경됨) ...
      let topicSpecificInstructions = "";
        if (subject === "데이터베이스" && userRequestedNumQuestions === 1) { // 데이터베이스 1문제 요청 시 특별히 (numQuestionsToRequestFromAI는 3이 됨)
            topicSpecificInstructions = `
            당신은 "데이터베이스" 주제에 대해 문제를 출제하는 AI입니다.
            "데이터베이스 키" 개념 외에 다른 중요한 데이터베이스 개념 (예: 정규화, SQL, 트랜잭션, 인덱스 등)에 대한 문제를 출제해주세요.
            매번 다른 개념에 대한 문제를 내도록 노력해주세요.
            요약은 생성하지 않습니다.
            `;
        } else if (subject === "정보처리기사_시스템설계" && specificTopic === "복원문제_스타일") {
          topicSpecificInstructions = `
            당신은 정보처리기사 필기시험의 '시스템 설계' 과목 기출문제를 복원하는 AI입니다.
            최근 정보처리기사 시험의 출제 경향을 반영하여, 시스템 분석, 설계, 테스트, UML, 디자인 패턴 등과 관련된
            전형적인 문제를 생성해주세요. 문제는 실제 시험 문제와 유사한 난이도와 형식을 가져야 합니다.
            요약은 생성하지 않습니다.
          `;
        } else {
          const topicDetail = specificTopic ? `(${specificTopic} 스타일로)` : '';
          topicSpecificInstructions = `
            당신은 주어진 주제에 대해 문제를 출제하는 AI입니다.
            주제: "${subject}" ${topicDetail}
            매번 다른 측면이나 핵심 개념에 대한 문제를 출제하도록 노력해주세요.
            요약은 생성하지 않습니다.
          `;
        }

        instructionForAI = `
          ${topicSpecificInstructions}
          ${commonQuestionInstruction.replace("2.", "1.")}
          (객관식 문제는 반드시 4개의 선택지를 포함해야 합니다.)
        `;
    }

    const jsonOutputFormat = `
      최종 응답은 반드시 아래의 JSON 형식을 따라야 하며, 다른 어떤 텍스트도 포함하지 마세요:
      {
        "summary": "${mode === 'userInput' ? '여기에 요약 내용을 넣어주세요.' : ''}",
        "questions": [
          {
            "id": 1, 
            "type": "multipleChoice",
            "question": "문제 내용",
            "options": ["선택지1", "선택지2", "선택지3", "정답"],
            "answer": "정답",
            "explanation": "해설 내용"
          }
          // ... 요청된 문제 개수만큼 반복 ...
        ]
      }
    `;
    const prompt = `${instructionForAI}\n${jsonOutputFormat}`;
    console.log("Sending prompt to Gemini (expecting AI to generate " + numQuestionsToRequestFromAI + " questions):", prompt);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const aiResponseText = response.text();
    console.log("Received from Gemini:", aiResponseText);

    let aiData;
    try {
      const jsonMatch = aiResponseText.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
      if (!jsonMatch || (!jsonMatch[1] && !jsonMatch[2])) {
        throw new Error("AI 응답 형식이 올바르지 않습니다. JSON을 찾을 수 없습니다.");
      }
      const extractedJson = jsonMatch[1] || jsonMatch[2];
      aiData = JSON.parse(extractedJson);

      if (!aiData.questions || !Array.isArray(aiData.questions)) {
        console.warn("AI response did not contain a valid questions array. Initializing as empty.");
        aiData.questions = [];
      }
    } catch (parseError: any) {
      // ... 기존 파싱 에러 처리 ...
      return NextResponse.json({ message: 'AI 응답을 처리하는 중 에러가 발생했습니다. (Parsing Error)', rawResponse: aiResponseText }, { status: 500 });
    }

    // --- AI가 생성한 문제들 중에서 사용자 요청 개수만큼 선택 ---
    let finalQuestions = [];
    if (aiData.questions.length > 0) {
      if (mode === 'topicOnly' && userRequestedNumQuestions === 1 && aiData.questions.length >= numQuestionsToRequestFromAI) {
        // AI에게 3문제 요청했고, 사용자는 1문제를 원했으므로, 3문제 중 1개를 랜덤 선택
        const randomIndex = Math.floor(Math.random() * aiData.questions.length);
        finalQuestions = [aiData.questions[randomIndex]];
      } else if (aiData.questions.length >= userRequestedNumQuestions) {
        // AI가 생성한 문제 수가 사용자가 요청한 수보다 많거나 같으면, 요청한 수만큼만 잘라서 사용
        finalQuestions = aiData.questions.slice(0, userRequestedNumQuestions);
      } else {
        // AI가 생성한 문제 수가 사용자가 요청한 수보다 적으면, 생성된 만큼만 사용
        finalQuestions = aiData.questions;
        console.warn(`AI returned ${aiData.questions.length} questions, user requested ${userRequestedNumQuestions}. Using all returned questions.`);
      }
    }

    // 최종 문제들에 대해 ID를 1부터 순서대로 다시 부여
    finalQuestions.forEach((q: any, index: number) => {
      q.id = index + 1;
    });
    // --- --------------------------------------- ---

    return NextResponse.json({
      summary: (mode === 'topicOnly' && !aiData.summary) ? "" : aiData.summary,
      questions: finalQuestions, // 최종 선택된 문제들로 응답
    });

  } catch (error: any) {
    // ... 기존 에러 처리 ...
    return NextResponse.json({ message: error.message || 'Gemini API 요청 중 에러가 발생했습니다.' }, { status: 500 });
  }
}