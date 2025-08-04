// 전역 변수로 선언
let HF_API_TOKEN = '';
let chatHistory = [];

// DOM 요소들
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');

// 페이지 로드 시 토큰 초기화
document.addEventListener('DOMContentLoaded', async () => {
    try {
        HF_API_TOKEN = await window.electronAPI.getHfToken();
        console.log("[chatbot] API 토큰 로드 완료");
        messageInput.focus();
    } catch (error) {
        console.error("[chatbot] API 토큰 로드 실패:", error);
        addMessage('오류: API 토큰을 불러올 수 없습니다. .env 파일을 확인해 주세요.', 'bot');
    }
});

// 엔터키로 메시지 전송
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 전송 버튼 클릭
sendBtn.addEventListener('click', sendMessage);

// 메시지 전송 함수
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !HF_API_TOKEN) return;

    // 사용자 메시지 표시
    addMessage(message, 'user');
    messageInput.value = '';
    messageInput.disabled = true;
    sendBtn.disabled = true;

    // 타이핑 인디케이터 표시
    showTypingIndicator();

    try {
        // Hugging Face API 호출
        const response = await callHuggingFaceAPI(message);

        // 봇 응답 표시
        addMessage(response, 'bot');
    } catch (error) {
        console.error('API 호출 오류:', error);
        let errorMessage = '죄송합니다. 오류가 발생했습니다.';

        if (error.message.includes('401')) {
            errorMessage = 'API 토큰이 유효하지 않습니다. 토큰을 확인해 주세요.';
        } else if (error.message.includes('429')) {
            errorMessage = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('503')) {
            errorMessage = '모델이 로딩 중입니다. 잠시 후 다시 시도해주세요.';
        }

        addMessage(errorMessage, 'bot');
    } finally {
        // UI 복구
        hideTypingIndicator();
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

// Hugging Face API 호출 함수
async function callHuggingFaceAPI(userMessage) {
    const API_URL = "https://router.huggingface.co/v1/chat/completions";

    // 대화 기록에 현재 메시지 추가
    chatHistory.push({ role: "user", content: userMessage });

    // 최근 10개 메시지만 유지 (토큰 제한 고려)
    if (chatHistory.length > 10) {
        chatHistory = chatHistory.slice(-10);
    }

    const payload = {
        model: "MLP-KTLim/llama-3-Korean-Bllossom-8B:featherless-ai",
        messages: [
            {
                role: "system",
                content: "당신은 유능한 AI 어시스턴트입니다. 사용자의 질문에 대해 친절하고 정확하게 답변해주세요. 한국어 질문에는 한국어로, 영어 질문에는 영어로 답변해주세요."
            },
            ...chatHistory
        ],
        max_tokens: 800,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
    };

    console.log("[chatbot] API 요청:", payload);

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HF_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[chatbot] API 응답 오류:", response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("[chatbot] API 응답:", data);

    // Chat Completions 응답 처리 (올바른 방식)
    if (data.error) {
        throw new Error(data.error.message || data.error);
    }

    if (!data.choices || data.choices.length === 0) {
        throw new Error('응답에서 선택지를 찾을 수 없습니다.');
    }

    const botResponse = data.choices[0].message.content.trim();

    if (!botResponse || botResponse.length < 2) {
        throw new Error('빈 응답을 받았습니다.');
    }

    // 대화 기록에 봇 응답 추가
    chatHistory.push({ role: "assistant", content: botResponse });

    return botResponse;
}

// 메시지를 채팅창에 추가하는 함수
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = text;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 타이핑 인디케이터 표시/숨김
function showTypingIndicator() {
    typingIndicator.style.display = 'block';
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}
