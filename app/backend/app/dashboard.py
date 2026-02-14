from fastapi import APIRouter

router = APIRouter(prefix="/dashboard")

@router.get("/summaries")
def summaries():
    return []
