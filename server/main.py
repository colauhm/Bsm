from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles  # ✅ 1. 추가된 부분
from .routers import user, board

app = FastAPI()

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# # ✅ 2. 추가된 부분: '/project' URL을 실제 파일 시스템의 '/project' 폴더와 연결
# app.mount("/", StaticFiles(directory="bsm/Bsm/app", html=True), name="app")

app.include_router(board.router)
app.include_router(user.router)