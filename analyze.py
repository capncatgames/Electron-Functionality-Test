import sys
import base64
import cv2
import numpy as np
import pytesseract

print("[python] analyzer.py 시작됨", flush=True)

def analyze_image(img):
    print("[python] 이미지 분석 시작", flush=True)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    count = sum(1 for c in contours if cv2.contourArea(c) > 50)

    h, w = gray.shape
    roi = gray[int(h*0.8):, int(w*0.3):int(w*0.7)]
    text = pytesseract.image_to_string(roi, config='--psm 7 digits')

    print(f"[OCR] 하얀 박스: {count}, 숫자: {text.strip()}", flush=True)

for line in sys.stdin:
    try:
        print("[python] base64 수신됨", flush=True)
        data = base64.b64decode(line.strip())
        nparr = np.frombuffer(data, np.uint8)
        if nparr.size == 0:
            print("[python] 빈 이미지 버퍼", flush=True)
            continue
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            print("[python] 디코딩 실패", flush=True)
            continue
        analyze_image(img)
    except Exception as e:
        print(f"[python] 오류 발생: {e}", flush=True)
