from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .dashboard import router as dashboard_router
from .subscriptions import router as subscriptions_router

app = FastAPI(title="See1Right API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router)
app.include_router(subscriptions_router)

@app.get("/health")
def health():
    return {"status": "ok"}
