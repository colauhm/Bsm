# 프로젝트 목적
     fastapi로 반응형 웹 사이트 제작

# 실행 명령어
     uvicorn server.main:app --reload --host=0.0.0.0 --port=8088
     python -m http.server 80 -d ./app

     uvicorn server.main:app --reload --host=0.0.0.0 --port=8088
     python -m http.server 80 -d ./app
     
     nohup uvicorn server.main:app --host 0.0.0.0 --port 8088 &
     nohup python -m http.server 80 -d ./app &

     pkill -f "python -m http.server 80 -d ./app"
     pkill -f "uvicorn server.main:app --host 0.0.0.0 --port 8088"
## 테이블