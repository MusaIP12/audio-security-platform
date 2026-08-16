from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.convert import router as convert_router
from app.routes.classify import router as classify_router
from app.routes.files import router as files_router

app = FastAPI(title="Audio Security Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(convert_router, prefix="/api")
app.include_router(classify_router, prefix="/api")
app.include_router(files_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Audio Security Platform backend is running"}