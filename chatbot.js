(async () => {
    const MODEL_NAME = 'microsoft/DialoGPT-medium';
})();

let chatHistory = [];

// DOM 요소들
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');

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
    // 최근 5개 대화만 유지 (토큰 제한 고려)
    if (chatHistory.length > 10) {
        chatHistory = chatHistory.slice(-10);
    }

    const payload = {
        model: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B:featherless-ai",
        messages: [
            {
                role: "system",
                content: "You are a helpful AI assistant. Please provide clear and concise responses."
            },
            ...chatHistory
        ],
        max_tokens: 500,
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

    // 응답 처리
    if (data.error) {
        throw new Error(data.error.message || data.error);
    }

    let botResponse = '';
    if (Array.isArray(data) && data.length > 0) {
        botResponse = data[0].generated_text || '';

        if (botResponse.startsWith(userMessage)) {
            botResponse = botResponse.substring(userMessage.length).trim();
        }
    } else if (data.generated_text) {
        botResponse = data.generated_text.trim();
    }

    if (!botResponse || botResponse.length < 2) {
        botResponse = '죄송합니다. 응답을 생성할 수 없었습니다. 다시 시도해 주세요.';
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

// 페이지 로드 시 입력창에 포커스
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
